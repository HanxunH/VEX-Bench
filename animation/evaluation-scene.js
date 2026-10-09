(() => {
  const W = 1600;
  const H = 900;
  const FAM = 'Study Impact';
  const SANS = 'DM Sans';
  const MONO = 'IBM Plex Mono';
  const Y_MAX = 750;
  const Y_HARD = 766;
  const COUNT_KEYS = ['models', 'methods', 'tasks', 'domains', 'topics', 'conditions'];
  const FACTOR_META = [
    { key: 'models', word: 'models' },
    { key: 'methods', word: 'methods' },
    { key: 'tasks', word: 'tasks' },
    { key: 'topics', word: 'topics' },
  ];
  const SELECTED_DIMS = [
    { key: 'D1', colorKey: 'd1' },
    { key: 'D2', colorKey: 'd2' },
    { key: 'D3', colorKey: 'd3' },
    { key: 'D4', colorKey: 'd4' },
    { key: 'D5', colorKey: 'd5' },
  ];
  const cache = {};

  function mixHex(a, b, p) {
    const n = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = n(a), B = n(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * p);
    const g = Math.round(A[1] + (B[1] - A[1]) * p);
    const bl = Math.round(A[2] + (B[2] - A[2]) * p);
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
    rr(g, x, y, w, h, r);
    g.stroke();
    g.restore();
  }

  function disk(g, x, y, r, color) {
    if (r <= 0) return;
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  function stipple(g, w, h, seed, dens) {
    const r = U.rng(seed);
    const base = dens == null ? 0.14 : dens;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const fall = base + 0.5 * U.clamp(y / h);
        if (r() < fall * 0.18) {
          g.fillStyle = r() < 0.58 ? 'rgba(0,15,70,0.10)' : 'rgba(255,255,255,0.14)';
          g.fillRect(x, y, 2, 2);
        }
      }
    }
    g.restore();
  }

  function grain(P) {
    const key = 'eval:grain:' + P.paper + P.ink;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(W + 40, H + 40);
    const g = cv.getContext('2d');
    g.fillStyle = P.paper;
    g.fillRect(0, 0, cv.width, cv.height);
    const r = U.rng(23);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let y = 0; y < cv.height; y += 2) {
      for (let x = 0; x < cv.width; x += 2) {
        if (r() < 0.11) {
          g.fillStyle = r() < 0.55 ? 'rgba(0,15,70,0.04)' : 'rgba(255,255,255,0.06)';
          g.fillRect(x, y, 2, 2);
        }
      }
    }
    cache[key] = cv;
    return cv;
  }

  function bgWorld(P) {
    const key = 'eval:bg:' + P.paper + P.peach + P.blue;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(W + 40, H + 40);
    const g = cv.getContext('2d');
    g.translate(20, 20);
    g.fillStyle = P.peach;
    g.beginPath();
    g.ellipse(220, 640, 280, 150, -0.16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.red, 0.18);
    g.beginPath();
    g.ellipse(180, 670, 120, 64, 0.36, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.blue;
    g.beginPath();
    g.ellipse(1380, 210, 260, 176, 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.blue, P.ink, 0.12);
    g.beginPath();
    g.ellipse(1440, 268, 104, 74, -0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.marker, 0.32);
    g.beginPath();
    g.ellipse(820, 710, 300, 80, 0.02, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.blue, P.white, 0.18);
    g.beginPath();
    g.ellipse(900, 390, 190, 120, -0.32, 0, Math.PI * 2);
    g.fill();
    stipple(g, cv.width, cv.height, 41, 0.15);
    cache[key] = cv;
    return cv;
  }

  function plate(w, h, fill, P, seed) {
    const key = 'eval:plate:' + w + ':' + h + ':' + fill + ':' + seed;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(w + 18, h + 18);
    const g = cv.getContext('2d');
    fillRound(g, 10, 12, w, h, 20, mixHex(fill, P.ink, 0.16));
    fillRound(g, 2, 2, w, h, 20, fill);
    stipple(g, cv.width, cv.height, 90 + seed, 0.09);
    cache[key] = cv;
    return cv;
  }

  function warmFill(c, x, y, text, size, fam) {
    const w = TY.width(c, text, size, fam);
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#bd294c');
    g.addColorStop(0.42, '#d95d21');
    g.addColorStop(0.72, 'rgb(187.24 102.92 12.54)');
    g.addColorStop(1, '#a96d00');
    return g;
  }

  function scanQ(st, period, dur) {
    if (st < dur) return U.clamp(st / dur);
    return 0.92 + 0.08 * Math.cos((st - dur) * Math.PI * 2 / period);
  }

  function quadPts(a, ctrl, b, n) {
    const o = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      o.push([
        u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
        u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1],
      ]);
    }
    return o;
  }

  function along(pts, p) {
    const q = U.clamp(p);
    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d);
      total += d;
    }
    let remain = total * q;
    let x = pts[0][0], y = pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const d = seg[i - 1];
      if (remain >= d) {
        x = pts[i][0];
        y = pts[i][1];
        remain -= d;
      } else {
        const k = d ? remain / d : 0;
        x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k;
        y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
        break;
      }
    }
    return [x, y, total];
  }

  function strokePartial(c, pts, p, color, lw) {
    if (p <= 0) return along(pts, 0);
    const q = U.clamp(p);
    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      seg.push(d);
      total += d;
    }
    let remain = total * q;
    c.save();
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const d = seg[i - 1];
      if (remain >= d) {
        c.lineTo(pts[i][0], pts[i][1]);
        remain -= d;
      } else {
        const k = d ? remain / d : 0;
        c.lineTo(
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k,
        );
        break;
      }
    }
    c.stroke();
    c.restore();
    return along(pts, q);
  }

  function routeDot(c, pts, p, st, P) {
    if (p <= 0) return;
    const deep = mixHex(P.red, P.ink, 0.28);
    strokePartial(c, pts, p, deep, 11);
    const end = strokePartial(c, pts, p, P.red, 6);
    disk(c, end[0], end[1], 5.5, P.red);
    if (p >= 0.995) {
      const u = (st * 0.22) % 1;
      const pos = along(pts, u);
      disk(c, pos[0], pos[1], 6.2, P.red);
      disk(c, pos[0], pos[1], 2.6, P.white);
    }
  }

  function needBenchmark(A) {
    const b = A && A.benchmark;
    if (!b) throw new Error('Missing A.benchmark');
    const counts = b.counts;
    if (!counts || typeof counts !== 'object') throw new Error('Missing A.benchmark.counts');
    for (let i = 0; i < COUNT_KEYS.length; i++) {
      const key = COUNT_KEYS[i];
      const v = counts[key];
      if (!Number.isFinite(v) || v <= 0) throw new Error('Missing A.benchmark.counts.' + key);
    }
    const product = counts.models * counts.methods * counts.tasks * counts.topics;
    if (product !== counts.conditions) {
      throw new Error('A.benchmark.counts product mismatch');
    }
    const domains = b.domains;
    if (!Array.isArray(domains) || domains.length !== counts.domains) {
      throw new Error('Missing A.benchmark.domains');
    }
    const labels = [];
    for (let i = 0; i < domains.length; i++) {
      const row = domains[i];
      const label = row && (row.label || row.name);
      if (!label) throw new Error('Missing A.benchmark.domains label');
      labels.push(String(label));
    }
    const srcDims = Array.isArray(b.dimensions) ? b.dimensions : null;
    const dimensions = SELECTED_DIMS.map((d, i) => {
      const src = srcDims && srcDims[i];
      return {
        key: (src && src.key) || d.key,
        color: (src && src.color) || null,
        colorKey: d.colorKey,
      };
    });
    return { counts, domainLabels: labels, dimensions };
  }

  function fmtCount(n) {
    return TY.fmt(n, 0, true);
  }

  function dimColor(P, dim, i) {
    if (dim.color && /^#[0-9a-fA-F]{6}$/.test(dim.color)) return dim.color;
    return P[dim.colorKey] || P['d' + (i + 1)];
  }

  function drawLines(g, x, y, w, spans, color, h) {
    for (let i = 0; i < spans.length; i++) {
      fillRound(g, x, y + i * (h + 7), w * spans[i], h, 3, color);
    }
  }

  function drawFabGlyph(g, x, y, w, h, P) {
    fillRound(g, x, y, w, h, 14, P.white);
    strokeRound(g, x, y, w, h, 14, mixHex(P.ink, P.paper, 0.18), 1.5);
    const pad = 16;
    fillRound(g, x + pad, y + 14, w * 0.42, 8, 4, mixHex(P.peach, P.red, 0.22));
    fillRound(g, x + pad, y + 30, w * 0.62, 7, 3, mixHex(P.blue, P.ink, 0.12));
    g.save();
    g.strokeStyle = mixHex(P.ink, P.paper, 0.42);
    g.lineWidth = 1.6;
    g.setLineDash([4, 4]);
    rr(g, x + w - pad - 36, y + 12, 36, 28, 6);
    g.stroke();
    g.restore();
    drawLines(g, x + pad, y + 52, w - pad * 2, [0.92, 0.74, 0.86, 0.58, 0.8, 0.46], P.blue, 7);
  }

  function drawRewGlyph(g, x, y, w, h, P, nudge) {
    fillRound(g, x + 10, y + 10, w - 8, h - 8, 14, mixHex(P.blue, P.paper, 0.12));
    fillRound(g, x, y, w - 8, h - 8, 14, P.white);
    strokeRound(g, x, y, w - 8, h - 8, 14, mixHex(P.ink, P.paper, 0.18), 1.5);
    const pad = 16;
    fillRound(g, x + pad, y + 12, 40, 30, 6, mixHex(P.peach, P.red, 0.18));
    fillRound(g, x + pad + 6, y + 16, 12, 10, 2, mixHex(P.blue, P.ink, 0.16));
    fillRound(g, x + pad + 22, y + 16, 12, 10, 2, mixHex(P.blue, P.ink, 0.1));
    fillRound(g, x + pad + 6, y + 28, 28, 8, 2, P.blue);
    fillRound(g, x + pad + 52, y + 16, (w - 8 - pad * 2 - 52) * 0.84, 8, 4, mixHex(P.blue, P.ink, 0.12));
    fillRound(g, x + pad + 52, y + 30, (w - 8 - pad * 2 - 52) * 0.56, 7, 3, P.blue);
    const spans = [0.9, 0.7, 0.82, 0.5, 0.76];
    for (let i = 0; i < spans.length; i++) {
      const yy = y + 54 + i * 14 + (i % 2 === 0 ? -nudge : nudge);
      fillRound(g, x + pad, yy, (w - 8 - pad * 2) * spans[i], 7, 3, i < 2 ? mixHex(P.blue, P.ink, 0.12) : P.blue);
    }
  }

  function drawTaskCard(g, x, y, w, h, kind, title, P, st) {
    const fill = kind === 'fab' ? mixHex(P.white, P.peach, 0.42) : mixHex(P.white, P.blue, 0.5);
    const pl = plate(w, h, fill, P, kind === 'fab' ? 11 : 12);
    g.drawImage(pl, x - 2, y - 2);
    TY.text(g, title, x + 22, y + 36, {
      size: 24,
      fam: FAM,
      color: P.ink,
      align: 'left',
      track: -0.5,
    });
    const gx = x + 18;
    const gy = y + 52;
    const gw = w - 36;
    const gh = h - 70;
    if (kind === 'fab') drawFabGlyph(g, gx, gy, gw, gh, P);
    else drawRewGlyph(g, gx, gy, gw, gh, P, 3.2 * Math.sin(st * 0.7));
  }

  function drawPips(g, n, x, y, P, kind) {
    if (kind === 'tasks') {
      const gap = 18;
      const size = 16;
      const total = n * size + (n - 1) * gap;
      let px = x - total / 2;
      for (let i = 0; i < n; i++) {
        const col = i === 0 ? mixHex(P.peach, P.red, 0.2) : mixHex(P.blue, P.ink, 0.12);
        fillRound(g, px, y - size / 2, size, size, 4, col);
        px += size + gap;
      }
      return;
    }
    if (kind === 'topics') {
      const cols = n === 60 ? 10 : Math.max(1, Math.ceil(Math.sqrt(n)));
      const rows = Math.max(1, Math.ceil(n / cols));
      const cw = 6, ch = 4, gx = 2, gy = 2;
      const tw = cols * cw + (cols - 1) * gx;
      const th = rows * ch + (rows - 1) * gy;
      const x0 = x - tw / 2;
      const y0 = y - th / 2;
      let k = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (k >= n) return;
          fillRound(g, x0 + c * (cw + gx), y0 + r * (ch + gy), cw, ch, 1.2, mixHex(P.ink, P.paper, 0.22));
          k += 1;
        }
      }
      return;
    }
    const r = 4.2;
    const gap = 11;
    const total = (n - 1) * gap;
    let px = x - total / 2;
    for (let i = 0; i < n; i++) {
      disk(g, px, y, r, mixHex(P.ink, P.paper, 0.28));
      px += gap;
    }
  }

  function accessibleCopy(b) {
    const c = b.counts;
    return (
      'Benchmark for evaluation. Two parallel task categories, Fabrication and Rewrite — not a sequence and not generation instructions. ' +
      'Controlled comparison of ' + c.models + ' models × ' + c.methods + ' methods × ' + c.tasks + ' tasks × ' + c.topics +
      ' topics = ' + fmtCount(c.conditions) + ' conditions, across ' + c.domains + ' domains (' + b.domainLabels.join(', ') + '). ' +
      'Outputs a five-dimension profile plus VEX. ' + fmtCount(c.conditions) +
      ' counts designed conditions, not validated successes or truth results.'
    );
  }

  function draw(c, lt, t, A, P) {
    void t;
    const b = needBenchmark(A);
    const counts = b.counts;
    const st = MO.step(lt, 12);
    const mute = mixHex(P.ink, P.paper, 0.38);
    const local = Number.isFinite(lt) ? lt : 0;

    c.save();
    c.fillStyle = P.paper;
    c.fillRect(0, 0, W, H);
    c.translate(MO.float(local, 5.2, 5.4, 0.18), MO.float(local, 3.8, 4.8, 1.25));
    c.drawImage(grain(P), -20, -20);
    c.drawImage(bgWorld(P), -20, -20);

    const title = 'BENCHMARK';
    const sub = 'EVALUATION';
    const titleSize = 76;
    TY.slam(c, title, 80, 122, local + 0.08, {
      size: titleSize,
      fam: FAM,
      color: P.ink,
      align: 'left',
      track: titleSize * -0.03,
    });
    const titleW = TY.width(c, title, titleSize, FAM, titleSize * -0.03);
    TY.underline(c, 80, 134, titleW, MO.at(st, 0.22, 0.36), P.red, 6);
    const subSize = 44;
    const subW = TY.width(c, sub, subSize, FAM, subSize * -0.024);
    TY.marker(c, 72, 176 - subSize * 0.84, subW + 18, subSize * 1.02, MO.at(st, 0.28, 0.32), P.marker, 0.16);
    const warm = warmFill(c, 80, 176, sub, subSize, FAM);
    TY.slam(c, sub, 80, 176, local - 0.12, {
      size: subSize,
      fam: FAM,
      color: warm,
      align: 'left',
      track: subSize * -0.024,
    });
    CL.highlight(c, 80, 86, titleW, 40, scanQ(st, 3.2, 0.9), 'rgba(228,214,59,0.42)');

    const cardW = 328;
    const cardH = 248;
    const cardY = 214;
    const groupP = MO.quintOut(MO.at(local, 0.28, 0.28));
    if (groupP > 0.01) {
      c.save();
      c.globalAlpha = 0.7 * groupP;
      c.drawImage(plate(688, 272, mixHex(P.white, P.peach, 0.28), P, 9), 70, 202);
      c.restore();
    }
    CL.slideIn(c, local, 0.2, 80, cardY, 0, (g) => {
      drawTaskCard(g, 0, 0, cardW, cardH, 'fab', 'Fabrication', P, st);
    }, { from: [-130, 18], tilt: 0.05, dur: 0.5, fps: 12 });
    CL.slideIn(c, local, 0.2, 424, cardY, 0, (g) => {
      drawTaskCard(g, 0, 0, cardW, cardH, 'rew', 'Rewrite', P, st);
    }, { from: [130, 18], tilt: -0.05, dur: 0.5, fps: 12 });

    const fx = [860, 1030, 1200, 1370];
    const fy = 248;
    for (let i = 0; i < FACTOR_META.length; i++) {
      const meta = FACTOR_META[i];
      const n = counts[meta.key];
      const enter = MO.springHz(local - 0.45 - i * 0.06, 2.3, 9);
      if (enter <= 0.01) continue;
      c.save();
      c.globalAlpha = U.clamp(enter);
      c.translate(fx[i], fy);
      c.scale(enter, enter);
      c.translate(-fx[i], -fy);
      const num = String(n);
      TY.text(c, num, fx[i], fy, {
        size: 42,
        fam: MONO,
        color: P.ink,
        align: 'center',
      });
      TY.rise(c, meta.word, fx[i], fy + 28, MO.at(local, 0.58 + i * 0.06, 0.22), {
        size: 16,
        fam: SANS,
        color: mute,
        align: 'center',
      });
      drawPips(c, n, fx[i], fy + 52, P, meta.key);
      if (i < FACTOR_META.length - 1) {
        TY.text(c, '×', (fx[i] + fx[i + 1]) / 2, fy - 2, {
          size: 28,
          fam: MONO,
          color: mixHex(P.ink, P.paper, 0.5),
          align: 'center',
          alpha: U.clamp(enter),
        });
      }
      c.restore();
    }

    const cond = fmtCount(counts.conditions);
    const condSize = 84;
    const condX = 860;
    const condY = 418;
    TY.slam(c, cond, condX, condY, local - 1.1, {
      size: condSize,
      fam: FAM,
      color: P.ink,
      align: 'left',
      track: condSize * -0.03,
    });
    const condW = TY.width(c, cond, condSize, FAM, condSize * -0.03);
    TY.rise(c, 'conditions', condX, condY + 36, MO.at(local, 1.3, 0.25), {
      size: 22,
      fam: SANS,
      color: mute,
      align: 'left',
    });
    CL.highlight(c, condX, condY - 70, condW, 54, scanQ(st - 1, 2.8, 0.8), 'rgba(228,214,59,0.5)');

    const chipY = 516;
    const chipH = 48;
    const chipGap = 12;
    const chipX0 = 80;
    const chipSpan = 1100;
    const chipW = (chipSpan - (counts.domains - 1) * chipGap) / counts.domains;
    for (let i = 0; i < b.domainLabels.length; i++) {
      const pop = MO.springHz(local - 1.7 - i * 0.04, 2.3, 9);
      if (pop <= 0.01) continue;
      const x = chipX0 + i * (chipW + chipGap);
      const cx = x + chipW / 2;
      const cy = chipY + chipH / 2;
      c.save();
      c.translate(cx, cy);
      c.scale(pop, pop);
      c.translate(-cx, -cy);
      const hold = local >= 6.4;
      const cycle = hold ? Math.floor(((local - 6.4) / 1.55) % counts.domains) : -1;
      const on = i === cycle;
      const fill = on ? P.peach : P.white;
      const pl = plate(chipW, chipH, fill, P, 40 + i);
      c.drawImage(pl, x - 2, chipY - 2);
      const fitted = TY.fit(c, b.domainLabels[i], chipW - 24, 18, SANS, { maxLines: 1, min: 14 / 18 });
      TY.text(c, fitted.lines[0], x + chipW / 2, chipY + 31, {
        size: fitted.size,
        fam: SANS,
        color: P.ink,
        align: 'center',
      });
      if (on) TY.underline(c, x + 16, chipY + 40, chipW - 32, 1, P.red, 3);
      c.restore();
    }

    const outY = 596;
    const outH = 144;
    const outBottom = outY + outH;
    if (outBottom > Y_MAX) throw new Error('Evaluation scene overflow y ' + outBottom + ' (hard ' + Y_HARD + ')');
    const outEnter = MO.quintOut(MO.at(local, 2.35, 0.35));
    const vx = 1188;
    const vy = outY + 26;
    const vw = 280;
    const vh = 88;
    if (outEnter > 0.01) {
      c.save();
      c.globalAlpha = 0.2 + 0.8 * outEnter;
      const outPl = plate(1440, outH, P.white, P, 77);
      c.drawImage(outPl, 78, outY - 2);
      c.restore();

      const dims = b.dimensions;
      const barW = 52;
      const barH = 68;
      const barGap = 20;
      const groupW = dims.length * barW + (dims.length - 1) * barGap;
      const barX0 = 130;
      const barY = outY + 28;
      for (let i = 0; i < dims.length; i++) {
        const p = MO.springHz(local - 2.5 - i * 0.05, 2.4, 9);
        if (p <= 0.01) continue;
        const x = barX0 + i * (barW + barGap);
        const col = dimColor(P, dims[i], i);
        c.save();
        c.translate(x + barW / 2, barY + barH / 2);
        c.scale(p, p);
        c.translate(-(x + barW / 2), -(barY + barH / 2));
        strokeRound(c, x, barY, barW, barH, 10, mixHex(col, P.paper, 0.18), 2);
        fillRound(c, x, barY, barW, 10, 5, col);
        TY.text(c, dims[i].key, x + barW / 2, barY + barH + 20, {
          size: 16,
          fam: MONO,
          color: P.ink,
          align: 'center',
        });
        c.restore();
      }

      const plusP = MO.at(local, 2.7, 0.22);
      TY.rise(c, '+', barX0 + groupW + 28, outY + 84, plusP, {
        size: 36,
        fam: FAM,
        color: mute,
        align: 'left',
      });

      const vexP = MO.springHz(local - 2.75, 2.2, 10);
      if (vexP > 0.01) {
        c.save();
        c.translate(vx + vw / 2, vy + vh / 2);
        c.scale(vexP, vexP);
        c.translate(-(vx + vw / 2), -(vy + vh / 2));
        const vexPl = plate(vw, vh, P.peach, P, 88);
        c.drawImage(vexPl, vx - 2, vy - 2);
        TY.text(c, 'VEX', vx + vw / 2, vy + 60, {
          size: 48,
          fam: FAM,
          color: P.ink,
          align: 'center',
          track: 48 * -0.03,
        });
        c.restore();
      }
    }

    const routeP = MO.expoOut(MO.at(st, 2.6, 0.5));
    const pts = quadPts(
      [Math.min(W - 80, condX + condW + 36), condY + 4],
      [1420, 548],
      [vx + vw * 0.5, vy + 8],
      22,
    );
    routeDot(c, pts, routeP, st, P);

    c.restore();
  }

  window.VEX_EVALUATION_SCENE = {
    draw,
    copy(A) { return accessibleCopy(needBenchmark(A)); },
    duration: 6,
  };
})();
