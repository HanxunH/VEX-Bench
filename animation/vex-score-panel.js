(() => {
  const W = 900;
  const H = 520;
  const FAM = 'Study Impact';
  const BODY = 'DM Sans';
  const MONO = 'IBM Plex Mono';
  const fitCache = Object.create(null);

  function mixHex(a, b, p) {
    const n = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = n(a), B = n(b);
    const t = U.clamp(p);
    const r = Math.round(A[0] + (B[0] - A[0]) * t);
    const g = Math.round(A[1] + (B[1] - A[1]) * t);
    const bl = Math.round(A[2] + (B[2] - A[2]) * t);
    return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function rr(g, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, rad);
    else {
      g.moveTo(x + rad, y);
      g.arcTo(x + w, y, x + w, y + h, rad);
      g.arcTo(x + w, y + h, x, y + h, rad);
      g.arcTo(x, y + h, x, y, rad);
      g.arcTo(x, y, x + w, y, rad);
      g.closePath();
    }
  }

  function fillRound(g, x, y, w, h, r, color) {
    if (w <= 0 || h <= 0) return;
    g.fillStyle = color;
    rr(g, x, y, w, h, r);
    g.fill();
  }

  function strokeRound(g, x, y, w, h, r, color, lw) {
    if (w <= 0 || h <= 0) return;
    g.save();
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    rr(g, x, y, w, h, r);
    g.stroke();
    g.restore();
  }

  function isHex(s) {
    return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
  }

  function wrapLabel(s) {
    return String(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  }

  function labelOf(item, kind) {
    const s = item && (item.label || item.short);
    if (!s) throw new Error('Missing ' + kind + ' label' + (item && item.id ? ': ' + item.id : ''));
    return String(s);
  }

  function needArray(v, n, msg) {
    if (!Array.isArray(v) || (n != null && v.length !== n)) throw new Error(msg);
    return v;
  }

  function idIndex(list, id, kind) {
    const i = list.findIndex((item) => item && item.id === id);
    if (i < 0) throw new Error('Unknown ' + kind + ': ' + id);
    return i;
  }

  function finiteOrNull(v, msg) {
    if (v === undefined) throw new Error(msg);
    if (v === null) return null;
    if (!Number.isFinite(v)) throw new Error(msg);
    return v;
  }

  function fmt1(v) {
    return v === null ? '—' : v.toFixed(1);
  }

  function heat(value, P) {
    if (!Number.isFinite(value)) return mixHex(P.paper, P.ink, 0.07);
    const t = U.clamp(value / 100);
    const lo = mixHex(P.paper, P.blue, 0.78);
    const hi = mixHex(P.d1, P.blue, 0.18);
    return mixHex(lo, hi, t);
  }

  function dimColor(dim, i, P) {
    if (dim && isHex(dim.color)) return dim.color;
    return P['d' + (i + 1)] || P.ink;
  }

  function identity(color, P) {
    return isHex(color) ? mixHex(color, P.ink, 0.38) : P.ink;
  }

  function fitText(c, text, maxW, size, fam, maxLines) {
    const key = text + '\0' + maxW + '\0' + size + '\0' + fam + '\0' + maxLines;
    if (fitCache[key]) return fitCache[key];
    const min = Math.max(0.28, Math.min(0.84, 8 / size));
    let fit = TY.fit(c, text, maxW, size, fam, { maxLines, min, soft: true, balance: true });
    if (!fit.ok) {
      const spaced = wrapLabel(text);
      fit = spaced === text
        ? TY.fit(c, text, maxW, size, fam, { maxLines, min: 8 / size, balance: true })
        : TY.fit(c, spaced, maxW, size, fam, { maxLines, min: 8 / size, balance: true });
    }
    fitCache[key] = fit;
    return fit;
  }

  function resolve(lens, data, P) {
    if (!P || !P.paper || !P.ink || !P.blue || !P.white || !P.red || !P.peach || !P.marker) {
      throw new Error('Missing VEX panel palette');
    }
    if (!P.d1 || !P.d2 || !P.d3 || !P.d4 || !P.d5) throw new Error('Missing VEX panel dimension colors');
    if (!data) throw new Error('Missing VEX panel data');
    if (!lens) throw new Error('Missing VEX panel lens');
    const models = needArray(data.models, 7, 'VEX panel requires 7 models');
    const methods = needArray(data.methods, 7, 'VEX panel requires 7 methods');
    const dimensions = needArray(data.dimensions, 5, 'VEX panel requires 5 dimensions');
    models.forEach((m, i) => {
      if (!m || !m.id) throw new Error('Missing model id at ' + i);
      labelOf(m, 'model');
    });
    methods.forEach((m, i) => {
      if (!m || !m.id) throw new Error('Missing method id at ' + i);
      labelOf(m, 'method');
    });
    dimensions.forEach((d, i) => {
      if (!d || !d.key) throw new Error('Missing dimension key at ' + i);
      labelOf(d, 'dimension');
    });
    const scores = needArray(lens.scores, 7, 'VEX lens requires 7×7 scores');
    scores.forEach((row, i) => {
      needArray(row, 7, 'VEX lens row ' + i + ' is not 7 cells');
      row.forEach((v, j) => {
        if (v !== null && !Number.isFinite(v)) throw new Error('Invalid score at ' + i + ',' + j);
      });
    });
    const selected = lens.selected;
    if (!selected || typeof selected !== 'object') throw new Error('Missing selected profile');
    if (!selected.modelId) throw new Error('Missing selected modelId');
    if (!selected.methodId) throw new Error('Missing selected methodId');
    const score = finiteOrNull(selected.score, 'Invalid selected score');
    const sr = finiteOrNull(selected.sr, 'Invalid selected sr');
    const nr = finiteOrNull(selected.nr, 'Invalid selected nr');
    const raw = needArray(selected.dimensions, 5, 'Selected profile requires 5 dimension means');
    raw.forEach((v, i) => {
      if (v !== null && !Number.isFinite(v)) throw new Error('Invalid dimension mean D' + (i + 1));
    });
    const lensDims = needArray(lens.dimensions, null, 'Missing lens dimensions');
    if (!lensDims.length) throw new Error('Empty lens dimensions');
    const keys = new Set(dimensions.map((d) => d.key));
    lensDims.forEach((k) => {
      if (!keys.has(k)) throw new Error('Unknown lens dimension: ' + k);
    });
    const title = lens.label ? String(lens.label) : lensDims.join(' + ');
    return {
      models,
      methods,
      dimensions,
      scores,
      selected,
      score,
      sr,
      nr,
      raw,
      selRow: idIndex(models, selected.modelId, 'model'),
      selCol: idIndex(methods, selected.methodId, 'method'),
      lensSet: new Set(lensDims),
      title,
    };
  }

  function drawLines(c, fit, x, y, fam, color, align) {
    const lead = fit.size * 1.12;
    fit.lines.forEach((line, i) => {
      TY.text(c, line, x, y + i * lead, { size: fit.size, fam, color, align, base: 'alphabetic' });
    });
  }

  function drawMatrix(c, t, R, P, mute, line) {
    const innerL = 16;
    const innerT = 12;
    const splitX = 628;
    const matrixR = splitX - 8;
    const labelW = 126;
    const gridX = innerL + labelW;
    const gridW = matrixR - gridX;
    const gap = 3;
    const cellW = (gridW - gap * 6) / 7;
    const headY = innerT + 30;
    const headH = 40;
    const gridY = headY + headH;
    const foot = 18;
    const gridH = H - innerT - foot - gridY;
    const cellH = (gridH - gap * 6) / 7;
    const numSize = fitText(c, '88.8', cellW - 8, 13, MONO, 1).size;

    TY.text(c, 'VEX score', innerL, innerT + 20, {
      size: 18,
      fam: FAM,
      color: P.ink,
      align: 'left',
      track: -0.4,
    });
    const titleW = TY.width(c, 'VEX score', 18, FAM, -0.4);
    const lensMax = Math.max(80, matrixR - innerL - titleW - 20);
    const lensFit = fitText(c, R.title, lensMax, 12, MONO, 1);
    TY.text(c, lensFit.lines[0], matrixR, innerT + 19, {
      size: lensFit.size,
      fam: MONO,
      color: P.red,
      align: 'right',
    });

    c.save();
    c.strokeStyle = line;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(gridX, headY + headH - 1);
    c.lineTo(matrixR, headY + headH - 1);
    c.stroke();
    c.restore();

    R.methods.forEach((method, j) => {
      const x = gridX + j * (cellW + gap);
      const fit = fitText(c, labelOf(method, 'method'), cellW - 4, 10, BODY, 2);
      const block = fit.lines.length * fit.size * 1.12;
      const y0 = headY + (headH - block) / 2 + fit.size * 0.82;
      drawLines(c, fit, x + cellW / 2, y0, BODY, identity(method.color, P), 'center');
    });

    R.models.forEach((model, i) => {
      const y = gridY + i * (cellH + gap);
      const fit = fitText(c, labelOf(model, 'model'), labelW - 10, 12, BODY, 2);
      const block = fit.lines.length * fit.size * 1.12;
      const y0 = y + (cellH - block) / 2 + fit.size * 0.82;
      const ink = identity(model.color, P);
      drawLines(c, fit, innerL, y0, BODY, i === R.selRow ? P.ink : ink, 'left');
      if (i === R.selRow) TY.underline(c, innerL, y0 + 4, Math.min(labelW - 12, TY.width(c, fit.lines[0], fit.size, BODY)), MO.at(t, 0.18, 0.28), P.red, 2);
    });

    let selBox = null;
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const x = gridX + j * (cellW + gap);
        const y = gridY + i * (cellH + gap);
        const delay = 0.05 + (i * 7 + j) * 0.01;
        const p = MO.quintOut(MO.at(t, delay, 0.22));
        if (p <= 0) continue;
        const value = R.scores[i][j];
        const selected = i === R.selRow && j === R.selCol;
        if (selected) selBox = { x, y, delay };
        c.save();
        c.globalAlpha *= 0.12 + 0.88 * p;
        c.translate(x + cellW / 2, y + cellH / 2);
        c.scale(0.94 + 0.06 * p, 0.94 + 0.06 * p);
        fillRound(c, -cellW / 2, -cellH / 2, cellW, cellH, 5, heat(value, P));
        c.restore();
        const text = fmt1(value);
        c.save();
        c.globalAlpha *= p;
        c.font = TY.font(numSize, MONO);
        c.fillStyle = value === null ? mute : P.ink;
        TY.tabular(c, text, x + cellW / 2, y + cellH / 2 + numSize * 0.34, { align: 'center' });
        c.restore();
      }
    }

    if (selBox) {
      const ring = U.clamp(MO.springHz(t - selBox.delay - 0.12, 2.4, 10));
      if (ring > 0.02) {
        c.save();
        c.globalAlpha *= Math.min(1, ring);
        strokeRound(c, selBox.x - 1.5, selBox.y - 1.5, cellW + 3, cellH + 3, 7, P.red, 2.4);
        fillRound(c, selBox.x + cellW - 9, selBox.y + 3, 5, 5, 1.5, P.marker);
        c.restore();
      }
    }

    const lx = gridX + gridW - 88;
    const ly = H - innerT - 11;
    const grad = c.createLinearGradient(lx, 0, lx + 64, 0);
    grad.addColorStop(0, heat(0, P));
    grad.addColorStop(1, heat(100, P));
    fillRound(c, lx, ly - 5, 64, 8, 2, grad);
    TY.text(c, '0', lx - 6, ly + 2, { size: 10, fam: MONO, color: mute, align: 'right' });
    TY.text(c, '100', lx + 70, ly + 2, { size: 10, fam: MONO, color: mute, align: 'left' });
  }

  function drawProfile(c, t, R, P, mute, line) {
    const x = 638;
    const w = 246;
    const pad = 14;
    const cx = x + pad;
    const cw = w - pad * 2;
    const fade = MO.quintOut(MO.at(t, 0.12, 0.24));
    const barP = MO.expoOut(MO.at(t, 0.28, 0.55));

    fillRound(c, x, 12, w, H - 24, 16, mixHex(P.white, P.peach, 0.42));
    c.save();
    c.globalAlpha *= 0.22;
    c.strokeStyle = line;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, 28);
    c.lineTo(x, H - 28);
    c.stroke();
    c.restore();

    c.save();
    c.globalAlpha *= 0.25 + 0.75 * fade;
    TY.text(c, 'SELECTED PROFILE', cx, 34, { size: 10, fam: MONO, color: mixHex(P.d1 || P.ink, P.paper, 0.12), align: 'left' });

    const model = R.models[R.selRow];
    const method = R.methods[R.selCol];
    const modelFit = fitText(c, labelOf(model, 'model'), cw, 22, FAM, 2);
    drawLines(c, modelFit, cx, 58, FAM, identity(model.color, P), 'left');
    const modelBlock = modelFit.lines.length * modelFit.size * 1.12;
    const methodFit = fitText(c, labelOf(method, 'method'), cw, 13, BODY, 2);
    drawLines(c, methodFit, cx, 58 + modelBlock + 4, BODY, identity(method.color, P), 'left');
    const methodBlock = methodFit.lines.length * methodFit.size * 1.12;
    let y = 58 + modelBlock + 4 + methodBlock + 18;

    const scoreText = fmt1(R.score);
    const vexFit = fitText(c, scoreText, cw, 52, FAM, 1);
    c.font = TY.font(vexFit.size, FAM);
    c.fillStyle = P.ink;
    TY.tabular(c, scoreText, cx, y + vexFit.size * 0.78, { align: 'left' });
    TY.text(c, 'VEX / 100', cx, y + vexFit.size + 12, {
      size: 11,
      fam: MONO,
      color: mute,
      align: 'left',
    });
    y += vexFit.size + 28;

    c.strokeStyle = line;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx, y);
    c.lineTo(cx + cw, y);
    c.stroke();
    y += 22;

    const col = cw / 2;
    const srText = R.sr === null ? '—' : (R.sr * 100).toFixed(1) + '%';
    const nrText = R.nr === null ? '—' : (R.nr * 100).toFixed(1) + '%';
    c.font = TY.font(18, MONO);
    c.fillStyle = P.ink;
    TY.tabular(c, srText, cx, y, { align: 'left' });
    TY.tabular(c, nrText, cx + col, y, { align: 'left' });
    TY.text(c, 'SR · valid', cx, y + 14, { size: 10, fam: MONO, color: mute, align: 'left' });
    TY.text(c, 'NR · yield', cx + col, y + 14, { size: 10, fam: MONO, color: mute, align: 'left' });
    y += 32;
    c.beginPath();
    c.moveTo(cx, y);
    c.lineTo(cx + cw, y);
    c.stroke();
    y += 16;

    TY.text(c, 'mean 1-5', cx, y + 8, { size: 9, fam: MONO, color: mute, align: 'left' });
    y += 12;
    const remain = (H - 20) - y;
    const slot = remain / 5;
    R.dimensions.forEach((dim, i) => {
      const by = y + i * slot;
      const on = R.lensSet.has(dim.key);
      const raw = R.raw[i];
      const colr = dimColor(dim, i, P);
      const keyFit = fitText(c, dim.key, 28, 11, MONO, 1);
      TY.text(c, dim.key, cx, by + 12, { size: keyFit.size, fam: MONO, color: on ? colr : mixHex(colr, P.paper, 0.35), align: 'left' });
      const nameFit = fitText(c, labelOf(dim, 'dimension'), cw - 70, 10, BODY, 1);
      TY.text(c, nameFit.lines[0], cx + 28, by + 12, {
        size: nameFit.size,
        fam: BODY,
        color: on ? P.ink : mute,
        align: 'left',
      });
      const val = fmt1(raw);
      c.font = TY.font(12, MONO);
      c.fillStyle = on ? P.ink : mute;
      TY.tabular(c, val, cx + cw, by + 12, { align: 'right' });

      const trackY = by + 18;
      const trackH = Math.min(8, Math.max(6, slot - 26));
      fillRound(c, cx, trackY, cw, trackH, 3, mixHex(P.paper, P.ink, 0.06));
      if (raw !== null) {
        const frac = U.clamp((raw - 1) / 4);
        const fillW = Math.max(frac > 0 ? 3 : 0, cw * frac * barP);
        c.save();
        c.globalAlpha *= on ? 1 : 0.42;
        fillRound(c, cx, trackY, fillW, trackH, 3, colr);
        c.restore();
      }
    });
    c.restore();
  }

  function draw(c, elapsed, lens, data, P) {
    if (!window.TY || typeof TY.fit !== 'function' || typeof TY.text !== 'function' || typeof TY.tabular !== 'function' || typeof TY.width !== 'function') {
      throw new Error('Missing TY utilities');
    }
    if (!window.MO || typeof MO.at !== 'function' || typeof MO.quintOut !== 'function' || typeof MO.expoOut !== 'function' || typeof MO.springHz !== 'function') {
      throw new Error('Missing MO');
    }
    if (!window.U || typeof U.clamp !== 'function') throw new Error('Missing U');
    const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
    const R = resolve(lens, data, P);
    const mute = mixHex(P.ink, P.paper, 0.45);
    const line = mixHex(P.ink, P.paper, 0.16);
    const card = mixHex(P.white, P.paper, 0.28);

    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    c.clip();
    fillRound(c, 0.75, 0.75, W - 1.5, H - 1.5, 18, card);
    strokeRound(c, 1.25, 1.25, W - 2.5, H - 2.5, 17, mixHex(P.ink, P.paper, 0.12), 1.5);
    fillRound(c, 0.75, 0.75, 7, H - 1.5, 3.5, mixHex(P.peach, P.red, 0.18));
    drawMatrix(c, t, R, P, mute, line);
    drawProfile(c, t, R, P, mute, line);
    c.restore();
  }

  window.VEX_SCORE_PANEL = { draw };
})();
