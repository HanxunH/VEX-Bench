(() => {
  "use strict";

  const content = document.getElementById("prompt-content");
  const promptStatus = document.getElementById("prompt-status");
  const judgeSelect = document.getElementById("judge-model");
  const dimensionSelect = document.getElementById("agreement-dimension");
  const matrix = document.getElementById("agreement-matrix");
  const agreementStatus = document.getElementById("agreement-status");
  const modelIcon = document.getElementById("judge-model-icon");
  const judgeIcons = {
    gpt52: "assets/judge-openai.svg",
    gemini31: "assets/judge-gemini.svg",
    opus47: "assets/judge-anthropic.svg",
  };

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function judgeMark(id, size = 16) {
    const icon = node(
      "img",
      `judge-mark${id === "gemini31" ? "" : " is-monochrome"}`,
    );
    icon.src = judgeIcons[id];
    icon.alt = "";
    icon.width = size;
    icon.height = size;
    return icon;
  }

  function appendRaterLabel(header, rater) {
    if (!judgeIcons[rater.id]) {
      header.textContent = rater.label;
      return;
    }
    const label = node("span", "agreement-rater-heading");
    label.append(judgeMark(rater.id), document.createTextNode(rater.label));
    header.append(label);
  }
  let copyLabelTimer;

  async function copyText(text, button) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      try {
        input.select();
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        input.remove();
        button.focus({ preventScroll: true });
      }
    }
    clearTimeout(copyLabelTimer);
    button.textContent = copied ? "Copied" : "Copy failed";
    button.dataset.copyState = copied ? "success" : "error";
    promptStatus.textContent = copied
      ? "Prompt copied to clipboard."
      : "Prompt could not be copied. Select the text and copy it manually.";
    copyLabelTimer = setTimeout(() => {
      button.textContent = "Copy prompt";
      delete button.dataset.copyState;
    }, 1800);
  }

  function renderPrompt(prompt, judge) {
    const details = node("details", "prompt-card");
    details.open = true;
    const summary = node("summary");
    const title = node("span", "prompt-card-title");
    title.append(
      judgeMark(judge.id, 22),
      document.createTextNode(`${judge.label} · Evaluation prompt`),
    );
    summary.append(title);
    const wrap = node("div", "prompt-code-wrap");
    const toolbar = node("div", "prompt-code-toolbar");
    const button = node("button", "prompt-copy", "Copy prompt");
    button.type = "button";
    button.addEventListener("click", () => copyText(prompt.text, button));
    toolbar.append(
      node("span", "prompt-line-count", `${prompt.text.trimEnd().split("\n").length} lines`),
      button,
    );
    const pre = node("pre");
    pre.tabIndex = 0;
    pre.setAttribute("role", "region");
    pre.setAttribute("aria-label", `${judge.label} evaluation prompt text`);
    pre.append(node("code", "", prompt.text));
    wrap.append(toolbar, pre);
    details.append(summary, wrap);
    return details;
  }

  function renderPrompts(data) {
    const judges = data.judges;
    judgeSelect.replaceChildren(...judges.map((judge) => {
      const option = node("option", "", judge.label);
      option.value = judge.id;
      return option;
    }));
    judgeSelect.value = "gpt52";
    judgeSelect.disabled = false;

    function showSelected() {
      const judge = judges.find((item) => item.id === judgeSelect.value);
      if (!judge) return;
      modelIcon.src = judgeIcons[judge.id];
      modelIcon.classList.toggle("is-monochrome", judge.id !== "gemini31");
      const section = node("section", "prompt-judge");
      section.append(...judge.prompts.map((prompt) => renderPrompt(prompt, judge)));
      content.replaceChildren(section);
      promptStatus.textContent = `Showing the ${judge.label} VEX-Bench prompt.`;
    }

    judgeSelect.addEventListener("change", showSelected);
    showSelected();
  }

  function renderAgreement(data) {
    const raterOrder = ["human1", "human2", "gpt52", "gemini31", "opus47"];
    const raterById = new Map(data.raters.map((rater) => [rater.id, rater]));
    const raters = raterOrder.map((id) => raterById.get(id));
    const pairByRaters = new Map();
    data.pairs.forEach((pair) => {
      pairByRaters.set(`${pair.a}:${pair.b}`, pair);
      pairByRaters.set(`${pair.b}:${pair.a}`, pair);
    });
    const meanOption = node("option", "", "Mean · D1–D5");
    meanOption.value = "mean";
    dimensionSelect.replaceChildren(
      meanOption,
      ...data.dimensions.map((dimension) => {
        const option = node("option", "", dimension.label);
        option.value = dimension.key;
        return option;
      }),
    );
    dimensionSelect.disabled = false;

    function showDimension() {
      const selected = dimensionSelect.value;
      const index = data.dimensions.findIndex((dim) => dim.key === selected);
      const label = index < 0 ? "Mean across D1–D5" : data.dimensions[index].label;
      const table = node("table", "agreement-table");
      table.append(node("caption", "sr-only", `${label}: pairwise ordinal Krippendorff alpha`));
      const thead = node("thead");
      const groups = node("tr", "agreement-groups");
      const groupCorner = node("td");
      groupCorner.setAttribute("aria-hidden", "true");
      const humans = node("th", "", "Human annotators");
      humans.scope = "colgroup";
      humans.colSpan = 2;
      const models = node("th", "", "Model judges");
      models.scope = "colgroup";
      models.colSpan = 3;
      groups.append(groupCorner, humans, models);
      const header = node("tr");
      const corner = node("th", "", "Rater");
      corner.scope = "col";
      header.append(corner);
      raters.forEach((rater) => {
        const th = node("th");
        th.scope = "col";
        appendRaterLabel(th, rater);
        header.append(th);
      });
      thead.append(groups, header);
      const tbody = node("tbody");
      raters.forEach((rater) => {
        const row = node("tr");
        const th = node("th", "agreement-rater");
        th.scope = "row";
        appendRaterLabel(th, rater);
        row.append(th);
        raters.forEach((other) => {
          const cell = node("td");
          if (rater.id === other.id) {
            cell.className = "agreement-self";
            cell.textContent = "—";
          } else {
            const pair = pairByRaters.get(`${rater.id}:${other.id}`);
            const value = index < 0 ? pair.mean : pair.alpha[index];
            const n = index < 0 ? Math.min(...pair.n) : pair.n[index];
            cell.className = value >= 0.8
              ? "agreement-reliable"
              : value >= 0.667
                ? "agreement-tentative"
                : "agreement-low";
            cell.textContent = value.toFixed(3).replace(/^0/, "");
            cell.setAttribute("aria-label",
              `${rater.label} and ${other.label}: α ${value.toFixed(3)}, ${n} articles`);
          }
          row.append(cell);
        });
        tbody.append(row);
      });
      table.append(thead, tbody);
      matrix.replaceChildren(table);
      agreementStatus.textContent = `${label} pairwise agreement shown.`;
    }

    dimensionSelect.addEventListener("change", showDimension);
    showDimension();
  }

  function loadJson(path) {
    return fetch(path).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  }

  loadJson("data/judge_prompts.json?v=20260926-2")
    .then(renderPrompts)
    .catch((error) => {
      content.replaceChildren(node("p", "loading-message",
        `VEX-Bench prompts could not be loaded: ${error.message}`));
    });
  loadJson("data/judge_alignment.json?v=20260926-1")
    .then(renderAgreement)
    .catch((error) => {
      matrix.replaceChildren(node("p", "loading-message",
        `Pairwise agreement could not be loaded: ${error.message}`));
    });
})();
