(() => {
  "use strict";
  const audio = document.getElementById("score");
  const status = document.getElementById("load-state");
  const origin = location.origin;
  const FRAME_MS = 1000 / 30;
  const CADENCE_SLACK_MS = 2;
  let ready = false;
  let playing = false;
  let time = 0;
  let anchor = 0;
  let frame = 0;
  let cadenceSlot = -1;
  let lastUpdate = -Infinity;
  let audioRequest = 0;
  let pendingStart = null;
  let error = null;
  let soundBlocked = false;
  let standaloneResume = false;

  function currentTime(now = performance.now()) {
    return playing ? Math.min(window.__total, time + (now - anchor) / 1000) : time;
  }

  function state() {
    return { ready, playing, time: currentTime(), duration: window.__total || 54, muted: audio.muted, soundBlocked, error };
  }

  function report(event, message) {
    if (parent !== window) {
      parent.postMessage({ type: "vex-intro", event, ...state(), ...(message ? { message } : {}) }, origin);
    }
  }

  function stopAudio() {
    audioRequest += 1;
    audio.pause();
  }

  function alignAudio() {
    if (audio.readyState < 1) return;
    const synced = currentTime();
    if (Math.abs(audio.currentTime - synced) < 0.01) return;
    audio.currentTime = synced;
  }

  function startAudio() {
    const request = ++audioRequest;
    soundBlocked = false;
    alignAudio();
    const attempt = audio.play();
    if (!attempt) return;
    attempt.then(() => {
      if (request !== audioRequest || !playing || audio.paused) return;
      soundBlocked = false;
      if (audio.readyState >= 1 && Math.abs(audio.currentTime - currentTime()) > 0.2) {
        audio.currentTime = currentTime();
      }
      if (!audio.muted) report("sound");
    }).catch((failure) => {
      if (request !== audioRequest || !playing || failure.name === "AbortError") return;
      soundBlocked = true;
      report("sound-blocked", failure.message);
    });
  }

  function fail(failure) {
    pause();
    error = failure instanceof Error ? failure.message : String(failure);
    status.hidden = false;
    status.textContent = "Animation could not be loaded.";
    report("error", error);
  }

  function tick(now) {
    if (!playing) return;
    const next = currentTime(now);
    try {
      const slot = Math.floor((now - anchor + CADENCE_SLACK_MS) / FRAME_MS);
      if (next === window.__total || slot > cadenceSlot) {
        window.VEX_FILM.seek(next);
        cadenceSlot = slot;
      }
      if (next === window.__total) {
        time = next;
        playing = false;
        frame = 0;
        stopAudio();
        report("ended");
        return;
      }
      if (now - lastUpdate >= 250) {
        lastUpdate = now;
        report("timeupdate");
      }
      frame = requestAnimationFrame(tick);
    } catch (failure) {
      fail(failure);
    }
  }

  function start(reset, muted) {
    if (typeof muted === "boolean") audio.muted = muted;
    if (!ready) {
      pendingStart = { reset, muted };
      return;
    }
    if (error) {
      report("error", error);
      return;
    }
    if (playing && !reset) return;
    time = reset || time >= window.__total ? 0 : currentTime();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    playing = true;
    anchor = performance.now();
    cadenceSlot = 0;
    lastUpdate = -Infinity;
    window.VEX_FILM.seek(time);
    // Synchronous call from the parent click preserves the sound activation gesture.
    startAudio();
    report("playing");
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    pendingStart = null;
    if (playing) time = currentTime();
    playing = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    stopAudio();
    report("paused");
  }

  function command(input) {
    if (!input || typeof input.action !== "string") return false;
    switch (input.action) {
      case "restart": start(true, input.muted); break;
      case "play": start(false, input.muted); break;
      case "pause": pause(); break;
      case "mute":
        if (typeof input.muted !== "boolean") return false;
        audio.muted = input.muted;
        if (pendingStart) pendingStart.muted = input.muted;
        if (playing) startAudio();
        report("mute");
        break;
      default: return false;
    }
    return true;
  }

  window.VEX_INTRO_PLAYER = { command, state };
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== origin || event.data?.type !== "vex-intro") return;
    command(event.data);
  });
  window.addEventListener("pagehide", pause);
  document.addEventListener("visibilitychange", () => {
    // The homepage owns embedded visibility/replay state; standalone source preview owns its own.
    if (parent !== window) return;
    if (document.hidden) {
      standaloneResume = playing;
      pause();
    } else if (standaloneResume) {
      standaloneResume = false;
      start(false);
    }
  });
  audio.addEventListener("loadedmetadata", () => {
    if (playing) alignAudio();
  });
  audio.addEventListener("error", () => {
    soundBlocked = true;
    report("sound-blocked", "The soundtrack could not be loaded.");
  });

  if (!window.VEX_FILM?.ready) {
    fail(new Error("Animation engine did not initialize."));
    return;
  }
  window.VEX_FILM.ready.then(() => {
    ready = true;
    status.hidden = true;
    window.VEX_FILM.seek(0);
    report("ready");
    if (pendingStart) {
      const pending = pendingStart;
      pendingStart = null;
      start(pending.reset, pending.muted);
    }
  }).catch(fail);
})();
