(() => {
  "use strict";
  const iframe = document.getElementById("vex-intro");
  if (!iframe) return;

  const ORIGIN = window.location.origin;
  const root = document.documentElement;
  const hero = document.getElementById("hero-intro");
  const slot = document.getElementById("intro-slot");
  const frame = document.getElementById("intro-frame");
  const playBtn = document.getElementById("intro-play");
  const chrome = document.getElementById("intro-chrome");
  const pauseBtn = document.getElementById("intro-pause");
  const soundBtn = document.getElementById("intro-sound");
  const enableBtn = document.getElementById("intro-enable-sound");
  const skipBtn = document.getElementById("intro-skip");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DOCK_MS = 600;
  const DOCK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
  const READY_MS = 8000;

  let phase = "docked";
  let motionToken = 0;
  let dockTimer = 0;
  let dockEndHandler = null;
  let readyTimer = 0;
  let resumeOnVisible = false;
  let reduced = reduceMotion.matches;
  let sourceReady = false;
  let sourcePaused = true;
  let wantMuted = false;
  let gotPlayback = false;
  let wantsPlayback = false;
  let soundBlocked = false;
  const inertBefore = new Map();

  function setBackgroundInert(active) {
    if (!active) {
      for (const [element, previous] of inertBefore) element.inert = previous;
      inertBefore.clear();
      return;
    }
    for (let child = frame; child.parentElement && child !== document.body; child = child.parentElement) {
      for (const sibling of child.parentElement.children) {
        if (sibling === child || !(sibling instanceof HTMLElement)) continue;
        if (!inertBefore.has(sibling)) inertBefore.set(sibling, sibling.inert);
        sibling.inert = true;
      }
    }
  }

  iframe.tabIndex = -1;
  root.classList.add("intro-ready");
  function updateReadyControls() {
    playBtn.disabled = !sourceReady;
    pauseBtn.disabled = !sourceReady;
    soundBtn.disabled = !sourceReady;
    enableBtn.disabled = !sourceReady;
  }


  function playerApi() {
    try {
      return iframe.contentWindow && iframe.contentWindow.VEX_INTRO_PLAYER;
    } catch {
      return null;
    }
  }

  function post(action, extra) {
    const win = iframe.contentWindow;
    if (!win) return false;
    const payload = { type: "vex-intro", action };
    if (extra && typeof extra.muted === "boolean") payload.muted = extra.muted;
    win.postMessage(payload, ORIGIN);
    return true;
  }

  function syncFromState() {
    const api = playerApi();
    if (!api || typeof api.state !== "function") return null;
    let state;
    try {
      state = api.state();
    } catch {
      return null;
    }
    if (!state || typeof state !== "object") return null;
    if (state.ready) sourceReady = true;
    updateReadyControls();
    if (typeof state.playing === "boolean") sourcePaused = !state.playing;
    if (typeof state.muted === "boolean") wantMuted = state.muted;
    if (typeof state.soundBlocked === "boolean") soundBlocked = state.soundBlocked;
    if (state.playing) gotPlayback = true;
    if (state.error) return state;
    updatePauseButton();
    updateSoundButton();
    return state;
  }

  function command(action, extra) {
    const api = playerApi();
    const payload =
      extra && typeof extra.muted === "boolean"
        ? { action, muted: extra.muted }
        : { action };
    if (api && typeof api.command === "function") {
      try {
        api.command(payload);
        const state = syncFromState();
        if (state && state.error) return false;
        return true;
      } catch {
        // Fall through to postMessage.
      }
    }
    return post(action, extra);
  }

  function isSourceEvent(event) {
    return (
      event.origin === ORIGIN &&
      event.source === iframe.contentWindow &&
      event.data &&
      typeof event.data === "object" &&
      event.data.type === "vex-intro" &&
      typeof event.data.event === "string"
    );
  }

  function clearReadyTimer() {
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = 0;
    }
  }

  function armReadyTimeout() {
    clearReadyTimer();
    if (document.hidden) return;
    readyTimer = window.setTimeout(() => {
      readyTimer = 0;
      if (phase === "playing" && !gotPlayback) failToPage();
    }, READY_MS);
  }

  function kickSource() {
    if (phase !== "playing" || !wantsPlayback || document.hidden) return;
    command("restart", { muted: wantMuted });
  }

  function clearFrameMotion() {
    frame.style.position = "";
    frame.style.inset = "";
    frame.style.top = "";
    frame.style.left = "";
    frame.style.right = "";
    frame.style.bottom = "";
    frame.style.width = "";
    frame.style.height = "";
    frame.style.margin = "";
    frame.style.transform = "";
    frame.style.transformOrigin = "";
    frame.style.transition = "";
    frame.style.zIndex = "";
    frame.style.willChange = "";
    frame.style.borderRadius = "";
    frame.style.maxHeight = "";
    frame.style.aspectRatio = "";
    frame.style.visibility = "";
  }

  function stopMotion() {
    motionToken += 1;
    if (dockTimer) {
      clearTimeout(dockTimer);
      dockTimer = 0;
    }
    if (dockEndHandler) {
      frame.removeEventListener("transitionend", dockEndHandler);
      dockEndHandler = null;
    }
    frame.style.willChange = "";
  }

  function updatePauseButton() {
    const paused = sourcePaused;
    const action = paused ? "Resume" : "Pause";
    pauseBtn.dataset.paused = String(paused);
    pauseBtn.setAttribute("aria-label", `${action} introduction`);
    pauseBtn.title = action;
  }

  function updateSoundButton() {
    const muted = wantMuted;
    soundBtn.dataset.muted = String(muted);
    soundBtn.setAttribute("aria-pressed", String(!muted));
    soundBtn.setAttribute(
      "aria-label",
      muted ? "Unmute introduction" : "Mute introduction",
    );
    soundBtn.title = muted ? "Unmute" : "Mute";
    updateEnableSound();
  }

  function updateEnableSound() {
    enableBtn.hidden = !(
      sourceReady &&
      !wantMuted &&
      soundBlocked &&
      phase === "playing"
    );
  }

  function applyMuted(value) {
    if (typeof value !== "boolean") return;
    wantMuted = value;
    updateSoundButton();
  }

  function focusPlayIfNeeded() {
    const active = document.activeElement;
    if (
      !active ||
      active === document.body ||
      active === playBtn ||
      active === iframe ||
      chrome.contains(active) ||
      frame.contains(active)
    ) {
      playBtn.focus({ preventScroll: true });
    }
  }

  function hideFrame() {
    frame.style.visibility = "hidden";
  }

  function finishDock() {
    stopMotion();
    clearReadyTimer();
    resumeOnVisible = false;
    wantsPlayback = false;
    clearFrameMotion();
    hideFrame();
    root.classList.remove("intro-open", "intro-docking");
    hero.dataset.introState = "docked";
    phase = "docked";
    sourcePaused = true;
    setBackgroundInert(false);
    frame.removeAttribute("role");
    frame.removeAttribute("aria-modal");
    frame.removeAttribute("aria-label");
    iframe.setAttribute("aria-hidden", "true");
    updatePauseButton();
    updateSoundButton();
    focusPlayIfNeeded();
  }

  function lockFrame(rect) {
    frame.style.position = "fixed";
    frame.style.inset = "auto";
    frame.style.top = `${rect.top}px`;
    frame.style.left = `${rect.left}px`;
    frame.style.width = `${rect.width}px`;
    frame.style.height = `${rect.height}px`;
    frame.style.margin = "0";
    frame.style.maxHeight = "none";
    frame.style.aspectRatio = "auto";
    frame.style.zIndex = "81";
    frame.style.transformOrigin = "top left";
    frame.style.transition = "none";
    frame.style.transform = "none";
    frame.style.borderRadius = getComputedStyle(frame).borderRadius;
  }

  function dock(instant = false) {
    if (phase === "docked") return;
    if (phase === "docking") {
      if (instant || reduced) finishDock();
      return;
    }

    resumeOnVisible = false;
    wantsPlayback = false;
    command("pause");
    sourcePaused = true;
    stopMotion();
    const token = motionToken;

    if (instant || reduced) {
      finishDock();
      return;
    }

    const first = frame.getBoundingClientRect();
    lockFrame(first);
    phase = "docking";
    hero.dataset.introState = "docking";
    root.classList.remove("intro-open");
    root.classList.add("intro-docking");
    const destination = slot.getBoundingClientRect();
    if (destination.top < 16 || destination.bottom > innerHeight - 16) {
      slot.scrollIntoView({ block: "center", behavior: "instant" });
    }
    const last = slot.getBoundingClientRect();
    if (first.width < 2 || last.width < 2) {
      finishDock();
      return;
    }

    const dx = last.left - first.left;
    const dy = last.top - first.top;
    const sx = last.width / first.width;
    const sy = last.height / first.height;
    frame.style.willChange = "transform";
    void frame.offsetWidth;
    frame.style.transition = `transform ${DOCK_MS}ms ${DOCK_EASE}`;
    frame.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    const done = (event) => {
      if (token !== motionToken) return;
      if (event && event.target && event.target !== frame) return;
      if (event && event.propertyName && event.propertyName !== "transform")
        return;
      finishDock();
    };
    dockEndHandler = done;
    frame.addEventListener("transitionend", done);
    dockTimer = window.setTimeout(done, DOCK_MS + 80);
  }

  function failToPage() {
    resumeOnVisible = false;
    wantsPlayback = false;
    command("pause");
    sourcePaused = true;
    if (phase !== "docked") finishDock();
  }

  function openIntro(withSound) {
    if (phase === "playing" || phase === "docking") return;
    if (withSound && !sourceReady) return;
    wantsPlayback = true;
    resumeOnVisible = document.hidden;
    stopMotion();
    clearFrameMotion();
    wantMuted = false;
    soundBlocked = false;
    gotPlayback = false;
    sourcePaused = true;
    root.classList.add("intro-open");
    root.classList.remove("intro-docking");
    hero.dataset.introState = "playing";
    phase = "playing";
    setBackgroundInert(true);
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-modal", "true");
    frame.setAttribute("aria-label", "VEX-Bench introduction");
    iframe.removeAttribute("aria-hidden");
    updatePauseButton();
    updateSoundButton();
    skipBtn.focus({ preventScroll: true });
    armReadyTimeout();
    kickSource();
  }

  function onSourceEvent(data) {
    if (typeof data.soundBlocked === "boolean") soundBlocked = data.soundBlocked;
    if (typeof data.muted === "boolean") applyMuted(data.muted);
    switch (data.event) {
      case "ready":
        sourceReady = true;
        updateReadyControls();
        syncFromState();
        if (phase === "playing") kickSource();
        break;
      case "playing":
        sourceReady = true;
        updateReadyControls();
        gotPlayback = true;
        sourcePaused = false;
        clearReadyTimer();
        if (phase !== "playing" || !wantsPlayback || document.hidden) {
          if (phase === "playing" && wantsPlayback && document.hidden) resumeOnVisible = true;
          command("pause");
          sourcePaused = true;
          return;
        }
        updatePauseButton();
        updateEnableSound();
        break;
      case "paused":
        sourcePaused = true;
        updatePauseButton();
        break;
      case "ended":
        sourcePaused = true;
        wantsPlayback = false;
        gotPlayback = true;
        clearReadyTimer();
        updatePauseButton();
        dock();
        break;
      case "mute":
        updateSoundButton();
        break;
      case "sound-blocked":
      case "sound":
        updateEnableSound();
        break;
      case "error":
        failToPage();
        break;
      case "timeupdate":
        break;
      default:
        break;
    }
  }

  playBtn.addEventListener("click", () => openIntro(true));
  skipBtn.addEventListener("click", () => dock());
  pauseBtn.addEventListener("click", () => {
    if (phase !== "playing") return;
    resumeOnVisible = false;
    wantsPlayback = sourcePaused;
    if (wantsPlayback) command("play");
    else command("pause");
    syncFromState();
  });
  soundBtn.addEventListener("click", () => {
    wantMuted = !wantMuted;
    if (!command("mute", { muted: wantMuted })) applyMuted(true);
    else syncFromState();
  });
  enableBtn.addEventListener("click", () => {
    wantMuted = false;
    updateSoundButton();
    command("mute", { muted: false });
    syncFromState();
  });
  window.addEventListener("message", (event) => {
    if (!isSourceEvent(event)) return;
    onSourceEvent(event.data);
  });
  iframe.addEventListener("load", () => {
    syncFromState();
    if (phase === "playing") {
      skipBtn.focus({ preventScroll: true });
      kickSource();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && phase === "playing") {
      const first =
        [pauseBtn, soundBtn, enableBtn, skipBtn].find((el) => !el.hidden && !el.disabled) ||
        skipBtn;
      const last = skipBtn;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key !== "Escape") return;
    if (phase === "playing") {
      event.preventDefault();
      dock();
    } else if (phase === "docking") {
      event.preventDefault();
      dock(true);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearReadyTimer();
      if (phase === "playing") {
        resumeOnVisible = wantsPlayback;
        command("pause");
        sourcePaused = true;
      } else {
        resumeOnVisible = false;
      }
      return;
    }
    if (phase === "playing" && resumeOnVisible) {
      resumeOnVisible = false;
      if (!gotPlayback) armReadyTimeout();
      command("play");
    }
  });
  reduceMotion.addEventListener("change", (event) => {
    reduced = event.matches;
    if (reduced && (phase === "playing" || phase === "docking")) dock(true);
  });

  updatePauseButton();
  updateSoundButton();
  // A cached iframe can finish before this deferred script installs its listeners.
  syncFromState();
  updateReadyControls();
  iframe.setAttribute("aria-hidden", "true");
  if (reduced) {
    hero.dataset.introState = "docked";
    return;
  }
  openIntro(false);
})();
