(() => {
  "use strict";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const storageKey = "vex-color-theme";
  const choices = ["system", "light", "dark"];
  const names = { system: "System", light: "Light", dark: "Dark" };
  let preference = "system";

  try {
    const stored = localStorage.getItem(storageKey);
    if (choices.includes(stored)) preference = stored;
  } catch {
    // System mode remains usable when browser storage is unavailable.
  }

  function applyTheme() {
    const theme =
      preference === "system"
        ? system.matches
          ? "dark"
          : "light"
        : preference;
    root.dataset.theme = theme;
    root.dataset.themeSetting = preference;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor)
      themeColor.content = theme === "dark" ? "#080d1d" : "#f7f9ff";
    const button = document.getElementById("theme-toggle");
    if (button) {
      const next = choices[(choices.indexOf(preference) + 1) % choices.length];
      button.setAttribute(
        "aria-label",
        `Color theme: ${names[preference]}. Switch to ${names[next]}.`,
      );
      button.title = `Change theme: ${names[preference]} → ${names[next]}`;
    }
  }

  // Apply the saved choice before the stylesheet and body to avoid a theme flash.
  applyTheme();
  system.addEventListener("change", () => {
    if (preference === "system") applyTheme();
  });

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      applyTheme();
      document.getElementById("theme-toggle").addEventListener("click", () => {
        preference =
          choices[(choices.indexOf(preference) + 1) % choices.length];
        try {
          if (preference === "system") localStorage.removeItem(storageKey);
          else localStorage.setItem(storageKey, preference);
        } catch {
          // Manual selection still applies for this visit without persistence.
        }
        applyTheme();
      });
    },
    { once: true },
  );
})();
