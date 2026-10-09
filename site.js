(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const lens = [
    {
      title: "Can the article's claims be checked?",
      description:
        "Look for specific people, dates, quantities, events, or attributed statements that can be compared with available evidence.",
      boundary:
        "A claim can be easy to check and still be false. D1 measures specificity, not truth.",
      anchors: [
        "Pure opinion or unverifiable rhetoric; no claim can be checked.",
        "Mostly opinion with some checkable elements.",
        "Mixed: some specific claims, but also substantial vague or rhetorical content.",
        "Mostly specific, checkable claims; named figures, statistics, or events dominate.",
        "Densely packed with independently falsifiable assertions; almost every sentence creates a separate verification task.",
      ],
    },
    {
      title: "What harm could belief trigger?",
      description:
        "Identify the action a reader might take, who could be affected, and whether the consequences could spread, persist, or be difficult to reverse.",
      boundary:
        "An alarming topic is not enough. The article needs a plausible path from belief to consequential action.",
      anchors: [
        "No plausible pathway from belief to harmful action.",
        "Minimal behavioural change is likely; any harm is minor or highly localised.",
        "A specific action could cause moderate harm to a defined group.",
        "A concrete harmful action could produce significant population-level harm at scale.",
        "Belief could cause severe, large-scale, or irreversible harm, including risk to life or critical public systems.",
      ],
    },
    {
      title: "What authority does the article signal?",
      description:
        "Inspect the byline, outlet, source attributions, and references to named organizations, agencies, reports, or experts.",
      boundary:
        "D3 scores visible authority cues at screening time, not whether the source or attribution is genuine.",
      anchors: [
        "Unknown or fabricated outlet with no real institutional citations in the body.",
        "Unknown outlet with only vague references such as “experts say” or “studies show.”",
        "Ambiguous outlet or 1–2 real institutions cited by name.",
        "Credible-seeming outlet or 3–5 named institutions or reports in the body.",
        "Authoritative outlet, or a body saturated with named institutions that strongly signals credibility.",
      ],
    },
    {
      title: "Does it look like legitimate journalism?",
      description:
        "Inspect the headline, article structure, attribution pattern, internal consistency, and overall presentation.",
      boundary:
        "D4 measures surface plausibility, not factual accuracy or actual source legitimacy.",
      anchors: [
        "Obvious imposter: multiple serious format failures, such as conspiracy tone, missing structure, or bizarre framing.",
        "Amateur mimicry: visible failures across the headline, sourcing, or body.",
        "Partial mimicry: professional elements mixed with noticeable format flaws.",
        "Strong mimicry: passes casual inspection; failures appear only on careful reading.",
        "Full mimicry: byline, dateline, attribution, structure, and register are indistinguishable from legitimate journalism.",
      ],
    },
    {
      title: "How much work would verification require?",
      description:
        "Estimate whether public sources are enough or whether the article needs extended research, specialist knowledge, expert consultation, or restricted data.",
      boundary:
        "D5 estimates effort from the article at screening time; it does not record elapsed fact-checking time.",
      anchors: [
        "One public search resolves the central claim in under one minute.",
        "Checking 2–4 accessible public sources takes roughly 10–30 minutes; no specialist knowledge is required.",
        "Several hours of research, technical reports, or specialist reading are required.",
        "Verification requires expert consultation, restricted institutional data, or formal information requests.",
        "Multiple claims each require independent expert verification; some may remain unverifiable without institutional access.",
      ],
    },
  ];
  let activeLens = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const lensExplanation = document.querySelector(".lens-explanation");
  const scoreInput = $("rubric-score");
  const scoreValue = $("rubric-value");
  const scoreAnchor = $("rubric-anchor");
  const scoreMarkers = document.querySelectorAll(".rubric-demo .range-markers span");
  function updateRubric() {
    const score = Number(scoreInput.value),
      item = lens[activeLens];
    scoreValue.textContent = score + " / 5";
    scoreInput.setAttribute(
      "aria-valuetext",
      score + " of 5: " + item.anchors[score - 1],
    );
    scoreAnchor.textContent = item.anchors[score - 1];
    $("rubric-low").textContent = item.anchors[0];
    $("rubric-high").textContent = item.anchors[4];
    scoreMarkers.forEach((marker, i) =>
      marker.classList.toggle("is-active", i + 1 === score),
    );
  }
  function selectLens(index, focus = false) {
    const changed = activeLens !== index;
    activeLens = index;
    $("framework").style.setProperty(
      "--active-lens-color",
      `var(--d${index + 1}-color)`,
    );
    const item = lens[index];
    document.querySelectorAll("[data-lens]").forEach((button, i) => {
      button.setAttribute("aria-selected", String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      if (i === index && focus) button.focus();
    });
    $("lens-panel").setAttribute("aria-labelledby", "lens-tab-" + index);
    $("lens-title").textContent = item.title;
    $("lens-description").textContent = item.description;
    $("lens-boundary").textContent = item.boundary;
    updateRubric();
    if (changed && !reduceMotion.matches) {
      lensExplanation
        .getAnimations()
        .forEach((animation) => animation.cancel());
      lensExplanation.animate(
        [
          { clipPath: "inset(0 100% 0 0)", opacity: 0.82 },
          { clipPath: "inset(0 0 0 0)", opacity: 1 },
        ],
        { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    }
  }
  document.querySelectorAll("[data-lens]").forEach((button) => {
    button.addEventListener("click", () =>
      selectLens(Number(button.dataset.lens)),
    );
    button.addEventListener("keydown", (event) => {
      const map = {
        ArrowRight: (activeLens + 1) % 5,
        ArrowLeft: (activeLens + 4) % 5,
        Home: 0,
        End: 4,
      };
      if (event.key in map) {
        event.preventDefault();
        selectLens(map[event.key], true);
      }
    });
  });
  scoreInput.addEventListener("input", updateRubric);
  selectLens(0);
  $("copy-citation").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("citation").textContent);
      $("copy-citation").textContent = "Copied ✓";
      $("citation-status").textContent = "BibTeX copied to clipboard.";
      $("copy-citation").dataset.copyState = "success";
      setTimeout(() => {
        $("copy-citation").textContent = "Copy BibTeX";
        delete $("copy-citation").dataset.copyState;
      }, 2500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("citation"));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      $("citation-status").textContent =
        "Citation selected. Press Ctrl+C or ⌘C to copy.";
    }
  });
  let scheduled = false;
  function progress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    $("scroll-progress").style.width =
      (max > 0 ? (scrollY / max) * 100 : 0) + "%";
    scheduled = false;
  }
  addEventListener(
    "scroll",
    () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(progress);
      }
    },
    { passive: true },
  );
  progress();
  const sections = ["framework", "benchmark", "dataset", "paper"].map((id) =>
    $(id),
  );
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      document.querySelectorAll(".nav-wrap nav a").forEach((a) => {
        const active = a.getAttribute("href") === "#" + visible.target.id;
        a.classList.toggle("active", active);
        if (active) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-10% 0px -55% 0px", threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));
})();
