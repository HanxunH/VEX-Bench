(() => {
  const chapters = [
    { id: "problem", start: 0, end: 7, title: "Problem", caption: "Misinformation is cheap. Verification is not." },
    { id: "organizations", start: 7, end: 15, title: "Organizations", caption: "Different organizations. Different priorities." },
    { id: "screening", start: 15, end: 21, title: "Screening", caption: "Screen first. Verify next." },
    { id: "priorities", start: 21, end: 26, title: "Priorities", caption: "Prioritize. Deprioritize." },
    { id: "dimensions", start: 26, end: 35, title: "Dimensions", caption: "Five dimensions." },
    { id: "vex", start: 35, end: 43, title: "VEX score", caption: "Your priorities. Your VEX lens." },
    { id: "evaluation", start: 43, end: 49, title: "Benchmark evaluation", caption: "Two evaluation tasks. 7 models × 7 methods × 2 tasks × 60 topics: 5,880 conditions across 6 domains." },
    { id: "close", start: 49, end: 54, title: "Close", caption: "VEX-Bench. arxiv.org/abs/2609.35028 · huggingface.co/datasets/hanxunh/VEX-Bench · hanxunh.github.io/VEX-Bench" },
  ];
  const pages = {
    newsrooms: [
      ["abc", "reuters", "sbs", "bbc", "ap", "al-jazeera", "nhk", "folha"],
      ["the-conversation", "abc", "guardian-australia", "daily-nation", "the-hindu", "rappler", "groundup", "bristol-cable"],
      ["dw", "cna", "abc", "el-pais", "the-wire", "outlier-media", "eldiario", "guardian-australia"],
    ],
    factCheckers: [
      ["aap-factcheck", "afp-fact-check", "abc-news-verify", "full-fact", "africa-check", "chequeado", "politifact", "boom"],
      ["maldita", "taiwan-factcheck-center", "aap-factcheck", "afp-fact-check", "abc-news-verify", "full-fact", "africa-check", "chequeado"],
      ["politifact", "boom", "maldita", "taiwan-factcheck-center", "aap-factcheck", "afp-fact-check", "abc-news-verify", "full-fact"],
    ],
    platforms: [
      ["youtube", "facebook", "instagram", "tiktok", "x", "reddit", "snapchat", "threads"],
      ["whatsapp", "weibo", "line", "youtube", "facebook", "instagram", "tiktok", "x"],
      ["reddit", "snapchat", "threads", "whatsapp", "weibo", "line", "youtube", "facebook"],
    ],
  };
  const groups = [{ key: "newsrooms", file: "newsrooms.json" }, { key: "factCheckers", file: "fact-checkers.json" }, { key: "platforms", file: "platforms.json" }];
  const organizationExamples = { newsrooms: [], factCheckers: [], platforms: [] };
  const paths = {
    photo: "assets/article/news-photo.jpg",
    resources: { arxiv: "assets/resources/arxiv.svg", huggingface: "assets/resources/huggingface.svg" },
  };
  const palette = Object.freeze({ paper: "#f7f9ff", ink: "#000f46", red: "#b8433f", marker: "#e4d63b", blue: "#dce7f2", peach: "#f3ddd2", white: "#ffffff", d1: "#315fc7", d2: "#b43a55", d3: "#6942ba", d4: "#a95718", d5: "#087e78" });
  const assets = { photo: null, marks: {}, pages: {}, resources: {}, benchmark: null };
  const runtime = window.VEX_RUNTIME = {
    chapters, organizationExamples, palette, assets,
    captionAt(t) { return (chapters.find(c => t >= c.start && t < c.end) || chapters[chapters.length - 1]).caption; },
    installAssets(images) {
      assets.photo = images[paths.photo];
      for (const [key, path] of Object.entries(paths.resources)) assets.resources[key] = images[path];
      for (const { key } of groups) {
        const records = organizationExamples[key];
        for (const record of records) assets.marks[record.id] = images[`assets/marks/${record.id}.png`];
        assets.pages[key] = pages[key].map(ids => ids.map(id => {
          const record = records.find(item => item.id === id);
          if (!record) throw new Error(`Missing curated organization: ${id}`);
          return record;
        }));
      }
    },
  };
  window.BPM = 128;
  window.PUNCH = 0;
  window.FILM_DURATION = 54;
  window.FONT_FACES = [
    { family: "Study Impact", url: "fonts/manrope-800.ttf", desc: { weight: "400" } },
    { family: "Manrope", url: "fonts/manrope-600.ttf", desc: { weight: "600" } },
    { family: "Manrope", url: "fonts/manrope-800.ttf", desc: { weight: "800" } },
    { family: "DM Sans", url: "fonts/dm-sans-400.ttf", desc: { weight: "400" } },
    { family: "DM Sans", url: "fonts/dm-sans-500.ttf", desc: { weight: "500" } },
    { family: "IBM Plex Mono", url: "fonts/plex-mono-500.ttf", desc: { weight: "500" } },
  ];
  runtime.bootstrap = (async () => {
    await Promise.all(groups.map(async ({ key, file }) => {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`Organization source failed: ${file}`);
      organizationExamples[key] = await response.json();
    }));
    const benchmarkResponse = await fetch("assets/data/vex-lenses.json");
    if (!benchmarkResponse.ok) throw new Error("Benchmark data failed: assets/data/vex-lenses.json");
    assets.benchmark = await benchmarkResponse.json();
    window.EXTRA_ASSETS = [...new Set([paths.photo, ...Object.values(paths.resources), ...groups.flatMap(({ key }) => organizationExamples[key].map(record => `assets/marks/${record.id}.png`))])];
  })();
})();
