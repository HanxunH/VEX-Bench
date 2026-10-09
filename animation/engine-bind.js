(() => {
  const rt = window.VEX_RUNTIME;
  if (!rt) throw new Error('VEX_RUNTIME is required before engine-bind');
  if (typeof rt.captionAt !== 'function') throw new Error('VEX_RUNTIME.captionAt is required');
  if (!window.ENGINE_READY || typeof ENGINE_READY.then !== 'function') {
    throw new Error('ENGINE_READY is required before engine-bind');
  }
  if (typeof window.renderFrame !== 'function') {
    throw new Error('renderFrame is required before engine-bind');
  }

  function clampTime(t) {
    const n = Number(t);
    const total = window.__total;
    if (!Number.isFinite(n) || n < 0) return 0;
    if (Number.isFinite(total) && n > total) return total;
    return n;
  }

  function seek(t) {
    const time = clampTime(t);
    window.renderFrame(time);
    const caption = rt.captionAt(time);
    api.caption = caption;
    const canvas = window.__canvas;
    if (canvas) canvas.setAttribute('aria-label', caption);
    return time;
  }

  const api = {
    duration: window.__total,
    chapters: rt.chapters,
    organizationExamples: rt.organizationExamples,
    ready: window.ENGINE_READY,
    seek,
    caption: rt.captionAt(0),
  };

  window.VEX_FILM = api;
  window.seek = seek;
})();
