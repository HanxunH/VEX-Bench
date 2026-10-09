// VEX-Bench 54s English film. Artwork 1600×900 drawn at 1.2× into the 1920×1080 engine canvas.
// Hard cuts (no TRANSITIONS). No year/corner tags. PUNCH 0 — Vox/kinetic slam lives in the artists.
(() => {
  window.PUNCH = 0;
  window.__bootErrors = window.__bootErrors || [];

  const IDS = [
    ['problem', 7],
    ['organizations', 8],
    ['screening', 6],
    ['priorities', 5],
    ['dimensions', 9],
    ['vex', 8],
    ['evaluation', 6],
    ['close', 5],
  ];

  function drawEraArtist(id) {
    return function (c, lt, t) {
      const scene = window.VEX_ART_SCENES && VEX_ART_SCENES[id];
      if (!scene || typeof scene.draw !== 'function') {
        throw new Error('Missing artist for era ' + id);
      }
      const rt = window.VEX_RUNTIME;
      if (!rt) throw new Error('VEX_RUNTIME is required');
      c.save();
      c.scale(1.2, 1.2);
      scene.draw(c, lt, t, rt.assets, rt.palette);
      c.restore();
    };
  }

  window.ERAS = IDS.map(([id, dur]) => {
    const scene = window.VEX_ART_SCENES && VEX_ART_SCENES[id];
    if (!scene || typeof scene.draw !== 'function') {
      window.__bootErrors.push(id + ": missing VEX_ART_SCENES['" + id + "'].draw");
    }
    return { id, dur, draw: drawEraArtist(id) };
  });
})();
