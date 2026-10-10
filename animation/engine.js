// Copied from huashu-art-motion scripts/engine/engine.js
// MIT License, Copyright (c) 2026 alchaincyf (花叔 · 花生). See vendor/huashu/LICENSE.
// VEX adapts the upstream era renderer and asset/font boot to hard-cut editorial scenes.
// Unused year tags, clip sequences, transitions and legacy preview controls are removed.
(() => {
const W = 1920, H = 1080;
const LIVE_MAX_W = 1600, LIVE_MIN_W = 640, LIVE_DPR = 1.5;
const cv = document.getElementById('film');
if (!cv) throw new Error('canvas #film is required');
const EXPORT = location.search.includes('render=1');
const ctx = cv.getContext('2d', { alpha: false });
window.__canvas = cv;
window.U.setStage(W, H);

const EIGHTH = 60 / (window.BPM || 128) / 2;   // 0.234375s @128；片子可设 window.BPM
// 段长：eighths（八分音符数，卡节拍）或 dur（秒，按口播切的解说片）。写了 dur 就以 dur 为准。
let acc = 0;
for (const e of ERAS) { e.t0 = acc; acc += e.dur != null ? e.dur : e.eighths * EIGHTH; e.t1 = acc; }
// 片长 = 最后一段的 t1；window.FILM_DURATION 优先。render.py / 预览都读 window.__total。
window.__total = window.FILM_DURATION || ERAS[ERAS.length - 1].t1;
ERAS[ERAS.length - 1].t1 = 1e9;


// ---------- 资源 ----------
const IMG = {};
function load(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(src); im.src = src; });
}
async function boot() {
  if (window.__bootErrors && __bootErrors.length) { window.__bootFailed = __bootErrors.join('\n'); console.error('BOOT FAILED\n' + window.__bootFailed); return; }
  const rt = window.VEX_RUNTIME;
  if (!rt || !rt.bootstrap) throw new Error('VEX_RUNTIME.bootstrap is required');
  await rt.bootstrap;                                      // EXTRA_ASSETS / FONT_FACES come from runtime
  const list = new Set();
  for (const e of ERAS) (e.assets || []).concat(e.plate ? [e.plate] : []).forEach(s => list.add(s));
  (window.EXTRA_ASSETS || []).forEach(s => list.add(s));
  await Promise.all([...list].map(async s => { IMG[s] = await load(s); }));
  for (const f of (window.FONT_FACES || [])) { const ff = new FontFace(f.family, `url(${f.url})`, f.desc || {}); await ff.load(); document.fonts.add(ff); }
  await document.fonts.ready;
  await U.loadCmaps();                                  // 字形检查用（U.assertGlyphs）
  if (typeof rt.installAssets !== 'function') throw new Error('VEX_RUNTIME.installAssets is required');
  rt.installAssets(IMG);
  for (const e of ERAS) if (e.init) e.init(IMG);
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?()+/−–—×= ';
  for (const family of ['Study Impact', 'DM Sans', 'IBM Plex Mono']) {
    if (!U.assertGlyphs(`32px \"${family}\"`, glyphs, 'VEX film')) {
      throw new Error(`Missing film glyphs: ${family}`);
    }
  }
  window.__ready = true;
  renderFrame(0);
}
window.IMG = IMG;

const U = window.U;


// The film decodes its shared assets once during boot; preparation waits for that real boot.
window.prepare = async function () {
  await window.ENGINE_READY;
};

// Live backing follows the visible 16:9 viewport (DPR cap, pixel budget). Logical stage stays 1920×1080.
let lastT = 0, lastSoloId, lastSoloLt, lastMode = 'frame', painted = false, resizeRaf = 0;
function liveCssWidth() {
  const cw = cv.clientWidth, ch = cv.clientHeight;
  if (cw > 0 && ch > 0) return Math.min(cw, ch * W / H);
  return cw > 0 ? cw : 0;
}
function backingSize() {
  if (EXPORT) return { w: W, h: H };
  const css = liveCssWidth();
  const dpr = Math.min(window.devicePixelRatio || 1, LIVE_DPR);
  const w = Math.round(Math.min(LIVE_MAX_W, Math.max(LIVE_MIN_W, (css || LIVE_MIN_W) * dpr)));
  return { w, h: Math.round(w * H / W) };
}
function fitBacking() {
  const next = backingSize();
  if (cv.width === next.w && cv.height === next.h) return false;
  cv.width = next.w;
  cv.height = next.h;
  return true;
}
function beginDraw(c) {
  fitBacking();
  c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
function redrawLast() {
  if (!painted) return;
  if (lastMode === 'solo') window.renderSolo(lastSoloId, lastSoloLt);
  else renderFrame(lastT);
}
function scheduleFit() {
  if (EXPORT || resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    const next = backingSize();
    if (!painted) { fitBacking(); return; }
    if (cv.width !== next.w || cv.height !== next.h) redrawLast();
  });
}
fitBacking();
if (!EXPORT) {
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFit).observe(cv);
  window.addEventListener('resize', scheduleFit);
  if (window.visualViewport) visualViewport.addEventListener('resize', scheduleFit);
  window.addEventListener('pagehide', () => { if (resizeRaf) cancelAnimationFrame(resizeRaf); resizeRaf = 0; });
}

// ---------- 画一个时代（本段局部时间 lt） ----------
function drawEra(c, e, t) {
  const lt = t - e.t0;
  beginDraw(c);
  c.save();
  c.clearRect(0, 0, W, H);
  if (typeof e.draw !== 'function') throw new Error(`Missing artist: ${e.id}`);
  e.draw(c, lt, t, IMG);
  c.restore();
}

// ---------- 主渲染 ----------
function renderFrame(t) {
  lastMode = 'frame';
  lastT = t;
  let k = ERAS.findIndex(e => t >= e.t0 && t < e.t1);
  if (k < 0) k = ERAS.length - 1;
  drawEra(ctx, ERAS[k], t);
  if (window.GLOBAL_OVERLAY) window.GLOBAL_OVERLAY(ctx, t);
  painted = true;
  return k;
}
window.renderFrame = renderFrame;
// Solo rendering uses the same real scene artist and global-time anchor as the full film.
window.renderSolo = function (id, lt) {
  const era = ERAS.find(e => e.id === id);
  if (!era) throw new Error(`Unknown solo scene: ${id}`);
  lastMode = 'solo';
  lastSoloId = id;
  lastSoloLt = lt;
  drawEra(ctx, era, era.t0 + lt);
  painted = true;
};

if (EXPORT) document.body.classList.add('render');
window.ENGINE_READY = (async () => {
  try {
    await boot();
    if (window.__bootFailed) throw new Error(window.__bootFailed);
    if (window.__ready !== true) throw new Error('Engine boot did not complete');
  } catch (err) {
    const msg = window.__bootFailed || (err && err.message) || String(err);
    if (!window.__bootFailed) console.error('boot failed', err);
    window.__bootFailed = msg;
    throw (err instanceof Error ? err : new Error(msg));
  }
})();
})();
