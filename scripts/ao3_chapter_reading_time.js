// ==UserScript==
// @name        AO3: Chapter Reading Time
// @version     1.1.1
// @author      BlackBatCat
// @description  Display word count and reading time at the beginning of each chapter on AO3 (using AO3's exact counting method)
// @match       *://archiveofourown.org/works/*
// @match       *://archiveofourown.org/chapters/*
// @license     MIT
// @grant       none
// ==/UserScript==

(function () {
  "use strict";

  const DEFAULTS = {
    wpm: 375,
    chapterTimeStyle: "default", // "default", "colored", or "timeonly"
  };

  let CONFIG = { ...DEFAULTS };

  const $1 = (selector, root = document) => root.querySelector(selector);

  const saveSettings = () => {
    if (typeof Storage !== "undefined") {
      localStorage.setItem(
        "ao3_chapter_reading_time_config",
        JSON.stringify(CONFIG)
      );
    }
  };

  const loadSettings = () => {
    if (typeof Storage === "undefined") return;
    const savedConfig = localStorage.getItem("ao3_chapter_reading_time_config");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        CONFIG = { ...DEFAULTS, ...parsedConfig };
      } catch (e) {
        console.error("Error loading saved config, using defaults:", e);
        CONFIG = { ...DEFAULTS };
      }
    }
  };

  loadSettings();

  const addStyles = () => {
    if (document.getElementById("ao3-chapter-reading-time-styles")) return;

    const style = document.createElement("style");
    style.id = "ao3-chapter-reading-time-styles";
    style.textContent = `
      .notice.ao3-chapter-stats {
        list-style: none;
      }
      .notice.ao3-chapter-stats li {
        list-style: none;
        margin: 0;
      }
      .ao3-chapter-stats-default,
      .ao3-chapter-stats-timeonly {
        font-style: italic;
        text-align: center;
        opacity: 0.9;
        margin: 1em 0;
        font-size: 1.2em;
      }
    `;
    if (document.head) {
      document.head.appendChild(style);
    }
  };

  // Replicate AO3's exact word counting method from word_counter.rb
  const countWords = (text) => {
    if (!text || text.trim().length === 0) return 0;

    // Step 1: Replace -- with em-dash (so "one--two" counts as 2 words)
    let processed = text.replace(/--/g, "—");

    // Step 2: Strip hyphens and apostrophes (so "well-deserving" and "one's" become single words)
    // Match Ruby's /['''-]/ pattern using Unicode escapes to preserve the actual characters
    // U+0027 = straight apostrophe, U+2018 = left single quote, U+2019 = right single quote, U+002D = hyphen
    processed = processed.replace(/[\u0027\u2018\u2019\-]/g, "");

    // Step 3: Count words using AO3's pattern
    // CJK characters (each counts as 1 word) OR sequences of word characters
    // Ruby's [[:word:]] = letters, numbers, underscore
    // JavaScript equivalent: \w (which is [a-zA-Z0-9_])
    
    // CJK Unicode ranges (Chinese, Japanese, Korean)
    const cjkRanges = [
      '\u4E00-\u9FFF',     // CJK Unified Ideographs
      '\u3400-\u4DBF',     // CJK Extension A
      '\u3040-\u309F',     // Hiragana
      '\u30A0-\u30FF',     // Katakana
      '\uAC00-\uD7AF',     // Hangul
      '\u1100-\u11FF',     // Hangul Jamo
      '\u3130-\u318F',     // Hangul Compatibility Jamo
      '\uFF00-\uFFEF'      // Halfwidth and Fullwidth Forms
    ].join('');
    
    const cjkPattern = `[${cjkRanges}]`;
    
    // Match: (CJK character) OR (non-CJK word sequences)
    // This replicates: /#{character_count_scripts}|((?!#{character_count_scripts})[[:word:]])+/
    const wordPattern = new RegExp(`${cjkPattern}|[a-zA-Z0-9_]+`, 'g');
    
    const matches = processed.match(wordPattern);
    return matches ? matches.length : 0;
  };

  const updateExistingChapterTimeStyles = () => {
    const WORKS_PAGE_REGEX =
      /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
    if (!WORKS_PAGE_REGEX.test(window.location.href)) return;

    const chaptersContainer = $1("#chapters");
    if (!chaptersContainer) return;

    const existingStats = chaptersContainer.querySelectorAll(
      ".ao3-chapter-stats-default, .ao3-chapter-stats-colored, .ao3-chapter-stats-timeonly, .ao3-chapter-stats"
    );
    existingStats.forEach((statsElement) => {
      let wordCountText;
      if (statsElement.classList.contains("ao3-chapter-stats-default")) {
        wordCountText = statsElement.textContent.match(
          /(\d{1,3}(?:,\d{3})*|\d+) words/
        );
      } else if (
        statsElement.classList.contains("ao3-chapter-stats-colored") ||
        statsElement.classList.contains("ao3-chapter-stats")
      ) {
        wordCountText = statsElement.textContent.match(
          /(\d{1,3}(?:,\d{3})*|\d+) words/
        );
      } else if (
        statsElement.classList.contains("ao3-chapter-stats-timeonly")
      ) {
        return;
      }

      if (!wordCountText) return;

      const wordCount = parseInt(wordCountText[1].replace(/,/g, ""));
      const minutes = wordCount / CONFIG.wpm;
      const hrs = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);

      let timeLongStr;
      if (hrs > 0) {
        timeLongStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""} ${mins} minute${
                mins > 1 ? "s" : ""
              }`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeLongStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      let timeOnlyStr;
      if (hrs > 0) {
        timeOnlyStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""}, ${mins} minute${
                mins > 1 ? "s" : ""
              }`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeOnlyStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      if (CONFIG.chapterTimeStyle === "default") {
        if (!statsElement.classList.contains("ao3-chapter-stats-default")) {
          statsElement.className = "ao3-chapter-stats-default";
          statsElement.tagName = "p";
          statsElement.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
        }
      } else if (CONFIG.chapterTimeStyle === "colored") {
        if (!statsElement.classList.contains("ao3-chapter-stats")) {
          if (statsElement.tagName !== "UL") {
            const newUl = document.createElement("ul");
            newUl.className = "notice ao3-chapter-stats";
            const listItem = document.createElement("li");
            listItem.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
            newUl.appendChild(listItem);
            statsElement.parentNode.replaceChild(newUl, statsElement);
          } else {
            statsElement.className = "notice ao3-chapter-stats";
            const listItem = statsElement.querySelector("li");
            if (listItem) {
              listItem.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
            }
          }
        }
      } else if (CONFIG.chapterTimeStyle === "timeonly") {
        if (!statsElement.classList.contains("ao3-chapter-stats-timeonly")) {
          statsElement.className = "ao3-chapter-stats-timeonly";
          statsElement.tagName = "p";
          statsElement.textContent = `~${timeOnlyStr}`;
        }
      }
    });
  };

  const calculateChapterStats = (chaptersContainer = null) => {
    const WORKS_PAGE_REGEX =
      /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
    if (!WORKS_PAGE_REGEX.test(window.location.href)) return;

    const container = chaptersContainer || $1("#chapters");
    if (!container) return;

    const chapters = container.querySelectorAll(".chapter");
    // CRITICAL FIX: Only get the story div.userstuff, NOT blockquote.userstuff
    // The story content is specifically in #chapters > div.userstuff
    const singleChapter = $1("#chapters > div.userstuff:not(.preface div.userstuff):not(.notes div.userstuff)");
    
    let chaptersToProcess = [];

    if (chapters.length > 0) {
      chaptersToProcess = Array.from(chapters);
    } else if (singleChapter) {
      chaptersToProcess = [{ userstuff: singleChapter, isSingle: true }];
    }
    if (chaptersToProcess.length === 0) return;

    chaptersToProcess.forEach((chapter) => {
      let userstuff;
      let existingStats;

      if (chapter.isSingle) {
        userstuff = chapter.userstuff;
        const chapterNotes = $1("#chapters .notes");
        if (
          userstuff.previousElementSibling &&
          userstuff.previousElementSibling.classList.contains("notice")
        ) {
          return;
        }
        existingStats = chapterNotes;
      } else {
        const prefaceContainer = $1(".chapter.preface", chapter);
        if ($1(".notice.ao3-chapter-stats", chapter)) {
          return;
        }
        // In multi-chapter works, only get div.userstuff within the chapter
        userstuff = $1("div.userstuff:not(.preface div.userstuff):not(.notes div.userstuff)", chapter);
        existingStats = prefaceContainer;
      }
      
      if (!userstuff) return;
      
      // Safety check: make sure we're not counting blockquote elements (notes/summaries)
      if (userstuff.tagName === "BLOCKQUOTE") {
        console.warn("Skipping blockquote.userstuff element");
        return;
      }

      const text = userstuff.textContent || "";
      const wordCount = countWords(text);
      
      // Debug logging
      console.log("Counting words for element:", userstuff);
      console.log("Text length:", text.length);
      console.log("Word count:", wordCount);

      if (wordCount === 0) return;
      const minutes = wordCount / CONFIG.wpm;
      const hrs = Math.floor(minutes / 60);
      const mins = Math.ceil(minutes % 60);

      let timeLongStr;
      if (hrs > 0) {
        timeLongStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""} ${mins} minute${
                mins > 1 ? "s" : ""
              }`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeLongStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      let timeOnlyStr;
      if (hrs > 0) {
        timeOnlyStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""}, ${mins} minute${
                mins > 1 ? "s" : ""
              }`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeOnlyStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      let statsDiv;
      if (CONFIG.chapterTimeStyle === "default") {
        statsDiv = document.createElement("p");
        statsDiv.className = "ao3-chapter-stats-default";
        statsDiv.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
      } else if (CONFIG.chapterTimeStyle === "colored") {
        statsDiv = document.createElement("ul");
        statsDiv.className = "notice ao3-chapter-stats";
        const listItem = document.createElement("li");
        listItem.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
        statsDiv.appendChild(listItem);
      } else {
        statsDiv = document.createElement("p");
        statsDiv.className = "ao3-chapter-stats-timeonly";
        statsDiv.textContent = `~${timeOnlyStr}`;
      }

      if (chapter.isSingle) {
        if (existingStats) {
          existingStats.insertAdjacentElement("afterend", statsDiv);
        } else {
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      } else {
        if (existingStats) {
          existingStats.insertAdjacentElement("afterend", statsDiv);
        } else {
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      }
    });
  };

  const init = () => {
    addStyles();
    calculateChapterStats();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();