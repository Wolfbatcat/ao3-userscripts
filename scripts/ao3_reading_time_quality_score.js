// ==UserScript==
// @name        AO3: Reading Time & Quality Score
// @version     3.2
// @description  Add reading time, chapter reading time, and quality scores to AO3 works with color coding, score normalization and sorting.
// @author      BlackBatCat
// @match       *://archiveofourown.org/
// @match       *://archiveofourown.org/tags/*/works*
// @match       *://archiveofourown.org/works*
// @match       *://archiveofourown.org/chapters/*
// @match       *://archiveofourown.org/users/*
// @match       *://archiveofourown.org/collections/*
// @match       *://archiveofourown.org/bookmarks*
// @match       *://archiveofourown.org/series/*
// @license     MIT
// @require     https://update.greasyfork.org/scripts/552743/AO3%3A%20Menu%20Helpers%20Library.js
// @grant       none
// ==/UserScript==

(function () {
  "use strict";

  // DEFAULT CONFIGURATION
  const DEFAULTS = {
    enableReadingTime: true,
    enableQualityScore: true,
    enableChapterStats: true,
    wpm: 375,
    alwaysCountReadingTime: true,
    readingTimeLvl1: 120,
    readingTimeLvl2: 360,
    alwaysCountQualityScore: true,
    alwaysSortQualityScore: false,
    excludeMyContentFromSort: false,
    hideMetrics: false,
    hideHits: false,
    hideKudos: false,
    hideBookmarks: false,
    hideComments: false,
    useNormalization: false,
    userMaxScore: 32,
    minKudosToShowScore: 100,
    colorThresholdLow: 10,
    colorThresholdHigh: 20,
    colorStyle: "background",
    colorGreen: "#3e8fb0",
    colorYellow: "#f6c177",
    colorRed: "#eb6f92",
    colorText: "#ffffff",
    useIcons: false,
    iconColor: "",
    chapterTimeStyle: "default",
    username: "",
  };

  let CONFIG = { ...DEFAULTS };
  let countable = false;
  let sortable = false;
  let statsPage = false;

  const $ = (selector, root = document) => root.querySelectorAll(selector);
  const $1 = (selector, root = document) => root.querySelector(selector);

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

  const saveAllSettings = () => {
    if (typeof Storage !== "undefined") {
      localStorage.setItem(
        "ao3_reading_quality_config",
        JSON.stringify(CONFIG)
      );
    }
  };

  function saveSetting(key, value) {
    CONFIG[key] = value;
    saveAllSettings();
  }

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

  const detectAndStoreUsername = () => {
    let username = null;
    const userLink = document.querySelector(
      'li.user.logged-in a[href^="/users/"]'
    );
    if (userLink) {
      const match = userLink.getAttribute("href").match(/^\/users\/([^\/]+)/);
      if (match) username = match[1];
    }
    if (!username && CONFIG.username) {
      username = CONFIG.username;
    }
    if (!username) {
      const urlMatch = window.location.pathname.match(/^\/users\/([^\/]+)/);
      if (urlMatch) username = urlMatch[1];
    }
    if (!username) {
      const params = new URLSearchParams(window.location.search);
      const paramUserId = params.get("user_id");
      if (paramUserId) username = paramUserId;
    }
    if (username && username !== CONFIG.username) {
      saveSetting("username", username);
    }
    return username;
  };

  const isMyContentPage = (username) => {
    if (!username) return false;
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `^/users/${escapedUsername}(/pseuds/[^/]+)?(/(bookmarks|works))?(/|$)`
      ),
      new RegExp(`^/users/${escapedUsername}/readings(/|$)`),
    ];
    if (patterns.some((r) => r.test(window.location.pathname))) {
      return true;
    }
    if (window.location.pathname.startsWith("/bookmarks")) {
      const params = new URLSearchParams(window.location.search);
      const paramUserId = params.get("user_id");
      if (paramUserId && paramUserId.toLowerCase() === username.toLowerCase()) {
        return true;
      }
    }
    return false;
  };

  const getNumberFromElement = (element) => {
    if (!element) return NaN;
    let text =
      element.getAttribute("data-ao3e-original") || element.textContent;
    if (text === null) return NaN;
    let cleanText = text.replace(/[,\s]/g, "");
    if (element.matches("dd.chapters")) {
      cleanText = cleanText.split("/")[0];
    }
    const number = parseInt(cleanText, 10);
    return isNaN(number) ? NaN : number;
  };

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
      element.style.backgroundColor = "";
      element.style.color = "inherit";
      element.style.padding = "";
    }
  };

  const addIconStyles = () => {
    const style = document.createElement("style");
    style.id = "ao3-userscript-icon-styles";
    const iconColor = CONFIG.iconColor || "currentColor";

    // Embedded SVG icons as base64-encoded data URIs
    const readingTimeIcon =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGcgdHJhbnNmb3JtPSJtYXRyaXgoMS4yLDAsMCwxLjIsLTIuNCwtMi40KSI+PHBhdGggZmlsbD0iIzAwMDAwMCIgZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05LjY2OCAxMy4zNjlhMS44ODQgMS44ODQgMCAwIDAgMC0yLjczOGwtLjEwOC0uMTAyQzcuNTQ1IDguNjA1IDUuOTg4IDcuMTIgNS41MiA0LjAwNyA1LjM1MiAyLjkxIDYuMjkyIDIgNy40MjQgMmg5LjE1YzEuMTMyIDAgMi4wNzIuOTEgMS45MDYgMi4wMDctLjQ3IDMuMTEzLTIuMDI2IDQuNTk4LTQuMDQxIDYuNTIybC0uMTA3LjEwMmExLjg4NCAxLjg4NCAwIDAgMCAwIDIuNzM4bC4xMDcuMTAyYzIuMDE1IDEuOTI0IDMuNTcyIDMuNDA5IDQuMDQxIDYuNTIyLjE2NiAxLjA5Ny0uNzc0IDIuMDA3LTEuOTA2IDIuMDA3aC05LjE1Yy0xLjEzMiAwLTIuMDcyLS45MS0xLjkwNi0yLjAwNy40Ny0zLjExMyAyLjAyNi00LjU5OCA0LjA0MS02LjUyMnptLjY4MyAxLjY5OC0uMDA4LjAwNmMtMS41MzUgMS4zNzMtMi42NzggMi4zOTUtMi44MjcgNC45MjNhLjQ2OC40NjggMCAwIDAgLjE2OC4zODguNDkzLjQ5MyAwIDAgMCAuMzIuMTE2aDcuOTkyYy4xNDQgMCAuMjc0LS4wNi4zNjMtLjE1OGEuNDY2LjQ2NiAwIDAgMCAuMTI0LS4zNDZjLS4xNDktMi41MjgtMS4yOTEtMy41NS0yLjgyNi00LjkyMy0uNDA2LS4zNjMtLjg0LS43NTEtMS4yOS0xLjE5OGEuNTIzLjUyMyAwIDAgMC0uNzM1IDBjLS40NDcuNDQ0LS44NzguODMtMS4yODEgMS4xOTF6Ii8+PC9nPjwvc3ZnPg==";

    const scoreIcon =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjMDAwMDAwIiBkPSJNMjk4LjEzOCAxMzYuNjY1Yy02Mi4wNjUtMTMuMDExLTExMC41NzYtNjEuNTIyLTEyMy41ODUtMTIzLjU4OGExNi40NTUgMTYuNDU1IDAgMCAwLTMyLjIwOS4wMDFjLTEzLjAxIDYyLjA2NS02MS41MjEgMTEwLjU3NS0xMjMuNTg2IDEyMy41ODRhMTYuNDU1IDE2LjQ1NSAwIDAgMCAwIDMyLjIwOGM2Mi4wNjQgMTMuMDExIDExMC41NzMgNjEuNTIxIDEyMy41ODMgMTIzLjU4NmExNi40NTQgMTYuNDU0IDAgMCAwIDMyLjIwOCAwYzEzLjAxMS02Mi4wNjUgNjEuNTIzLTExMC41NzUgMTIzLjU4OC0xMjMuNTgzYTE2LjQ1NCAxNi40NTQgMCAwIDAgLjAwMS0zMi4yMDh6TTI3MC45MzggNDA4LjQ4NGMtMjkuMjQyLTYuMTI5LTUyLjA5OC0yOC45ODUtNTguMjI5LTU4LjIyOWExNi40NTQgMTYuNDU0IDAgMCAwLTMyLjIwOC0uMDAxYy02LjEzMSAyOS4yNDMtMjguOTg4IDUyLjA5OS01OC4yMyA1OC4yMjlhMTYuNDU1IDE2LjQ1NSAwIDAgMCAwIDMyLjIwOGMyOS4yNDEgNi4xMyA1Mi4wOTggMjguOTg3IDU4LjIyOCA1OC4yM2ExNi40NTQgMTYuNDU0IDAgMCAwIDMyLjIwOCAwYzYuMTMxLTI5LjI0MyAyOC45ODgtNTIuMDk5IDU4LjIzMS01OC4yMjlhMTYuNDU1IDE2LjQ1NSAwIDAgMCAwLTMyLjIwOHpNNDkzLjI0MyAyNTYuMTM1Yy0zOS41MjYtOC4yODYtNzAuNDE5LTM5LjE4LTc4LjcwNC03OC43MDVhMTYuNDU0IDE2LjQ1NCAwIDAgMC0zMi4yMDgtLjAwMWMtOC4yODYgMzkuNTI2LTM5LjE3OSA3MC40MTktNzguNzA1IDc4LjcwNGExNi40NTUgMTYuNDU1IDAgMCAwIDAgMzIuMjA4YzM5LjUyNSA4LjI4NiA3MC40MTggMzkuMTc5IDc4LjcwMyA3OC43MDVhMTYuNDU0IDE2LjQ1NCAwIDAgMCAzMi4yMDggMGM4LjI4Ny0zOS41MjYgMzkuMTgtNzAuNDE5IDc4LjcwNS03OC43MDNhMTYuNDU0IDE2LjQ1NCAwIDAgMCAuMDAxLTMyLjIwOHoiLz48L3N2Zz4=";

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
        -webkit-mask-image: url("${readingTimeIcon}") !important;
        mask-image: url("${readingTimeIcon}") !important;
        -webkit-mask-size: contain !important;
        mask-size: contain !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center center !important;
        mask-position: center center !important;
        content: "" !important;
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
        -webkit-mask-image: url("${scoreIcon}") !important;
        mask-image: url("${scoreIcon}") !important;
        -webkit-mask-size: contain !important;
        mask-size: contain !important;
        -webkit-mask-repeat: no-repeat !important;
        mask-repeat: no-repeat !important;
        -webkit-mask-position: center center !important;
        mask-position: center center !important;
        content: "" !important;
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
        textSpan.style.fontSize = "inherit";
        textSpan.style.lineHeight = "inherit";
        applyColorStyling(textSpan, color);
        readtime_value.appendChild(textSpan);
      } else {
        readtime_value.textContent = minutes_print;
        readtime_value.style.borderRadius = "4px";
        readtime_value.style.fontSize = "inherit";
        readtime_value.style.lineHeight = "inherit";
        applyColorStyling(readtime_value, color);
      }

      wordsElement.insertAdjacentElement("afterend", readtime_label);
      readtime_label.insertAdjacentElement("afterend", readtime_value);
    });
  };

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
        if (CONFIG.hideHits && !statsPage && hitsElement) {
          hitsElement.style.display = "none";
        }
        if (CONFIG.hideKudos && !statsPage && kudosElement) {
          kudosElement.style.display = "none";
        }
        const bookmarksElement = $1("dd.bookmarks", statsElement);
        if (CONFIG.hideBookmarks && !statsPage && bookmarksElement) {
          bookmarksElement.style.display = "none";
        }
        const commentsElement = $1("dd.comments", statsElement);
        if (CONFIG.hideComments && !statsPage && commentsElement) {
          commentsElement.style.display = "none";
        }
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
          textSpan.style.fontSize = "inherit";
          textSpan.style.lineHeight = "inherit";
          applyColorStyling(textSpan, color);
          ratioValue.appendChild(textSpan);
        } else {
          ratioValue.textContent = displayScore;
          ratioValue.style.borderRadius = "4px";
          ratioValue.style.fontSize = "inherit";
          ratioValue.style.lineHeight = "inherit";
          applyColorStyling(ratioValue, color);
        }

        hitsElement.insertAdjacentElement("afterend", ratioValue);
        hitsElement.insertAdjacentElement("afterend", ratioLabel);
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

  const calculateChapterStats = () => {
    if (!CONFIG.enableChapterStats) return;
    const WORKS_PAGE_REGEX =
      /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
    if (!WORKS_PAGE_REGEX.test(window.location.href)) return;
    const chaptersContainer = $1("#chapters");
    if (!chaptersContainer) return;
    const chapters = $("#chapters > .chapter");
    const singleChapter = $1("#chapters > div.userstuff");
    let chaptersToProcess = [];
    if (chapters.length > 0) {
      chaptersToProcess = Array.from(chapters);
    } else if (singleChapter) {
      chaptersToProcess = [{ userstuff: singleChapter, isSingle: true }];
    }
    if (chaptersToProcess.length === 0) return;

    chaptersToProcess.forEach((chapter) => {
      let userstuff;
      if (chapter.isSingle) {
        userstuff = chapter.userstuff;
        if (
          userstuff.previousElementSibling &&
          userstuff.previousElementSibling.classList.contains("notice")
        ) {
          return;
        }
      } else {
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
        const chapterNotes = $1("#chapters .notes");
        if (chapterNotes) {
          chapterNotes.insertAdjacentElement("afterend", statsDiv);
        } else {
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      } else {
        const prefaceContainer = $1(".chapter.preface", chapter);
        if (prefaceContainer) {
          prefaceContainer.insertAdjacentElement("afterend", statsDiv);
        } else {
          userstuff.insertAdjacentElement("beforebegin", statsDiv);
        }
      }
    });
  };

  const showSettingsPopup = () => {
    if (!window.AO3MenuHelpers) return;

    window.AO3MenuHelpers.removeAllDialogs();

    const dialog = window.AO3MenuHelpers.createDialog(
      "⏱️ Reading Time & Quality Score ⭐",
      {
        maxWidth: "600px",
      }
    );

    const displayThresholdLow = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdLow / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdLow;
    const displayThresholdHigh = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdHigh / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdHigh;

    // Reading Time Section
    const readingTimeSection =
      window.AO3MenuHelpers.createSection("📚 Reading Time");
    const readingTimeGroup = window.AO3MenuHelpers.createSettingGroup();
    const enableReadingTimeCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "enableReadingTime",
      label: "Enable Reading Time",
      checked: CONFIG.enableReadingTime,
      inGroup: false,
    });
    readingTimeGroup.appendChild(enableReadingTimeCheckbox);

    const readingTimeSubsettings = window.AO3MenuHelpers.createSubsettings();
    readingTimeSubsettings.style.display = CONFIG.enableReadingTime
      ? ""
      : "none";
    readingTimeSubsettings.appendChild(
      window.AO3MenuHelpers.createCheckbox({
        id: "alwaysCountReadingTime",
        label: "Calculate automatically",
        checked: CONFIG.alwaysCountReadingTime,
      })
    );
    readingTimeSubsettings.appendChild(
      window.AO3MenuHelpers.createCheckbox({
        id: "enableChapterStats",
        label: "Show chapter reading times",
        checked: CONFIG.enableChapterStats,
        tooltip:
          "Show word count and reading time at the start of each chapter",
      })
    );
    readingTimeSubsettings.appendChild(
      window.AO3MenuHelpers.createNumberInput({
        id: "wpm",
        label: "Words per minute",
        value: CONFIG.wpm,
        min: 100,
        max: 1000,
        step: 25,
        tooltip:
          "Average reading speed is 200-300 wpm. 375 is for faster readers.",
      })
    );
    const readingTimeTwoColumn = window.AO3MenuHelpers.createTwoColumnLayout(
      window.AO3MenuHelpers.createNumberInput({
        id: "readingTimeLvl1",
        label: "Yellow threshold (minutes)",
        value: CONFIG.readingTimeLvl1,
        min: 5,
        max: 240,
        step: 5,
        tooltip:
          "Works taking less than this many minutes will be colored green",
      }),
      window.AO3MenuHelpers.createNumberInput({
        id: "readingTimeLvl2",
        label: "Red threshold (minutes)",
        value: CONFIG.readingTimeLvl2,
        min: 30,
        max: 480,
        step: 10,
        tooltip: "Works taking more than this many minutes will be colored red",
      })
    );
    readingTimeTwoColumn.style.marginBottom = "0";
    readingTimeSubsettings.appendChild(readingTimeTwoColumn);
    readingTimeGroup.appendChild(readingTimeSubsettings);
    readingTimeSection.appendChild(readingTimeGroup);
    dialog.appendChild(readingTimeSection);

    // Quality Score Section
    const qualityScoreSection =
      window.AO3MenuHelpers.createSection("💖 Quality Score");
    const qualityScoreGroup = window.AO3MenuHelpers.createSettingGroup();
    const enableQualityScoreCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "enableQualityScore",
      label: "Enable Quality Score",
      checked: CONFIG.enableQualityScore,
      inGroup: false,
    });
    qualityScoreGroup.appendChild(enableQualityScoreCheckbox);

    const qualityScoreSubsettings = window.AO3MenuHelpers.createSubsettings();
    qualityScoreSubsettings.style.display = CONFIG.enableQualityScore
      ? ""
      : "none";
    qualityScoreSubsettings.appendChild(
      window.AO3MenuHelpers.createCheckbox({
        id: "alwaysCountQualityScore",
        label: "Calculate automatically",
        checked: CONFIG.alwaysCountQualityScore,
      })
    );

    const alwaysSortGroup = window.AO3MenuHelpers.createSettingGroup();
    const alwaysSortCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "alwaysSortQualityScore",
      label: "Sort by score automatically",
      checked: CONFIG.alwaysSortQualityScore,
      inGroup: false,
    });
    alwaysSortGroup.appendChild(alwaysSortCheckbox);

    const excludeMyContentSubsetting =
      window.AO3MenuHelpers.createSubsettings();
    excludeMyContentSubsetting.style.marginLeft = "1em";
    excludeMyContentSubsetting.style.display = CONFIG.alwaysSortQualityScore
      ? ""
      : "none";
    excludeMyContentSubsetting.appendChild(
      window.AO3MenuHelpers.createCheckbox({
        id: "excludeMyContentFromSort",
        label: "Exclude my content",
        checked: CONFIG.excludeMyContentFromSort,
        tooltip:
          "Disable automatic sorting on your user dashboard, bookmarks, history, and works pages",
        inGroup: false,
      })
    );
    alwaysSortGroup.appendChild(excludeMyContentSubsetting);
    qualityScoreSubsettings.appendChild(alwaysSortGroup);
    qualityScoreSubsettings.appendChild(
      window.AO3MenuHelpers.createNumberInput({
        id: "minKudosToShowScore",
        label: "Minimum kudos to show score",
        value: CONFIG.minKudosToShowScore,
        min: 0,
        max: 10000,
        step: 1,
      })
    );

    const normalizationGroup = window.AO3MenuHelpers.createSettingGroup();
    const useNormalizationCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "useNormalization",
      label: "Normalize scores to 100%",
      checked: CONFIG.useNormalization,
      tooltip:
        "Scale the raw score so your 'Best Possible Raw Score' equals 100%. Makes scores from different fandoms more comparable.",
      inGroup: false,
    });
    normalizationGroup.appendChild(useNormalizationCheckbox);

    const userMaxScoreGroup = window.AO3MenuHelpers.createSettingGroup();
    userMaxScoreGroup.id = "userMaxScoreContainer";
    userMaxScoreGroup.style.display = CONFIG.useNormalization ? "" : "none";

    const userMaxScoreLabel = document.createElement("label");
    userMaxScoreLabel.className = "setting-label";
    userMaxScoreLabel.setAttribute("for", "userMaxScore");
    userMaxScoreLabel.textContent = "Best Possible Raw Score ";

    const normalizationLabel = document.createElement("span");
    normalizationLabel.id = "normalizationLabel";
    normalizationLabel.textContent = CONFIG.useNormalization
      ? "(for 100%)"
      : "";
    userMaxScoreLabel.appendChild(normalizationLabel);

    userMaxScoreLabel.appendChild(document.createTextNode(" "));
    userMaxScoreLabel.appendChild(
      window.AO3MenuHelpers.createTooltip(
        "The highest score you've seen in your fandom. Used to scale other scores to percentages."
      )
    );

    userMaxScoreGroup.appendChild(userMaxScoreLabel);
    userMaxScoreGroup.appendChild(
      window.AO3MenuHelpers.createNumberInput({
        id: "userMaxScore",
        value: CONFIG.userMaxScore,
        min: 1,
        max: 100,
        step: 1,
      })
    );
    normalizationGroup.appendChild(userMaxScoreGroup);
    qualityScoreSubsettings.appendChild(normalizationGroup);

    const thresholdLowLabel = document.createElement("label");
    thresholdLowLabel.className = "setting-label";
    thresholdLowLabel.setAttribute("for", "colorThresholdLow");
    thresholdLowLabel.textContent = "Good Score ";

    const thresholdLowLabelSpan = document.createElement("span");
    thresholdLowLabelSpan.id = "thresholdLowLabel";
    thresholdLowLabelSpan.textContent = CONFIG.useNormalization ? "(%)" : "";
    thresholdLowLabel.appendChild(thresholdLowLabelSpan);

    thresholdLowLabel.appendChild(document.createTextNode(" "));
    thresholdLowLabel.appendChild(
      window.AO3MenuHelpers.createTooltip(
        "Scores at or above this threshold will be colored yellow"
      )
    );

    const thresholdHighLabel = document.createElement("label");
    thresholdHighLabel.className = "setting-label";
    thresholdHighLabel.setAttribute("for", "colorThresholdHigh");
    thresholdHighLabel.textContent = "Excellent Score ";

    const thresholdHighLabelSpan = document.createElement("span");
    thresholdHighLabelSpan.id = "thresholdHighLabel";
    thresholdHighLabelSpan.textContent = CONFIG.useNormalization ? "(%)" : "";
    thresholdHighLabel.appendChild(thresholdHighLabelSpan);

    thresholdHighLabel.appendChild(document.createTextNode(" "));
    thresholdHighLabel.appendChild(
      window.AO3MenuHelpers.createTooltip(
        "Scores at or above this threshold will be colored green"
      )
    );

    // Create the Good Score input
    const colorThresholdLowInput = document.createElement("div");
    colorThresholdLowInput.className = "setting-group";
    colorThresholdLowInput.style.marginBottom = "0";
    colorThresholdLowInput.appendChild(thresholdLowLabel);
    colorThresholdLowInput.appendChild(
      window.AO3MenuHelpers.createNumberInput({
        id: "colorThresholdLow",
        value: displayThresholdLow,
        min: 0.1,
        max: 100,
        step: 0.1,
      }).querySelector("input") // Extract just the input, not the wrapper
    );

    // Create the Excellent Score input
    const colorThresholdHighInput = document.createElement("div");
    colorThresholdHighInput.className = "setting-group";
    colorThresholdHighInput.style.marginBottom = "0";
    colorThresholdHighInput.appendChild(thresholdHighLabel);
    colorThresholdHighInput.appendChild(
      window.AO3MenuHelpers.createNumberInput({
        id: "colorThresholdHigh",
        value: displayThresholdHigh,
        min: 0.1,
        max: 100,
        step: 0.1,
      }).querySelector("input") // Extract just the input, not the wrapper
    );

    // Create two-column layout
    const thresholdTwoColumn = window.AO3MenuHelpers.createTwoColumnLayout(
      colorThresholdLowInput,
      colorThresholdHighInput
    );
    thresholdTwoColumn.style.marginBottom = "0";
    qualityScoreSubsettings.appendChild(thresholdTwoColumn);

    qualityScoreGroup.appendChild(qualityScoreSubsettings);
    qualityScoreSection.appendChild(qualityScoreGroup);
    dialog.appendChild(qualityScoreSection);

    // Visual Styling Section
    const visualSection =
      window.AO3MenuHelpers.createSection("🎨 Visual Styling");

    const twoColumnLayout = document.createElement("div");
    twoColumnLayout.className = "two-column";

    twoColumnLayout.appendChild(
      window.AO3MenuHelpers.createSelect({
        id: "colorStyle",
        label: "Visual Style:",
        options: [
          {
            value: "none",
            label: "Default",
            selected: CONFIG.colorStyle === "none",
          },
          {
            value: "text",
            label: "Colored",
            selected: CONFIG.colorStyle === "text",
          },
          {
            value: "background",
            label: "Bars",
            selected: CONFIG.colorStyle === "background",
          },
        ],
      })
    );

    const chapterTimeStyleGroup = window.AO3MenuHelpers.createSelect({
      id: "chapterTimeStyle",
      label: "Chapter Time Style:",
      options: [
        {
          value: "default",
          label: "Default",
          selected: CONFIG.chapterTimeStyle === "default",
        },
        {
          value: "colored",
          label: "Notice",
          selected: CONFIG.chapterTimeStyle === "colored",
        },
        {
          value: "timeonly",
          label: "Time Only",
          selected: CONFIG.chapterTimeStyle === "timeonly",
        },
      ],
    });
    chapterTimeStyleGroup.id = "chapterTimeStyleSettings";
    chapterTimeStyleGroup.style.display = CONFIG.enableChapterStats
      ? ""
      : "none";
    twoColumnLayout.appendChild(chapterTimeStyleGroup);

    visualSection.appendChild(twoColumnLayout);

    const colorPickerSettings = window.AO3MenuHelpers.createSubsettings();
    colorPickerSettings.id = "colorPickerSettings";
    colorPickerSettings.style.display =
      CONFIG.colorStyle !== "none" ? "" : "none";

    const twoColumnColors = document.createElement("div");
    twoColumnColors.className = "two-column";
    twoColumnLayout.style.marginBottom = "0";
    twoColumnColors.appendChild(
      window.AO3MenuHelpers.createColorPicker({
        id: "colorGreen",
        label: "Green",
        value: CONFIG.colorGreen,
      })
    );
    twoColumnColors.appendChild(
      window.AO3MenuHelpers.createColorPicker({
        id: "colorYellow",
        label: "Yellow",
        value: CONFIG.colorYellow,
      })
    );
    twoColumnColors.appendChild(
      window.AO3MenuHelpers.createColorPicker({
        id: "colorRed",
        label: "Red",
        value: CONFIG.colorRed,
      })
    );

    const textColorContainer = window.AO3MenuHelpers.createSettingGroup();
    textColorContainer.id = "textColorContainer";
    textColorContainer.style.display =
      CONFIG.colorStyle === "background" ? "" : "none";
    textColorContainer.appendChild(
      window.AO3MenuHelpers.createColorPicker({
        id: "colorText",
        label: "Text color",
        value: CONFIG.colorText,
      })
    );
    twoColumnColors.appendChild(textColorContainer);

    colorPickerSettings.appendChild(twoColumnColors);
    visualSection.appendChild(colorPickerSettings);

    const useIconsGroup = window.AO3MenuHelpers.createSettingGroup();
    const useIconsCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "useIcons",
      label: "Use icons instead of text labels",
      checked: CONFIG.useIcons,
      tooltip: "Replace 'Time:' and 'Score:' labels with icons",
      inGroup: false,
    });
    useIconsGroup.appendChild(useIconsCheckbox);

    const iconColorSettings = window.AO3MenuHelpers.createSubsettings();
    iconColorSettings.id = "iconColorSettings";
    iconColorSettings.style.display = CONFIG.useIcons ? "" : "none";
    iconColorSettings.appendChild(
      window.AO3MenuHelpers.createCheckbox({
        id: "useCustomIconColor",
        label: "Use custom icon color",
        checked: !!CONFIG.iconColor,
        tooltip:
          "When unchecked, icons will inherit color from your site skin. When checked, you can set a specific color.",
      })
    );

    const customIconColorPicker = window.AO3MenuHelpers.createSettingGroup();
    customIconColorPicker.id = "customIconColorPicker";
    customIconColorPicker.style.display = CONFIG.iconColor ? "" : "none";
    customIconColorPicker.appendChild(
      window.AO3MenuHelpers.createColorPicker({
        id: "iconColor",
        label: "Icon color",
        value: CONFIG.iconColor || "#000000",
      })
    );
    iconColorSettings.appendChild(customIconColorPicker);
    useIconsGroup.appendChild(iconColorSettings);
    visualSection.appendChild(useIconsGroup);

    const hideMetricsGroup = window.AO3MenuHelpers.createSettingGroup();
    const hideMetricsCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "hideMetrics",
      label: "Hide metrics",
      checked: CONFIG.hideMetrics,
      tooltip: "Hide metrics (hits, kudos, bookmarkers, comments) from blurbs",
      inGroup: false,
    });
    hideMetricsGroup.appendChild(hideMetricsCheckbox);

    const hideMetricsSubsettings = window.AO3MenuHelpers.createSubsettings();
    hideMetricsSubsettings.id = "hideMetricsSubsettings";
    hideMetricsSubsettings.style.display = CONFIG.hideMetrics ? "" : "none";

    const hideHitsKudosRow = window.AO3MenuHelpers.createTwoColumnLayout(
      window.AO3MenuHelpers.createCheckbox({
        id: "hideHits",
        label: "Hits",
        checked: CONFIG.hideHits,
        inGroup: false,
      }),
      window.AO3MenuHelpers.createCheckbox({
        id: "hideKudos",
        label: "Kudos",
        checked: CONFIG.hideKudos,
        inGroup: false,
      })
    );
    hideMetricsSubsettings.appendChild(hideHitsKudosRow);

    const hideBookmarksCommentsRow =
      window.AO3MenuHelpers.createTwoColumnLayout(
        window.AO3MenuHelpers.createCheckbox({
          id: "hideBookmarks",
          label: "Bookmarks",
          checked: CONFIG.hideBookmarks,
          inGroup: false,
        }),
        window.AO3MenuHelpers.createCheckbox({
          id: "hideComments",
          label: "Comments",
          checked: CONFIG.hideComments,
          inGroup: false,
        })
      );
    hideMetricsSubsettings.appendChild(hideBookmarksCommentsRow);
    hideMetricsGroup.appendChild(hideMetricsSubsettings);
    visualSection.appendChild(hideMetricsGroup);

    dialog.appendChild(visualSection);

    // Buttons
    dialog.appendChild(
      window.AO3MenuHelpers.createButtonGroup([
        { text: "Save", id: "saveButton" },
        { text: "Close", id: "closeButton" },
      ])
    );
    dialog.appendChild(
      window.AO3MenuHelpers.createResetLink("Reset to Default Settings", () => {
        resetAllSettings();
        dialog.remove();
      })
    );

    // Event Listeners
    dialog
      .querySelector("#enableReadingTime")
      .addEventListener("change", (e) => {
        readingTimeSubsettings.style.display = e.target.checked ? "" : "none";
      });

    dialog
      .querySelector("#enableChapterStats")
      .addEventListener("change", (e) => {
        chapterTimeStyleGroup.style.display = e.target.checked ? "" : "none";
      });

    dialog
      .querySelector("#enableQualityScore")
      .addEventListener("change", (e) => {
        qualityScoreSubsettings.style.display = e.target.checked ? "" : "none";
      });

    dialog
      .querySelector("#alwaysSortQualityScore")
      .addEventListener("change", (e) => {
        excludeMyContentSubsetting.style.display = e.target.checked
          ? ""
          : "none";
      });

    const colorStyleSelect = dialog.querySelector("#colorStyle");
    colorStyleSelect.addEventListener("change", () => {
      const selectedStyle = colorStyleSelect.value;
      colorPickerSettings.style.display =
        selectedStyle !== "none" ? "" : "none";
      textColorContainer.style.display =
        selectedStyle === "background" ? "" : "none";
    });

    dialog.querySelector("#useIcons").addEventListener("change", (e) => {
      iconColorSettings.style.display = e.target.checked ? "" : "none";
    });

    dialog
      .querySelector("#useCustomIconColor")
      .addEventListener("change", (e) => {
        customIconColorPicker.style.display = e.target.checked ? "" : "none";
      });

    dialog
      .querySelector("#useNormalization")
      .addEventListener("change", (e) => {
        const isNormalizationEnabled = e.target.checked;
        const normLabel = dialog.querySelector("#normalizationLabel");
        const thresholdLowLabel = dialog.querySelector("#thresholdLowLabel");
        const thresholdHighLabel = dialog.querySelector("#thresholdHighLabel");
        const thresholdLowInput = dialog.querySelector("#colorThresholdLow");
        const thresholdHighInput = dialog.querySelector("#colorThresholdHigh");
        const userMaxScoreInput = dialog.querySelector("#userMaxScore");
        const userMaxScoreContainer = dialog.querySelector(
          "#userMaxScoreContainer"
        );

        if (isNormalizationEnabled) {
          normLabel.textContent = "(for 100%)";
          thresholdLowLabel.textContent = "(%)";
          thresholdHighLabel.textContent = "(%)";
          userMaxScoreContainer.style.display = "";
          thresholdLowInput.value = Math.ceil(
            (parseFloat(thresholdLowInput.value) /
              parseFloat(userMaxScoreInput.value)) *
              100
          );
          thresholdHighInput.value = Math.ceil(
            (parseFloat(thresholdHighInput.value) /
              parseFloat(userMaxScoreInput.value)) *
              100
          );
        } else {
          normLabel.textContent = "";
          thresholdLowLabel.textContent = "";
          thresholdHighLabel.textContent = "";
          userMaxScoreContainer.style.display = "none";
          thresholdLowInput.value = Math.round(
            (parseFloat(thresholdLowInput.value) / 100) *
              parseFloat(userMaxScoreInput.value)
          );
          thresholdHighInput.value = Math.round(
            (parseFloat(thresholdHighInput.value) / 100) *
              parseFloat(userMaxScoreInput.value)
          );
        }
      });

    dialog.querySelector("#hideMetrics").addEventListener("change", (e) => {
      hideMetricsSubsettings.style.display = e.target.checked ? "" : "none";
    });

    dialog.querySelector("#closeButton").addEventListener("click", () => {
      dialog.remove();
    });

    dialog.querySelector("#saveButton").addEventListener("click", () => {
      let userMaxScoreValue = parseFloat(
        dialog.querySelector("#userMaxScore").value
      );
      let thresholdLowValue = parseFloat(
        dialog.querySelector("#colorThresholdLow").value
      );
      let thresholdHighValue = parseFloat(
        dialog.querySelector("#colorThresholdHigh").value
      );
      const isNormalizationEnabled =
        dialog.querySelector("#useNormalization").checked;

      if (isNormalizationEnabled) {
        thresholdLowValue = (thresholdLowValue / 100) * userMaxScoreValue;
        thresholdHighValue = (thresholdHighValue / 100) * userMaxScoreValue;
      }

      CONFIG.enableReadingTime =
        dialog.querySelector("#enableReadingTime").checked;
      CONFIG.enableQualityScore = dialog.querySelector(
        "#enableQualityScore"
      ).checked;
      CONFIG.enableChapterStats = dialog.querySelector(
        "#enableChapterStats"
      ).checked;
      CONFIG.alwaysCountReadingTime = dialog.querySelector(
        "#alwaysCountReadingTime"
      ).checked;
      CONFIG.wpm = parseInt(dialog.querySelector("#wpm").value);
      CONFIG.readingTimeLvl1 = parseInt(
        dialog.querySelector("#readingTimeLvl1").value
      );
      CONFIG.readingTimeLvl2 = parseInt(
        dialog.querySelector("#readingTimeLvl2").value
      );
      CONFIG.alwaysCountQualityScore = dialog.querySelector(
        "#alwaysCountQualityScore"
      ).checked;
      CONFIG.alwaysSortQualityScore = dialog.querySelector(
        "#alwaysSortQualityScore"
      ).checked;
      CONFIG.excludeMyContentFromSort =
        dialog.querySelector("#excludeMyContentFromSort")?.checked || false;
      CONFIG.hideMetrics = dialog.querySelector("#hideMetrics").checked;
      CONFIG.hideHits = dialog.querySelector("#hideHits").checked;
      CONFIG.hideKudos = dialog.querySelector("#hideKudos").checked;
      CONFIG.hideBookmarks = dialog.querySelector("#hideBookmarks").checked;
      CONFIG.hideComments = dialog.querySelector("#hideComments").checked;
      CONFIG.minKudosToShowScore = parseInt(
        dialog.querySelector("#minKudosToShowScore").value
      );
      CONFIG.useNormalization = isNormalizationEnabled;
      CONFIG.userMaxScore = userMaxScoreValue;
      CONFIG.colorThresholdLow = thresholdLowValue;
      CONFIG.colorThresholdHigh = thresholdHighValue;
      CONFIG.colorStyle = dialog.querySelector("#colorStyle").value;
      CONFIG.colorGreen = dialog.querySelector("#colorGreen").value;
      CONFIG.colorYellow = dialog.querySelector("#colorYellow").value;
      CONFIG.colorRed = dialog.querySelector("#colorRed").value;
      CONFIG.colorText = dialog.querySelector("#colorText").value;
      CONFIG.useIcons = dialog.querySelector("#useIcons").checked;
      CONFIG.iconColor = dialog.querySelector("#useCustomIconColor").checked
        ? dialog.querySelector("#iconColor").value
        : "";
      CONFIG.chapterTimeStyle = dialog.querySelector("#chapterTimeStyle").value;

      saveAllSettings();
      dialog.remove();
      location.reload();
    });

    document.body.appendChild(dialog);
  };

  function initSharedMenu() {
    if (window.AO3MenuHelpers) {
      window.AO3MenuHelpers.addToSharedMenu({
        id: "opencfg_reading_quality",
        text: "Reading Time & Quality Score",
        onClick: showSettingsPopup,
      });

      // Add separator if we have conditional items
      if (CONFIG.enableReadingTime || CONFIG.enableQualityScore) {
        // Note: separator is handled automatically by the library
      }

      // Reading Time manual calculation only if 'Calculate automatically' is unchecked
      if (CONFIG.enableReadingTime && !CONFIG.alwaysCountReadingTime) {
        window.AO3MenuHelpers.addToSharedMenu({
          id: "calc_reading_time",
          text: "Reading Time: Calculate Times",
          onClick: calculateReadtime,
        });
      }

      // Quality Score manual calculation only if 'Calculate automatically' is unchecked
      if (CONFIG.enableQualityScore && !CONFIG.alwaysCountQualityScore) {
        window.AO3MenuHelpers.addToSharedMenu({
          id: "calc_quality_score",
          text: "Quality Score: Calculate Scores",
          onClick: countRatio,
        });
      }

      // Show manual 'Sort by Score' when 'Sort by score automatically' is unchecked,
      // or when both 'Sort by score automatically' and 'Exclude my content' are checked and on my content pages
      const username = detectAndStoreUsername();
      const isWorksPage = /^\/works\/(\d+)(\/chapters\/\d+)?(\/|$)/.test(
        window.location.pathname
      );
      if (
        isAllowedMenuPage() &&
        CONFIG.enableQualityScore &&
        (!CONFIG.alwaysSortQualityScore ||
          (CONFIG.alwaysSortQualityScore &&
            CONFIG.excludeMyContentFromSort &&
            isMyContentPage(username))) &&
        !isWorksPage
      ) {
        window.AO3MenuHelpers.addToSharedMenu({
          id: "sort_by_score",
          text: "Quality Score: Sort by Score",
          onClick: () => sortByRatio(),
        });
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

  const init = () => {
    checkCountable();
    initSharedMenu();

    const username = detectAndStoreUsername();

    setTimeout(() => {
      if (CONFIG.alwaysCountReadingTime && CONFIG.enableReadingTime) {
        calculateReadtime();
      }

      if (CONFIG.alwaysCountQualityScore && CONFIG.enableQualityScore) {
        countRatio();

        const myContentPage = isMyContentPage(username);

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
