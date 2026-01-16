// ==UserScript==
// @name         AO3: Work Stats Extractor
// @version      1.0
// @description  Extract workID, title, words, kudos, hits from AO3 results, bucketed by manual pass selection, persisted across pages, and download as CSV.
// @match        https://archiveofourown.org/*works*
// @run-at       document-end
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "ao3_pass_data_v1";

  const PASS_DEFS = [
    { key: "A", label: "A - Hits" },
    { key: "B", label: "B - Kudos" },
    { key: "C", label: "C - Date Posted" },
    { key: "D", label: "D - Mid-Length (20k–60k)" },
    { key: "E", label: "E - Longfics (60k–200k)" },
    { key: "F", label: "F - Ultra-long (200k+)" },
    { key: "G", label: "G - Shortfics (1k–10k)" },
  ];

  // passData representation:
  // {
  //   A: { "12345": { workId, title, words, kudos, hits }, ... },
  //   B: { ... },
  //   ...
  // }
  let passData = loadPassData();
  ensurePassBuckets(passData);

  let currentPassKey = "A";
  let statusSpan = null;
  let passSelect = null;

  // ---------- Storage helpers ----------

  function loadPassData() {
    try {
      const raw = GM_getValue(STORAGE_KEY, "{}");
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") return obj;
    } catch (e) {
      console.warn(
        "AO3 Pass Extractor: failed to parse storage, resetting.",
        e
      );
    }
    return {};
  }

  function savePassData() {
    try {
      GM_setValue(STORAGE_KEY, JSON.stringify(passData));
    } catch (e) {
      console.error("AO3 Pass Extractor: failed to save storage.", e);
    }
  }

  function ensurePassBuckets(obj) {
    PASS_DEFS.forEach((p) => {
      if (!obj[p.key] || typeof obj[p.key] !== "object") {
        obj[p.key] = {};
      }
    });
  }

  function csvEscape(value) {
    if (value == null) return '""';
    const s = String(value);
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  function cleanInt(text) {
    if (!text) return "";
    const stripped = text.replace(/,/g, "").trim();
    const n = parseInt(stripped, 10);
    return Number.isNaN(n) ? "" : String(n);
  }

  function getPassLabel(key) {
    const def = PASS_DEFS.find((p) => p.key === key);
    return def ? def.label : key;
  }

  // ---------- Extraction ----------

  function extractWorksOnPageForPass(passKey) {
    const bucket = passData[passKey];
    if (!bucket) return;

    const workLis = document.querySelectorAll(
      "ol.work.index.group li.work.blurb.group"
    );
    let addedCount = 0;

    workLis.forEach((li) => {
      let workId = "";
      const liId = li.getAttribute("id");
      if (liId && liId.startsWith("work_")) {
        workId = liId.replace("work_", "").trim();
      }

      const titleLink = li.querySelector(
        '.header.module h4.heading a[href*="/works/"]'
      );
      if (!workId && titleLink) {
        const href = titleLink.getAttribute("href") || "";
        const m = href.match(/\/works\/(\d+)/);
        if (m) workId = m[1];
      }

      if (!workId) return;

      const title = titleLink ? titleLink.textContent.trim() : "";

      const stats = li.querySelector("dl.stats");
      let words = "";
      let kudos = "";
      let hits = "";

      if (stats) {
        const wordsEl = stats.querySelector("dd.words");
        const kudosEl = stats.querySelector("dd.kudos");
        const hitsEl = stats.querySelector("dd.hits");

        if (wordsEl) words = cleanInt(wordsEl.textContent);
        if (kudosEl) kudos = cleanInt(kudosEl.textContent);
        if (hitsEl) hits = cleanInt(hitsEl.textContent);
      }

      if (!bucket[workId]) {
        bucket[workId] = { workId, title, words, kudos, hits };
        addedCount++;
      }
    });

    savePassData();
    updateStatusText();
    alert(`Pass ${passKey}: added ${addedCount} new works from this page.`);
  }

  // ---------- CSV generation ----------

  function generateCSVForPass(passKey) {
    const bucket = passData[passKey];
    if (!bucket || Object.keys(bucket).length === 0) {
      alert(`Pass ${passKey} is empty.`);
      return null;
    }

    const header = "workid,title,words,kudos,hits";
    const lines = [header];

    Object.keys(bucket).forEach((id) => {
      const row = bucket[id];
      const title = csvEscape(row.title);
      const words = row.words ?? "";
      const kudos = row.kudos ?? "";
      const hits = row.hits ?? "";
      lines.push(`${id},${title},${words},${kudos},${hits}`);
    });

    return lines.join("\n");
  }

  function generateCSVForAllPasses() {
    const combined = new Map();

    Object.entries(passData).forEach(([passKey, bucket]) => {
      Object.keys(bucket).forEach((id) => {
        const row = bucket[id];
        if (!combined.has(id)) {
          combined.set(id, {
            workId: id,
            title: row.title,
            words: row.words,
            kudos: row.kudos,
            hits: row.hits,
            passes: new Set([passKey]),
          });
        } else {
          const existing = combined.get(id);
          existing.passes.add(passKey);
        }
      });
    });

    if (combined.size === 0) {
      alert("No data collected in any pass.");
      return null;
    }

    const header = "workid,title,words,kudos,hits,passes";
    const lines = [header];

    combined.forEach((row) => {
      const id = row.workId;
      const title = csvEscape(row.title);
      const words = row.words ?? "";
      const kudos = row.kudos ?? "";
      const hits = row.hits ?? "";
      const passes = Array.from(row.passes).sort().join(";");
      lines.push(`${id},${title},${words},${kudos},${hits},${passes}`);
    });

    return lines.join("\n");
  }

  function downloadCSV(content, filename) {
    if (!content) return;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    GM_download({
      url: URL.createObjectURL(blob),
      name: filename,
      saveAs: true,
    });
  }

  // ---------- UI ----------

  function updateStatusText() {
    if (!statusSpan) return;

    const pieces = PASS_DEFS.map((p) => {
      const bucket = passData[p.key] || {};
      const size = Object.keys(bucket).length;
      const marker = p.key === currentPassKey ? "*" : "";
      return `${marker}${p.key}:${size}`;
    });

    statusSpan.textContent = `Pass counts [* = current]: ${pieces.join("  ")}`;
  }

  function buildControlPanel() {
    const panel = document.createElement("div");
    panel.style.position = "fixed";
    panel.style.bottom = "20px";
    panel.style.left = "20px";
    panel.style.padding = "10px";
    panel.style.background = "rgba(0,0,0,0.80)";
    panel.style.color = "#fff";
    panel.style.fontSize = "12px";
    panel.style.borderRadius = "6px";
    panel.style.zIndex = "99999";
    panel.style.maxWidth = "270px";

    const title = document.createElement("div");
    title.textContent = "AO3 Stats (Pass Mode)";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "4px";
    panel.appendChild(title);

    const passRow = document.createElement("div");
    passRow.style.marginBottom = "4px";

    const label = document.createElement("span");
    label.textContent = "Current pass: ";
    passRow.appendChild(label);

    const select = document.createElement("select");
    PASS_DEFS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = p.label;
      if (p.key === currentPassKey) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      currentPassKey = select.value;
      updateStatusText();
    });
    passRow.appendChild(select);
    panel.appendChild(passRow);
    passSelect = select;

    const buttonsRow = document.createElement("div");
    buttonsRow.style.display = "flex";
    buttonsRow.style.flexWrap = "wrap";
    buttonsRow.style.gap = "4px";
    buttonsRow.style.marginBottom = "4px";

    const scrapeBtn = document.createElement("button");
    scrapeBtn.textContent = "Scrape page → pass";
    scrapeBtn.style.flex = "1 1 auto";
    scrapeBtn.style.fontSize = "11px";
    scrapeBtn.addEventListener("click", () => {
      extractWorksOnPageForPass(currentPassKey);
    });
    buttonsRow.appendChild(scrapeBtn);

    const dlCurrentBtn = document.createElement("button");
    dlCurrentBtn.textContent = "CSV: current pass";
    dlCurrentBtn.style.flex = "1 1 auto";
    dlCurrentBtn.style.fontSize = "11px";
    dlCurrentBtn.addEventListener("click", () => {
      const csv = generateCSVForPass(currentPassKey);
      if (csv) downloadCSV(csv, `ao3_pass_${currentPassKey}.csv`);
    });
    buttonsRow.appendChild(dlCurrentBtn);

    const dlAllBtn = document.createElement("button");
    dlAllBtn.textContent = "CSV: all passes";
    dlAllBtn.style.flex = "1 1 auto";
    dlAllBtn.style.fontSize = "11px";
    dlAllBtn.addEventListener("click", () => {
      const csv = generateCSVForAllPasses();
      if (csv) downloadCSV(csv, "ao3_all_passes.csv");
    });
    buttonsRow.appendChild(dlAllBtn);

    panel.appendChild(buttonsRow);

    const status = document.createElement("div");
    status.style.marginTop = "2px";
    status.style.fontSize = "11px";
    statusSpan = status;
    panel.appendChild(status);

    document.body.appendChild(panel);
    updateStatusText();
  }

  // ---------- Init ----------

  function init() {
    buildControlPanel();
  }

  init();

  // Expose for debugging
  window.AO3_PassData = passData;
  window.AO3_ClearPassData = function () {
    if (confirm("Clear all stored pass data?")) {
      passData = {};
      ensurePassBuckets(passData);
      savePassData();
      updateStatusText();
    }
  };
})();
