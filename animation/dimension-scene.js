(() => {
  const W = 1600;
  const H = 900;
  const SLOT = 1.8;
  const FAM = 'Study Impact';
  const MONO = 'IBM Plex Mono';
  const ART_W = 440;
  const ART_H = 340;
  const SCALE = 1.32;
  const GX = 88;
  const GY = 204;
  const QX = 720;
  const Q_MAX = 1520 - 720;
  const DIMS = [
    { key: 'D1', name: 'Checkability', color: 'd1', question: 'Can the claims be checked?' },
    { key: 'D2', name: 'Harm Significance', color: 'd2', question: 'What harm if believed?' },
    { key: 'D3', name: 'Source Credibility Signals', color: 'd3', question: 'Who appears to back it?' },
    { key: 'D4', name: 'Imposter Legitimacy', color: 'd4', question: 'Does it look like real news?' },
    { key: 'D5', name: 'Verification Cost', color: 'd5', question: 'How much effort to verify?' },
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

  function disk(g, x, y, r, color) {
    if (r <= 0) return;
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  function grain(P) {
    const key = 'b:grain:' + P.paper + P.ink;
    if (cache[key]) return cache[key];
    const cv = document.createElement('canvas');
    cv.width = W + 40;
    cv.height = H + 40;
    const g = cv.getContext('2d');
    g.fillStyle = P.paper;
    g.fillRect(0, 0, cv.width, cv.height);
    const r = U.rng(19);
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

  function focus(lt) {
    const local = Number.isFinite(lt) ? lt : 0;
    if (local >= 9) return { idx: 4, elapsed: local - 4 * SLOT, st: local };
    const st = U.clamp(local, 0, 9 - 1e-6);
    const idx = Math.min(4, Math.max(0, Math.floor(st / SLOT)));
    return { idx, elapsed: st - idx * SLOT, st };
  }

  function draw(c, lt, t, A, P) {
    void A;
    void t;
    if (!window.VEX_DIMENSION_ART || typeof VEX_DIMENSION_ART.draw !== 'function') {
      throw new Error('Missing artist: VEX_DIMENSION_ART.draw');
    }

    const { idx, elapsed, st } = focus(lt);
    const dim = DIMS[idx];
    const accent = P[dim.color];
    const gw = ART_W * SCALE;
    const gh = ART_H * SCALE;
    const enter = MO.quintOut(U.clamp(elapsed / 0.22));
    const qEnter = MO.quintOut(U.clamp((elapsed - 0.06) / 0.2));
    const stage = MO.quintOut(U.clamp(elapsed / 0.28));

    c.save();
    c.fillStyle = P.paper;
    c.fillRect(0, 0, W, H);
    c.translate(MO.float(st, 2.0, 6.8, 0.12), MO.float(st, 1.2, 7.6, 1.35));
    c.drawImage(grain(P), -20, -20);

    const titleSize = TY.fit(c, dim.name, 1440, 76, FAM, { maxLines: 1, min: 56 / 76 }).size;
    c.save();
    c.globalAlpha = 0.84 + 0.16 * enter;
    TY.text(c, dim.name, 80, 140, {
      size: titleSize,
      fam: FAM,
      color: P.ink,
      align: 'left',
      track: titleSize * -0.03,
    });
    c.restore();
    const titleW = TY.width(c, dim.name, titleSize, FAM, titleSize * -0.03);
    TY.underline(c, 80, 156, titleW * enter, U.clamp(elapsed / 0.3), accent, 6);

    const pad = 16;
    c.save();
    c.globalAlpha = 0.2 + 0.8 * stage;
    fillRound(c, GX - pad, GY - pad, gw + pad * 2, gh + pad * 2, 20, mixHex(P.white, accent, 0.14));
    fillRound(c, GX - pad, GY - pad, 8, (gh + pad * 2) * stage, 4, accent);
    c.restore();

    c.save();
    c.globalAlpha = stage;
    c.translate(GX, GY);
    c.scale(SCALE, SCALE);
    VEX_DIMENSION_ART.draw(c, dim.key, elapsed, P);
    c.restore();

    const ruleX = GX + gw + 28;
    c.save();
    c.globalAlpha = 0.18 * stage;
    c.strokeStyle = mixHex(P.ink, accent, 0.22);
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ruleX, GY + 28);
    c.lineTo(ruleX, GY + gh - 28);
    c.stroke();
    c.restore();

    const q = TY.fit(c, dim.question, Q_MAX, 52, FAM, { maxLines: 2, min: 42 / 52, balance: true });
    const qLead = q.size * 1.12;
    const qBlock = q.lines.length * qLead;
    const qBase = GY + gh / 2 - qBlock / 2 + q.size * 0.78;
    c.save();
    c.globalAlpha = 0.84 + 0.16 * qEnter;
    q.lines.forEach((line, i) => {
      TY.text(c, line, QX, qBase + i * qLead, {
        size: q.size,
        fam: FAM,
        color: P.ink,
        align: 'left',
        track: q.size * -0.024,
      });
    });
    c.restore();

    const ix0 = 88;
    const iStep = 92;
    const iy = 716;
    const tickY = 734;
    c.save();
    c.strokeStyle = mixHex(P.ink, P.paper, 0.16);
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(ix0 + 14, tickY);
    c.lineTo(ix0 + 4 * iStep + 14, tickY);
    c.stroke();
    c.restore();

    const hold = Math.max(0, elapsed - 0.35);
    const pip = 0.55 + 0.45 * Math.sin(hold * Math.PI * 2 / 1.6);
    for (let i = 0; i < 5; i++) {
      const d = DIMS[i];
      const x = ix0 + i * iStep;
      const on = i === idx;
      const col = on ? P[d.color] : mixHex(P[d.color], P.paper, 0.42);
      TY.text(c, d.key, x, iy, {
        size: 20,
        fam: MONO,
        color: on ? P.ink : mixHex(P.ink, P.paper, 0.46),
        align: 'left',
      });
      disk(c, x + 14, tickY, on ? 4.6 + pip * 1.1 : 3.1, col);
      if (on) TY.underline(c, x, iy + 8, 36, U.clamp(elapsed / 0.28), P[d.color], 3);
    }

    c.restore();
  }

  window.VEX_DIMENSION_SCENE = { draw };
})();
