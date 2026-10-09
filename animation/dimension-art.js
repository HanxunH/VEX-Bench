(() => {
  const W = 440;
  const H = 340;
  const cache = {};

  function mixHex(a, b, p) {
    const n = (h) => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const A = n(a), B = n(b);
    const r = Math.round(A[0] + (B[0] - A[0]) * p);
    const g = Math.round(A[1] + (B[1] - A[1]) * p);
    const bl = Math.round(A[2] + (B[2] - A[2]) * p);
    return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function hexA(h, a) {
    const n = (x) => parseInt(h.slice(x, x + 2), 16);
    return 'rgba(' + n(1) + ',' + n(3) + ',' + n(5) + ',' + a + ')';
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
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    rr(g, x, y, w, h, r);
    g.stroke();
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
        const fall = base + 0.62 * U.clamp(y / h);
        if (r() < fall * 0.2) {
          g.fillStyle = r() < 0.58 ? 'rgba(0,15,70,0.11)' : 'rgba(255,255,255,0.16)';
          g.fillRect(x, y, 2, 2);
        }
      }
    }
    g.restore();
  }

  function palKey(P) {
    return [P.paper, P.ink, P.white, P.peach, P.blue, P.red, P.marker, P.d1, P.d2, P.d3, P.d4, P.d5].join('|');
  }


  function putPlate(c, pl, x, y) {
    c.drawImage(pl, x - 2, y - 2);
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

  function highlighter(g, x, y, w, h, q, col) {
    const ww = w * U.clamp(q);
    if (ww <= 0.5) return;
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y + 3);
    for (let i = 0; i <= 12; i++) g.lineTo(x + ww * i / 12, y + Math.sin(i * 1.4) * 1.5);
    g.lineTo(x + ww, y + h);
    for (let i = 12; i >= 0; i--) g.lineTo(x + ww * i / 12, y + h + Math.sin(i * 2.1) * 1.3);
    g.closePath();
    g.fill();
    g.restore();
  }

  function enterP(t) {
    return MO.smooth(U.clamp(t / 0.35));
  }

  function underlay(kind, P, paint, seed) {
    const key = 'ul:' + kind + palKey(P);
    if (cache[key]) return cache[key];
    const cv = makeCanvas(W, H);
    const g = cv.getContext('2d');
    paint(g, P);
    stipple(g, W, H, seed, 0.14);
    cache[key] = cv;
    return cv;
  }

  const SPANS = [0.9, 0.62, 0.84, 0.48, 0.78, 0.7, 0.4, 0.66];

  function paperArt(P) {
    const key = 'd1paper:' + palKey(P);
    if (cache[key]) return cache[key];
    const w = 228, h = 284;
    const cv = makeCanvas(w + 16, h + 16);
    const g = cv.getContext('2d');
    fillRound(g, 8, 10, w, h, 18, mixHex(P.white, P.ink, 0.16));
    fillRound(g, 2, 2, w, h, 18, P.white);
    g.save();
    rr(g, 2, 2, w, h, 18);
    g.clip();
    fillRound(g, 2, 2, w, 22, 0, P.peach);
    fillRound(g, 2, 24, w, 3, 0, mixHex(P.peach, P.d1, 0.28));
    g.restore();
    fillRound(g, 22, 42, 9, 22, 4, mixHex(P.peach, P.d1, 0.45));
    fillRound(g, 36, 42, 9, 22, 4, mixHex(P.peach, P.d1, 0.45));
    fillRound(g, 22, 66, 48, 5, 2.5, mixHex(P.blue, P.ink, 0.1));
    const lineY = [96, 118, 140, 162, 184, 206, 228, 250];
    for (let i = 0; i < SPANS.length; i++) {
      const yy = lineY[i];
      const ww = 176 * SPANS[i];
      const col = i === 2 || i === 3 ? mixHex(P.blue, P.ink, 0.18) : P.blue;
      fillRound(g, 22, yy, ww, i < 2 ? 9 : 7, 4, col);
    }
    fillRound(g, 186, 8, 28, 28, 6, mixHex(P.blue, P.paper, 0.2));
    stipple(g, cv.width, cv.height, 41, 0.1);
    cache[key] = cv;
    return cv;
  }

  function tokenArt(P, i) {
    const key = 'tok:' + i + palKey(P);
    if (cache[key]) return cache[key];
    const w = 92, h = 56;
    const cv = makeCanvas(w + 14, h + 14);
    const g = cv.getContext('2d');
    const fills = [
      mixHex(P.blue, P.white, 0.15),
      mixHex(P.peach, P.white, 0.08),
      mixHex(P.blue, P.d1, 0.12),
    ];
    fillRound(g, 6, 8, w, h, 12, mixHex(fills[i], P.ink, 0.14));
    fillRound(g, 2, 2, w, h, 12, fills[i]);
    fillRound(g, 14, 16, 18, 18, 5, i === 1 ? mixHex(P.d1, P.ink, 0.12) : P.d1);
    fillRound(g, 40, 18, 40, 7, 3.5, mixHex(P.ink, P.blue, 0.18));
    fillRound(g, 40, 32, 28, 6, 3, P.blue);
    stipple(g, cv.width, cv.height, 80 + i * 11, 0.1);
    cache[key] = cv;
    return cv;
  }

  function brackets(c, x, y, w, h, a, color) {
    const arm = Math.min(18, w * 0.22, h * 0.45);
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x, y + arm);
    c.lineTo(x, y);
    c.lineTo(x + arm, y);
    c.moveTo(x + w, y + arm);
    c.lineTo(x + w, y);
    c.lineTo(x + w - arm, y);
    c.moveTo(x, y + h - arm);
    c.lineTo(x, y + h);
    c.lineTo(x + arm, y + h);
    c.moveTo(x + w, y + h - arm);
    c.lineTo(x + w, y + h);
    c.lineTo(x + w - arm, y + h);
    c.stroke();
    c.restore();
  }

  function magnifier(c, x, y, r, shine, P) {
    const handleAng = 0.72;
    const hx = x + Math.cos(handleAng) * (r + 6);
    const hy = y + Math.sin(handleAng) * (r + 6);
    c.save();
    c.strokeStyle = mixHex(P.d1, P.ink, 0.28);
    c.lineWidth = 11;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx + Math.cos(handleAng) * 34, hy + Math.sin(handleAng) * 34);
    c.stroke();
    c.strokeStyle = P.d1;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx + Math.cos(handleAng) * 34, hy + Math.sin(handleAng) * 34);
    c.stroke();
    disk(c, x + 2, y + 3, r + 3, mixHex(P.d1, P.ink, 0.22));
    disk(c, x, y, r + 3, P.d1);
    disk(c, x, y, r - 5, mixHex(P.blue, P.white, 0.45));
    c.globalAlpha = 0.55;
    disk(c, x, y, r - 5, hexA(P.white, 0.28));
    c.globalAlpha = 1;
    c.strokeStyle = hexA(P.white, 0.7);
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(x, y, r - 14, shine - 0.7, shine + 0.5);
    c.stroke();
    c.restore();
  }

  function drawD1(c, t, P) {
    const e = enterP(t);
    const st = MO.step(t, 12);
    const paperIn = MO.quartOut(U.clamp(st / 0.32));
    c.drawImage(underlay('d1', P, (g) => {
      g.fillStyle = mixHex(P.peach, P.d1, 0.18);
      g.beginPath();
      g.ellipse(150, 250, 150, 78, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.blue, P.white, 0.12);
      g.beginPath();
      g.ellipse(330, 90, 88, 62, 0.3, 0, Math.PI * 2);
      g.fill();
    }, 21), 0, 0);

    c.save();
    c.globalAlpha = 0.55 + 0.45 * paperIn;
    c.translate((1 - paperIn) * -22, (1 - paperIn) * 10);
    putPlate(c, paperArt(P), 28, 22);
    c.restore();

    const lineY = [118, 140, 162, 184];
    const cycle = 2.15;
    const hold = Math.max(0, t - 0.28);
    const u = (hold % cycle) / cycle;
    const span = MO.sineInOut(u);
    const focusY = U.lerp(lineY[0], lineY[3], 0.5 - 0.5 * Math.cos(span * Math.PI * 2));
    const magX = 196;
    const magY = U.lerp(128, focusY + 6, e);
    const magS = U.lerp(0.72, 1, MO.backOut(U.clamp((t - 0.04) / 0.3), 1.4));
    const hiQ = t < 0.34 ? U.clamp(t / 0.28) : 0.9 + 0.1 * Math.cos(hold * Math.PI * 2 / 1.8);
    c.save();
    c.globalAlpha = paperIn;
    highlighter(c, 48, focusY - 4, 168, 18, hiQ, hexA(P.marker, 0.82));
    const bPulse = 0.72 + 0.28 * Math.sin(hold * Math.PI * 2 / 1.7);
    brackets(c, 42, focusY - 12, 186, 28, e * bPulse, P.d1);
    c.restore();

    c.save();
    c.translate(magX, magY);
    c.scale(magS, magS);
    magnifier(c, 0, 0, 46, hold * 1.1, P);
    c.restore();

    const tokens = [tokenArt(P, 0), tokenArt(P, 1), tokenArt(P, 2)];
    for (let i = 0; i < 3; i++) {
      const q = MO.quartOut(MO.lagged(i, 3, U.clamp(st / 0.34), 0.18));
      if (q <= 0) continue;
      const near = 1 - U.clamp(Math.abs(focusY - lineY[i + 1]) / 36);
      const lift = MO.float(t, 3.2, 3.4, i * 1.1) - near * 5;
      c.save();
      c.globalAlpha = 0.25 + 0.75 * q;
      c.translate(318, 58 + i * 78 + (1 - q) * 16);
      c.translate(0, lift);
      c.scale(0.92 + 0.08 * q, 0.92 + 0.08 * q);
      c.drawImage(tokens[i], -2, -2);
      c.restore();
    }
  }

  const D2_RAYS = [
    quadPts([132, 156], [220, 90], [346, 114], 20),
    quadPts([148, 176], [240, 186], [364, 210], 18),
    quadPts([132, 196], [210, 250], [342, 282], 20),
  ];

  function iconPlate(kind, P) {
    const key = 'ico:' + kind + palKey(P);
    if (cache[key]) return cache[key];
    const s = 92;
    const cv = makeCanvas(s + 16, s + 16);
    const g = cv.getContext('2d');
    const fill = kind === 'health' ? mixHex(P.peach, P.white, 0.2)
      : kind === 'finance' ? mixHex(P.blue, P.white, 0.12)
      : mixHex(P.peach, P.d2, 0.12);
    fillRound(g, 8, 10, s, s, 22, mixHex(fill, P.ink, 0.16));
    fillRound(g, 2, 2, s, s, 22, fill);
    g.save();
    g.translate(2 + s / 2, 2 + s / 2);
    if (kind === 'health') {
      disk(g, 0, 0, 26, mixHex(P.d2, P.peach, 0.35));
      disk(g, 0, 0, 22, P.white);
      fillRound(g, -6, -18, 12, 36, 5, P.d2);
      fillRound(g, -18, -6, 36, 12, 5, P.d2);
    } else if (kind === 'finance') {
      disk(g, -8, 8, 16, mixHex(P.d2, P.ink, 0.12));
      disk(g, -8, 6, 16, mixHex(P.peach, P.d2, 0.25));
      disk(g, 8, -2, 18, mixHex(P.d2, P.ink, 0.08));
      disk(g, 8, -6, 18, mixHex(P.blue, P.white, 0.05));
      fillRound(g, 4, -10, 8, 8, 4, P.d2);
      fillRound(g, -22, 14, 10, 16, 3, mixHex(P.d2, P.ink, 0.18));
      fillRound(g, -8, 6, 10, 24, 3, P.d2);
      fillRound(g, 6, 10, 10, 20, 3, mixHex(P.d2, P.peach, 0.2));
    } else {
      g.fillStyle = mixHex(P.d2, P.ink, 0.18);
      g.beginPath();
      g.moveTo(0, -26);
      g.quadraticCurveTo(24, -18, 24, 4);
      g.quadraticCurveTo(0, 30, 0, 30);
      g.quadraticCurveTo(-24, 4, -24, 4);
      g.quadraticCurveTo(-24, -18, 0, -26);
      g.fill();
      g.fillStyle = P.white;
      g.beginPath();
      g.moveTo(0, -18);
      g.quadraticCurveTo(16, -12, 16, 2);
      g.quadraticCurveTo(0, 22, 0, 22);
      g.quadraticCurveTo(-16, 2, -16, 2);
      g.quadraticCurveTo(-16, -12, 0, -18);
      g.fill();
      fillRound(g, -6, -4, 12, 16, 4, P.d2);
    }
    g.restore();
    stipple(g, cv.width, cv.height, 51 + kind.length, 0.1);
    cache[key] = cv;
    return cv;
  }

  function messageCard(P) {
    const key = 'msg:' + palKey(P);
    if (cache[key]) return cache[key];
    const w = 150, h = 118;
    const cv = makeCanvas(w + 16, h + 28);
    const g = cv.getContext('2d');
    fillRound(g, 8, 10, w, h, 18, mixHex(P.white, P.ink, 0.16));
    fillRound(g, 2, 2, w, h, 18, P.white);
    fillRound(g, 18, 20, 92, 10, 5, mixHex(P.blue, P.ink, 0.14));
    fillRound(g, 18, 40, 110, 8, 4, P.blue);
    fillRound(g, 18, 58, 74, 8, 4, P.blue);
    fillRound(g, 18, 76, 96, 8, 4, mixHex(P.blue, P.ink, 0.08));
    g.fillStyle = mixHex(P.white, P.ink, 0.16);
    g.beginPath();
    g.moveTo(36, 120);
    g.lineTo(58, 120);
    g.lineTo(30, 138);
    g.closePath();
    g.fill();
    g.fillStyle = P.white;
    g.beginPath();
    g.moveTo(34, 112);
    g.lineTo(56, 112);
    g.lineTo(28, 132);
    g.closePath();
    g.fill();
    stipple(g, cv.width, cv.height, 63, 0.1);
    cache[key] = cv;
    return cv;
  }

  function drawD2(c, t, P) {
    const e = enterP(t);
    const st = MO.step(t, 12);
    c.drawImage(underlay('d2', P, (g) => {
      g.fillStyle = mixHex(P.peach, P.d2, 0.22);
      g.beginPath();
      g.ellipse(210, 180, 170, 110, 0.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.blue, P.paper, 0.25);
      g.beginPath();
      g.ellipse(80, 70, 70, 44, -0.3, 0, Math.PI * 2);
      g.fill();
    }, 33), 0, 0);

    const cx = 108, cy = 168;
    const ringHold = Math.max(0, t - 0.18);
    for (let i = 2; i >= 0; i--) {
      const local = (ringHold * 0.42 + i * 0.33) % 1;
      const rad = 28 + local * 70;
      const a = (1 - local) * 0.28 * Math.max(e, 0.25);
      if (a < 0.02) continue;
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = P.d2;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(cx, cy, rad, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    c.save();
    const pop = U.lerp(0.72, 1, MO.quartOut(U.clamp(t / 0.32)));
    c.globalAlpha = 0.4 + 0.6 * U.clamp(t / 0.28);
    c.translate(cx - 10, cy - 8);
    c.scale(pop, pop);
    c.drawImage(messageCard(P), -76, -64);
    c.restore();

    const kinds = ['health', 'finance', 'safety'];
    const pos = [[300, 68], [318, 164], [296, 236]];
    for (let i = 0; i < 3; i++) {
      const grow = MO.quartOut(MO.lagged(i, 3, U.clamp(st / 0.34), 0.16));
      strokePartial(c, D2_RAYS[i], grow, mixHex(P.d2, P.ink, 0.2), 8);
      strokePartial(c, D2_RAYS[i], grow, P.d2, 4.5);
      const pulse = 1 + 0.045 * Math.sin(Math.max(0, t - 0.35) * Math.PI * 2 / 1.55 + i * 1.7);
      const hit = 0.55 + 0.45 * grow;
      c.save();
      c.globalAlpha = hit;
      c.translate(pos[i][0] + 46, pos[i][1] + 46);
      c.scale(pulse * (0.82 + 0.18 * grow), pulse * (0.82 + 0.18 * grow));
      c.drawImage(iconPlate(kinds[i], P), -54, -54);
      c.restore();
      if (grow > 0.85) {
        const ripple = (Math.max(0, t - 0.4 - i * 0.12) * 0.7 + i * 0.2) % 1;
        c.save();
        c.globalAlpha = (1 - ripple) * 0.35;
        c.strokeStyle = P.d2;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(pos[i][0] + 46, pos[i][1] + 46, 28 + ripple * 22, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    }
  }

  function buildingArt(P) {
    const key = 'bldg:' + palKey(P);
    if (cache[key]) return cache[key];
    const w = 196, h = 220;
    const cv = makeCanvas(w + 16, h + 16);
    const g = cv.getContext('2d');
    const stone = mixHex(P.blue, P.white, 0.08);
    fillRound(g, 8, 10, w, h, 14, mixHex(stone, P.ink, 0.16));
    fillRound(g, 2, 18, w, h - 8, 12, mixHex(P.d3, P.ink, 0.22));
    g.fillStyle = mixHex(P.d3, P.ink, 0.12);
    g.beginPath();
    g.moveTo(w / 2 + 2, 6);
    g.lineTo(w + 4, 54);
    g.lineTo(0, 54);
    g.closePath();
    g.fill();
    g.fillStyle = mixHex(P.d3, P.blue, 0.18);
    g.beginPath();
    g.moveTo(w / 2 + 2, 12);
    g.lineTo(w - 6, 52);
    g.lineTo(10, 52);
    g.closePath();
    g.fill();
    fillRound(g, 18, 58, w - 28, 154, 8, stone);
    fillRound(g, 18, 58, w - 28, 14, 4, mixHex(P.d3, P.peach, 0.2));
    const colW = 22;
    const gap = 28;
    const x0 = 40;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (colW + gap);
      fillRound(g, x, 78, colW, 112, 6, mixHex(P.d3, P.ink, 0.1));
      fillRound(g, x + 4, 84, colW - 8, 100, 4, mixHex(P.blue, P.white, 0.25));
    }
    fillRound(g, 78, 150, 40, 48, 6, mixHex(P.d3, P.ink, 0.18));
    fillRound(g, 10, 196, w - 4, 16, 6, mixHex(P.d3, P.ink, 0.2));
    fillRound(g, 24, 188, w - 32, 10, 4, mixHex(P.peach, P.d3, 0.15));
    stipple(g, cv.width, cv.height, 77, 0.1);
    cache[key] = cv;
    return cv;
  }

  function sealArt(P) {
    const key = 'seal:' + palKey(P);
    if (cache[key]) return cache[key];
    const s = 118;
    const cv = makeCanvas(s, s);
    const g = cv.getContext('2d');
    const cx = 59, cy = 59;
    disk(g, cx + 2, cy + 3, 46, mixHex(P.d3, P.ink, 0.22));
    disk(g, cx, cy, 46, mixHex(P.d3, P.ink, 0.08));
    disk(g, cx, cy, 40, mixHex(P.blue, P.white, 0.2));
    disk(g, cx, cy, 32, P.white);
    g.strokeStyle = P.d3;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, cy, 36, 0, Math.PI * 2);
    g.stroke();
    fillRound(g, cx - 7, cy - 16, 14, 28, 3, P.d3);
    fillRound(g, cx - 16, cy + 8, 32, 8, 3, P.d3);
    fillRound(g, cx - 12, cy - 22, 8, 10, 2, P.d3);
    fillRound(g, cx + 4, cy - 22, 8, 10, 2, P.d3);
    stipple(g, s, s, 91, 0.08);
    cache[key] = cv;
    return cv;
  }

  function drawD3(c, t, P) {
    const st = MO.step(t, 12);
    c.drawImage(underlay('d3', P, (g) => {
      g.fillStyle = mixHex(P.blue, P.d3, 0.12);
      g.beginPath();
      g.ellipse(160, 250, 150, 70, 0.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.peach, P.white, 0.2);
      g.beginPath();
      g.ellipse(340, 80, 80, 50, 0.4, 0, Math.PI * 2);
      g.fill();
    }, 45), 0, 0);

    const rise = MO.quartOut(U.clamp(st / 0.32));
    c.save();
    c.globalAlpha = 0.3 + 0.7 * rise;
    c.translate(0, (1 - rise) * 22);
    c.drawImage(buildingArt(P), 28, 28);
    const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Math.max(0, t - 0.35) * Math.PI * 2 / 2.0));
    c.globalAlpha = glow * rise;
    fillRound(c, 70, 114, 14, 18, 3, mixHex(P.marker, P.peach, 0.35));
    fillRound(c, 120, 114, 14, 18, 3, mixHex(P.marker, P.peach, 0.35));
    fillRound(c, 170, 114, 14, 18, 3, mixHex(P.marker, P.peach, 0.35));
    c.restore();

    const ribbon = MO.quartOut(U.clamp((st - 0.06) / 0.28));
    const rw = 332 * ribbon;
    if (rw > 4) {
      fillRound(c, 40, 262, rw, 44, 12, mixHex(P.peach, P.white, 0.1));
      fillRound(c, 40, 262, rw, 44, 12, hexA(P.white, 0.92));
      c.save();
      rr(c, 40, 262, rw, 44, 12);
      c.clip();
      disk(c, 64, 284, 12, mixHex(P.d3, P.ink, 0.18));
      fillRound(c, 84, 272, 70, 8, 4, mixHex(P.ink, P.blue, 0.2));
      fillRound(c, 84, 286, 48, 7, 3.5, P.blue);
      fillRound(c, 168, 272, 90, 8, 4, mixHex(P.d3, P.blue, 0.25));
      fillRound(c, 168, 286, 54, 7, 3.5, P.blue);
      fillRound(c, 276, 276, 64, 16, 8, mixHex(P.d3, P.peach, 0.2));
      c.restore();
      strokeRound(c, 40, 262, rw, 44, 12, mixHex(P.d3, P.ink, 0.12), 2);
      const scan = t < 0.4 ? U.clamp((t - 0.18) / 0.22) : 0.88 + 0.12 * Math.cos((t - 0.4) * Math.PI * 2 / 1.9);
      highlighter(c, 48, 268, rw - 16, 32, scan, hexA(P.marker, 0.55));
    }

    const sealQ = U.lerp(0.7, 1, MO.quartOut(U.clamp((t - 0.06) / 0.28)));
    const ring = 0.7 + 0.3 * Math.sin(Math.max(0, t - 0.35) * Math.PI * 2 / 1.65);
    c.save();
    c.globalAlpha = 0.35 + 0.65 * U.clamp(t / 0.28);
    c.translate(352, 108);
    c.scale(sealQ, sealQ);
    c.drawImage(sealArt(P), -59, -59);
    c.strokeStyle = hexA(P.d3, 0.45 * ring);
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 50, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function newsPieces(P) {
    const key = 'news:' + palKey(P);
    if (cache[key]) return cache[key];
    const pack = {};
    function piece(id, w, h, paint, seed, rad) {
      const cv = makeCanvas(w + 14, h + 14);
      const g = cv.getContext('2d');
      paint(g, w, h);
      stipple(g, cv.width, cv.height, seed, 0.1);
      pack[id] = { cv, w, h, rad };
    }
    piece('mast', 344, 34, (g, w, h) => {
      fillRound(g, 6, 8, w, h, 8, mixHex(P.d4, P.ink, 0.2));
      fillRound(g, 2, 2, w, h, 8, mixHex(P.d4, P.peach, 0.18));
      fillRound(g, 18, 12, 72, 12, 6, P.white);
      fillRound(g, 100, 14, 40, 8, 4, hexA(P.white, 0.7));
      fillRound(g, 150, 14, 28, 8, 4, hexA(P.white, 0.7));
    }, 101, 8);
    piece('head1', 344, 20, (g, w, h) => {
      fillRound(g, 6, 8, w, h, 6, mixHex(P.ink, P.blue, 0.22));
      fillRound(g, 2, 2, w, h, 6, mixHex(P.ink, P.blue, 0.12));
    }, 102, 6);
    piece('head2', 248, 16, (g, w, h) => {
      fillRound(g, 6, 8, w, h, 5, mixHex(P.ink, P.blue, 0.16));
      fillRound(g, 2, 2, w, h, 5, mixHex(P.ink, P.blue, 0.08));
    }, 103, 5);
    piece('byline', 168, 14, (g, w, h) => {
      fillRound(g, 2, 2, w, h, 7, mixHex(P.peach, P.white, 0.15));
      disk(g, 12, 9, 5, mixHex(P.d4, P.ink, 0.15));
      fillRound(g, 22, 6, 70, 6, 3, mixHex(P.d4, P.blue, 0.2));
      fillRound(g, 98, 6, 48, 6, 3, P.blue);
    }, 104, 7);
    piece('photo', 148, 112, (g, w, h) => {
      fillRound(g, 6, 8, w, h, 12, mixHex(P.peach, P.ink, 0.14));
      fillRound(g, 2, 2, w, h, 12, mixHex(P.peach, P.blue, 0.25));
      g.fillStyle = mixHex(P.d4, P.peach, 0.35);
      g.beginPath();
      g.arc(44, 36, 16, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.d4, P.ink, 0.18);
      g.beginPath();
      g.moveTo(8, 102);
      g.lineTo(48, 58);
      g.lineTo(86, 86);
      g.lineTo(118, 52);
      g.lineTo(146, 102);
      g.closePath();
      g.fill();
    }, 105, 12);
    piece('cols', 180, 112, (g, w, h) => {
      fillRound(g, 6, 8, w, h, 10, mixHex(P.white, P.ink, 0.12));
      fillRound(g, 2, 2, w, h, 10, P.white);
      const spans = [0.92, 0.74, 0.86, 0.58, 0.8, 0.66];
      for (let col = 0; col < 2; col++) {
        const x0 = 12 + col * 86;
        for (let i = 0; i < spans.length; i++) {
          fillRound(g, x0, 16 + i * 16, 70 * spans[i], 8, 4, i < 2 ? mixHex(P.blue, P.ink, 0.12) : P.blue);
        }
      }
    }, 106, 10);
    cache[key] = pack;
    return pack;
  }

  const D4_LAYOUT = [
    { id: 'mast', x: 44, y: 28, ox: -24, oy: -14, rot: -0.07 },
    { id: 'head1', x: 44, y: 72, ox: 20, oy: -8, rot: 0.05 },
    { id: 'head2', x: 44, y: 100, ox: -14, oy: 10, rot: -0.04 },
    { id: 'byline', x: 44, y: 126, ox: 12, oy: 12, rot: 0.06 },
    { id: 'photo', x: 44, y: 152, ox: -18, oy: 18, rot: -0.05 },
    { id: 'cols', x: 204, y: 152, ox: 16, oy: 14, rot: 0.04 },
  ];

  function drawD4(c, t, P) {
    const st = MO.step(t, 12);
    const p = U.clamp(st / 0.35);
    c.drawImage(underlay('d4', P, (g) => {
      g.fillStyle = mixHex(P.peach, P.d4, 0.16);
      g.beginPath();
      g.ellipse(220, 240, 180, 80, 0.08, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.blue, P.white, 0.2);
      g.beginPath();
      g.ellipse(80, 60, 70, 40, -0.2, 0, Math.PI * 2);
      g.fill();
    }, 57), 0, 0);

    const pack = newsPieces(P);
    const n = D4_LAYOUT.length;
    for (let i = 0; i < n; i++) {
      const item = D4_LAYOUT[i];
      const q = MO.quartOut(MO.lagged(i, n, p, 0.1));
      const art = pack[item.id];
      const x = item.x + item.ox * (1 - q);
      const y = item.y + item.oy * (1 - q);
      c.save();
      c.globalAlpha = 0.25 + 0.75 * Math.max(q, 0.15);
      c.translate(x + art.w / 2, y + art.h / 2);
      c.rotate(item.rot * (1 - q));
      c.drawImage(art.cv, -art.w / 2 - 2, -art.h / 2 - 2);
      c.restore();
    }

    const settled = U.clamp((t - 0.32) / 0.12);
    if (settled > 0) {
      const breath = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(Math.max(0, t - 0.35) * Math.PI * 2 / 1.8));
      c.save();
      c.globalAlpha = settled * breath;
      c.strokeStyle = P.d4;
      c.lineWidth = 2;
      c.setLineDash([4, 6]);
      c.beginPath();
      c.moveTo(40, 26);
      c.lineTo(40, 268);
      c.moveTo(196, 148);
      c.lineTo(196, 268);
      c.moveTo(396, 26);
      c.lineTo(396, 268);
      c.moveTo(40, 68);
      c.lineTo(396, 68);
      c.stroke();
      c.setLineDash([]);
      c.restore();
      const scan = ((Math.max(0, t - 0.36) % 2.0) / 2.0);
      const sy = scan < 0.45 ? 70 : scan < 0.7 ? 126 : 170 + (scan - 0.7) * 240;
      const sw = scan < 0.45 ? 344 : scan < 0.7 ? 168 : 336;
      highlighter(c, 48, sy, sw, 22, 0.55 + 0.45 * settled, hexA(P.marker, 0.5));
    }
  }

  function nodePlate(kind, P) {
    const key = 'node:' + kind + palKey(P);
    if (cache[key]) return cache[key];
    const s = 96;
    const cv = makeCanvas(s + 16, s + 16);
    const g = cv.getContext('2d');
    const fill = kind === 'claim' ? P.white
      : kind === 'books' ? mixHex(P.peach, P.white, 0.12)
      : kind === 'expert' ? mixHex(P.blue, P.white, 0.1)
      : mixHex(P.blue, P.d5, 0.1);
    fillRound(g, 8, 10, s, s, 20, mixHex(fill, P.ink, 0.16));
    fillRound(g, 2, 2, s, s, 20, fill);
    g.save();
    g.translate(2 + s / 2, 2 + s / 2);
    if (kind === 'claim') {
      fillRound(g, -28, -22, 56, 8, 4, mixHex(P.blue, P.ink, 0.14));
      fillRound(g, -28, -6, 44, 7, 3.5, P.blue);
      fillRound(g, -28, 10, 36, 7, 3.5, P.blue);
    } else if (kind === 'books') {
      fillRound(g, -28, -8, 16, 36, 4, mixHex(P.d5, P.ink, 0.12));
      fillRound(g, -10, -18, 16, 46, 4, P.d5);
      fillRound(g, 8, -4, 18, 32, 4, mixHex(P.peach, P.d5, 0.3));
      fillRound(g, -32, -26, 40, 10, 5, mixHex(P.blue, P.ink, 0.1));
      disk(g, 22, -22, 8, mixHex(P.d5, P.ink, 0.1));
    } else if (kind === 'expert') {
      disk(g, 0, -16, 14, mixHex(P.d5, P.ink, 0.18));
      disk(g, 0, -16, 12, mixHex(P.d5, P.blue, 0.25));
      g.fillStyle = mixHex(P.d5, P.ink, 0.18);
      g.beginPath();
      g.ellipse(0, 16, 22, 16, 0, Math.PI, 0, true);
      g.fill();
      fillRound(g, 16, -8, 22, 6, 3, P.d5);
      fillRound(g, 16, 4, 16, 6, 3, mixHex(P.d5, P.blue, 0.3));
    } else {
      fillRound(g, -24, -8, 48, 28, 10, mixHex(P.d5, P.ink, 0.16));
      fillRound(g, -24, -14, 48, 12, 6, mixHex(P.d5, P.blue, 0.2));
      fillRound(g, -20, 4, 40, 18, 6, mixHex(P.d5, P.ink, 0.08));
      g.strokeStyle = P.d5;
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, -6, 10, Math.PI, 0, true);
      g.stroke();
      disk(g, 0, 10, 4, P.d5);
    }
    g.restore();
    stipple(g, cv.width, cv.height, 120 + kind.length * 9, 0.1);
    cache[key] = cv;
    return cv;
  }

  const D5_PATHS = [
    quadPts([118, 150], [190, 78], [268, 78], 18),
    quadPts([122, 176], [210, 176], [300, 176], 16),
    quadPts([118, 200], [190, 268], [268, 270], 18),
  ];

  function drawClock(c, x, y, r, t, P) {
    disk(c, x + 2, y + 3, r, mixHex(P.d5, P.ink, 0.18));
    disk(c, x, y, r, P.white);
    c.strokeStyle = P.d5;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, r - 2, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = mixHex(P.d5, P.ink, 0.2);
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * (r - 8), y + Math.sin(a) * (r - 8));
      c.lineTo(x + Math.cos(a) * (r - 14), y + Math.sin(a) * (r - 14));
      c.stroke();
    }
    const minA = t * 0.9 - Math.PI / 2;
    const hrA = t * 0.22 - Math.PI / 2;
    c.strokeStyle = P.d5;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(hrA) * (r * 0.45), y + Math.sin(hrA) * (r * 0.45));
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(minA) * (r * 0.68), y + Math.sin(minA) * (r * 0.68));
    c.stroke();
    disk(c, x, y, 3.2, P.d5);
  }

  function drawD5(c, t, P) {
    const e = enterP(t);
    const st = MO.step(t, 12);
    c.drawImage(underlay('d5', P, (g) => {
      g.fillStyle = mixHex(P.blue, P.d5, 0.14);
      g.beginPath();
      g.ellipse(220, 190, 160, 100, -0.12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = mixHex(P.peach, P.white, 0.2);
      g.beginPath();
      g.ellipse(70, 60, 60, 36, 0.2, 0, Math.PI * 2);
      g.fill();
    }, 69), 0, 0);

    const claimQ = U.lerp(0.74, 1, MO.quartOut(U.clamp(t / 0.3)));
    c.save();
    c.globalAlpha = 0.45 + 0.55 * U.clamp(t / 0.22);
    c.translate(72, 168);
    c.scale(claimQ, claimQ);
    c.drawImage(nodePlate('claim', P), -56, -56);
    c.restore();

    const clockQ = MO.quartOut(U.clamp(st / 0.3));
    c.save();
    c.globalAlpha = 0.3 + 0.7 * clockQ;
    c.translate(72, 52);
    c.scale(0.85 + 0.15 * clockQ, 0.85 + 0.15 * clockQ);
    drawClock(c, 0, 0, 28, t, P);
    c.restore();

    const dest = [
      { kind: 'books', x: 292, y: 32 },
      { kind: 'expert', x: 324, y: 130 },
      { kind: 'lock', x: 292, y: 220 },
    ];
    const speeds = [0.28, 0.19, 0.23];
    for (let i = 0; i < 3; i++) {
      const grow = MO.quartOut(MO.lagged(i, 3, U.clamp(st / 0.34), 0.14));
      strokePartial(c, D5_PATHS[i], grow, mixHex(P.d5, P.ink, 0.18), 8);
      strokePartial(c, D5_PATHS[i], grow, P.d5, 4.5);
      const sc = U.lerp(0.72, 1, grow);
      c.save();
      c.globalAlpha = 0.35 + 0.65 * Math.max(grow, 0.2);
      c.translate(dest[i].x + 48, dest[i].y + 48);
      c.scale(sc, sc);
      c.drawImage(nodePlate(dest[i].kind, P), -56, -56);
      c.restore();

      if (grow > 0.7) {
        const u = (Math.max(0, t - 0.32) * speeds[i] + i * 0.27) % 1;
        const pos = along(D5_PATHS[i], u);
        disk(c, pos[0], pos[1], 6, P.d5);
        disk(c, pos[0], pos[1], 2.4, P.white);
      }
    }

    const lockPulse = 0.55 + 0.45 * Math.sin(Math.max(0, t - 0.35) * Math.PI * 2 / 1.6);
    if (e > 0.6) {
      c.save();
      c.globalAlpha = 0.28 * lockPulse;
      c.strokeStyle = P.d5;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(340, 268, 30 + lockPulse * 8, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  const DRAWS = { D1: drawD1, D2: drawD2, D3: drawD3, D4: drawD4, D5: drawD5 };

  window.VEX_DIMENSION_ART = {
    draw(c, key, elapsed, P) {
      c.save();
      try {
        const t = Math.max(0, +elapsed || 0);
        c.beginPath();
        c.rect(0, 0, W, H);
        c.clip();
        const fn = DRAWS[key];
        if (!fn) throw new Error('Unknown dimension artist: ' + key);
        fn(c, t, P);
      } finally {
        c.restore();
      }
    },
  };
})();
