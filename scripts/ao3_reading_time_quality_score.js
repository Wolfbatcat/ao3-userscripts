// ==UserScript==
// @name        AO3: Reading Time & Quality Score
// @description Combined reading time and quality scoring. Highly customizable.
// @author      BlackBatCat
// @version     1.1.3
// @include     http://archiveofourown.org/*
// @include     https://archiveofourown.org/*
// @license     MIT
// @grant       none
// ==/UserScript==

(function () {
  "use strict";

  // DEFAULT CONFIGURATION
  const DEFAULTS = {
    // Feature Toggles
    enableReadingTime: true,
    enableQualityScore: true,
    // Reading Time Settings
    wpm: 375,
    alwaysCountReadingTime: true,
    readingTimeLvl1: 120,
    readingTimeLvl2: 360,
    // Quality Score Settings
    alwaysCountQualityScore: true,
    alwaysSortQualityScore: false,
    hideHitcount: false,
    useNormalization: false,
    userMaxScore: 32,
    minKudosToShowScore: 100,
    colorThresholdLow: 10,
    colorThresholdHigh: 20,
    // Shared Color Settings
    colorGreen: "#3e8fb0",
    colorYellow: "#f6c177",
    colorRed: "#eb6f92",
    colorText: "#ffffff",
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
    for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
      const saved = localStorage.getItem(key + "Local");
      if (saved !== null) {
        if (typeof defaultValue === "boolean") {
          CONFIG[key] = saved === "true";
        } else if (typeof defaultValue === "number") {
          CONFIG[key] = parseFloat(saved) || defaultValue;
        } else {
          CONFIG[key] = saved;
        }
      }
    }
  };

  // Save a setting to localStorage
  const saveSetting = (key, value) => {
    CONFIG[key] = value;
    if (typeof Storage !== "undefined") {
      localStorage.setItem(key + "Local", value);
    }
  };

  // Reset all settings to defaults
  const resetAllSettings = () => {
    if (confirm("Reset all settings to defaults?")) {
      for (const key of Object.keys(DEFAULTS)) {
        localStorage.removeItem(key + "Local");
      }
      CONFIG = { ...DEFAULTS };
      countRatio();
      calculateReadtime();
    }
  };

  // Robust number extraction from element
  const getNumberFromElement = (element) => {
    if (!element) return NaN;
    let text =
      element.getAttribute("data-ao3e-original") || element.textContent;
    if (text === null) return NaN;
    let cleanText = text.replace(/[,\s  ]/g, "");
    if (element.matches("dd.chapters")) {
      cleanText = cleanText.split("/")[0];
    }
    const number = parseInt(cleanText, 10);
    return isNaN(number) ? NaN : number;
  };

  // --- READING TIME FUNCTIONS ---
  const checkCountable = () => {
    const foundStats = $("dl.stats");
    if (foundStats.length === 0) return;

    const firstStat = foundStats[0];
    if (firstStat.closest("li")?.matches(".work, .bookmark")) {
      countable = sortable = true;
    } else if (firstStat.closest(".statistics")) {
      countable = sortable = statsPage = true;
    } else if (firstStat.closest("dl.work")) {
      countable = true;
    }
    // Menu logic is now handled by initSharedMenu()
  };

  const calculateReadtime = () => {
    if (!countable || !CONFIG.enableReadingTime) return;
    $("dl.stats").forEach((statsElement) => {
      // Check if readtime already exists to avoid duplicates
      if ($1("dt.readtime", statsElement)) return;
      const wordsElement = $1("dd.words", statsElement);
      if (!wordsElement) return;
      const words_count = getNumberFromElement(wordsElement);
      if (isNaN(words_count)) return;
      const minutes = words_count / CONFIG.wpm;
      const hrs = Math.floor(minutes / 60);
      const mins = (minutes % 60).toFixed(0);
      const minutes_print = hrs > 0 ? hrs + "h" + mins + "m" : mins + "m";
      // Create elements
      const readtime_label = document.createElement("dt");
      readtime_label.className = "readtime";
      readtime_label.textContent = "Readtime:";
      const readtime_value = document.createElement("dd");
      readtime_value.className = "readtime";
      readtime_value.textContent = minutes_print;
      // Apply styling
      readtime_value.style.color = CONFIG.colorText;
      readtime_value.style.borderRadius = "4px";
      readtime_value.style.padding = "0 6px";
      readtime_value.style.fontWeight = "bold";
      readtime_value.style.display = "inline-block";
      readtime_value.style.verticalAlign = "middle";
      // Apply color based on reading time
      if (minutes < CONFIG.readingTimeLvl1) {
        readtime_value.style.backgroundColor = CONFIG.colorGreen;
      } else if (minutes < CONFIG.readingTimeLvl2) {
        readtime_value.style.backgroundColor = CONFIG.colorYellow;
      } else {
        readtime_value.style.backgroundColor = CONFIG.colorRed;
      }
      // Inherit font size and line height from dl.stats
      const parentStats = readtime_value.closest("dl.stats");
      if (parentStats) {
        const computed = window.getComputedStyle(parentStats);
        readtime_value.style.lineHeight = computed.lineHeight;
        readtime_value.style.fontSize = computed.fontSize;
      }
      // Insert after words_value
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
      // Check if score already exists to avoid duplicates
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
        // Hide score if kudos below threshold
        if (kudos < CONFIG.minKudosToShowScore) {
          // Remove any previous score elements
          if (statsElement.querySelector("dt.kudoshits"))
            statsElement.querySelector("dt.kudoshits").remove();
          if (statsElement.querySelector("dd.kudoshits"))
            statsElement.querySelector("dd.kudoshits").remove();
          return;
        }
        let rawScore = calculateWordBasedScore(kudos, hits, words);
        if (kudos < 10) rawScore = 1;
        let displayScore = rawScore;
        // Normalize thresholds if normalization is enabled
        let thresholdLow = CONFIG.colorThresholdLow;
        let thresholdHigh = CONFIG.colorThresholdHigh;
        if (CONFIG.useNormalization) {
          displayScore = (rawScore / CONFIG.userMaxScore) * 100;
          displayScore = Math.min(100, displayScore);
          displayScore = Math.ceil(displayScore); // round up, no decimals
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
        ratioLabel.textContent = "Score:";
        const ratioValue = document.createElement("dd");
        ratioValue.className = "kudoshits";
        ratioValue.textContent = displayScore;
        ratioValue.style.color = CONFIG.colorText;
        ratioValue.style.borderRadius = "4px";
        ratioValue.style.padding = "0 6px";
        ratioValue.style.fontWeight = "bold";
        ratioValue.style.display = "inline-block";
        ratioValue.style.verticalAlign = "middle";
        // Apply color based on score
        if (displayScore >= thresholdHigh) {
          ratioValue.style.backgroundColor = CONFIG.colorGreen;
        } else if (displayScore >= thresholdLow) {
          ratioValue.style.backgroundColor = CONFIG.colorYellow;
        } else {
          ratioValue.style.backgroundColor = CONFIG.colorRed;
        }
        // Inherit font size and line height from dl.stats
        const parentStats = ratioValue.closest("dl.stats");
        if (parentStats) {
          const computed = window.getComputedStyle(parentStats);
          ratioValue.style.lineHeight = computed.lineHeight;
          ratioValue.style.fontSize = computed.fontSize;
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

  // --- SETTINGS POPUP ---
  const showSettingsPopup = () => {
    // Get AO3 input field background color
    let inputBg = "#fffaf5"; // fallback
    const testInput = document.createElement("input");
    document.body.appendChild(testInput);
    try {
      const computedBg = window.getComputedStyle(testInput).backgroundColor;
      if (
        computedBg &&
        computedBg !== "rgba(0, 0, 0, 0)" &&
        computedBg !== "transparent"
      ) {
        inputBg = computedBg;
      }
    } catch (e) {}
    testInput.remove();
    const popup = document.createElement("div");
    popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${inputBg};
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
            z-index: 10000;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: inherit;
            font-size: 16px;
            box-sizing: border-box;
        `;
    // Ensure headings inherit font family
    const style = document.createElement('style');
    style.textContent = `
      #ao3-rtqs-popup h3, #ao3-rtqs-popup h4 {
        font-family: inherit !important;
      }
    `;
    popup.id = 'ao3-rtqs-popup';
    document.head.appendChild(style);
    const form = document.createElement("form");

    // Calculate values for display
    const displayThresholdLow = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdLow / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdLow;

    const displayThresholdHigh = CONFIG.useNormalization
      ? Math.ceil((CONFIG.colorThresholdHigh / CONFIG.userMaxScore) * 100)
      : CONFIG.colorThresholdHigh;

    form.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; font-size: 1.2em;">⚙️ Reading Time & Quality Score Settings ⚙️</h3>
            <hr style='margin: 16px 0; border: none; border-top: 1px solid #ccc;'>

            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold; display: flex; align-items: center;">
                    <span>Reading Time 📚</span>
                </h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="enableReadingTime" ${
                      CONFIG.enableReadingTime ? "checked" : ""
                    }>
                    Enable Reading Time
                </label>
                <div id="readingTimeSettings" style="margin-left: 20px; ${
                  CONFIG.enableReadingTime ? "" : "display: none;"
                }">
                    <label style="display: block; margin: 10px 0;">
                        <input type="checkbox" id="alwaysCountReadingTime" ${
                          CONFIG.alwaysCountReadingTime ? "checked" : ""
                        }>
                        Calculate automatically
                    </label>
                    <div style="margin: 10px 0;">
                        <label>Words per minute:</label>
                        <input type="number" id="wpm" value="${
                          CONFIG.wpm
                        }" min="100" max="1000" step="25">
                    </div>
                    <div style="margin: 10px 0;">
                        <label>Yellow threshold (minutes):</label>
                        <input type="number" id="readingTimeLvl1" value="${
                          CONFIG.readingTimeLvl1
                        }" min="5" max="240" step="5">
                    </div>
                    <div style="margin: 10px 0;">
                        <label>Red threshold (minutes):</label>
                        <input type="number" id="readingTimeLvl2" value="${
                          CONFIG.readingTimeLvl2
                        }" min="30" max="480" step="10">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold; display: flex; align-items: center;">
                    <span>Quality Score 💖</span>
                </h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="enableQualityScore" ${
                      CONFIG.enableQualityScore ? "checked" : ""
                    }>
                    Enable Quality Score
                </label>
                <div id="qualityScoreSettings" style="margin-left: 20px; ${
                  CONFIG.enableQualityScore ? "" : "display: none;"
                }">
                    <label style="display: block; margin: 10px 0;">
                        <input type="checkbox" id="alwaysCountQualityScore" ${
                          CONFIG.alwaysCountQualityScore ? "checked" : ""
                        }>
                        Calculate automatically
                    </label>
                    <label style="display: block; margin: 10px 0;">
                        <input type="checkbox" id="alwaysSortQualityScore" ${
                          CONFIG.alwaysSortQualityScore ? "checked" : ""
                        }>
                        Sort by score automatically
                    </label>
                    <label style="display: block; margin: 10px 0;">
                        <input type="checkbox" id="hideHitcount" ${
                          CONFIG.hideHitcount ? "checked" : ""
                        }>
                        Hide hit count
                    </label>
                    <div style="margin: 10px 0;">
                        <label>Minimum kudos to show score:</label>
                        <input type="number" id="minKudosToShowScore" value="${
                          CONFIG.minKudosToShowScore
                        }" min="0" max="10000" step="1">
                    </div>
                    <label style="display: block; margin: 10px 0;">
                        <input type="checkbox" id="useNormalization" ${
                          CONFIG.useNormalization ? "checked" : ""
                        }>
                        Normalize scores to 100%
                        <span title="Scales the raw score so your 'Best Possible Raw Score' equals 100%. Makes scores from different fandoms more comparable." style="margin-left: 4px; cursor: help;">❓</span>
                    </label>
                    <div id="userMaxScoreContainer" style="margin: 10px 0;${CONFIG.useNormalization ? '' : ' display:none;'}">
                        <label>Best Possible Raw Score <span id="normalizationLabel">${
                          CONFIG.useNormalization ? "(for 100%)" : ""
                        }</span>:</label>
                        <input type="number" id="userMaxScore" value="${
                          CONFIG.userMaxScore
                        }" min="1" max="100" step="1">
                    </div>
                    <div style="margin: 10px 0;">
                        <label>Good Score <span id="thresholdLowLabel">${
                          CONFIG.useNormalization ? "(%)" : ""
                        }</span>:</label>
                        <input type="number" id="colorThresholdLow" value="${displayThresholdLow}" min="0.1" max="100" step="0.1">
                    </div>
                    <div style="margin: 10px 0;">
                        <label>Excellent Score <span id="thresholdHighLabel">${
                          CONFIG.useNormalization ? "(%)" : ""
                        }</span>:</label>
                        <input type="number" id="colorThresholdHigh" value="${displayThresholdHigh}" min="0.1" max="100" step="0.1">
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold; display: flex; align-items: center;">
                    <span>Color Settings 🎨</span>
                </h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Green:</label>
                        <input type="color" id="colorGreen" value="${
                          CONFIG.colorGreen
                        }" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Yellow:</label>
                        <input type="color" id="colorYellow" value="${
                          CONFIG.colorYellow
                        }" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Red:</label>
                        <input type="color" id="colorRed" value="${
                          CONFIG.colorRed
                        }" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Text color:</label>
                        <input type="color" id="colorText" value="${
                          CONFIG.colorText
                        }" style="width: 100%;">
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px;">
                <button type="submit" style="flex: 1; padding: 10px; font-size: 1em;">Save</button>
                <button type="button" id="closePopup" style="flex: 1; padding: 10px; font-size: 1em;">Close</button>
            </div>
            <div style="text-align: center; margin-top: 5px;">
                <a href="#" id="resetSettingsLink" style="font-size: 0.9em; color: #666; text-decoration: none;">Reset to Default Settings</a>
            </div>
        `;

    // Toggle reading time settings
    const readingTimeCheckbox = form.querySelector("#enableReadingTime");
    const readingTimeSettings = form.querySelector("#readingTimeSettings");
    const toggleReadingTimeSettings = () => {
      readingTimeSettings.style.display = readingTimeCheckbox.checked
        ? "block"
        : "none";
    };
    readingTimeCheckbox.addEventListener("change", toggleReadingTimeSettings);

    // Toggle quality score settings
    const qualityScoreCheckbox = form.querySelector("#enableQualityScore");
    const qualityScoreSettings = form.querySelector("#qualityScoreSettings");
    const toggleQualityScoreSettings = () => {
      qualityScoreSettings.style.display = qualityScoreCheckbox.checked
        ? "block"
        : "none";
    };
    qualityScoreCheckbox.addEventListener("change", toggleQualityScoreSettings);

    // Toggle normalization labels, convert values, and show/hide userMaxScore
    const normCheckbox = form.querySelector("#useNormalization");
    const normLabel = form.querySelector("#normalizationLabel");
    const thresholdLowLabel = form.querySelector("#thresholdLowLabel");
    const thresholdHighLabel = form.querySelector("#thresholdHighLabel");
    const thresholdLowInput = form.querySelector("#colorThresholdLow");
    const thresholdHighInput = form.querySelector("#colorThresholdHigh");
    const userMaxScoreInput = form.querySelector("#userMaxScore");
    const userMaxScoreContainer = form.querySelector("#userMaxScoreContainer");

    const toggleNormalization = () => {
      if (normCheckbox.checked) {
        normLabel.textContent = "(for 100%)";
        thresholdLowLabel.textContent = "(%)";
        thresholdHighLabel.textContent = "(%)";
        userMaxScoreContainer.style.display = "block";
        // Convert current raw thresholds to percentages
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
        // Convert current percentages back to raw values
        thresholdLowInput.value = Math.round(
          (parseFloat(thresholdLowInput.value) / 100) *
            parseFloat(userMaxScoreInput.value)
        );
        thresholdHighInput.value = Math.round(
          (parseFloat(thresholdHighInput.value) / 100) *
            parseFloat(userMaxScoreInput.value)
        );
      }
    };
    normCheckbox.addEventListener("change", toggleNormalization);

    // Add event listeners for reset and close
    form
      .querySelector("#resetSettingsLink")
      .addEventListener("click", function (e) {
        e.preventDefault();
        resetAllSettings();
        popup.remove();
      });
    form
      .querySelector("#closePopup")
      .addEventListener("click", () => popup.remove());

    // Form submission
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Collect all values first
      let userMaxScoreValue = parseFloat(
        form.querySelector("#userMaxScore").value
      );
      let thresholdLowValue = parseFloat(
        form.querySelector("#colorThresholdLow").value
      );
      let thresholdHighValue = parseFloat(
        form.querySelector("#colorThresholdHigh").value
      );
      const isNormalizationEnabled =
        form.querySelector("#useNormalization").checked;

      // CRITICAL FIX: If normalization is enabled, convert percentages back to raw scores before saving
      if (isNormalizationEnabled) {
        thresholdLowValue = (thresholdLowValue / 100) * userMaxScoreValue;
        thresholdHighValue = (thresholdHighValue / 100) * userMaxScoreValue;
      }

      // Save all settings
      saveSetting(
        "enableReadingTime",
        form.querySelector("#enableReadingTime").checked
      );
      saveSetting(
        "enableQualityScore",
        form.querySelector("#enableQualityScore").checked
      );
      saveSetting(
        "alwaysCountReadingTime",
        form.querySelector("#alwaysCountReadingTime").checked
      );
      saveSetting("wpm", parseInt(form.querySelector("#wpm").value));
      saveSetting(
        "readingTimeLvl1",
        parseInt(form.querySelector("#readingTimeLvl1").value)
      );
      saveSetting(
        "readingTimeLvl2",
        parseInt(form.querySelector("#readingTimeLvl2").value)
      );
      saveSetting(
        "alwaysCountQualityScore",
        form.querySelector("#alwaysCountQualityScore").checked
      );
      saveSetting(
        "alwaysSortQualityScore",
        form.querySelector("#alwaysSortQualityScore").checked
      );
      saveSetting("hideHitcount", form.querySelector("#hideHitcount").checked);
      saveSetting(
        "minKudosToShowScore",
        parseInt(form.querySelector("#minKudosToShowScore").value)
      );
      saveSetting("useNormalization", isNormalizationEnabled);
      saveSetting("userMaxScore", userMaxScoreValue);
      // Save the potentially converted raw thresholds
      saveSetting("colorThresholdLow", thresholdLowValue);
      saveSetting("colorThresholdHigh", thresholdHighValue);
      saveSetting("colorGreen", form.querySelector("#colorGreen").value);
      saveSetting("colorYellow", form.querySelector("#colorYellow").value);
      saveSetting("colorRed", form.querySelector("#colorRed").value);
      saveSetting("colorText", form.querySelector("#colorText").value);

      popup.remove();
      countRatio();
      calculateReadtime();
    });

    popup.appendChild(form);
    document.body.appendChild(popup);
  };

  // --- UI MENU ---
  // Helper: check if current page is one of the allowed types for menu options
  function isAllowedMenuPage() {
    const path = window.location.pathname;
    // User bookmarks: /users/USERNAME/bookmarks or /bookmarks
    if (/^\/users\/[^\/]+\/bookmarks(\/|$)/.test(path) || /^\/bookmarks(\/|$)/.test(path)) return true;
    // User profile: /users/USERNAME (no trailing /works etc)
    if (/^\/users\/[^\/]+\/?$/.test(path)) return true;
    // Tag works: /tags/ANYTHING/works
    if (/^\/tags\/[^\/]+\/works(\/|$)/.test(path)) return true;
    // Collections: /collections/ANYTHING
    if (/^\/collections\/[^\/]+(\/|$)/.test(path)) return true;
    // Works index: /works
    if (/^\/works(\/|$)/.test(path)) return true;
    return false;
  }

  // --- SHARED MENU MANAGEMENT ---
  function initSharedMenu() {
    // Create shared menu object if it doesn't exist (copied from ao3_chapter_shortcuts.js)
    if (!window.AO3UserScriptMenu) {
      window.AO3UserScriptMenu = {
        items: [],
        register: function(item) {
          this.items.push(item);
          this.renderMenu();
        },
        renderMenu: function() {
          // Find or create menu container
          let menuContainer = document.getElementById('ao3-userscript-menu');
          if (!menuContainer) {
            const headerMenu = document.querySelector("ul.primary.navigation.actions");
            const searchItem = headerMenu ? headerMenu.querySelector("li.search") : null;
            if (!headerMenu || !searchItem) return;
            menuContainer = document.createElement("li");
            menuContainer.className = "dropdown";
            menuContainer.id = "ao3-userscript-menu";
            const title = document.createElement("a");
            title.href = "#";
            title.textContent = "Userscripts";
            menuContainer.appendChild(title);
            const menu = document.createElement("ul");
            menu.className = "menu dropdown-menu";
            menuContainer.appendChild(menu);
            headerMenu.insertBefore(menuContainer, searchItem);
          }
          // Render menu items
          const menu = menuContainer.querySelector("ul.menu");
          if (menu) {
            menu.innerHTML = "";
            this.items.forEach(item => {
              const li = document.createElement("li");
              const a = document.createElement("a");
              a.href = "#";
              a.textContent = item.label;
              a.addEventListener("click", (e) => {
                e.preventDefault();
                item.onClick();
              });
              li.appendChild(a);
              menu.appendChild(li);
            });
          }
        }
      };
    }

    // Register this script's menu items
    const showMenuOptions = isAllowedMenuPage();
    if (showMenuOptions && CONFIG.enableReadingTime) {
      window.AO3UserScriptMenu.register({
        label: "Reading Time: Calculate",
        onClick: calculateReadtime,
      });
    }
    if (showMenuOptions && CONFIG.enableQualityScore) {
      window.AO3UserScriptMenu.register({
        label: "Quality Score: Calculate Scores",
        onClick: countRatio,
      });
      window.AO3UserScriptMenu.register({
        label: "Quality Score: Sort by Score",
        onClick: () => sortByRatio(),
      });
    }
    window.AO3UserScriptMenu.register({
      label: "Reading Time & Quality Score Settings",
      onClick: showSettingsPopup,
    });
  }

// --- INITIALIZATION ---
loadUserSettings();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    checkCountable();
    initSharedMenu();
    if (CONFIG.alwaysCountReadingTime) setTimeout(calculateReadtime, 1000);
    if (CONFIG.alwaysCountQualityScore) {
      setTimeout(() => {
        countRatio();
        if (CONFIG.alwaysSortQualityScore) sortByRatio();
      }, 1000);
    }
  });
} else {
  checkCountable();
  initSharedMenu();
  if (CONFIG.alwaysCountReadingTime) setTimeout(calculateReadtime, 1000);
  if (CONFIG.alwaysCountQualityScore) {
    setTimeout(() => {
      countRatio();
      if (CONFIG.alwaysSortQualityScore) sortByRatio();
    }, 1000);
  }
}
})();
