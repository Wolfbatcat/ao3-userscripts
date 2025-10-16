// ==UserScript==
// @name        AO3: Reading Time & Quality Score
// @description  Add reading time, chapter reading time, and quality scores to AO3 works with color coding, score normalization and sorting.
// @author      BlackBatCat
// @version     2.8
// @match       *://archiveofourown.org/
// @match       *://archiveofourown.org/tags/*/works*
// @match       *://archiveofourown.org/works*
// @match       *://archiveofourown.org/chapters/*
// @match       *://archiveofourown.org/users/*
// @match       *://archiveofourown.org/collections/*
// @match       *://archiveofourown.org/bookmarks*
// @match       *://archiveofourown.org/series/*
// @license     MIT
// @require      https://update.greasyfork.org/scripts/552743/1678339/AO3%3A%20Menu%20Helpers%20Library.js
// @grant       none
// ==/UserScript==

(function () {
  "use strict";

  // DEFAULT CONFIGURATION
  const DEFAULTS = {
    // Feature Toggles
    enableReadingTime: true,
    enableQualityScore: true,
    enableChapterStats: true,
    // Reading Time Settings
    wpm: 375,
    alwaysCountReadingTime: true,
    readingTimeLvl1: 120,
    readingTimeLvl2: 360,
    // Quality Score Settings
    alwaysCountQualityScore: true,
    alwaysSortQualityScore: false,
    excludeMyContentFromSort: false, // Exclude all my content pages from auto sort
    hideHitcount: false,
    useNormalization: false,
    userMaxScore: 32,
    minKudosToShowScore: 100,
    colorThresholdLow: 10,
    colorThresholdHigh: 20,
    // Shared Color Settings
    colorStyle: "background", // "none", "background", or "text"
    colorGreen: "#3e8fb0",
    colorYellow: "#f6c177",
    colorRed: "#eb6f92",
    colorText: "#ffffff",
    // Icon Settings
    useIcons: false,
    iconColor: "", // Empty = inherit from page, or set custom color
    // Chapter Time Settings
    chapterTimeStyle: "default", // "default", "colored", or "timeonly"
    // Stored username
    username: "", // Store detected username
  };

  // Current config, loaded from localStorage
  let CONFIG = { ...DEFAULTS };

  // Variables to track the state of the page
  let countable = false;
  let sortable = false;
  let statsPage = false;

  // --- HELPER FUNCTIONS ---
  const $ = (selector, root = document) => root.querySelectorAll(selector);
  const $1 = (selector, root = document) => root.querySelector(selector);

  // Load user settings from localStorage
  const loadUserSettings = () => {
    if (typeof Storage === "undefined") return;

    const savedConfig = localStorage.getItem("ao3_reading_quality_config");
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

  // Save all settings to localStorage
  const saveAllSettings = () => {
    if (typeof Storage !== "undefined") {
      localStorage.setItem(
        "ao3_reading_quality_config",
        JSON.stringify(CONFIG)
      );
    }
  };

  // Save a single setting to CONFIG and localStorage
  function saveSetting(key, value) {
    CONFIG[key] = value;
    saveAllSettings();
  }

  // Reset all settings to defaults
  const resetAllSettings = () => {
    if (confirm("Reset all settings to defaults?")) {
      if (typeof Storage !== "undefined") {
        localStorage.removeItem("ao3_reading_quality_config");
      }
      CONFIG = { ...DEFAULTS };
      if (CONFIG.enableReadingTime && countable) calculateReadtime();
      if (CONFIG.enableQualityScore && countable) countRatio();
      if (CONFIG.enableChapterStats) calculateChapterStats();
    }
  };

  // Detect and store username
  const detectAndStoreUsername = () => {
    let username = null;

    // Method 1: Try to get from user menu
    const userLink = document.querySelector(
      'li.user.logged-in a[href^="/users/"]'
    );
    if (userLink) {
      const match = userLink.getAttribute("href").match(/^\/users\/([^\/]+)/);
      if (match) username = match[1];
    }

    // Method 2: Check if already stored in config
    if (!username && CONFIG.username) {
      username = CONFIG.username;
    }

    // Method 3: Try to get from URL path
    if (!username) {
      const urlMatch = window.location.pathname.match(/^\/users\/([^\/]+)/);
      if (urlMatch) username = urlMatch[1];
    }

    // Method 4: Try to get from user_id query parameter (for bookmark pages)
    if (!username) {
      const params = new URLSearchParams(window.location.search);
      const paramUserId = params.get("user_id");
      if (paramUserId) {
        username = paramUserId;
      }
    }

    // If we found a username and it's not stored yet, store it
    if (username && username !== CONFIG.username) {
      saveSetting("username", username);
    }

    return username;
  };

  // Check if current page is a "my content" page
  const isMyContentPage = (username) => {
    if (!username) return false;

    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Patterns for user content pages in the URL path
    const patterns = [
      new RegExp(
        `^/users/${escapedUsername}(/pseuds/[^/]+)?(/(bookmarks|works))?(/|$)`
      ), // dashboard, bookmarks, works
      new RegExp(`^/users/${escapedUsername}/readings(/|$)`), // history page
    ];

    // Check path-based patterns
    if (patterns.some((r) => r.test(window.location.pathname))) {
      return true;
    }

    // Special case: /bookmarks with user_id parameter
    if (window.location.pathname.startsWith("/bookmarks")) {
      const params = new URLSearchParams(window.location.search);
      const paramUserId = params.get("user_id");
      if (paramUserId && paramUserId.toLowerCase() === username.toLowerCase()) {
        return true;
      }
    }

    return false;
  };

  // Robust number extraction from element
  const getNumberFromElement = (element) => {
    if (!element) return NaN;
    let text =
      element.getAttribute("data-ao3e-original") || element.textContent;
    if (text === null) return NaN;
    let cleanText = text.replace(/[,\sÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â°ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¯]/g, "");
    if (element.matches("dd.chapters")) {
      cleanText = cleanText.split("/")[0];
    }
    const number = parseInt(cleanText, 10);
    return isNaN(number) ? NaN : number;
  };

  // Apply color styling based on colorStyle setting
  const applyColorStyling = (element, color) => {
    if (CONFIG.colorStyle === "background") {
      element.style.backgroundColor = color;
      element.style.color = CONFIG.colorText;
      element.style.padding = "0 4px";
    } else if (CONFIG.colorStyle === "text") {
      element.style.color = color;
      element.style.backgroundColor = "";
      element.style.padding = "";
    } else {
      // colorStyle === "none"
      element.style.backgroundColor = "";
      element.style.color = "inherit";
      element.style.padding = "";
    }
  };

  // Add CSS to ensure icons work with skins that style stats
  const addIconStyles = () => {
    const style = document.createElement("style");
    style.id = "ao3-userscript-icon-styles";

    const iconColor = CONFIG.iconColor || "currentColor";
    style.textContent = `
      .stats dd.readtime::before,
      dl.statistics dt.readtime::before {
        display: inline-block !important;
        width: 1em !important;
        height: 1em !important;
        min-width: 1em !important;
        min-height: 1em !important;
        margin-right: 5px !important;
        background-color: ${iconColor} !important;
        ${CONFIG.iconColor ? "filter: none !important;" : ""}
        -webkit-mask-image: url("https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/373d8c4cde1210ac54eb0c6ce74cfe0415c2814a/assets/icon_readingtime.svg") !important;
        mask-image: url("https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/373d8c4cde1210ac54eb0c6ce74cfe0415c2814a/assets/icon_readingtime.svg") !important;
        -webkit-mask-size: contain !important;
        mask-size: contain !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center center !important;
        mask-position: center center !important;
        content: "" !important;
        /* vertical-align: text-bottom !important; */
        transform: translate(0, 1px) !important;
      }

      .stats dd.kudoshits::before,
      dl.statistics dt.kudoshits::before {
        display: inline-block !important;
        width: 1em !important;
        height: 1em !important;
        min-width: 1em !important;
        min-height: 1em !important;
        margin-right: 5px !important;
        background-color: ${iconColor} !important;
        ${CONFIG.iconColor ? "filter: none !important;" : ""}
        -webkit-mask-image: url("https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/373d8c4cde1210ac54eb0c6ce74cfe0415c2814a/assets/icon_score-sparkles.svg") !important;
        mask-image: url("https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/373d8c4cde1210ac54eb0c6ce74cfe0415c2814a/assets/icon_score-sparkles.svg") !important;
        -webkit-mask-size: contain !important;
        mask-size: contain !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center center !important;
        mask-position: center center !important;
        content: "" !important;
        /* vertical-align: text-bottom !important; */
        transform: translate(0, 1px) !important;
      }

      dl.stats dd {
        justify-content: center;
        position: relative;
      }

      .stats dd.readtime::after {
        display: none;
        position: absolute;
        top: 2em;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        padding: 0.3em;
        font-size: 0.8em;
        line-height: 1;
        text-align: center;
        content: "Time";
        white-space: nowrap;
        pointer-events: none;
      }
      .stats dd.kudoshits::after {
        display: none;
        position: absolute;
        top: 2em;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        padding: 0.3em;
        font-size: 0.8em;
        line-height: 1;
        text-align: center;
        content: "Score";
        white-space: nowrap;
        pointer-events: none;
      }

      .stats dd:hover::after {
        display: inline-block;
      }

      .statistics .stats dd:last-of-type::after,
      .index .stats dd:last-of-type:has(a[href$=bookmarks])::after,
      .stats dd.inspired::after,
      .tagset .index .stats dd:last-of-type::after {
        right: 0;
        left: auto;
        transform: none;
      }

      .stats a,
      .stats a:visited {
        border: none;
        color: inherit;
      }

      .stats dt.readtime,
      .stats dt.kudoshits,
      dl.statistics dt.readtime,
      dl.statistics dt.kudoshits {
        font-size: 0 !important;
        line-height: 0 !important;
      }

      dl.statistics dt.readtime::before,
      dl.statistics dt.kudoshits::before {
        font-size: 1rem !important;
        line-height: normal !important;
      }

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

    document.head.appendChild(style);
  };

  // --- READING TIME FUNCTIONS ---
  const checkCountable = () => {
    const foundStats = $("dl.stats");
    if (foundStats.length === 0) return;

    for (const stat of foundStats) {
      const li = stat.closest("li.work, li.bookmark");
      if (li) {
        countable = true;
        sortable = true;
        return;
      }
      if (stat.closest(".statistics")) {
        countable = true;
        sortable = true;
        statsPage = true;
        return;
      }
      if (stat.closest("dl.work")) {
        countable = true;
        return;
      }
    }
  };

  const calculateReadtime = () => {
    if (!countable || !CONFIG.enableReadingTime) return;
    $("dl.stats").forEach((statsElement) => {
      if ($1("dt.readtime", statsElement)) return;
      const wordsElement = $1("dd.words", statsElement);
      if (!wordsElement) return;
      const words_count = getNumberFromElement(wordsElement);
      if (isNaN(words_count)) return;
      const minutes = words_count / CONFIG.wpm;
      const hrs = Math.floor(minutes / 60);
      const mins = (minutes % 60).toFixed(0);
      const minutes_print = hrs > 0 ? hrs + "h" + mins + "m" : mins + "m";

      const readtime_label = document.createElement("dt");
      readtime_label.className = "readtime";

      if (!CONFIG.useIcons) {
        readtime_label.textContent = "Time:";
      }

      const readtime_value = document.createElement("dd");
      readtime_value.className = "readtime";

      let color;
      if (minutes < CONFIG.readingTimeLvl1) {
        color = CONFIG.colorGreen;
      } else if (minutes < CONFIG.readingTimeLvl2) {
        color = CONFIG.colorYellow;
      } else {
        color = CONFIG.colorRed;
      }

      Object.assign(readtime_value.style, {
        display: "inline-block",
        verticalAlign: "baseline",
      });

      if (CONFIG.useIcons) {
        const textSpan = document.createElement("span");
        textSpan.textContent = minutes_print;
        textSpan.style.borderRadius = "4px";
        textSpan.style.display = "inline-block";
        textSpan.style.verticalAlign = "baseline";
        // Remove fontSize and lineHeight so it inherits from parent
        textSpan.style.fontSize = "inherit";
        textSpan.style.lineHeight = "inherit";
        applyColorStyling(textSpan, color);
        readtime_value.appendChild(textSpan);
      } else {
        readtime_value.textContent = minutes_print;
        readtime_value.style.borderRadius = "4px";
        // Remove fontSize and lineHeight so it inherits from parent
        readtime_value.style.fontSize = "inherit";
        readtime_value.style.lineHeight = "inherit";
        applyColorStyling(readtime_value, color);
      }

      wordsElement.insertAdjacentElement("afterend", readtime_label);
      readtime_label.insertAdjacentElement("afterend", readtime_value);
    });
  };

  // --- QUALITY SCORE FUNCTIONS ---
  const calculateWordBasedScore = (kudos, hits, words) => {
    if (hits === 0 || words === 0 || kudos === 0) return 0;
    const effectiveChapters = words / 5000;
    const adjustedHits = hits / Math.sqrt(effectiveChapters);
    return (100 * kudos) / adjustedHits;
  };

  const countRatio = () => {
    if (!countable || !CONFIG.enableQualityScore) return;
    $("dl.stats").forEach((statsElement) => {
      if ($1("dt.kudoshits", statsElement)) return;
      const hitsElement = $1("dd.hits", statsElement);
      const kudosElement = $1("dd.kudos", statsElement);
      const wordsElement = $1("dd.words", statsElement);
      const parentLi = statsElement.closest("li");
      try {
        const hits = getNumberFromElement(hitsElement);
        const kudos = getNumberFromElement(kudosElement);
        const words = getNumberFromElement(wordsElement);
        if (isNaN(hits) || isNaN(kudos) || isNaN(words)) return;
        if (kudos < CONFIG.minKudosToShowScore) {
          if (statsElement.querySelector("dt.kudoshits"))
            statsElement.querySelector("dt.kudoshits").remove();
          if (statsElement.querySelector("dd.kudoshits"))
            statsElement.querySelector("dd.kudoshits").remove();
          return;
        }
        let rawScore = calculateWordBasedScore(kudos, hits, words);
        if (kudos < 10) rawScore = 1;
        let displayScore = rawScore;
        let thresholdLow = CONFIG.colorThresholdLow;
        let thresholdHigh = CONFIG.colorThresholdHigh;
        if (CONFIG.useNormalization) {
          displayScore = (rawScore / CONFIG.userMaxScore) * 100;
          displayScore = Math.min(100, displayScore);
          displayScore = Math.ceil(displayScore);
          thresholdLow = Math.ceil(
            (CONFIG.colorThresholdLow / CONFIG.userMaxScore) * 100
          );
          thresholdHigh = Math.ceil(
            (CONFIG.colorThresholdHigh / CONFIG.userMaxScore) * 100
          );
        } else {
          displayScore = Math.round(displayScore * 10) / 10;
        }
        const ratioLabel = document.createElement("dt");
        ratioLabel.className = "kudoshits";

        if (!CONFIG.useIcons) {
          ratioLabel.textContent = "Score:";
        }
        const ratioValue = document.createElement("dd");
        ratioValue.className = "kudoshits";

        let color;
        if (displayScore >= thresholdHigh) {
          color = CONFIG.colorGreen;
        } else if (displayScore >= thresholdLow) {
          color = CONFIG.colorYellow;
        } else {
          color = CONFIG.colorRed;
        }

        Object.assign(ratioValue.style, {
          display: "inline-block",
          verticalAlign: "baseline",
        });

        if (CONFIG.useIcons) {
          const textSpan = document.createElement("span");
          textSpan.textContent = displayScore;
          textSpan.style.borderRadius = "4px";
          textSpan.style.display = "inline-block";
          textSpan.style.verticalAlign = "baseline";
          // Remove fontSize and lineHeight so it inherits from parent
          textSpan.style.fontSize = "inherit";
          textSpan.style.lineHeight = "inherit";
          applyColorStyling(textSpan, color);
          ratioValue.appendChild(textSpan);
        } else {
          ratioValue.textContent = displayScore;
          ratioValue.style.borderRadius = "4px";
          // Remove fontSize and lineHeight so it inherits from parent
          ratioValue.style.fontSize = "inherit";
          ratioValue.style.lineHeight = "inherit";
          applyColorStyling(ratioValue, color);
        }

        hitsElement.insertAdjacentElement("afterend", ratioValue);
        hitsElement.insertAdjacentElement("afterend", ratioLabel);
        if (CONFIG.hideHitcount && !statsPage && hitsElement) {
          hitsElement.style.display = "none";
        }
        if (parentLi) parentLi.setAttribute("kudospercent", displayScore);
      } catch (error) {
        console.error("Error calculating score:", error);
      }
    });
  };

  const sortByRatio = (ascending = false) => {
    if (!sortable) return;
    $("dl.stats").forEach((statsElement) => {
      const parentLi = statsElement.closest("li");
      const list = parentLi?.parentElement;
      if (!list) return;
      const listElements = Array.from(list.children);
      listElements.sort((a, b) => {
        const aPercent = parseFloat(a.getAttribute("kudospercent")) || 0;
        const bPercent = parseFloat(b.getAttribute("kudospercent")) || 0;
        return ascending ? aPercent - bPercent : bPercent - aPercent;
      });
      list.innerHTML = "";
      list.append(...listElements);
    });
  };

  // --- CHAPTER STATISTICS FUNCTIONS ---
  const calculateChapterStats = () => {
    if (!CONFIG.enableChapterStats) return;

    // Check if we're on a works/chapters page
    const WORKS_PAGE_REGEX =
      /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
    if (!WORKS_PAGE_REGEX.test(window.location.href)) return;

    const chaptersContainer = $1("#chapters");
    if (!chaptersContainer) return;

    // Find all chapter divs - works with both multi-chapter and single-chapter works
    // Single-chapter: #chapters > div.userstuff
    // Multi-chapter: #chapters > .chapter
    const chapters = $("#chapters > .chapter");
    const singleChapter = $1("#chapters > div.userstuff");

    let chaptersToProcess = [];
    if (chapters.length > 0) {
      chaptersToProcess = Array.from(chapters);
    } else if (singleChapter) {
      chaptersToProcess = [{ userstuff: singleChapter, isSingle: true }];
    }

    if (chaptersToProcess.length === 0) return;

    chaptersToProcess.forEach((chapter, index) => {
      let userstuff;
      if (chapter.isSingle) {
        userstuff = chapter.userstuff;
        // Check if already processed
        if (
          userstuff.previousElementSibling &&
          userstuff.previousElementSibling.classList.contains("notice")
        ) {
          return;
        }
      } else {
        // Multi-chapter work
        if ($1(".notice", chapter)) {
          return;
        }
        userstuff = $1("div.userstuff", chapter);
      }

      if (!userstuff) return;

      const clone = userstuff.cloneNode(true);

      const elementsToRemove = clone.querySelectorAll(
        "h3.landmark, script, style"
      );
      elementsToRemove.forEach((el) => el.remove());

      const text = clone.textContent
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[^\w\s'-]/g, "");

      const words = text.split(/\s+/).filter((word) => {
        return word.length > 0 && /[a-zA-Z]/.test(word);
      });

      const wordCount = words.length;

      if (wordCount === 0) return;

      const minutes = wordCount / CONFIG.wpm;
      const hrs = Math.floor(minutes / 60);
      const mins = Math.ceil(minutes % 60);

      // Full format for all styles
      let timeLongStr;
      if (hrs > 0) {
        timeLongStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""} ${mins} minute${mins > 1 ? "s" : ""}`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeLongStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      // Time only format
      let timeOnlyStr;
      if (hrs > 0) {
        timeOnlyStr =
          mins > 0
            ? `${hrs} hour${hrs > 1 ? "s" : ""}, ${mins} minute${mins > 1 ? "s" : ""}`
            : `${hrs} hour${hrs > 1 ? "s" : ""}`;
      } else {
        timeOnlyStr = `${mins} minute${mins > 1 ? "s" : ""}`;
      }

      let statsDiv;

      if (CONFIG.chapterTimeStyle === "default") {
        // Default style
        statsDiv = document.createElement("p");
        statsDiv.className = "ao3-chapter-stats-default";
        statsDiv.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;
      } else if (CONFIG.chapterTimeStyle === "colored") {
        // Colored notice box style
        statsDiv = document.createElement("ul");
        statsDiv.className = "notice ao3-chapter-stats";

        const listItem = document.createElement("li");
        listItem.textContent = `~${timeLongStr} (${wordCount.toLocaleString()} words)`;

        statsDiv.appendChild(listItem);
      } else {
        // Time only style
        statsDiv = document.createElement("p");
        statsDiv.className = "ao3-chapter-stats-timeonly";
        statsDiv.textContent = `~${timeOnlyStr}`;
      }

      // Find insertion point: after notes (if exist), before chapter text
      // Always insert outside of .preface to maintain consistent width
      if (chapter.isSingle) {
        const chapterNotes = $1("#chapters .notes");
        if (chapterNotes) {
          chapterNotes.insertAdjacentElement("afterend", statsDiv);
        } else {
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      } else {
        // Multi-chapter: insert after the entire preface container, not inside it
        const prefaceContainer = $1(".chapter.preface", chapter);
        if (prefaceContainer) {
          prefaceContainer.insertAdjacentElement("afterend", statsDiv);
        } else {
          // Fallback: before userstuff
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      }
    });
  };

  // --- SETTINGS POPUP ---
  const showSettingsPopup = () => {
    AO3MenuHelpers.removeAllDialogs();
    const popup = AO3MenuHelpers.createDialog('⏱️ Reading Time & Quality Score ⭐', {
      maxWidth: '600px'
    });
    const form = document.createElement("form");

    // Calculate values for display
    const displayThresholdLow = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdLow / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdLow;

    const displayThresholdHigh = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdHigh / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdHigh;

    // Build the form using helpers

    // Reading Time Section
    const readingTimeSection = AO3MenuHelpers.createSection('📚 Reading Time');
    const alwaysCountReadingTime = AO3MenuHelpers.createCheckbox({
      id: 'alwaysCountReadingTime',
      label: 'Calculate automatically',
      checked: CONFIG.alwaysCountReadingTime
    });
    const chapterTimeStyleRadios = AO3MenuHelpers.createRadioGroup({
      name: 'chapterTimeStyle',
      label: 'Chapter Reading Time Style:',
      options: [
        { value: 'default', label: 'Default', checked: CONFIG.chapterTimeStyle === 'default' },
        { value: 'colored', label: 'Notice', checked: CONFIG.chapterTimeStyle === 'colored' },
        { value: 'timeonly', label: 'Time Only', checked: CONFIG.chapterTimeStyle === 'timeonly' }
      ]
    });
    const enableChapterStats = AO3MenuHelpers.createConditionalCheckbox({
      id: 'enableChapterStats',
      label: 'Show chapter reading times',
      checked: CONFIG.enableChapterStats,
      tooltip: 'Show word count and reading time at the start of each chapter',
      subsettings: [chapterTimeStyleRadios]
    });
    const wpm = AO3MenuHelpers.createNumberInput({
      id: 'wpm',
      label: 'Words per minute',
      value: CONFIG.wpm,
      min: 100,
      max: 1000,
      step: 25,
      tooltip: 'Average reading speed is 200-300 wpm. 375 is for faster readers.'
    });
    const readingTimeLvl1 = AO3MenuHelpers.createNumberInput({
      id: 'readingTimeLvl1',
      label: 'Yellow threshold (minutes)',
      value: CONFIG.readingTimeLvl1,
      min: 5,
      max: 240,
      step: 5,
      tooltip: 'Works taking less than this many minutes will be colored green'
    });
    const readingTimeLvl2 = AO3MenuHelpers.createNumberInput({
      id: 'readingTimeLvl2',
      label: 'Red threshold (minutes)',
      value: CONFIG.readingTimeLvl2,
      min: 30,
      max: 480,
      step: 10,
      tooltip: 'Works taking more than this many minutes will be colored red'
    });
    const readingTimeSubsettings = [alwaysCountReadingTime, enableChapterStats, wpm, readingTimeLvl1, readingTimeLvl2];
    const enableReadingTime = AO3MenuHelpers.createConditionalCheckbox({
      id: 'enableReadingTime',
      label: 'Enable Reading Time',
      checked: CONFIG.enableReadingTime,
      subsettings: readingTimeSubsettings
    });
    readingTimeSection.appendChild(enableReadingTime);
    form.appendChild(readingTimeSection);

    // Quality Score Section
    const qualityScoreSection = AO3MenuHelpers.createSection('💖 Quality Score');
    const alwaysCountQualityScore = AO3MenuHelpers.createCheckbox({
      id: 'alwaysCountQualityScore',
      label: 'Calculate automatically',
      checked: CONFIG.alwaysCountQualityScore
    });
    const excludeMyContent = AO3MenuHelpers.createCheckbox({
      id: 'excludeMyContentFromSort',
      label: 'Exclude my content',
      checked: CONFIG.excludeMyContentFromSort,
      tooltip: 'Disable automatic sorting on your user dashboard, bookmarks, history, and works pages'
    });
    const alwaysSortQualityScore = AO3MenuHelpers.createConditionalCheckbox({
      id: 'alwaysSortQualityScore',
      label: 'Sort by score automatically',
      checked: CONFIG.alwaysSortQualityScore,
      subsettings: [excludeMyContent]
    });
    const hideHitcount = AO3MenuHelpers.createCheckbox({
      id: 'hideHitcount',
      label: 'Hide hit count',
      checked: CONFIG.hideHitcount
    });
    const minKudosToShowScore = AO3MenuHelpers.createNumberInput({
      id: 'minKudosToShowScore',
      label: 'Minimum kudos to show score',
      value: CONFIG.minKudosToShowScore,
      min: 0,
      max: 10000,
      step: 1
    });
    const userMaxScore = AO3MenuHelpers.createNumberInput({
      id: 'userMaxScore',
      label: 'Best Possible Raw Score <span id="normalizationLabel">' + (CONFIG.useNormalization ? '(for 100%)' : '') + '</span>',
      value: CONFIG.userMaxScore,
      min: 1,
      max: 100,
      step: 1,
      tooltip: 'The highest score you\'ve seen in your fandom. Used to scale other scores to percentages.'
    });
    const userMaxScoreContainer = document.createElement('div');
    userMaxScoreContainer.className = 'setting-group';
    userMaxScoreContainer.appendChild(userMaxScore);
    userMaxScoreContainer.id = 'userMaxScoreContainer';
    const colorThresholdLow = AO3MenuHelpers.createNumberInput({
      id: 'colorThresholdLow',
      label: 'Good Score <span id="thresholdLowLabel">' + (CONFIG.useNormalization ? '(%)' : '') + '</span>',
      value: displayThresholdLow,
      min: 0.1,
      max: 100,
      step: 0.1,
      tooltip: 'Scores at or above this threshold will be colored yellow'
    });
    const colorThresholdHigh = AO3MenuHelpers.createNumberInput({
      id: 'colorThresholdHigh',
      label: 'Excellent Score <span id="thresholdHighLabel">' + (CONFIG.useNormalization ? '(%)' : '') + '</span>',
      value: displayThresholdHigh,
      min: 0.1,
      max: 100,
      step: 0.1,
      tooltip: 'Scores at or above this threshold will be colored green'
    });
    const useNormalization = AO3MenuHelpers.createConditionalCheckbox({
      id: 'useNormalization',
      label: 'Normalize scores to 100%',
      checked: CONFIG.useNormalization,
      tooltip: 'Scale the raw score so your \'Best Possible Raw Score\' equals 100%. Makes scores from different fandoms more comparable.',
      subsettings: [userMaxScoreContainer]
    });
    const qualityScoreSubsettings = [alwaysCountQualityScore, alwaysSortQualityScore, hideHitcount, minKudosToShowScore, useNormalization, colorThresholdLow, colorThresholdHigh];
    const enableQualityScore = AO3MenuHelpers.createConditionalCheckbox({
      id: 'enableQualityScore',
      label: 'Enable Quality Score',
      checked: CONFIG.enableQualityScore,
      subsettings: qualityScoreSubsettings
    });
    qualityScoreSection.appendChild(enableQualityScore);
    form.appendChild(qualityScoreSection);

    // Visual Styling Section
    const visualStylingSection = AO3MenuHelpers.createSection('🎨 Visual Styling');
    const chapterTimeStyleSettings = document.createElement('div');
    chapterTimeStyleSettings.className = 'setting-group';
    chapterTimeStyleSettings.appendChild(chapterTimeStyleRadios);
    chapterTimeStyleSettings.id = 'chapterTimeStyleSettings';
    const colorStyleRadios = AO3MenuHelpers.createRadioGroup({
      name: 'colorStyle',
      label: 'Color Style:',
      options: [
        { value: 'none', label: 'Default text', checked: CONFIG.colorStyle === 'none' },
        { value: 'text', label: 'Colored text', checked: CONFIG.colorStyle === 'text' },
        { value: 'background', label: 'Colored backgrounds', checked: CONFIG.colorStyle === 'background' }
      ]
    });
    const colorGreen = AO3MenuHelpers.createColorPicker({
      id: 'colorGreen',
      label: 'Green',
      value: CONFIG.colorGreen
    });
    const colorYellow = AO3MenuHelpers.createColorPicker({
      id: 'colorYellow',
      label: 'Yellow',
      value: CONFIG.colorYellow
    });
    const colorRed = AO3MenuHelpers.createColorPicker({
      id: 'colorRed',
      label: 'Red',
      value: CONFIG.colorRed
    });
    const colorText = AO3MenuHelpers.createColorPicker({
      id: 'colorText',
      label: 'Text color',
      value: CONFIG.colorText
    });
    const colorTextContainer = document.createElement('div');
    colorTextContainer.className = 'setting-group';
    colorTextContainer.appendChild(colorText);
    colorTextContainer.id = 'textColorContainer';
    const colorPickerSettings = AO3MenuHelpers.createTwoColumnLayout(
      (() => {
        const leftContent = document.createElement('div');
        leftContent.className = 'setting-group';
        leftContent.appendChild(colorGreen);
        leftContent.appendChild(colorYellow);
        return leftContent;
      })(),
      (() => {
        const rightContent = document.createElement('div');
        rightContent.className = 'setting-group';
        rightContent.appendChild(colorRed);
        rightContent.appendChild(colorTextContainer);
        return rightContent;
      })()
    );
    colorPickerSettings.id = 'colorPickerSettings';
    const useIcons = AO3MenuHelpers.createConditionalCheckbox({
      id: 'useIcons',
      label: 'Use icons instead of text labels',
      checked: CONFIG.useIcons,
      tooltip: 'Replace \'Time:\' and \'Score:\' labels with icons',
      subsettings: [] // will add
    });
    const useCustomIconColor = AO3MenuHelpers.createConditionalCheckbox({
      id: 'useCustomIconColor',
      label: 'Use custom icon color',
      checked: CONFIG.iconColor ? true : false,
      tooltip: 'When unchecked, icons will inherit color from your site skin. When checked, you can set a specific color.',
      subsettings: [] // will add
    });
    const iconColor = AO3MenuHelpers.createColorPicker({
      id: 'iconColor',
      label: 'Icon color',
      value: CONFIG.iconColor || '#000000'
    });
    const customIconColorPicker = document.createElement('div');
    customIconColorPicker.className = 'setting-group';
    customIconColorPicker.appendChild(iconColor);
    customIconColorPicker.id = 'customIconColorPicker';
    useCustomIconColor.subsettings = [customIconColorPicker];
    const iconColorSettings = AO3MenuHelpers.createSubsettings([useCustomIconColor]);
    iconColorSettings.id = 'iconColorSettings';
    useIcons.subsettings = [iconColorSettings];
    visualStylingSection.appendChild(chapterTimeStyleSettings);
    visualStylingSection.appendChild(colorStyleRadios);
    visualStylingSection.appendChild(colorPickerSettings);
    visualStylingSection.appendChild(useIcons);
    form.appendChild(visualStylingSection);

    // Buttons
    const buttons = AO3MenuHelpers.createButtonGroup([
      { text: 'Save', id: 'save-btn' },
      { text: 'Close', id: 'closePopup' }
    ]);
    form.appendChild(buttons);

    // Reset link
    const resetLink = AO3MenuHelpers.createResetLink('Reset to Default Settings', () => {
      resetAllSettings();
      popup.remove();
    });
    form.appendChild(resetLink);

    // Toggle functions
    // Toggle chapter time style settings
    const enableChapterStatsCheckbox = form.querySelector("#enableChapterStats");
    enableChapterStatsCheckbox.addEventListener('change', () => {
      form.querySelector("#chapterTimeStyleSettings").style.display = enableChapterStatsCheckbox.checked ? "block" : "none";
    });
    // Toggle color settings
    const colorStyleRadioInputs = form.querySelectorAll('input[name="colorStyle"]');
    const toggleColorSettings = () => {
      const selectedStyle = form.querySelector('input[name="colorStyle"]:checked').value;
      form.querySelector("#colorPickerSettings").style.display = selectedStyle !== "none" ? "block" : "none";
      form.querySelector("#textColorContainer").style.display = selectedStyle === "background" ? "block" : "none";
    };
    colorStyleRadioInputs.forEach(radio => radio.addEventListener('change', toggleColorSettings));
    // Toggle normalization labels
    const normCheckbox = form.querySelector("#useNormalization");
    const toggleNormalization = () => {
      if (normCheckbox.checked) {
        form.querySelector("#normalizationLabel").textContent = "(for 100%)";
        form.querySelector("#thresholdLowLabel").textContent = "(%)";
        form.querySelector("#thresholdHighLabel").textContent = "(%)";
        form.querySelector("#userMaxScoreContainer").style.display = "block";
        // Convert current raw thresholds to percentages
        const currentLow = parseFloat(AO3MenuHelpers.getValue('colorThresholdLow'));
        const currentHigh = parseFloat(AO3MenuHelpers.getValue('colorThresholdHigh'));
        const maxScore = parseFloat(AO3MenuHelpers.getValue('userMaxScore'));
        AO3MenuHelpers.setValue('colorThresholdLow', Math.ceil((currentLow / maxScore) * 100));
        AO3MenuHelpers.setValue('colorThresholdHigh', Math.ceil((currentHigh / maxScore) * 100));
      } else {
        form.querySelector("#normalizationLabel").textContent = "";
        form.querySelector("#thresholdLowLabel").textContent = "";
        form.querySelector("#thresholdHighLabel").textContent = "";
        form.querySelector("#userMaxScoreContainer").style.display = "none";
        // Convert current percentages back to raw values
        const currentLow = parseFloat(AO3MenuHelpers.getValue('colorThresholdLow'));
        const currentHigh = parseFloat(AO3MenuHelpers.getValue('colorThresholdHigh'));
        const maxScore = parseFloat(AO3MenuHelpers.getValue('userMaxScore'));
        AO3MenuHelpers.setValue('colorThresholdLow', Math.round((currentLow / 100) * maxScore));
        AO3MenuHelpers.setValue('colorThresholdHigh', Math.round((currentHigh / 100) * maxScore));
      }
    };
    normCheckbox.addEventListener("change", toggleNormalization);
    // Initial display
    form.querySelector("#chapterTimeStyleSettings").style.display = CONFIG.enableChapterStats ? "block" : "none";
    form.querySelector("#colorPickerSettings").style.display = CONFIG.colorStyle !== "none" ? "block" : "none";
    form.querySelector("#textColorContainer").style.display = CONFIG.colorStyle === "background" ? "block" : "none";
    form.querySelector("#iconColorSettings").style.display = CONFIG.useIcons ? "block" : "none";
    form.querySelector("#customIconColorPicker").style.display = CONFIG.iconColor ? "block" : "none";

    // Event listeners
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Collect all values first
      let userMaxScoreValue = parseFloat(AO3MenuHelpers.getValue('userMaxScore'));
      let thresholdLowValue = parseFloat(AO3MenuHelpers.getValue('colorThresholdLow'));
      let thresholdHighValue = parseFloat(AO3MenuHelpers.getValue('colorThresholdHigh'));
      const isNormalizationEnabled = AO3MenuHelpers.getValue('useNormalization');
      // If normalization is enabled, convert percentages back to raw scores before saving
      if (isNormalizationEnabled) {
        thresholdLowValue = (thresholdLowValue / 100) * userMaxScoreValue;
        thresholdHighValue = (thresholdHighValue / 100) * userMaxScoreValue;
      }
      // Update config object with all settings
      CONFIG.enableReadingTime = AO3MenuHelpers.getValue('enableReadingTime');
      CONFIG.enableQualityScore = AO3MenuHelpers.getValue('enableQualityScore');
      CONFIG.enableChapterStats = AO3MenuHelpers.getValue('enableChapterStats');
      CONFIG.alwaysCountReadingTime = AO3MenuHelpers.getValue('alwaysCountReadingTime');
      CONFIG.wpm = parseInt(AO3MenuHelpers.getValue('wpm'));
      CONFIG.readingTimeLvl1 = parseInt(AO3MenuHelpers.getValue('readingTimeLvl1'));
      CONFIG.readingTimeLvl2 = parseInt(AO3MenuHelpers.getValue('readingTimeLvl2'));
      CONFIG.alwaysCountQualityScore = AO3MenuHelpers.getValue('alwaysCountQualityScore');
      CONFIG.alwaysSortQualityScore = AO3MenuHelpers.getValue('alwaysSortQualityScore');
      CONFIG.excludeMyContentFromSort = AO3MenuHelpers.getValue('excludeMyContentFromSort');
      CONFIG.hideHitcount = AO3MenuHelpers.getValue('hideHitcount');
      CONFIG.minKudosToShowScore = parseInt(AO3MenuHelpers.getValue('minKudosToShowScore'));
      CONFIG.useNormalization = isNormalizationEnabled;
      CONFIG.userMaxScore = userMaxScoreValue;
      CONFIG.colorThresholdLow = thresholdLowValue;
      CONFIG.colorThresholdHigh = thresholdHighValue;
      CONFIG.colorStyle = AO3MenuHelpers.getValue('colorStyle');
      CONFIG.colorGreen = AO3MenuHelpers.getValue('colorGreen');
      CONFIG.colorYellow = AO3MenuHelpers.getValue('colorYellow');
      CONFIG.colorRed = AO3MenuHelpers.getValue('colorRed');
      CONFIG.colorText = AO3MenuHelpers.getValue('colorText');
      CONFIG.useIcons = AO3MenuHelpers.getValue('useIcons');
      CONFIG.iconColor = AO3MenuHelpers.getValue('useCustomIconColor') ? AO3MenuHelpers.getValue('iconColor') : "";
      CONFIG.chapterTimeStyle = AO3MenuHelpers.getValue('chapterTimeStyle');
      // Save the entire config object
      saveAllSettings();
      popup.remove();
      location.reload();
    });
    form.querySelector('#closePopup').addEventListener('click', () => popup.remove());
    popup.appendChild(form);
  };

  // --- SHARED MENU SYSTEM ---
  function initSharedMenu() {
    const menuContainer = document.getElementById("scriptconfig");
    if (!menuContainer) {
      const headerMenu = document.querySelector(
        "ul.primary.navigation.actions"
      );
      const searchItem = headerMenu
        ? headerMenu.querySelector("li.search")
        : null;
      if (!headerMenu || !searchItem) return;

      // Create menu container
      const newMenuContainer = document.createElement("li");
      newMenuContainer.className = "dropdown";
      newMenuContainer.id = "scriptconfig";

      const title = document.createElement("a");
      title.className = "dropdown-toggle";
      title.href = "/";
      title.setAttribute("data-toggle", "dropdown");
      title.setAttribute("data-target", "#");
      title.textContent = "Userscripts";
      newMenuContainer.appendChild(title);

      const menu = document.createElement("ul");
      menu.className = "menu dropdown-menu";
      newMenuContainer.appendChild(menu);

      // Insert before search item
      headerMenu.insertBefore(newMenuContainer, searchItem);
    }

    // Add menu items
    const menu = document.querySelector("#scriptconfig .dropdown-menu");
    if (menu) {
      const showMenuOptions = isAllowedMenuPage();

      // Always add settings menu item
      const settingsItem = document.createElement("li");
      const settingsLink = document.createElement("a");
      settingsLink.href = "javascript:void(0);";
      settingsLink.id = "opencfg_reading_quality";
      settingsLink.textContent = "Reading Time & Quality Score";
      settingsLink.addEventListener("click", showSettingsPopup);
      settingsItem.appendChild(settingsLink);
      menu.appendChild(settingsItem);

      // Add separator if we have conditional items
      if (CONFIG.enableReadingTime || CONFIG.enableQualityScore) {
        const separator = document.createElement("li");
        separator.innerHTML = "<hr style='margin: 5px 0;'>";
        menu.appendChild(separator);
      }

      // Reading Time manual calculation only if 'Calculate automatically' is unchecked
      if (CONFIG.enableReadingTime && !CONFIG.alwaysCountReadingTime) {
        const readingTimeItem = document.createElement("li");
        const readingTimeLink = document.createElement("a");
        readingTimeLink.href = "javascript:void(0);";
        readingTimeLink.textContent = "Reading Time: Calculate Times";
        readingTimeLink.addEventListener("click", calculateReadtime);
        readingTimeItem.appendChild(readingTimeLink);
        menu.appendChild(readingTimeItem);
      }

      // Quality Score manual calculation only if 'Calculate automatically' is unchecked
      if (CONFIG.enableQualityScore && !CONFIG.alwaysCountQualityScore) {
        const qualityScoreItem = document.createElement("li");
        const qualityScoreLink = document.createElement("a");
        qualityScoreLink.href = "javascript:void(0);";
        qualityScoreLink.textContent = "Quality Score: Calculate Scores";
        qualityScoreLink.addEventListener("click", countRatio);
        qualityScoreItem.appendChild(qualityScoreLink);
        menu.appendChild(qualityScoreItem);
      }

      // Sort by Score only if 'Sort by score automatically' is unchecked AND not on actual works pages AND allowed by showMenuOptions
      const isWorksPage = /^\/works\/(\d+)(\/chapters\/\d+)?(\/|$)/.test(
        window.location.pathname
      );
      if (
        showMenuOptions &&
        CONFIG.enableQualityScore &&
        !CONFIG.alwaysSortQualityScore &&
        !isWorksPage
      ) {
        const sortScoreItem = document.createElement("li");
        const sortScoreLink = document.createElement("a");
        sortScoreLink.href = "javascript:void(0);";
        sortScoreLink.textContent = "Quality Score: Sort by Score";
        sortScoreLink.addEventListener("click", () => sortByRatio());
        sortScoreItem.appendChild(sortScoreLink);
        menu.appendChild(sortScoreItem);
      }
    }
  }

  function isAllowedMenuPage() {
    const path = window.location.pathname;
    if (/^\/works\/(\d+)(\/chapters\/\d+)?(\/|$)/.test(path)) return false;
    if (
      /^\/users\/[^\/]+\/bookmarks(\/|$)/.test(path) ||
      /^\/bookmarks(\/|$)/.test(path)
    )
      return true;
    if (/^\/users\/[^\/]+\/pseuds\/[^\/]+\/bookmarks(\/|$)/.test(path))
      return true;
    if (/^\/users\/[^\/]+\/?$/.test(path)) return true;
    if (/^\/users\/[^\/]+\/pseuds\/[^\/]+\/works(\/|$)/.test(path)) return true;
    if (/^\/tags\/[^\/]+\/works(\/|$)/.test(path)) return true;
    if (/^\/collections\/[^\/]+(\/|$)/.test(path)) return true;
    if (/^\/works(\/|$)/.test(path)) return true;
    return false;
  }

  // --- INITIALIZATION ---
  const init = () => {
    checkCountable();
    initSharedMenu();

    // Detect and store username early
    const username = detectAndStoreUsername();

    // Consolidate all delayed operations into a single setTimeout
    setTimeout(() => {
      if (CONFIG.alwaysCountReadingTime && CONFIG.enableReadingTime) {
        calculateReadtime();
      }

      if (CONFIG.alwaysCountQualityScore && CONFIG.enableQualityScore) {
        countRatio();

        // Determine if this is a "my content" page
        const myContentPage = isMyContentPage(username);

        // Only sort if:
        // 1. Auto-sort is enabled, AND
        // 2. Either exclude is off OR this is not my content page
        if (
          CONFIG.alwaysSortQualityScore &&
          !(CONFIG.excludeMyContentFromSort && myContentPage)
        ) {
          sortByRatio();
        }
      }

      if (CONFIG.enableChapterStats) {
        calculateChapterStats();
      }
    }, 150);
  };

  loadUserSettings();
  addIconStyles();

  console.log("[AO3: Reading Time & Quality Score] loaded.");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();