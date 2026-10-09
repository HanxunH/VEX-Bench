(() => {
  const W = 1600;
  const H = 900;
  const AX = 90;
  const AY = 320;
  const AW = 508;
  const AH = 458;
  const ARTICLE_SCALE = 0.82;
  const PX = 1178;
  const PY = [214, 386, 558];
  const PW = 340;
  const PH = 148;
  const TOOLS = [
    { id: 'claims', name: 'Claims' },
    { id: 'source', name: 'Source' },
    { id: 'evidence', name: 'Evidence' },
  ];
  const SPANS = [0.92, 0.76, 0.84, 0.42, 0.88, 0.7, 0.8, 0.5];
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
    return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
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
    g.fillStyle = color;
    rr(g, x, y, w, h, r);
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


  function paintClaims(g, s, P) {
    const peach = P.peach;
    const deep = mixHex(P.peach, P.ink, 0.22);
    const mid = mixHex(P.peach, P.red, 0.18);
    g.fillStyle = deep;
    g.beginPath();
    g.arc(5, 7, s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = peach;
    g.beginPath();
    g.arc(0, 0, s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mid;
    g.beginPath();
    g.ellipse(-s * 0.2, -s * 0.24, s * 0.58, s * 0.46, -0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.white;
    g.beginPath();
    g.arc(0, 2, s * 0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = P.ink;
    g.lineWidth = s * 0.15;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-s * 0.22, 0.04 * s);
    g.lineTo(-s * 0.05, s * 0.22);
    g.lineTo(s * 0.28, -s * 0.2);
    g.stroke();
  }

  function paintSource(g, s, P) {
    const blue = P.blue;
    const deep = mixHex(P.blue, P.ink, 0.28);
    const mid = mixHex(P.blue, P.ink, 0.1);
    g.fillStyle = deep;
    g.beginPath();
    g.arc(5, 7, s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = blue;
    g.beginPath();
    g.arc(0, 0, s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mid;
    g.beginPath();
    g.ellipse(-s * 0.18, -s * 0.2, s * 0.5, s * 0.4, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.ink;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.1, s * 0.42, 0, Math.PI * 2);
    g.arc(-s * 0.08, -s * 0.1, s * 0.24, 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.save();
    g.translate(-s * 0.08, -s * 0.1);
    g.rotate(0.72);
    fillRound(g, -s * 0.09, s * 0.34, s * 0.18, s * 0.52, s * 0.09, P.ink);
    g.restore();
  }

  function paintEvidence(g, s, P) {
    const deep = mixHex(P.blue, P.ink, 0.22);
    const mid = mixHex(P.peach, P.ink, 0.12);
    fillRound(g, -s * 0.58 + 12, -s * 0.62 + 14, s * 1.16, s * 1.28, 18, deep);
    fillRound(g, -s * 0.58 + 6, -s * 0.62 + 7, s * 1.16, s * 1.28, 18, mid);
    fillRound(g, -s * 0.58, -s * 0.62, s * 1.16, s * 1.28, 18, P.white);
    fillRound(g, -s * 0.36, -s * 0.36, s * 0.72, s * 0.15, 6, P.marker);
    fillRound(g, -s * 0.36, -s * 0.08, s * 0.7, s * 0.09, 5, P.blue);
    fillRound(g, -s * 0.36, s * 0.08, s * 0.52, s * 0.09, 5, P.blue);
    fillRound(g, -s * 0.36, s * 0.24, s * 0.6, s * 0.09, 5, mixHex(P.blue, P.ink, 0.08));
    g.fillStyle = P.red;
    g.beginPath();
    g.arc(s * 0.38, -s * 0.42, s * 0.12, 0, Math.PI * 2);
    g.fill();
  }

  function symbolCanvas(id, P) {
    const key = 'sym_' + id;
    if (cache[key]) return cache[key];
    const size = 196;
    const cv = makeCanvas(size, size);
    const g = cv.getContext('2d');
    g.translate(size / 2, size / 2);
    const s = 78;
    if (id === 'claims') paintClaims(g, s, P);
    else if (id === 'source') paintSource(g, s, P);
    else paintEvidence(g, s, P);
    stipple(g, size, size, 41 + id.length * 17, 0.1);
    cache[key] = cv;
    return cv;
  }

  function bgWorld(P) {
    const key = 'bg';
    if (cache[key]) return cache[key];
    const cv = makeCanvas(W + 40, H + 40);
    const g = cv.getContext('2d');
    g.translate(20, 20);
    const peach = P.peach;
    const blue = P.blue;
    const deepPeach = mixHex(P.peach, P.red, 0.2);
    const deepBlue = mixHex(P.blue, P.ink, 0.12);
    g.fillStyle = peach;
    g.beginPath();
    g.ellipse(250, 690, 310, 190, -0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = deepPeach;
    g.beginPath();
    g.ellipse(210, 720, 140, 80, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = blue;
    g.beginPath();
    g.ellipse(1360, 250, 280, 210, 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = deepBlue;
    g.beginPath();
    g.ellipse(1420, 310, 120, 90, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.marker, 0.35);
    g.beginPath();
    g.ellipse(820, 790, 340, 110, 0.02, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.blue, P.white, 0.2);
    g.beginPath();
    g.ellipse(780, 430, 210, 150, -0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.white, 0.15);
    g.beginPath();
    g.arc(118, 240, 54, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.red, P.peach, 0.55);
    g.beginPath();
    g.arc(1490, 760, 64, 0, Math.PI * 2);
    g.fill();
    fillRound(g, 640, 300, 220, 54, 27, mixHex(P.peach, P.blue, 0.35));
    fillRound(g, 700, 390, 180, 44, 22, mixHex(P.blue, P.ink, 0.06));
    fillRound(g, 660, 500, 200, 48, 24, mixHex(P.peach, P.ink, 0.08));
    g.fillStyle = mixHex(P.ink, P.blue, 0.7);
    g.globalAlpha = 0.35;
    g.beginPath();
    g.arc(640, 270, 18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(980, 620, 22, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    stipple(g, cv.width, cv.height, 9, 0.16);
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

  function routeGeom(i) {
    const a = [AX + AW * ARTICLE_SCALE, AY + [96, 214, 352][i] * ARTICLE_SCALE];
    const b = [PX, PY[i] + PH / 2];
    const ctrl = [
      (a[0] + b[0]) * 0.5 + (i - 1) * 18,
      (a[1] + b[1]) * 0.5 + (i === 1 ? -36 : i === 0 ? -18 : 22),
    ];
    return quadPts(a, ctrl, b, 36);
  }

  function coverPhoto(c, img, x, y, w, h) {
    c.save();
    rr(c, x, y, w, h, 12);
    c.clip();
    const iw = img.width, ih = img.height;
    const s = Math.max(w / iw, h / ih);
    const sw = w / s, sh = h / s;
    c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
    c.restore();
  }

  function glyph(c, kind, x, y, s, color) {
    c.save();
    c.translate(x, y);
    c.scale(s / 24, s / 24);
    c.fillStyle = color;
    if (kind === 'author') {
      c.beginPath();
      c.arc(12, 8, 4.2, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(12, 20, 7.2, 6.2, 0, Math.PI, 0, true);
      c.fill();
    } else if (kind === 'bookmark') {
      c.beginPath();
      c.moveTo(7, 4);
      c.lineTo(17, 4);
      c.lineTo(17, 21);
      c.lineTo(12, 16.4);
      c.lineTo(7, 21);
      c.closePath();
      c.fill();
    } else {
      c.beginPath();
      c.arc(6, 12, 2.6, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(18, 6, 2.6, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(18, 18, 2.6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 2.2;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(8.2, 11);
      c.lineTo(15.6, 7.2);
      c.moveTo(8.2, 13);
      c.lineTo(15.6, 16.8);
      c.stroke();
    }
    c.restore();
  }

  function drawArticle(c, t, assets, P) {
    const inkSoft = mixHex(P.ink, P.paper, 0.42);
    const tone = mixHex(P.blue, P.ink, 0.16);
    fillRound(c, 10, 12, AW, AH, 28, tone);
    fillRound(c, 0, 0, AW, AH, 28, P.white);
    c.save();
    rr(c, 0, 0, AW, AH, 28);
    c.clip();
    fillRound(c, 0, 0, AW, 18, 0, P.peach);
    c.fillStyle = mixHex(P.peach, P.red, 0.25);
    c.beginPath();
    c.arc(28, 9, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = mixHex(P.blue, P.ink, 0.12);
    c.beginPath();
    c.arc(46, 9, 5, 0, Math.PI * 2);
    c.fill();
    c.restore();
    const pad = 24;
    TY.text(c, 'Earth from space', pad, 52, {
      size: 26,
      fam: 'DM Sans',
      color: P.ink,
      align: 'left',
      base: 'alphabetic',
    });
    const phY = 68, phH = 196, phW = AW - pad * 2;
    coverPhoto(c, assets.photo, pad, phY, phW, phH);
    const ringP = MO.expoOut(MO.at(MO.step(t, 12), 1.15, 0.7));
    if (ringP > 0) {
      c.save();
      c.strokeStyle = P.red;
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      c.ellipse(pad + phW / 2, phY + phH / 2, phW * 0.48, phH * 0.48, -0.08, -0.35, -0.35 + ringP * 5.9);
      c.stroke();
      c.restore();
    }
    const scan = (() => {
      if (t < 1.7) return 0;
      const st = MO.step(t - 1.7, 12);
      const local = st - Math.floor(st / 2.35) * 2.35;
      return U.clamp(local / 0.85);
    })();
    CL.highlight(c, pad, phY + 70, phW, 36, scan, 'rgba(228,214,59,0.88)');
    glyph(c, 'author', pad, 280, 22, inkSoft);
    TY.text(c, 'Reporting desk', pad + 30, 298, {
      size: 15,
      fam: 'DM Sans',
      color: inkSoft,
      align: 'left',
    });
    glyph(c, 'bookmark', AW - 78, 280, 21, inkSoft);
    glyph(c, 'share', AW - 46, 280, 21, inkSoft);
    fillRound(c, pad, 314, phW, 3, 1.5, P.blue);
    const show = MO.at(t, -0.28, 0.62);
    for (let i = 0; i < SPANS.length; i++) {
      const reveal = U.clamp(show * 1.25 - i * 0.045);
      if (reveal <= 0) continue;
      const y = 336 + i * 18;
      const w = phW * SPANS[i] * reveal;
      fillRound(c, pad, y, w, i < 2 ? 9 : 7, 4, i < 2 ? mixHex(P.blue, P.ink, 0.12) : P.blue);
    }
  }

  function drawHeadline(c, t, P) {
    const fam = 'Study Impact';
    const x = 90;
    const subject = 'Misinformation is cheap.';
    const size = TY.fit(c, subject, 1380, 84, fam, { maxLines: 1, min: 0.8 }).size;
    const track = size * -0.03;
    TY.slam(c, subject, x, 110, t + 0.1, {
      size,
      fam,
      color: P.ink,
      align: 'left',
      track,
      from: 1.05,
      oy: 110,
    });

    const secondarySize = 68;
    const verificationW = TY.width(c, 'Verification', secondarySize, fam, secondarySize * -0.03);
    TY.marker(c, x - 8, 208 - secondarySize * 0.84, verificationW + 16, secondarySize * 0.9,
      MO.at(MO.step(t, 12), 0.45, 0.3), P.marker, 0.16);
    TY.slam(c, 'Verification is not.', x, 208, t - 0.25, {
      size: secondarySize,
      fam,
      color: warmFill(c, x, 208, 'Verification is not.', secondarySize, fam),
      align: 'left',
      track: secondarySize * -0.03,
      from: 1.08,
      oy: 208,
    });
    TY.underline(c, x + TY.width(c, 'Verification is ', secondarySize, fam, secondarySize * -0.03),
      220, TY.width(c, 'not', secondarySize, fam, secondarySize * -0.03),
      MO.at(MO.step(t, 12), 0.85, 0.3), P.red, 4);
  }

  function plateCanvas(kind, P) {
    const key = 'plate_' + kind;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(PW + 18, PH + 18);
    const g = cv.getContext('2d');
    const fill = kind === 0 ? P.peach : kind === 1 ? P.blue : P.white;
    const deep = mixHex(fill, P.ink, 0.18);
    fillRound(g, 10, 12, PW, PH, 28, deep);
    fillRound(g, 2, 2, PW, PH, 28, fill);
    stipple(g, cv.width, cv.height, 70 + kind * 11, 0.1);
    cache[key] = cv;
    return cv;
  }

  function drawSymbols(c, t, P) {
    for (let i = 0; i < TOOLS.length; i++) {
      const tool = TOOLS[i];
      const lt = t - (0.48 + i * 0.13);
      const sc = lt < 0 ? 0 : MO.springHz(lt, 2.3, 9);
      const cx = PX + PW / 2, cy = PY[i] + PH / 2;
      if (sc > 0.01) {
        c.save();
        c.translate(cx, cy);
        c.scale(sc, sc);
        const plate = plateCanvas(i, P);
        c.drawImage(plate, -PW / 2 - 2, -PH / 2 - 2);
        const cv = symbolCanvas(tool.id, P);
        const is = 118;
        c.drawImage(cv, -PW / 2 + 8, -is / 2, is, is);
        c.restore();
      }
      TY.rise(c, tool.name, PX + 150, PY[i] + PH / 2 + 16, MO.at(t, 0.62 + i * 0.13, 0.3), {
        size: 44,
        fam: 'Study Impact',
        color: P.ink,
        align: 'left',
        track: -1.2,
      });
    }
  }

  function drawRoutes(c, t, P) {
    const deep = mixHex(P.red, P.ink, 0.28);
    for (let i = 0; i < 3; i++) {
      const pts = routeGeom(i);
      const st = MO.step(t, 12);
      const p = MO.expoOut(MO.at(st, 0.92 + i * 0.16, 0.55));
      if (p <= 0) continue;
      strokePartial(c, pts, p, deep, 14);
      const end = strokePartial(c, pts, p, P.red, 9);
      c.fillStyle = P.red;
      c.beginPath();
      c.arc(end[0], end[1], 7, 0, Math.PI * 2);
      c.fill();
      if (p >= 0.995) {
        const u = (st * 0.42 + i * 0.33) % 1;
        const pos = along(pts, u);
        c.fillStyle = P.red;
        c.beginPath();
        c.arc(pos[0], pos[1], 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = P.white;
        c.beginPath();
        c.arc(pos[0], pos[1], 3.2, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function draw(c, t, assets, P) {
    c.save();
    c.fillStyle = P.paper;
    c.fillRect(0, 0, W, H);
    c.translate(MO.float(t, 3.2, 6.8, 0.15), MO.float(t, 2.4, 5.2, 1.3));
    c.drawImage(bgWorld(P), -20, -20);
    CL.placed(c, 1488, 168, 0.18, (g) => {
      g.fillStyle = mixHex(P.peach, P.marker, 0.4);
      g.beginPath();
      g.ellipse(0, 0, 46, 28, 0, 0, Math.PI * 2);
      g.fill();
    });
    CL.slideIn(c, t, -0.2, AX, AY, 0, (g) => {
      g.scale(ARTICLE_SCALE, ARTICLE_SCALE);
      drawArticle(g, t, assets, P);
    }, { from: [-160, 22], tilt: 0.07, dur: 0.7, fps: 12 });
    drawRoutes(c, t, P);
    drawSymbols(c, t, P);
    drawHeadline(c, t, P);
    c.restore();
  }

  window.VEX_DIRECTIONS = window.VEX_DIRECTIONS || {};
  window.VEX_DIRECTIONS.b = {
    label: 'Flat verification flow',
    draw,
  };
})();
