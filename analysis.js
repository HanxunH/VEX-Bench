(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = { model: "", costGroup: "models", data: null };
  const escapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => escapeMap[char]);
  const percent = (value) => `${Math.max(0, Math.min(100, value ?? 0))}%`;
  const displayMetric = (row, key) => row.display[key] === "—" ? "—" : `${row.display[key]}%`;
  const delta = (row, key, task) => task === "rewrite" && (key === "claim" || key === "entity") && row.display[key + "Delta"] !== "—"
    ? ` <small>(${escapeHtml(row.display[key + "Delta"])} pp)</small>` : "";
  const models = () => state.data.models;
  const methods = () => state.data.methods;
  const modelLinks = new Map();
  const methodLinks = new Map();
  const identityColors = new Map();
  const modelIdentity = (id) => modelLinks.get(id);
  const methodIdentity = (id) => methodLinks.get(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function prepareIdentities() {
    for (const model of models()) {
      identityColors.set(model.id, model.color);
      const icon = window.VEX_MODEL_ICONS.get(model.id);
      const mark = `<svg class="rank-model-icon" viewBox="${escapeHtml(icon.viewBox)}" style="color:${escapeHtml(icon.color)}" aria-hidden="true">${icon.paths.map((path) => `<path d="${escapeHtml(path)}" fill="currentColor"></path>`).join("")}</svg>`;
      modelLinks.set(model.id, `<a class="analysis-identity analysis-model-link" style="--identity-color:${escapeHtml(model.color)}" href="${escapeHtml(model.website)}" target="_blank" rel="noopener" aria-label="Visit the official ${escapeHtml(model.label)} website">${mark}<span>${escapeHtml(model.label)}</span></a>`);
    }
    for (const method of methods()) {
      identityColors.set(method.id, method.color);
      const color = escapeHtml(method.color);
      const label = escapeHtml(method.label);
      methodLinks.set(method.id, method.reference
        ? `<a class="analysis-identity analysis-method-link" style="--identity-color:${color}" href="${escapeHtml(method.reference)}" target="_blank" rel="noopener" aria-label="Read the ${label} method paper"><span>${label}</span></a>`
        : `<span class="analysis-identity analysis-method-link" style="--identity-color:${color}">${label}</span>`);
    }
  }

  function trackSections() {
    const links = [...document.querySelectorAll(".analysis-nav a")];
    const sections = links.map((link) => document.querySelector(link.getAttribute("href")));
    let current = links.find((link) => link.hasAttribute("aria-current"));
    let frame = 0;
    const update = () => {
      frame = 0;
      const anchorOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) + parseFloat(getComputedStyle(sections[0]).scrollMarginTop);
      const boundary = Math.max(anchorOffset + 1, window.innerHeight * 0.3);
      let index = 0;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].getBoundingClientRect().top <= boundary) index = i;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) index = sections.length - 1;
      const next = links[index];
      if (next === current) return;
      current?.removeAttribute("aria-current");
      next.setAttribute("aria-current", "location");
      current = next;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.fonts.ready.then(schedule);
    schedule();
  }

  function heatCell(value, text, color = "var(--accent)", count = "", maximum = 100, reverse = false) {
    if (value == null) return '<td class="no-score">—</td>';
    const part = Math.max(0, Math.min(1, value / maximum));
    const strength = Math.round(7 + 27 * (reverse ? 1 - part : part));
    return `<td class="analysis-heat" style="--heat-color:${color};--heat-strength:${strength}%"><span>${escapeHtml(text)}</span>${count ? `<small>${escapeHtml(count)}</small>` : ""}</td>`;
  }
  function table(caption, headers, rows, className = "", linkedHeader) {
    return `<table class="${className}"><caption>${escapeHtml(caption)}</caption><thead><tr>${headers.map((heading, index) => `<th scope="col">${linkedHeader && index ? linkedHeader(heading) : escapeHtml(heading)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }
  function identityHeading(identity) {
    return `<th scope="row">${identity}</th>`;
  }
  function resultCell(row, key, task) {
    return `<td class="${key === "vex" ? "vex-cell" : ""}" data-metric="${key}">${escapeHtml(displayMetric(row, key))}${delta(row, key, task)}</td>`;
  }
  function resultCells(row) {
    return [
      resultCell(row, "strongReject", "overall"),
      resultCell(row, "sr", "overall"),
      resultCell(row, "vex", "overall"),
      resultCell(row, "nr", "overall"),
      ...row.display.dimensions.map((value, index) => `<td data-metric="d${index + 1}">${escapeHtml(value === "—" ? value : `${value}%`)}</td>`),
      resultCell(row, "claim", "overall"),
      resultCell(row, "entity", "overall"),
    ];
  }
  function traceOnView(cells) {
    if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reduceMotion.matches) continue;
        entry.target.querySelector(".evidence-trace").animate(
          [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0)" }],
          { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
        );
      }
    }, { threshold: 0.75 });
    for (const cell of cells) {
      const trace = document.createElement("i");
      trace.className = "evidence-trace";
      trace.setAttribute("aria-hidden", "true");
      cell.append(trace);
      observer.observe(cell);
    }
  }

  function renderMethods() {
    const overall = state.data.methodResults.overall;
    const results = [...overall].sort((a, b) => (b.vex ?? -1) - (a.vex ?? -1));
    $("method-bars").innerHTML = results.map((row) => `<div class="method-row" style="--identity-color:${escapeHtml(identityColors.get(row.method))}"><span class="method-name">${methodIdentity(row.method)}</span><span class="vex-reading"><span class="value-rail" aria-hidden="true"><i style="--fill:${percent(row.vex)}"></i></span><strong>${escapeHtml(row.display.vex)}</strong></span><span class="rate"><small>SR</small>${escapeHtml(row.display.sr)}%</span><span class="rate"><small>NR</small>${escapeHtml(row.display.nr)}%</span></div>`).join("");
    const headers = ["Method", "StrongREJECT", "SR", "VEX", "NR", "D1", "D2", "D3", "D4", "D5", "Claim support", "Entity integrity"];
    $("method-table").innerHTML = table("Both tasks · method scores (%)", headers,
      overall.map((row) => `<tr data-method="${escapeHtml(row.method)}">${identityHeading(methodIdentity(row.method))}${resultCells(row).join("")}</tr>`), "method-results-table");
    const mark = (method, metric, color = "var(--accent)") => {
      const cell = $("method-table").querySelector(`tr[data-method="${CSS.escape(method)}"] td[data-metric="${metric}"]`);
      cell.classList.add("is-method-evidence");
      cell.style.setProperty("--evidence-color", color);
      return cell;
    };
    for (const row of overall) {
      if (row.sr >= 90) {
        mark(row.method, "sr");
        mark(row.method, "vex");
      }
    }
    mark("pap", "nr");
    mark("pap", "d1", "var(--d1-color)");
    const papD5 = mark("pap", "d5", "var(--d5-color)");
    $("method-reading").innerHTML = `<li>${methodIdentity("isc")}, ${methodIdentity("disinfocap")} and ${methodIdentity("misinfoqa")} have high success rates but different VEX scores.</li><li>${methodIdentity("pap")} yields fewer scorable articles yet leads D1 and D5.</li>`;
    traceOnView([
      $("method-table").querySelector('tr[data-method="isc"] td[data-metric="vex"]'),
      $("method-table").querySelector('tr[data-method="misinfoqa"] td[data-metric="vex"]'),
      papD5,
    ]);
  }

  function taskPairCell(fabrication, rewrite, index) {
    const first = fabrication.display.dimensions[index];
    const second = rewrite.display.dimensions[index];
    return `<td class="task-compare" data-method="${escapeHtml(fabrication.method)}" data-dimension="${index + 1}" style="--dimension-color:var(--d${index + 1}-color)"><span data-task-score="fabrication"><span>Fabrication</span><strong>${escapeHtml(first === "—" ? first : `${first}%`)}</strong></span><span data-task-score="rewrite"><span>Rewrite</span><strong>${escapeHtml(second === "—" ? second : `${second}%`)}</strong></span></td>`;
  }

  function renderDimensions() {
    const fabrication = state.data.methodResults.fabrication;
    const rewriteByMethod = new Map(state.data.methodResults.rewrite.map((row) => [row.method, row]));
    const rows = fabrication.map((row) => {
      const rewrite = rewriteByMethod.get(row.method);
      return `<tr>${identityHeading(methodIdentity(row.method))}${row.dimensions.map((_, i) => taskPairCell(row, rewrite, i)).join("")}</tr>`;
    });
    $("dimension-table").innerHTML = table("Fabrication / rewrite · D1–D5 mean (%)",
      ["Method", ...state.data.dimensions.map((dimension) => dimension.key)], rows, "dimension-table");
    const focus = [{ index: 2, task: "rewrite" }, { index: 3, task: "rewrite" }, { index: 4, task: "fabrication" }]
      .map(({ index, task }) => {
        let best = null;
        for (const row of fabrication) {
          const rewrite = rewriteByMethod.get(row.method);
          const gap = task === "rewrite"
            ? rewrite.dimensions[index] - row.dimensions[index]
            : row.dimensions[index] - rewrite.dimensions[index];
          if (!(gap > 0)) continue;
          const cell = $("dimension-table").querySelector(`.task-compare[data-method="${CSS.escape(row.method)}"][data-dimension="${index + 1}"]`);
          cell.classList.add("is-evidence");
          cell.querySelector(`[data-task-score="${task}"]`).classList.add("is-evidence-value");
          if (!best || gap > best.gap) best = { method: row.method, index, gap };
        }
        return best;
      }).filter(Boolean);
    $("dimension-reading").innerHTML = "<li>Rewrite generally scores higher on source credibility (D3) and imposter legitimacy (D4).</li><li>Fabrication generally scores higher on verification cost (D5).</li>";
    traceOnView(focus.map((item) =>
      $("dimension-table").querySelector(`.task-compare[data-method="${CSS.escape(item.method)}"][data-dimension="${item.index + 1}"]`)));

  }

  function rankRows(items, identity, maximum) {
    const sorted = [...items].sort((a, b) => a.rank - b.rank);
    return `<ol class="rank-rows">${sorted.map((row, index) => `<li class="analysis-rank-item" style="--identity-color:${escapeHtml(identityColors.get(row.id))}"><span>${String(index + 1).padStart(2, "0")}</span><span class="rank-name">${identity(row.id)}</span><span class="rank-rail" aria-hidden="true"><i style="--fill:${percent((maximum + 1 - row.rank) / maximum * 100)}"></i></span><span class="rank-value">${escapeHtml(row.rankText)}<small>${row.first ? `${row.first} × #1` : "—"}</small></span></li>`).join("")}</ol>`;
  }
  function renderRanks() {
    const ranks = state.data.ranks;
    $("method-ranks").innerHTML = rankRows(ranks.methods, methodIdentity, 7);
    $("model-ranks").innerHTML = rankRows(ranks.models, modelIdentity, 7);
    const lookup = new Map(ranks.pairs.map((item) => [`${item.model}|${item.method}`, item]));
    const caption = "Mean rank across 62 settings · lower means higher burden";
    const matrix = table(caption, ["Model / method", ...methods().map((item) => item.id)],
      models().map((model) => `<tr>${identityHeading(modelIdentity(model.id))}${methods().map((method) => {
        const pair = lookup.get(`${model.id}|${method.id}`);
        return heatCell(49 - pair.rank, pair.rankText, "var(--accent)", pair.first ? `${pair.first} × #1` : "", 48);
      }).join("")}</tr>`), "rank-matrix", methodIdentity);
    $("pair-ranks").innerHTML = `<p class="rank-table-caption" aria-hidden="true">${escapeHtml(caption)}</p><div class="data-window" role="region" aria-label="Scrollable model and method mean-rank matrix" tabindex="0">${matrix}</div>`;
    $("pair-ranks").querySelector("caption").classList.add("paper-visually-hidden");
  }

  function renderModelResults() {
    const headers = ["Method", "StrongREJECT", "SR", "NR", ...state.data.dimensions.map((item) => item.key), "VEX", "Claim support", "Entity integrity"];
    $("analysis-model-link").innerHTML = modelIdentity(state.model);
    for (const task of ["fabrication", "rewrite"]) {
      const rows = state.data.pairResults[task].filter((row) => row.model === state.model);
      const top = rows.reduce((best, row) => row.vex !== null && (best === null || row.vex > best.vex) ? row : best, null);
      const summary = task === "fabrication" ? "model-summary" : "model-rewrite-summary";
      const target = task === "fabrication" ? "model-table" : "model-rewrite-table";
      $(summary).innerHTML = top
        ? `<li>For ${modelIdentity(state.model)}, ${methodIdentity(top.method)} leads at <strong>${escapeHtml(top.display.vex)}% VEX</strong>.</li><li>“—” is unscored, not zero.</li>`
        : `<li>No method produced a scorable result for ${modelIdentity(state.model)}.</li>`;
      $(target).innerHTML = table(`${task === "fabrication" ? "Fabrication" : "Rewrite"} · full model results (%)`, headers,
        rows.map((row) => `<tr>${identityHeading(methodIdentity(row.method))}${[resultCell(row, "strongReject", task), resultCell(row, "sr", task), resultCell(row, "nr", task), ...row.display.dimensions.map((value) => `<td>${escapeHtml(value === "—" ? value : `${value}%`)}</td>`), resultCell(row, "vex", task), resultCell(row, "claim", task), resultCell(row, "entity", task)].join("")}</tr>`), "model-results-table");
    }
  }

  function renderCosts() {
    const rows = state.data.costs[state.costGroup];
    const identity = state.costGroup === "models" ? modelIdentity : methodIdentity;
    const scale = 28; // US cents across generation plus the agent's LLM and search work.
    $("cost-bars").innerHTML = rows.map((row) => `<div class="cost-row"><span>${identity(row.id)}</span><span class="cost-rail" aria-hidden="true"><i class="cost-gen" style="--gen:${percent(row.generation / scale * 100)}"></i><i class="cost-llm" style="--llm:${percent(row.llm / scale * 100)}"></i><i class="cost-search" style="--search:${percent(row.search / scale * 100)}"></i></span><strong>${escapeHtml(row.display.ratio)}×</strong></div>`).join("");
    $("cost-table").innerHTML = table(`US cents per valid, non-refused article · ${state.costGroup}`, [state.costGroup === "models" ? "Target model" : "Method", "Generation ¢", "Agent LLM ¢", "Search ¢", "Agent total ¢", "Ratio"],
      rows.map((row) => `<tr>${identityHeading(identity(row.id))}${["generation", "llm", "search", "verification"].map((key) => `<td>${escapeHtml(row.display[key])}</td>`).join("")}<td class="vex-cell">${escapeHtml(row.display.ratio)}×</td></tr>`), "cost-table");
    document.querySelectorAll("[data-cost-group]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.costGroup === state.costGroup)));
  }

  async function load() {
    const status = $("analysis-status");
    status.hidden = false;
    status.textContent = "Loading benchmark results…";
    try {
      const response = await fetch("data/analysis.json?v=20260926-9");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      prepareIdentities();
      document.querySelectorAll("[data-model-identity], [data-method-identity]").forEach((node) => {
        const id = node.dataset.modelIdentity;
        node.innerHTML = id ? modelIdentity(id) : methodIdentity(node.dataset.methodIdentity);
      });
      const select = $("analysis-model");
      select.replaceChildren(...state.data.models.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.label;
        return option;
      }));
      state.model = select.value;
      select.disabled = false;
      renderMethods();
      renderDimensions();
      renderModelResults();
      renderRanks();
      renderCosts();
      window.VEX_RENDER_PAPER_FIGURES(document.querySelectorAll("figure[data-paper-figure]"), state.data, modelIdentity);
      status.hidden = true;
      trackSections();
    } catch {
      status.innerHTML = '<span>Benchmark results could not be loaded.</span> <button type="button" class="button secondary">Reload results</button>';
      status.querySelector("button").addEventListener("click", load);
    }
  }
  document.querySelectorAll("[data-cost-group]").forEach((button) => button.addEventListener("click", () => {
    if (state.costGroup === button.dataset.costGroup) return;
    state.costGroup = button.dataset.costGroup;
    if (state.data) renderCosts();
  }));
  $("analysis-model").addEventListener("change", (event) => {
    state.model = event.target.value;
    if (state.data) renderModelResults();
  });
  load();
})();
