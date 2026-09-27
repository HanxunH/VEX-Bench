(() => {
  "use strict";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const formatValue = (value, format) => {
    if (value == null) return "—";
    if (format === "decimal3") return value.toFixed(3);
    if (format === "decimal2") return value.toFixed(2);
    if (format === "pct0") return `${value.toFixed(0)}%`;
    return String(Math.round(value));
  };

  function matrix(panel, heading, modelIdentity) {
    const { rows, columns, values, detail, format, min, max, palette, rowLinks, modelRowIds, modelColumnIds } = panel;
    if (values.length !== rows.length || values.some((row) => row.length !== columns.length)
      || (rowLinks && (rowLinks.length !== rows.length || rowLinks.some((href) => !href)))
      || (modelRowIds && modelRowIds.length !== rows.length)
      || (modelColumnIds && modelColumnIds.length !== columns.length)) {
      throw new Error(`Incomplete figure matrix: ${heading}`);
    }
    const color = { blue: "var(--d1-color)", rose: "var(--d2-color)", purple: "var(--d3-color)" };
    const headers = columns.map((name, index) => modelColumnIds ? modelIdentity(modelColumnIds[index]) : escapeHtml(name));
    const body = rows.map((name, row) => {
      const href = rowLinks?.[row];
      const title = escapeHtml(name);
      const rowHeading = modelRowIds ? modelIdentity(modelRowIds[row])
        : href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${title}</a>` : title;
      return `<tr role="row"><th scope="row" role="rowheader">${rowHeading}</th>${values[row].map((value, col) => {
        const note = detail?.[row]?.[col];
        const content = `<span class="paper-cell-label">${headers[col]}</span><span class="paper-cell-value">${escapeHtml(formatValue(value, format))}${note ? `<small>${escapeHtml(note)}</small>` : ""}</span>`;
        if (value == null) return `<td role="cell" class="is-missing">${content}</td>`;
        const fraction = palette === "diverging"
          ? Math.min(1, Math.abs(value) / Math.max(Math.abs(min), Math.abs(max)))
          : Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
        const hue = palette === "diverging" ? (value < 0 ? "var(--d1-color)" : "var(--d4-color)") : color[palette];
        if (!hue) throw new Error(`Unknown palette: ${palette}`);
        return `<td role="cell" style="--matrix-hue:${hue};--matrix-strength:${Math.round(6 + 30 * fraction)}%">${content}</td>`;
      }).join("")}</tr>`;
    }).join("");
    return `<table class="paper-matrix" role="table"><caption class="paper-visually-hidden">${escapeHtml(heading)}</caption><thead><tr role="row"><th scope="col" role="columnheader">${escapeHtml(format === "int" ? "Mentions" : "Result")}</th>${headers.map((name) => `<th scope="col" role="columnheader">${name}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function groupedBars(panel) {
    if (panel.series.length !== 2 || panel.series.some((series) => series.values.length !== panel.categories.length)) {
      throw new Error("Incomplete real/fabricated entity composition");
    }
    return panel.categories.map((category, index) => `<div class="paper-bar-row"><strong>${escapeHtml(category)}</strong><div>${panel.series.map((series, seriesIndex) => {
      const value = series.values[index];
      const fill = Math.max(0, Math.min(100, value / panel.max * 100));
      return `<div class="paper-bar-series" style="--series-color:var(--d${seriesIndex === 0 ? 1 : 2}-color)"><span>${escapeHtml(series.name)}</span><span class="paper-bar-track" aria-hidden="true"><i style="--fill:${fill}%"></i></span><b>${escapeHtml(formatValue(value, panel.format))}</b></div>`;
    }).join("")}</div></div>`).join("");
  }

  window.VEX_RENDER_PAPER_FIGURES = (figures, data, modelIdentity) => {
    const ranks = {
      "rank_method.pdf": "method-ranks", "rank_model.pdf": "model-ranks", "rank_cells.pdf": "pair-ranks",
    };
    for (const figure of figures) {
      const name = figure.dataset.paperFigure;
      const host = figure.querySelector(".paper-chart");
      const label = figure.querySelector("figcaption").textContent.trim();
      if (!host || host.dataset.paperChart !== name) throw new Error(`Missing chart host for ${name}`);
      if (ranks[name]) {
        if (host.id !== ranks[name]) throw new Error(`Rank figure must reuse its single result host: ${name}`);
      } else {
        const result = data.figureResults?.[name];
        if (!result) throw new Error(`Missing source results for ${name}`);
        if (result.kind === "matrix") host.innerHTML = matrix(result, label, modelIdentity);
        else if (result.kind === "groupedBars") host.innerHTML = groupedBars(result);
        else throw new Error(`Unsupported paper figure type for ${name}: ${result.kind}`);
      }
      host.dataset.rendered = "true";
    }
  };
})();
