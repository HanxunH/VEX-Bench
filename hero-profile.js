(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  function svgNode(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    return node;
  }
  function radarAnnotation({
    x,
    y,
    code,
    name,
    note,
    maxNameLength = Infinity,
    codeX = x,
    codeY = y,
    codeColor = "var(--radar-line)",
  }) {
    const group = svgNode("g", {});
    const heading = svgNode(
      "text",
      {
        x: codeX,
        y: codeY,
        fill: codeColor,
        "font-family": "IBM Plex Mono, monospace",
        "font-size": 19,
        "font-weight": 600,
        "text-anchor": "middle",
      },
      code,
    );

    const lines = [];
    for (const word of name.split(/\s+/)) {
      const last = lines.length - 1;
      if (last >= 0 && lines[last].length + word.length + 1 <= maxNameLength)
        lines[last] += ` ${word}`;
      else lines.push(word);
    }
    const title = svgNode("text", {
      fill: "var(--radar-label)",
      "font-family": "DM Sans, sans-serif",
      "font-size": 21,
      "font-weight": 600,
      "text-anchor": "middle",
    });
    lines.forEach((line, i) => {
      title.append(
        svgNode("tspan", { x, y: y + 26 + i * 24 }, `${i ? " " : ""}${line}`),
      );
    });
    group.append(
      heading,
      title,
      svgNode(
        "text",
        {
          x,
          y: y + 26 + lines.length * 24,
          fill: "var(--radar-label)",
          "font-family": "DM Sans, sans-serif",
          "font-size": 14,
          "text-anchor": "middle",
        },
        note,
      ),
    );
    return group;
  }
  const profileDimensions = window.VEX_DATA?.dimensions || [];
  const methodReferences = new Map(
    (window.VEX_DATA?.methods || []).map((method) => [
      method.id,
      method.reference,
    ]),
  );
  const modelMetadata = new Map(
    (window.VEX_DATA?.models || []).map((model) => [model.id, model]),
  );
  const modelIcons = window.VEX_MODEL_ICONS;
  const formatProfilePercent = (value) =>
    Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : "—";
  function drawRadar(profile) {
    const svg = $("hero-radar");
    const card = svg.closest(".hero-profile");
    card.style.setProperty("--profile-model-color", profile.modelColor);
    card.style.setProperty("--profile-method-color", profile.methodColor);
    svg.replaceChildren();
    const cx = 320,
      cy = 215,
      r = 120;
    const dimensionPercentages = profile.dimensions.map((value) =>
      Number.isFinite(value) ? 100 * ((value - 1) / 4) : NaN,
    );
    const point = (i, radius) => [
      cx + Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 5) * radius,
      cy + Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 5) * radius,
    ];
    const points = (radius) =>
      Array.from({ length: 5 }, (_, i) => point(i, radius).join(",")).join(" ");
    svg.append(
      svgNode(
        "title",
        {},
        `Verification complexity profile: ${profile.label} · ${profile.methodLabel} · ${profile.taskLabel}`,
      ),
    );
    svg.append(
      svgNode(
        "desc",
        {},
        `Outline and upper-left background: ${profile.label}. Fill and lower-right background: ${profile.methodLabel}. Task: ${profile.taskLabel}. SR: ${formatProfilePercent(profile.sr)}. NR: ${formatProfilePercent(profile.nr)}. Each radar axis runs from 0 to 100 and shows 100 × (D−1)/4. VEX combines the mean dimension percentage with SR and NR. ` +
          profile.dimensions
            .map(
              (d, i) =>
                `${profileDimensions[i].short} ${profileDimensions[i].label}: raw ${Number.isFinite(d) ? d.toFixed(2) : "unavailable"}, plotted ${Number.isFinite(dimensionPercentages[i]) ? `${dimensionPercentages[i].toFixed(2)}%` : "unavailable"}. ${profileDimensions[i].description}`,
            )
            .join("; "),
      ),
    );
    for (let ring = 1; ring <= 5; ring++)
      svg.append(
        svgNode("polygon", {
          points: points((r * ring) / 5),
          fill: "none",
          stroke: "var(--radar-grid)",
          "stroke-width": ring === 5 ? 1.2 : 0.8,
        }),
      );
    for (let i = 0; i < 5; i++) {
      const p = point(i, r);
      svg.append(
        svgNode("line", {
          x1: cx,
          y1: cy,
          x2: p[0],
          y2: p[1],
          stroke: "var(--radar-grid)",
          "stroke-width": 0.8,
        }),
      );
    }
    const allAvailable = dimensionPercentages.every(Number.isFinite);
    if (allAvailable) {
      const shape = dimensionPercentages
        .map((value, i) => point(i, (r * value) / 100).join(","))
        .join(" ");
      svg.append(
        svgNode("polygon", {
          points: shape,
          fill: "var(--profile-method-color)",
          "fill-opacity": 0.22,
          stroke: "var(--profile-model-color)",
          "stroke-width": 2.6,
          "stroke-linejoin": "round",
        }),
      );
      for (let i = 0; i < 5; i++) {
        const p = point(i, (r * dimensionPercentages[i]) / 100);
        svg.append(
          svgNode("circle", {
            cx: p[0],
            cy: p[1],
            r: 3.4,
            fill: "var(--profile-model-color)",
            stroke: "var(--brand)",
            "stroke-width": 1.6,
          }),
        );
      }
    }
    const labelPositions = [
      { x: 320, y: -1, codeX: 320, codeY: 82 },
      { x: 545, y: 114, codeX: 458, codeY: 198 },
      { x: 535, y: 235, codeX: 410, codeY: 326 },
      { x: 105, y: 235, codeX: 230, codeY: 326 },
      { x: 95, y: 114, codeX: 182, codeY: 198 },
    ];
    profileDimensions.forEach((dimension, i) => {
      const position = labelPositions[i];
      svg.append(
        radarAnnotation({
          ...position,
          code: dimension.short,
          codeColor: `var(--d${i + 1}-color)`,
          name: dimension.label,
          note: dimension.description,
          maxNameLength: 18,
        }),
      );
    });
    svg.append(
      radarAnnotation({
        x: 185,
        y: 365,
        code: "SR",
        name: "Elicitation Success Rate",
        note: "",
      }),
      radarAnnotation({
        x: 455,
        y: 365,
        code: "NR",
        name: "Non-Refusal Rate",
        note: "",
      }),
    );
    for (const [x, value] of [
      [185, profile.sr],
      [455, profile.nr],
    ]) {
      const width = 118;
      const start = x - 72;
      const progress = Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : 0;
      const percentage = Number.isFinite(value)
        ? `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`
        : "—";
      svg.append(
        svgNode("rect", {
          x: start,
          y: 411,
          width,
          height: 8,
          rx: 4,
          fill: "var(--radar-grid)",
          "aria-hidden": "true",
        }),
        svgNode("rect", {
          x: start,
          y: 411,
          width: width * progress,
          height: 8,
          rx: 4,
          fill: "var(--radar-line)",
          "aria-hidden": "true",
        }),
        svgNode(
          "text",
          {
            x: start + width + 9,
            y: 419,
            fill: "var(--radar-label)",
            "font-family": "IBM Plex Mono, monospace",
            "font-size": 13,
            "font-weight": 500,
            "text-anchor": "start",
          },
          percentage,
        ),
      );
    }
    $("hero-vex").textContent = Number.isFinite(profile.vex)
      ? profile.vex.toFixed(1)
      : "—";
    const modelLabel = $("hero-profile-label");
    const modelLink = $("hero-model-link");
    const modelIcon = $("hero-model-icon");
    const model = modelMetadata.get(profile.model);
    const icon = modelIcons.get(profile.model);
    modelLabel.textContent = profile.label;
    modelLabel.title = profile.label;
    if (model?.website) {
      modelLink.href = model.website;
      modelLink.title = `Visit the official ${profile.label} website`;
      modelLink.setAttribute(
        "aria-label",
        `Visit the official ${profile.label} website`,
      );
    }
    if (icon) {
      modelIcon.setAttribute("viewBox", icon.viewBox);
      modelIcon.style.color = icon.color;
      modelIcon.replaceChildren(
        ...icon.paths.map((d) => svgNode("path", { d, fill: "currentColor" })),
      );
    }
    const methodLink = $("hero-profile-method");
    const referenceUrl = methodReferences.get(profile.method);
    methodLink.textContent = profile.methodLabel;
    methodLink.title = profile.methodLabel;
    if (referenceUrl) {
      methodLink.href = referenceUrl;
      methodLink.title = `Read the ${profile.methodLabel} reference paper`;
      methodLink.setAttribute(
        "aria-label",
        `Read the ${profile.methodLabel} reference paper`,
      );
    } else {
      methodLink.removeAttribute("href");
      methodLink.removeAttribute("aria-label");
    }
    $("hero-profile-task").textContent = profile.taskLabel;
    $("hero-profile-task").title = profile.taskLabel;
  }
  const modelProfiles = window.VEX_MODEL_PROFILES;
  if (modelProfiles?.length) {
    const rotationButton = $("profile-rotation");
    const byModel = new Map();
    for (const profile of modelProfiles) {
      if (!byModel.has(profile.model)) byModel.set(profile.model, []);
      byModel.get(profile.model).push(profile);
    }
    const modelGroups = [...byModel.values()];
    let modelIndex = Math.max(
      0,
      modelGroups.findIndex((group) =>
        group.some((profile) => profile.initial),
      ),
    );
    let currentProfile =
      modelGroups[modelIndex].find((profile) => profile.initial) ||
      modelGroups[modelIndex][0];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let paused = reducedMotion.matches;
    let visible = false;
    let rotationTimer = null;
    drawRadar(currentProfile);
    rotationButton.disabled = modelGroups.length < 2;

    function updateRotationButton() {
      rotationButton.setAttribute("aria-pressed", String(paused));
      const action = paused ? "Resume" : "Pause";
      rotationButton.setAttribute("aria-label", `${action} profile rotation`);
      rotationButton.title = `${action} profile rotation`;
    }

    function syncRotation() {
      clearInterval(rotationTimer);
      rotationTimer = null;
      if (!paused && visible && !document.hidden && modelGroups.length > 1) {
        rotationTimer = setInterval(() => {
          const offset =
            1 + Math.floor(Math.random() * (modelGroups.length - 1));
          modelIndex = (modelIndex + offset) % modelGroups.length;
          const choices = modelGroups[modelIndex];
          currentProfile = choices[Math.floor(Math.random() * choices.length)];
          drawRadar(currentProfile);
        }, 5000);
      }
    }

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncRotation();
    }).observe($("hero-radar"));
    rotationButton.addEventListener("click", () => {
      paused = !paused;
      updateRotationButton();
      syncRotation();
    });
    reducedMotion.addEventListener("change", (event) => {
      if (event.matches) {
        paused = true;
        updateRotationButton();
      }
      syncRotation();
    });
    document.addEventListener("visibilitychange", syncRotation);
    updateRotationButton();
    syncRotation();
  } else {
    $("profile-rotation").title = "Profile rotation unavailable";
    $("profile-rotation").setAttribute(
      "aria-label",
      "Profile rotation unavailable",
    );
  }
})();
