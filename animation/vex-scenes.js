(() => {
  const W = 1600;
  const H = 900;
  const COL_X = [80, 580, 1080];
  const COL_W = 440;
  const SPANS = [0.92, 0.76, 0.84, 0.42, 0.88, 0.7, 0.8, 0.5, 0.86, 0.62];
  const ORDERS = [[0, 1, 2], [1, 0, 2], [2, 1, 0]];
  const ORGS = [
    { key: 'newsrooms', name: 'Newsroom', priorities: ['D2'] },
    { key: 'factCheckers', name: 'Fact-checker', priorities: ['D1', 'D5'] },
    { key: 'platforms', name: 'Platform', priorities: ['D2', 'D3'] },
  ];
  const COMBOS = [
    { mask: 19, label: 'D1 + D2 + D5' },
    { mask: 14, label: 'D2 + D3 + D4' },
    { mask: 17, label: 'D1 + D5' },
  ];
  const OPTICAL = {
    folha: 1.2, nhk: 1.13, 'al-jazeera': 1.1, 'the-hindu': 1.1,
    x: 1.06, snapchat: 1.08, threads: 1.06,
    youtube: 0.96, facebook: 0.94, instagram: 0.94, bbc: 0.94,
  };
  const cache = {};

  function need(img, label) {
    if (!img || !img.width) throw new Error('Missing asset: ' + label);
    return img;
  }

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

  function bgWorld(P, seed) {
    const key = 'bg:' + seed + P.paper + P.peach + P.blue;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(W + 40, H + 40);
    const g = cv.getContext('2d');
    g.translate(20, 20);
    const peach = P.peach;
    const blue = P.blue;
    const deepPeach = mixHex(P.peach, P.red, 0.2);
    const deepBlue = mixHex(P.blue, P.ink, 0.12);
    const ox = (seed % 5) * 18 - 36;
    const oy = ((seed * 3) % 5) * 10 - 20;
    g.fillStyle = peach;
    g.beginPath();
    g.ellipse(250 + ox, 620 + oy, 300, 170, -0.18, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = deepPeach;
    g.beginPath();
    g.ellipse(210 + ox, 650 + oy, 130, 72, 0.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = blue;
    g.beginPath();
    g.ellipse(1360 - ox, 240 + oy, 270, 190, 0.22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = deepBlue;
    g.beginPath();
    g.ellipse(1420 - ox, 300 + oy, 110, 80, -0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.marker, 0.35);
    g.beginPath();
    g.ellipse(820, 700, 320, 90, 0.02, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.blue, P.white, 0.2);
    g.beginPath();
    g.ellipse(780 + ox, 400, 200, 140, -0.35, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.peach, P.white, 0.15);
    g.beginPath();
    g.arc(118, 220, 50, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mixHex(P.red, P.peach, 0.55);
    g.beginPath();
    g.arc(1490, 680, 58, 0, Math.PI * 2);
    g.fill();
    fillRound(g, 640, 280, 200, 48, 24, mixHex(P.peach, P.blue, 0.35));
    fillRound(g, 700, 360, 170, 40, 20, mixHex(P.blue, P.ink, 0.06));
    fillRound(g, 660, 460, 190, 44, 22, mixHex(P.peach, P.ink, 0.08));
    stipple(g, cv.width, cv.height, 9 + seed * 17, 0.16);
    cache[key] = cv;
    return cv;
  }

  function plate(w, h, fill, P, seed) {
    const key = 'plate:' + w + ':' + h + ':' + fill + ':' + seed;
    if (cache[key]) return cache[key];
    const cv = makeCanvas(w + 18, h + 18);
    const g = cv.getContext('2d');
    const deep = mixHex(fill, P.ink, 0.16);
    fillRound(g, 10, 12, w, h, 22, deep);
    fillRound(g, 2, 2, w, h, 22, fill);
    stipple(g, cv.width, cv.height, 70 + seed, 0.1);
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

  function routeDot(c, pts, st, i, P) {
    const p = MO.expoOut(MO.at(st, 0.35 + i * 0.12, 0.55));
    if (p <= 0) return;
    const deep = mixHex(P.red, P.ink, 0.28);
    strokePartial(c, pts, p, deep, 12);
    const end = strokePartial(c, pts, p, P.red, 7);
    c.fillStyle = P.red;
    c.beginPath();
    c.arc(end[0], end[1], 6, 0, Math.PI * 2);
    c.fill();
    if (p >= 0.995) {
      const u = (st * 0.38 + i * 0.31) % 1;
      const pos = along(pts, u);
      c.fillStyle = P.red;
      c.beginPath();
      c.arc(pos[0], pos[1], 7, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = P.white;
      c.beginPath();
      c.arc(pos[0], pos[1], 2.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  function scanQ(st, period, dur) {
    if (st < dur) return U.clamp(st / dur);
    return 0.92 + 0.08 * Math.cos((st - dur) * Math.PI * 2 / period);
  }



  function opticalMark(c, img, x, y, w, h, id) {
    need(img, 'marks.' + id);
    const iw = img.width, ih = img.height;
    const ratio = iw / ih;
    const optical = OPTICAL[id] || 1;
    let mh = Math.min(h + 4, Math.sqrt(2600 / ratio) * optical);
    let mw = mh * ratio;
    if (mw > w) { mw = w; mh = mw / ratio; }
    c.drawImage(img, x + (w - mw) / 2, y + (h - mh) / 2, mw, mh);
  }

  function pageOf(A, key, page) {
    const pages = A && A.pages && A.pages[key];
    if (!pages || !pages.length) throw new Error('Missing asset: pages.' + key);
    const recs = pages[Math.min(page, pages.length - 1)];
    if (!recs || recs.length < 8) throw new Error('Missing asset: pages.' + key + ' needs 8 records');
    return recs;
  }


  function world(c, lt, P, seed, fn) {
    c.save();
    c.fillStyle = P.paper;
    c.fillRect(0, 0, W, H);
    c.translate(MO.float(lt, 6.4, 4.8, 0.15), MO.float(lt, 4.8, 4.2, 1.3));
    c.drawImage(bgWorld(P, seed), -20, -20);
    fn();
    c.restore();
  }

  function slamHead(c, text, x, y, lt, size, color) {
    TY.slam(c, text, x, y, lt, {
      size,
      fam: 'Study Impact',
      color,
      align: 'left',
      track: size * -0.03,
    });
  }

  function body(c, text, x, y, p, size, color) {
    TY.rise(c, text, x, y, p, {
      size,
      fam: 'DM Sans',
      color,
      align: 'left',
    });
  }

  function dataText(c, text, x, y, size, color, align) {
    TY.text(c, text, x, y, {
      size,
      fam: 'IBM Plex Mono',
      color,
      align: align || 'left',
    });
  }

  function drawSheet(c, x, y, w, h, P, lines, shift, seed) {
    const pl = plate(w, h, P.white, P, seed);
    c.drawImage(pl, x - 2, y - 2);
    const pad = 28;
    fillRound(c, x + pad, y + 22, Math.min(72, w * 0.18), 8, 4, mixHex(P.peach, P.red, 0.25));
    fillRound(c, x + pad, y + 42, (w - pad * 2) * 0.72, 10, 5, mixHex(P.blue, P.ink, 0.12));
    fillRound(c, x + pad, y + 60, (w - pad * 2) * 0.44, 8, 4, P.blue);
    const top = y + 92;
    for (let i = 0; i < 8; i++) {
      const reveal = U.clamp(lines * 1.2 - i * 0.08);
      if (reveal <= 0) continue;
      const yy = top + i * 22 + shift * (i % 2 === 0 ? -10 : 12);
      const ww = (w - pad * 2) * SPANS[i] * reveal;
      fillRound(c, x + pad, yy, ww, i < 2 ? 9 : 7, 4, i < 2 ? mixHex(P.blue, P.ink, 0.12) : P.blue);
    }
  }

  function iconClock(c, x, y, s, st, P) {
    c.save();
    c.translate(x, y);
    c.fillStyle = mixHex(P.blue, P.ink, 0.1);
    c.beginPath();
    c.arc(4, 5, s, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = P.white;
    c.beginPath();
    c.arc(0, 0, s, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = P.ink;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, s - 2, 0, Math.PI * 2);
    c.stroke();
    const a = st * 0.7;
    c.strokeStyle = P.red;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(a) * s * 0.55, -Math.cos(a) * s * 0.55);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.sin(a * 12) * s * 0.72, -Math.cos(a * 12) * s * 0.72);
    c.stroke();
    c.restore();
  }

  function iconStaff(c, x, y, s, P) {
    const h = [s * 1.1, s * 1.55, s * 0.85];
    for (let i = 0; i < 3; i++) {
      fillRound(c, x + i * (s * 0.7), y + s * 1.55 - h[i], s * 0.48, h[i], 6, i === 1 ? P.red : mixHex(P.blue, P.ink, 0.18));
    }
  }

  function iconBudget(c, x, y, s, st, P) {
    for (let i = 0; i < 3; i++) {
      const lift = Math.sin(st * 1.4 + i * 0.9) * 2;
      c.fillStyle = i === 2 ? mixHex(P.marker, P.red, 0.35) : mixHex(P.peach, P.red, 0.2);
      c.beginPath();
      c.ellipse(x + s, y + s * 1.15 - i * s * 0.38 + lift, s * 0.9, s * 0.28, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  function redPen(c, x, y, rx, ry, p, P) {
    if (p <= 0) return;
    c.save();
    c.strokeStyle = P.red;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.ellipse(x, y, rx, ry, -0.08, -0.4, -0.4 + MO.expoOut(p) * 6.0);
    c.stroke();
    c.restore();
  }

  function drawProblem(c, lt, t, A, P) {
    void t;
    if (!window.VEX_DIRECTIONS || !VEX_DIRECTIONS.b || !VEX_DIRECTIONS.b.draw) {
      throw new Error('Missing asset: VEX_DIRECTIONS.b');
    }
    need(A && A.photo, 'photo');
    VEX_DIRECTIONS.b.draw(c, lt, A, P);
  }

  function drawOrganizations(c, lt, t, A, P) {
    void t;
    world(c, lt, P, 2, () => {
      const st = MO.step(lt, 12);
      const fam = 'Study Impact';
      slamHead(c, 'Different organizations.', 80, 128, lt + 0.08, 54, P.ink);
      const line2 = 'Different priorities.';
      const g2 = warmFill(c, 80, 196, line2, 54, fam);
      const markW = TY.width(c, 'priorities', 54, fam);
      const preW = TY.width(c, 'Different ', 54, fam);
      TY.marker(c, 80 + preW - 8, 196 - 54 * 0.84, markW + 18, 54 * 1.02, MO.at(st, 0.45, 0.32), P.marker, 0.16);
      slamHead(c, line2, 80, 196, lt - 0.22, 54, g2);

      const waveDuration = 8 / 3;
      const page = Math.min(2, Math.max(0, Math.floor(lt / waveDuration)));
      for (let g = 0; g < 3; g++) {
        const org = ORGS[g];
        const x = COL_X[g];
        body(c, org.name, x, 262, MO.at(lt, 0.28 + g * 0.08, 0.28), 32, P.ink);
        const recs = pageOf(A, org.key, page);
        for (let i = 0; i < 8; i++) {
          const rec = recs[i];
          if (!rec || !rec.id) throw new Error('Missing asset: pages.' + org.key + '[' + i + ']');
          const cx = x + (i % 2) * 224;
          const cy = 286 + Math.floor(i / 2) * 104;
          const sc = MO.springHz(lt - Math.floor(i / 2) * 0.05, 2.3, 9);
          if (sc <= 0.01) continue;
          c.save();
          c.translate(cx + 104, cy + 44);
          c.scale(sc, sc);
          const pl = plate(208, 88, P.white, P, 30 + g * 8 + i);
          c.drawImage(pl, -106, -46);
          opticalMark(c, A.marks[rec.id], -90, -32, 180, 64, rec.id);
          c.restore();
        }
      }
    });
  }

  function drawPriorities(c, lt, t, A, P) {
    void t;
    if (!A.benchmark || !Array.isArray(A.benchmark.dimensions)) throw new Error('Missing priority dimension definitions');
    world(c, lt, P, 3, () => {
      const st = MO.step(lt, 12);
      const fam = 'Study Impact';
      const g1 = warmFill(c, 80, 128, 'Prioritize.', 58, fam);
      slamHead(c, 'Prioritize.', 80, 128, lt + 0.08, 58, g1);
      slamHead(c, 'Deprioritize.', 80, 196, lt - 0.18, 58, P.ink);
      TY.underline(c, 80, 140, TY.width(c, 'Prioritize.', 58, fam), MO.at(st, 0.4, 0.35), P.red, 6);

      const sort = MO.smooth(MO.at(st, 0.35, 0.85));
      iconClock(c, 92, 250, 16, st, P);
      iconStaff(c, 148, 236, 16, P);
      iconBudget(c, 214, 238, 16, st, P);
      body(c, 'Time  ·  staff  ·  budget', 268, 258, MO.at(lt, 0.25, 0.28), 22, mixHex(P.ink, P.paper, 0.32));
      for (let g = 0; g < 3; g++) {
        const x0 = COL_X[g];
        body(c, ORGS[g].name, x0, 310, MO.at(lt, 0.2 + g * 0.06, 0.25), 30, P.ink);
        for (let j = 0; j < ORGS[g].priorities.length; j++) {
          const key = ORGS[g].priorities[j];
          const dim = A.benchmark.dimensions.find(item => item.key === key);
          if (!dim) throw new Error('Missing priority dimension: ' + key);
          TY.text(c, key + ' ' + dim.label, x0, 354 + j * 32, {
            size: 24,
            fam: 'DM Sans',
            color: dim.color,
            align: 'left',
            alpha: MO.at(lt, 0.22 + g * 0.06, 0.25),
          });
        }
        const order = ORDERS[g];
        for (let article = 0; article < 3; article++) {
          const target = order.indexOf(article);
          const x = x0 + U.lerp(article, target, sort) * 138;
          const lift = article === target ? 0 : Math.sin(Math.PI * sort) * (target < article ? -88 : 88);
          const y = 516 + lift;
          const first = target === 0 && sort > 0.88;
          const fill = first ? P.peach : P.white;
          const pl = plate(126, 86, fill, P, 50 + article + g * 3);
          c.drawImage(pl, x - 2, y - 2);
          TY.text(c, 'Article ' + String.fromCharCode(65 + article), x + 14, y + 52, {
            size: 22,
            fam: 'DM Sans',
            color: first ? P.red : P.ink,
            align: 'left',
          });
        }
        const firstX = x0;
        const firstY = 516;
        const pts = quadPts([x0 + 40, 412], [x0 + 40, 462], [firstX + 63, firstY + 8], 16);
        routeDot(c, pts, st - 0.9, g, P);
        if (sort >= 0.95) {
          CL.highlight(c, firstX, firstY + 18, 126, 44, scanQ(st - g * 0.2, 2.2, 0.8), 'rgba(228,214,59,0.8)');
        }
        const pg = warmFill(c, x0, 728, 'Prioritize', 22, fam);
        TY.text(c, 'Prioritize', x0, 728, { size: 20, fam, color: pg, align: 'left' });
        TY.text(c, 'Deprioritize', x0 + 138, 728, { size: 20, fam: 'DM Sans', color: mixHex(P.ink, P.paper, 0.35), align: 'left' });
      }
    });
  }

  function drawScreening(c, lt, t, A, P) {
    void t;
    void A;
    world(c, lt, P, 4, () => {
      const st = MO.step(lt, 12);
      const mainLine = 'Screen first.';
      TY.marker(c, 72, 128 - 56 * 0.84, TY.width(c, mainLine, 56, 'Study Impact') + 16, 56 * 0.95, MO.at(st, 0.2, 0.3), P.marker, 0.16);
      slamHead(c, mainLine, 80, 128, lt + 0.08, 56, warmFill(c, 80, 128, mainLine, 56, 'Study Impact'));
      slamHead(c, 'Verify next.', 80, 196, lt - 0.2, 44, mixHex(P.ink, P.paper, 0.3));

      iconClock(c, 92, 250, 16, st, P);
      iconStaff(c, 148, 236, 16, P);
      iconBudget(c, 214, 238, 16, st, P);
      body(c, 'Time  ·  staff  ·  budget', 268, 258, MO.at(lt, 0.35, 0.28), 22, mixHex(P.ink, P.paper, 0.32));

      const boxes = [
        { x: 80, y: 320, w: 360, h: 300, title: 'Incoming content', fill: P.blue },
        { x: 620, y: 320, w: 360, h: 300, title: 'Screening', fill: P.peach },
        { x: 1160, y: 320, w: 360, h: 300, title: 'Verification', fill: P.white },
      ];
      for (let i = 0; i < 3; i++) {
        const b = boxes[i];
        const sc = MO.springHz(lt - 0.15 - i * 0.1, 2.2, 9);
        if (sc <= 0.01) continue;
        c.save();
        c.globalAlpha *= i === 1 ? 1 : i === 0 ? 0.86 : 0.48;
        c.translate(b.x + b.w / 2, b.y + b.h / 2);
        c.scale(sc, sc);
        const pl = plate(b.w, b.h, b.fill, P, 80 + i);
        c.drawImage(pl, -b.w / 2 - 2, -b.h / 2 - 2);
        c.restore();
        TY.text(c, b.title, b.x + 28, b.y + 64, {
          size: i === 1 ? 34 : 28,
          fam: 'Study Impact',
          color: P.ink,
          align: 'left',
          alpha: MO.at(lt, 0.28 + i * 0.1, 0.28) * (i === 1 ? 1 : i === 0 ? 0.86 : 0.56),
          track: -0.8,
        });
      }
      CL.highlight(c, 620, 360, 280, 48, scanQ(st, 2.4, 0.85), 'rgba(228,214,59,0.82)');
      c.save();
      c.globalAlpha = MO.at(lt, 0.5, 0.35) * (0.7 + Math.sin(lt * 1.7) * 0.12);
      c.strokeStyle = P.red;
      c.lineWidth = 3;
      rr(c, 620, 320, 360, 300, 22);
      c.stroke();
      c.restore();
      TY.text(c, 'VEX-Bench', 800, 450, {
        size: 34,
        fam: 'Study Impact',
        color: P.ink,
        align: 'center',
        alpha: MO.at(lt, 0.55, 0.3),
      });

      const flow = MO.expoOut(MO.at(st, 0.55, 0.7));
      const p1 = quadPts([440, 470], [530, 440], [620, 470], 20);
      const p2 = quadPts([980, 470], [1070, 440], [1160, 470], 20);
      routeDot(c, p1, st, 0, P);
      c.save();
      c.setLineDash([10, 10]);
      strokePartial(c, p2, MO.at(st, 0.6, 0.5), mixHex(P.ink, P.paper, 0.74), 2.5);
      c.restore();

      const move = U.lerp(140, 760, flow);
      c.save();
      c.translate(move, 500 + Math.sin(st * 1.1) * 4);
      c.scale(0.42, 0.42);
      drawSheet(c, 0, 0, 220, 260, P, 0.7 + flow * 0.3, 0, 91);
      c.restore();

      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(110 + i * 36, 430 + i * 14);
        c.scale(0.34, 0.34);
        drawSheet(c, 0, 0, 200, 240, P, 0.45 + i * 0.12, Math.sin(st * 1.3 + i) * 3, 92 + i);
        c.restore();
      }
    });
  }

  function drawDimensions(c, lt, t, A, P) {
    if (!window.VEX_DIMENSION_SCENE || typeof VEX_DIMENSION_SCENE.draw !== 'function') {
      throw new Error('Missing artist: VEX_DIMENSION_SCENE.draw');
    }
    VEX_DIMENSION_SCENE.draw(c, lt, t, A, P);
  }

  function drawVex(c, lt, t, A, P) {
    void t;
    world(c, lt, P, 6, () => {
      const st = MO.step(lt, 12);
      slamHead(c, 'Your priorities.', 80, 120, lt + 0.08, 48, P.ink);
      const line2 = 'Your VEX lens.';
      const g2 = warmFill(c, 80, 178, line2, 48, 'Study Impact');
      TY.marker(c, 80 + TY.width(c, 'Your ', 48, 'Study Impact') - 6, 178 - 48 * 0.84, TY.width(c, 'VEX', 48, 'Study Impact') + 14, 48 * 1.02, MO.at(st, 0.4, 0.28), P.marker, 0.16);
      slamHead(c, line2, 80, 178, lt - 0.18, 48, g2);

      const slot = 8 / 3;
      const active = Math.min(2, Math.max(0, Math.floor(st / slot)));
      const combo = COMBOS[active];
      if (!A.benchmark || !window.VEX_SCORE_PANEL) throw new Error('Missing VEX numerical data or artist');
      const lens = A.benchmark.lenses.find(item => item.mask === combo.mask);
      if (!lens) throw new Error('Missing VEX lens: ' + combo.mask);
      const since = st - active * slot;

      slamHead(c, '31', 80, 310, lt - 0.35, 92, P.ink);
      redPen(c, 148, 278, 78, 52, MO.at(st, 0.5, 0.55), P);
      body(c, 'non-empty combinations', 80, 352, MO.at(lt, 0.5, 0.28), 20, mixHex(P.ink, P.paper, 0.35));
      TY.rise(c, combo.label, 80, 392, MO.at(since, 0.05, 0.28), {
        size: 24,
        fam: 'IBM Plex Mono',
        color: P.red,
        align: 'left',
      });

      for (let mask = 1; mask <= 31; mask++) {
        const i = mask - 1;
        const col = i % 8;
        const row = Math.floor(i / 8);
        const x = 80 + col * 28;
        const y = 418 + row * 26;
        const on = mask === combo.mask;
        let nSel = 0;
        for (let b = 0; b < 5; b++) if (mask & (1 << b)) nSel += 1;
        fillRound(c, x, y, 20, 20, 5, on ? P.red : mixHex(P.blue, P.ink, 0.05 + nSel * 0.04));
        if (on) {
          c.strokeStyle = P.marker;
          c.lineWidth = 2.5;
          rr(c, x - 2, y - 2, 24, 24, 6);
          c.stroke();
        }
      }

      CL.slideIn(c, lt, -0.12, 620, 168, 0, (g) => {
        VEX_SCORE_PANEL.draw(g, since, lens, A.benchmark, P);
      }, { from: [140, 16], tilt: -0.04, dur: 0.7, fps: 12 });

      for (let i = 0; i < COMBOS.length; i++) {
        const item = A.benchmark.lenses.find(value => value.mask === COMBOS[i].mask);
        if (!item) throw new Error('Missing VEX comparison lens: ' + COMBOS[i].mask);
        c.save();
        c.globalAlpha = i === active ? 1 : 0.55;
        const x = 80 + i * 170;
        fillRound(c, x, 560, 156, 96, 14, i === active ? P.peach : P.white);
        TY.text(c, COMBOS[i].label.replace(/ /g, ''), x + 12, 592, {
          size: 17, fam: 'IBM Plex Mono', color: P.ink, align: 'left',
        });
        dataText(c, Number.isFinite(item.selected.score) ? item.selected.score.toFixed(1) : '—', x + 12, 630, 28, P.ink);
        c.restore();
      }

      const formula = 'VEX = SR × NR × mean(normalized D)';
      TY.rise(c, formula, 80, 710, MO.at(lt, 0.7, 0.34), {
        size: 22,
        fam: 'IBM Plex Mono',
        color: P.ink,
        align: 'left',
      });
      TY.underline(c, 80, 722, TY.width(c, formula, 22, 'IBM Plex Mono'), MO.at(st, 0.9, 0.4), P.red, 3);
      CL.highlight(c, 80, 688, 420, 28, scanQ(st, 3.1, 0.9), 'rgba(228,214,59,0.55)');
    });
  }

  function drawEvaluation(c, lt, t, A, P) {
    if (!window.VEX_EVALUATION_SCENE || typeof VEX_EVALUATION_SCENE.draw !== 'function') {
      throw new Error('Missing benchmark evaluation artist');
    }
    VEX_EVALUATION_SCENE.draw(c, lt, t, A, P);
  }


  function drawClose(c, lt, t, A, P) {
    void t;
    const local = Math.min(lt, 3.5);
    world(c, local, P, 10, () => {
      const title = 'VEX-Bench';
      TY.slam(c, title, 800, 260, local + 0.1, {
        size: 112, fam: 'Study Impact', color: warmFill(c, 480, 260, title, 112, 'Study Impact'),
        align: 'center', track: -3.36, from: 1.1, ox: 800, oy: 260,
      });
      const width = TY.width(c, title, 112, 'Study Impact', -3.36);
      TY.underline(c, 800 - width / 2, 278, width, MO.at(local, 0.3, 0.45), P.red, 6);
      TY.text(c, 'Evaluate verification complexity.', 800, 358, {
        size: 48, fam: 'Study Impact', color: P.ink, align: 'center',
        alpha: MO.at(local, 0.25, 0.3),
      });
      CL.highlight(c, 486, 322, 380, 46, scanQ(local, 2.8, 0.7), 'rgba(228,214,59,0.5)');
      const rows = [
        { id: 'arxiv', url: 'arxiv.org/abs/2609.35028', y: 464 },
        { id: 'huggingface', url: 'huggingface.co/datasets/hanxunh/VEX-Bench', y: 548 },
        { id: 'website', url: 'hanxunh.github.io/VEX-Bench', y: 632 },
      ];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        c.save();
        c.globalAlpha *= MO.at(local, 0.45 + i * 0.17, 0.3);
        if (row.id === 'website') {
          c.strokeStyle = P.ink;
          c.lineWidth = 2.5;
          c.beginPath();
          c.arc(400, row.y - 12, 14, 0, Math.PI * 2);
          c.moveTo(386, row.y - 12);
          c.lineTo(414, row.y - 12);
          c.stroke();
          c.beginPath();
          c.ellipse(400, row.y - 12, 6, 14, 0, 0, Math.PI * 2);
          c.stroke();
        } else {
          const img = need(A.resources[row.id], 'resources.' + row.id);
          const w = 44 * img.width / img.height;
          c.drawImage(img, 400 - w / 2, row.y - 34, w, 44);
        }
        TY.text(c, row.url, 440, row.y, { size: 30, fam: 'IBM Plex Mono', color: P.ink, align: 'left' });
        c.restore();
      }
    });
  }

  window.VEX_ART_SCENES = {
    problem: { draw: drawProblem },
    organizations: { draw: drawOrganizations },
    priorities: { draw: drawPriorities },
    screening: { draw: drawScreening },
    dimensions: { draw: drawDimensions },
    vex: { draw: drawVex },
    evaluation: { draw: drawEvaluation },
    close: { draw: drawClose },
  };
})();
