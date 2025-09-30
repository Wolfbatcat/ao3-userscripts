// ==UserScript==
// @name          AO3: Advanced Blocker
// @description   Block works based off of tags, authors, word counts, languages, completion status and more. Now with primary pairing filtering!
// @author        BlackBatCat
// @namespace
// @license       MIT
// @match         http*://archiveofourown.org/*
// @version       1.3.3
// @require       https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js
// @grant         GM.getValue
// @grant         GM.setValue
// @run-at        document-idle
// @downloadURL https://update.greasyfork.org/scripts/549942/AO3%3A%20Advanced%20Blocker.user.js
// @updateURL https://update.greasyfork.org/scripts/549942/AO3%3A%20Advanced%20Blocker.meta.js
// ==/UserScript==

/* globals $, GM_config */

;(function () {
  "use strict";
  window.ao3Blocker = {};
    // Startup message
    try {
      console.log("[AO3: Advanced Blocker] loaded.");
    } catch (e) {}

  // Define the CSS namespace. All CSS classes are prefixed with this.
  const CSS_NAMESPACE = "ao3-blocker";

  // Define default configuration values
  const DEFAULTS = {
    tagBlacklist: "",
    tagWhitelist: "",
    tagHighlights: "",
    highlightColor: "#fff9b1",
    minWords: "",
    maxWords: "",
    blockComplete: false,
    blockOngoing: false,
    authorBlacklist: "",
    titleBlacklist: "",
    summaryBlacklist: "",
    showReasons: true,
    showPlaceholders: true,
    debugMode: false,
    allowedLanguages: "",
    maxCrossovers: "3",
    disableOnBookmarks: true,
    disableOnCollections: false,
    primaryRelationships: "",
    primaryCharacters: "",
    primaryRelpad: "1",
    primaryCharpad: "5"
  };

  // Storage key for single config object
  const STORAGE_KEY = "ao3_advanced_blocker_config";

  // Define the custom styles for the script
  const STYLE = `
  html body .ao3-blocker-hidden {
    display: none;
  }

  .ao3-blocker-cut {
    display: none;
  }

  .ao3-blocker-cut::after {
    clear: both;
    content: '';
    display: block;
  }

  .ao3-blocker-reason {
    margin-left: 5px;
  }

  .ao3-blocker-hide-reasons .ao3-blocker-reason {
    display: none;
  }

  .ao3-blocker-unhide .ao3-blocker-cut {
    display: block;
  }

  .ao3-blocker-fold {
    align-items: center;
    display: flex;
    justify-content: flex-start;
  }

  .ao3-blocker-unhide .ao3-blocker-fold {
      border-bottom: 1px dashed;
      border-bottom-color: inherit;
      margin-bottom: 15px;
      padding-bottom: 5px;
  }

  button.ao3-blocker-toggle {
    margin-left: auto;
    min-width: inherit;
    min-height: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.2em;
  }

  .ao3-blocker-toggle span {
    width: 1em !important;
    height: 1em !important;
    display: inline-block;
    vertical-align: -0.15em;
    margin-right: 0.2em;
    background-color: currentColor;
  }

  /* Settings menu styles */
  .ao3-blocker-menu-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fffaf5;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0,0,0,0.2);
    z-index: 10000;
    width: 90%;
    max-width: 900px;
    max-height: 80vh;
    overflow-y: auto;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    box-sizing: border-box;
  }

  .ao3-blocker-menu-dialog .settings-section {
    background: rgba(0,0,0,0.03);
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 20px;
    border-left: 4px solid currentColor;
  }

  .ao3-blocker-menu-dialog .section-title {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    font-weight: bold;
    font-family: inherit;
    color: inherit;
    opacity: 0.85;
  }

  .ao3-blocker-menu-dialog .setting-group {
    margin-bottom: 15px;
  }

  .ao3-blocker-menu-dialog .setting-label {
    display: block;
    margin-bottom: 6px;
    font-weight: bold;
    color: inherit;
    opacity: 0.9;
  }

  .ao3-blocker-menu-dialog .setting-description {
    display: block;
    margin-bottom: 8px;
    font-size: 0.9em;
    color: inherit;
    opacity: 0.6;
    line-height: 1.4;
  }

  .ao3-blocker-menu-dialog .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .ao3-blocker-menu-dialog .button-group {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 20px;
  }

  .ao3-blocker-menu-dialog .button-group button {
    flex: 1;
    padding: 10px;
    color: inherit;
    opacity: 0.9;
  }

  .ao3-blocker-menu-dialog .reset-link {
    text-align: center;
    margin-top: 10px;
    color: inherit;
    opacity: 0.7;
  }

  .ao3-blocker-menu-dialog textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
    box-sizing: border-box;
  }

  /* Highlighted works (color set inline, but !important for override) */
  .ao3-blocker-highlight {
    background-color: var(--ao3-blocker-highlight-color, rgba(255,255,0,0.1)) !important;
  }
  /* Tooltip icon style for settings menu (scoped) */
  .ao3-blocker-menu-dialog .symbol.question {
    font-size: 0.5em;
    vertical-align: middle;
  }
  /* Lighter placeholder text for menu input fields */
  .ao3-blocker-menu-dialog input::placeholder,
  .ao3-blocker-menu-dialog textarea::placeholder {
    opacity: 0.6 !important;
  }
`;

  // Load configuration from single object storage
  function loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {...DEFAULTS, ...parsed};
      }
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to load config:", e);
    }
    return {...DEFAULTS};
  }

  // Save configuration to single object storage
  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to save config:", e);
      return false;
    }
  }

  // Initialize GM_config with custom storage handlers
  GM_config.init({
    "id": "ao3Blocker",
    "title": "Advanced Blocker",
    "fields": {
      "tagBlacklist": {
        "label": "Tag Blacklist",
        "type": "text",
        "default": DEFAULTS.tagBlacklist
      },
      "tagWhitelist": {
        "label": "Tag Whitelist",
        "type": "text",
        "default": DEFAULTS.tagWhitelist
      },
      "tagHighlights": {
        "label": "Highlighted Tags",
        "type": "text",
        "default": DEFAULTS.tagHighlights
      },
      "highlightColor": {
        "label": "Highlight Color",
        "type": "text",
        "default": DEFAULTS.highlightColor
      },
      "minWords": {
        "label": "Min Words",
        "title": "Hide works under this many words. Leave empty to ignore.",
        "type": "text",
        "default": DEFAULTS.minWords
      },
      "maxWords": {
        "label": "Max Words",
        "title": "Hide works over this many words. Leave empty to ignore.",
        "type": "text",
        "default": DEFAULTS.maxWords
      },
      "blockComplete": {
        "label": "Block Complete Works",
        "type": "checkbox",
        "default": DEFAULTS.blockComplete
      },
      "blockOngoing": {
        "label": "Block Ongoing Works",
        "type": "checkbox",
        "default": DEFAULTS.blockOngoing
      },
      "authorBlacklist": {
        "label": "Author Blacklist",
        "type": "text",
        "default": DEFAULTS.authorBlacklist
      },
      "titleBlacklist": {
        "label": "Title Blacklist",
        "type": "text",
        "default": DEFAULTS.titleBlacklist
      },
      "summaryBlacklist": {
        "label": "Summary Blacklist",
        "type": "text",
        "default": DEFAULTS.summaryBlacklist
      },
      "showReasons": {
        "label": "Show Block Reason",
        "type": "checkbox",
        "default": DEFAULTS.showReasons
      },
      "showPlaceholders": {
        "label": "Show Work Placeholder",
        "type": "checkbox",
        "default": DEFAULTS.showPlaceholders
      },
      "debugMode": {
        "label": "Debug Mode",
        "type": "checkbox",
        "default": DEFAULTS.debugMode
      },
      "allowedLanguages": {
        "label": "Allowed Languages (show only these; empty = allow all)",
        "type": "text",
        "default": DEFAULTS.allowedLanguages
      },
      "maxCrossovers": {
        "label": "Max Fandoms (crossovers)",
        "type": "text",
        "default": DEFAULTS.maxCrossovers
      },
      "disableOnBookmarks": {
        "label": "Disable Blocking on Bookmarks Pages",
        "type": "checkbox",
        "default": DEFAULTS.disableOnBookmarks
      },
      "disableOnCollections": {
        "label": "Disable Blocking on Collections Pages",
        "type": "checkbox",
        "default": DEFAULTS.disableOnCollections
      },
      "primaryRelationships": {
        "label": "Primary Relationships",
        "type": "text",
        "default": DEFAULTS.primaryRelationships
      },
      "primaryCharacters": {
        "label": "Primary Characters",
        "type": "text",
        "default": DEFAULTS.primaryCharacters
      },
      "primaryRelpad": {
        "label": "Relationship Tag Window",
        "type": "text",
        "default": DEFAULTS.primaryRelpad
      },
      "primaryCharpad": {
        "label": "Character Tag Window",
        "type": "text",
        "default": DEFAULTS.primaryCharpad
      }
    },
    "events": {
      "open": function() {
        // Load settings from single object storage when GM_config opens
        const config = loadConfig();
        Object.keys(config).forEach(key => {
          if (GM_config.fields[key]) {
            GM_config.set(key, config[key]);
          }
        });
      },
      "save": function() {
        // Save all settings to single object storage
        const config = {};
        Object.keys(GM_config.fields).forEach(key => {
          config[key] = GM_config.get(key);
        });

        if (saveConfig(config)) {
          window.ao3Blocker.updated = true;
          // Remove the alert and reload automatically
          // alert("Your changes have been saved.");
          location.reload(); // Add this line to reload automatically
        } else {
          alert("Error saving settings.");
        }
      },
      "close": function() {
        if (window.ao3Blocker.updated) location.reload();
      },
      "init": function() {
        // Config is now available
        const config = loadConfig();

        // Process configuration for runtime use (ORIGINAL LOGIC PRESERVED)
        window.ao3Blocker.config = {
          "showReasons": config.showReasons,
          "showPlaceholders": config.showPlaceholders,
          "authorBlacklist": config.authorBlacklist.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "titleBlacklist": config.titleBlacklist.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagBlacklist": config.tagBlacklist.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagWhitelist": config.tagWhitelist.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagHighlights": config.tagHighlights.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "summaryBlacklist": config.summaryBlacklist.toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),

          "highlightColor": config.highlightColor,
          "debugMode": config.debugMode,
          "allowedLanguages": config.allowedLanguages
            .toLowerCase()
            .split(/,(?:\s)?/g)
            .map(s => s.trim())
            .filter(Boolean),
          "maxCrossovers": (function() {
            const val = config.maxCrossovers;
            const parsed = parseInt(val, 10);
            return (val === undefined || val === null || val === "" || isNaN(parsed)) ? null : parsed;
          })(),
          "minWords": (function () {
            const v = config.minWords;
            const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
            return Number.isFinite(n) ? n : null;
          })(),
          "maxWords": (function () {
            const v = config.maxWords;
            const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
            return Number.isFinite(n) ? n : null;
          })(),
          "disableOnBookmarks": config.disableOnBookmarks,
          "disableOnCollections": config.disableOnCollections,
          "blockComplete": config.blockComplete,
          "blockOngoing": config.blockOngoing,
          // Primary Pairing Config
          "primaryRelationships": config.primaryRelationships.split(",").map(s => s.trim()).filter(Boolean),
          "primaryCharacters": config.primaryCharacters.split(",").map(s => s.trim()).filter(Boolean),
          "primaryRelpad": (function() {
            const val = config.primaryRelpad;
            const parsed = parseInt(val, 10);
            return (val === undefined || val === null || val === "" || isNaN(parsed)) ? 1 : Math.max(1, parsed);
          })(),
          "primaryCharpad": (function() {
            const val = config.primaryCharpad;
            const parsed = parseInt(val, 10);
            return (val === undefined || val === null || val === "" || isNaN(parsed)) ? 5 : Math.max(1, parsed);
          })()
        }

        // --- Browser detection ---
        function isFirefox() {
          return typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);
        }

        // --- SHARED MENU REGISTRATION (MATCH ao3_chapter_shortcuts.js) ---
        function registerBlockerMenu() {
          if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === "function") {
            window.AO3UserScriptMenu.register({
              label: "Advanced Blocker",
              onClick: showBlockerMenu
            });
            return true;
          }
          // Fallback: legacy direct DOM method (only if shared menu truly missing)
          const headerMenu = document.querySelector("ul.primary.navigation.actions");
          const searchItem = headerMenu ? headerMenu.querySelector("li.search") : null;
          if (!headerMenu || !searchItem) return false;
          let menuContainer = document.getElementById('ao3-userscript-menu');
          if (!menuContainer) {
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
          const menu = menuContainer.querySelector("ul.menu");
          if (menu) {
            let li = menu.querySelector("#ao3-blocker-menu-item");
            if (!li) {
              li = document.createElement("li");
              li.id = "ao3-blocker-menu-item";
              const a = document.createElement("a");
              a.href = "#";
              a.textContent = "Advanced Blocker Settings";
              a.addEventListener("click", function (e) {
                e.preventDefault();
                try { showBlockerMenu(); } catch (err) { console.error("[Advanced Blocker] showBlockerMenu error", err); }
              });
              li.appendChild(a);
              menu.appendChild(li);
            }
          }
          return true;
        }

        // Register menu after DOMContentLoaded (robust, idempotent)
        function initBlockerMenu() {
          // On Firefox, always try shared menu, fallback if not available
          // On Chrome/Safari, use fallback menu directly
          if (isFirefox()) {
            if (!registerBlockerMenu()) {
              // fallback to jQuery menu if shared menu not available
              addMenu();
            }
          } else {
            // Chrome/Safari: always use fallback menu
            addMenu();
          }
        }
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", initBlockerMenu);
        } else {
          initBlockerMenu();
        }

        addStyle();
        setTimeout(() => {
          // Set the highlight color CSS variable globally
          document.documentElement.style.setProperty('--ao3-blocker-highlight-color', window.ao3Blocker.config.highlightColor || '#fff9b1');
          checkWorks();
        }, 10);
      }
    },
    "css": ".config_var {display: grid; grid-template-columns: repeat(2, 0.7fr);}"
  });

  // addMenu() - Add a custom menu to the AO3 menu bar to control our configuration options
  function addMenu() {
    // Define our custom menu and add it to the AO3 menu bar
    const headerMenu = $("ul.primary.navigation.actions");
    const blockerMenu = $("<li class=\"dropdown\"></li>").html("<a>Advanced Blocker</a>");
    headerMenu.find("li.search").before(blockerMenu);
    const dropMenu = $("<ul class=\"menu dropdown-menu\"></ul>");
    blockerMenu.append(dropMenu);

    // Add an option to show the improved config dialog
    const settingsButton = $("<li></li>").html("<a>Advanced Blocker Settings</a>");
    settingsButton.on("click", () => { showBlockerMenu(); });
    dropMenu.append(settingsButton);
  }

  // addStyle() - Apply the custom stylesheet to AO3
  function addStyle() {
    const style = $(`<style class="${CSS_NAMESPACE}"></style>`).html(STYLE);
    $("head").append(style);
  }

  // showBlockerMenu() - Show the improved settings menu
  function showBlockerMenu() {
    // Remove any existing menu
    $(`.${CSS_NAMESPACE}-menu-dialog`).remove();

    // Get AO3 input field background color
    let inputBg = "#fffaf5";
    const testInput = document.createElement("input");
    document.body.appendChild(testInput);
    try {
      const computedBg = window.getComputedStyle(testInput).backgroundColor;
      if (computedBg && computedBg !== "rgba(0, 0, 0, 0)" && computedBg !== "transparent") {
        inputBg = computedBg;
      }
    } catch (e) {}
    testInput.remove();

    // Load current config for the menu
    const config = loadConfig();

    // Create the dialog
    const dialog = $(`<div class="${CSS_NAMESPACE}-menu-dialog"></div>`);
    dialog.css({
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: inputBg,
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 0 20px rgba(0,0,0,0.2)',
      zIndex: '10000',
      width: '90%',
      maxWidth: '900px',
      maxHeight: '80vh',
      overflowY: 'auto',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      color: 'inherit',
      boxSizing: 'border-box'
    });

    // --- Build the menu content ---
    dialog.html(`
      <h3 style="text-align: center; margin-top: 0; color: inherit;">🛡️ Advanced Blocker Settings 🛡️</h3>

      <!-- 1. Tag Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Tag Filtering 🔖</h4>
        <div class="setting-group">
          <label class="setting-label" for="tag-blacklist-input">Blacklist Tags</label>
          <span class="setting-description ao3-blocker-inline-help" style="display:block;">
            Matches any AO3 tag: ratings, warnings, fandoms, ships, characters, freeforms.
          </span>
          <textarea id="tag-blacklist-input" placeholder="Reader-Insert, Abandoned" title="Blocks if any tag matches. * is a wildcard.">${config.tagBlacklist}</textarea>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="tag-whitelist-input">Whitelist Tags</label>
          <span class="setting-description ao3-blocker-inline-help" style="display:block;">
            Always shows the work even if it matches the blacklist.
          </span>
          <textarea id="tag-whitelist-input" placeholder="Happy Ending, Angst with a Happy Ending" title="Always shows the work, even if blacklisted.">${config.tagWhitelist}</textarea>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="tag-highlights-input">Highlight Tags
              <span class="symbol question" title="Make these works stand out."><span>?</span></span>
            </label>
            <textarea id="tag-highlights-input" placeholder="Hurt/Comfort, Found Family, Slow Burn" title="Keep and mark works with these tags.">${config.tagHighlights}</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="highlight-color-input">Highlight Color
              <span class="symbol question" title="Pick a background color for these works."><span>?</span></span>
            </label>
            <input type="color" id="highlight-color-input" value="${config.highlightColor || "#fff9b1"}" title="Pick the highlight color.">
          </div>
        </div>
      </div>

      <!-- 2. Primary Pairing Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Primary Pairing Filtering 💕</h4>
        <div class="setting-group">
          <label class="setting-label" for="primary-relationships-input">Primary Relationships
            <span class="symbol question" title="Only show works where these relationships are in the first few relationship tags."><span>?</span></span>
          </label>
          <textarea id="primary-relationships-input" placeholder="Luo Binghe/Shen Yuan | Shen Qingqiu, Lan Zhan | Lan Wangji/Wei Ying | Wei Wuxian" title="Case-sensitive. Comma separated.">${config.primaryRelationships}</textarea>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="primary-characters-input">Primary Characters
            <span class="symbol question" title="Only show works where these characters are in the first few character tags."><span>?</span></span>
          </label>
          <textarea id="primary-characters-input" placeholder="Shen Yuan | Shen Qingqiu, Luo Binghe" title="Case-sensitive. Comma separated.">${config.primaryCharacters}</textarea>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="primary-relpad-input">Relationship Tag Window
              <span class="symbol question" title="Check only the first X relationship tags."><span>?</span></span>
            </label>
            <input type="number" id="primary-relpad-input" min="1" max="10" value="${config.primaryRelpad || 1}" title="Check only the first X relationship tags.">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="primary-charpad-input">Character Tag Window
              <span class="symbol question" title="Check only the first X character tags."><span>?</span></span>
            </label>
            <input type="number" id="primary-charpad-input" min="1" max="10" value="${config.primaryCharpad || 5}" title="Check only the first X character tags.">
          </div>
        </div>
      </div>

      <!-- 3. Work Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Work Filtering 📝</h4>
        <div class="two-column">
          <div>
            <div class="setting-group">
              <label class="setting-label" for="allowed-languages-input">Allowed Languages
                <span class="symbol question" title="Only show these languages. Leave empty for all."><span>?</span></span>
              </label>
              <input id="allowed-languages-input" type="text"
                     placeholder="english, Русский, 中文-普通话 國語"
                     value="${config.allowedLanguages || ""}"
                     title="Only show these languages. Leave empty for all.">
            </div>
            <div class="setting-group">
              <label class="setting-label" for="min-words-input">Min Words
                <span class="symbol question" title="Hide works under this many words."><span>?</span></span>
              </label>
              <input id="min-words-input" type="text" style="width:100%;" placeholder="e.g. 1000" value="${config.minWords || ''}" title="Hide works under this many words.">
            </div>
            <div class="setting-group">
              <label class="checkbox-label" for="block-ongoing-checkbox">
                <input type="checkbox" id="block-ongoing-checkbox" ${config.blockOngoing ? "checked" : ""}>
                Block Ongoing Works
                <span class="symbol question" title="Hide works that are ongoing."><span>?</span></span>
              </label>
            </div>
          </div>
          <div>
            <div class="setting-group">
              <label class="setting-label" for="max-crossovers-input">Max Fandoms
                <span class="symbol question" title="Hide works with more than this many fandoms."><span>?</span></span>
              </label>
              <input id="max-crossovers-input" type="number" min="1" step="1"
                     value="${config.maxCrossovers || ''}"
                     title="Hide works with more than this many fandoms.">
            </div>
            <div class="setting-group">
              <label class="setting-label" for="max-words-input">Max Words
                <span class="symbol question" title="Hide works over this many words."><span>?</span></span>
              </label>
              <input id="max-words-input" type="text" style="width:100%;" placeholder="e.g. 100000" value="${config.maxWords || ''}" title="Hide works over this many words.">
            </div>
            <div class="setting-group">
              <label class="checkbox-label" for="block-complete-checkbox">
                <input type="checkbox" id="block-complete-checkbox" ${config.blockComplete ? "checked" : ""}>
                Block Complete Works
                <span class="symbol question" title="Hide works that are marked as complete."><span>?</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Author & Content Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Author & Content Filtering ✍️</h4>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="author-blacklist-input">Blacklist Authors
              <span class="symbol question" title="Match the author name exactly. Commas or semicolons."><span>?</span></span>
            </label>
            <textarea id="author-blacklist-input" placeholder="DetectiveMittens, BlackBatCat" title="Match the author name exactly. Commas or semicolons.">${config.authorBlacklist}</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="title-blacklist-input">Blacklist Titles
              <span class="symbol question" title="Blocks if the title contains your text. * works."><span>?</span></span>
            </label>
            <textarea id="title-blacklist-input" placeholder="Week 2025" title="Blocks if the title contains your text. * works.">${config.titleBlacklist}</textarea>
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="summary-blacklist-input">Blacklist Summary
            <span class="symbol question" title="Blocks if the summary has these words/phrases."><span>?</span></span>
          </label>
          <textarea id="summary-blacklist-input" placeholder="collection of oneshots" title="Blocks if the summary has these words/phrases.">${config.summaryBlacklist}</textarea>
        </div>
      </div>

      <!-- 5. Display Options -->
      <div class="settings-section">
        <h4 class="section-title">Display Options ⚙️</h4>
        <div class="two-column">
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="show-reasons-checkbox" ${config.showReasons ? "checked" : ""}>
                Show Block Reason
                <span class="symbol question" title="List what triggered the block."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="show-placeholders-checkbox" ${config.showPlaceholders ? "checked" : ""}>
                Show Work Placeholder
                <span class="symbol question" title="Leave a stub you can click to reveal."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="debug-mode-checkbox" ${config.debugMode ? "checked" : ""}>
                Debug Mode
                <span class="symbol question" title="Log details to the console."><span>?</span></span>
              </label>
            </div>
          </div>
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="disable-on-bookmarks-checkbox" ${config.disableOnBookmarks ? "checked" : ""}>
                Disable Blocking on Bookmarks
                <span class="symbol question" title="If checked, works will not be blocked on bookmarks pages. Highlighting still works."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="disable-on-collections-checkbox" ${config.disableOnCollections ? "checked" : ""}>
                Disable Blocking on Collections
                <span class="symbol question" title="If checked, works will not be blocked on collections pages. Highlighting still works."><span>?</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 6. Import/Export & Reset -->
      <div class="button-group">
        <button id="blocker-save">Save Settings</button>
        <button id="blocker-cancel">Cancel</button>
      </div>

      <div class="reset-link">
        <a href="#" id="resetBlockerSettingsLink">Reset to Default Settings</a>
      </div>

      <div class="reset-link" style="margin-top:18px;">
        <button id="ao3-export" style="margin-right:8px;">Export Settings</button>
        <input type="file" id="ao3-import" accept="application/json" style="display:none;">
        <button id="ao3-import-btn">Import Settings</button>
      </div>
    `);

    // --- Export Settings ---
    dialog.find("#ao3-export").on("click", function() {
      try {
        const config = loadConfig();
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const filename = `ao3_advanced_blocker_config_${dateStr}.json`;
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (e) {
        alert("Export failed: " + (e && e.message ? e.message : e));
      }
    });

    // --- Import Settings ---
    dialog.find("#ao3-import-btn").on("click", function() {
      dialog.find("#ao3-import").val("");
      dialog.find("#ao3-import").trigger("click");
    });
    dialog.find("#ao3-import").on("change", function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const importedConfig = JSON.parse(evt.target.result);
          if (typeof importedConfig !== "object" || !importedConfig) throw new Error("Invalid JSON");

          // Validate and merge with defaults
          const validConfig = {...DEFAULTS};
          Object.keys(validConfig).forEach(key => {
            if (importedConfig.hasOwnProperty(key)) {
              validConfig[key] = importedConfig[key];
            }
          });

          if (saveConfig(validConfig)) {
            alert("Settings imported! Reloading...");
            location.reload();
          } else {
            throw new Error("Failed to save imported settings");
          }
        } catch (err) {
          alert("Import failed: " + (err && err.message ? err.message : err));
        }
      };
      reader.readAsText(file);
    });

    $("body").append(dialog);

    // Save button handler - Use GM_config to save
    dialog.find("#blocker-save").on("click", () => {
      // Set values in GM_config which will trigger the save event
      GM_config.set("tagBlacklist", dialog.find("#tag-blacklist-input").val());
      GM_config.set("tagWhitelist", dialog.find("#tag-whitelist-input").val());
      GM_config.set("tagHighlights", dialog.find("#tag-highlights-input").val());
      GM_config.set("authorBlacklist", dialog.find("#author-blacklist-input").val());
      GM_config.set("titleBlacklist", dialog.find("#title-blacklist-input").val());
      GM_config.set("summaryBlacklist", dialog.find("#summary-blacklist-input").val());
      GM_config.set("showReasons", dialog.find("#show-reasons-checkbox").is(":checked"));
      GM_config.set("showPlaceholders", dialog.find("#show-placeholders-checkbox").is(":checked"));
      GM_config.set("debugMode", dialog.find("#debug-mode-checkbox").is(":checked"));
      GM_config.set("highlightColor", dialog.find("#highlight-color-input").val());
      GM_config.set("allowedLanguages", dialog.find("#allowed-languages-input").val());
      GM_config.set("maxCrossovers", dialog.find("#max-crossovers-input").val());
      GM_config.set("minWords", dialog.find("#min-words-input").val());
      GM_config.set("maxWords", dialog.find("#max-words-input").val());
      GM_config.set("blockComplete", dialog.find("#block-complete-checkbox").is(":checked"));
      GM_config.set("blockOngoing", dialog.find("#block-ongoing-checkbox").is(":checked"));
      GM_config.set("disableOnBookmarks", dialog.find("#disable-on-bookmarks-checkbox").is(":checked"));
      GM_config.set("disableOnCollections", dialog.find("#disable-on-collections-checkbox").is(":checked"));
      // Primary Pairing Settings
      GM_config.set("primaryRelationships", dialog.find("#primary-relationships-input").val());
      GM_config.set("primaryCharacters", dialog.find("#primary-characters-input").val());
      GM_config.set("primaryRelpad", dialog.find("#primary-relpad-input").val());
      GM_config.set("primaryCharpad", dialog.find("#primary-charpad-input").val());

      window.ao3Blocker.showHelp = false;
      GM_config.save(); // This will trigger our custom save event
      dialog.remove();
    });

    // Cancel button handler
    dialog.find("#blocker-cancel").on("click", () => {
      dialog.remove();
    });

    // Reset link handler
    dialog.find("#resetBlockerSettingsLink").on("click", function (e) {
      e.preventDefault();
      if (confirm("Are you sure you want to reset all settings to default?")) {
        if (saveConfig(DEFAULTS)) {
          alert("Settings reset! Reloading...");
          location.reload();
        }
      }
    });
  }

  // === ORIGINAL BLOCKING LOGIC PRESERVED ===

  function getWordCount($work) {
  let txt = $work.find("dd.words").first().text().trim();
  txt = txt.replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, "");
  txt = txt.replace(/[^\d]/g, "");
  const n = parseInt(txt, 10);
  return Number.isFinite(n) ? n : null;
  }

  function violatesWordCount(cfg, count) {
    if (count == null) return null;
    if (cfg.minWords != null && count < cfg.minWords) return { over: false, limit: cfg.minWords };
    if (cfg.maxWords != null && count > cfg.maxWords) return { over: true,  limit: cfg.maxWords };
    return null;
  }

function getCut(work) {
  const cut = $(`<div class="${CSS_NAMESPACE}-cut"></div>`);
  work.children().each(function () {
    const $child = $(this);
    if (
      !$child.hasClass(`${CSS_NAMESPACE}-fold`) &&
      !$child.hasClass(`${CSS_NAMESPACE}-cut`)
    ) {
      cut.append($child.detach());
    }
  });
  return cut;
}

  function getFold(reasons) {
    const fold = $(`<div class="${CSS_NAMESPACE}-fold"></div>`);
    const note = $(`<span class="${CSS_NAMESPACE}-note"></span>`);
    let message = "";
    const config = window.ao3Blocker && window.ao3Blocker.config;
    const showReasons = config && config.showReasons !== false;
    let iconHtml = "";
    if (showReasons && reasons && reasons.length > 0) {
      const parts = [];
      reasons.forEach((reason) => {
        if (reason.completionStatus) {
          parts.push(`<em>${reason.completionStatus}</em>`);
        }
        if (reason.wordCount) {
          parts.push(`<em>${reason.wordCount}</em>`);
        }
        if (reason.tags && reason.tags.length > 0) {
          parts.push(`<em>Tags: ${reason.tags.join(", ")}</em>`);
        }
        if (reason.authors && reason.authors.length > 0) {
          parts.push(`<em>Author: ${reason.authors.join(", ")}</em>`);
        }
        if (reason.titles && reason.titles.length > 0) {
          parts.push(`<em>Title: ${reason.titles.join(", ")}</em>`);
        }
        if (reason.summaryTerms && reason.summaryTerms.length > 0) {
          parts.push(`<em>Summary: ${reason.summaryTerms.join(", ")}</em>`);
        }
        if (reason.language) {
          parts.push(`<em>Language: ${reason.language}</em>`);
        }
        if (reason.crossovers !== undefined) {
          const max = (window.ao3Blocker && window.ao3Blocker.config && window.ao3Blocker.config.maxCrossovers) || 0;
          parts.push(`<em>Too many fandoms: ${reason.crossovers} &gt; ${max}</em>`);
        }
        if (reason.primaryPairing) {
          parts.push(`<em>${reason.primaryPairing}</em>`);
        }
      });
      message = parts.join('; ');
      const iconUrl = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-hidden.svg";
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconUrl}') no-repeat center/contain;-webkit-mask:url('${iconUrl}') no-repeat center/contain;"></span>`;
    }
    note.html(`${iconHtml}${message}`);
    fold.html(note);
    fold.append(getToggleButton());
    return fold;
  }

  function getToggleButton() {
  const iconHide = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-hidden.svg";
  const iconEye = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-visible.svg";
  const showIcon = `<span style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.2em;background-color:currentColor;mask:url('${iconEye}') no-repeat center/contain;-webkit-mask:url('${iconEye}') no-repeat center/contain;\"></span>`;
  const hideIcon = `<span style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.2em;background-color:currentColor;mask:url('${iconHide}') no-repeat center/contain;-webkit-mask:url('${iconHide}') no-repeat center/contain;\"></span>`;
  const button = $(`<button class="${CSS_NAMESPACE}-toggle"></button>`).html(showIcon + "Show");
    const unhideClassFragment = `${CSS_NAMESPACE}-unhide`;

    button.on("click", (event) => {
      const work = $(event.target).closest(`.${CSS_NAMESPACE}-work`);
      const note = work.find(`.${CSS_NAMESPACE}-note`);
      let message = note.html();
      const iconRegex = new RegExp('<span[^>]*class=["\']' + CSS_NAMESPACE + '-icon["\'][^>]*><\\/span>\\s*', 'i');
      message = message.replace(iconRegex, "");

      if (work.hasClass(unhideClassFragment)) {
        work.removeClass(unhideClassFragment);
        note.html(`<span class=\"${CSS_NAMESPACE}-icon\" style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconHide}') no-repeat center/contain;-webkit-mask:url('${iconHide}') no-repeat center/contain;\"></span>${message}`);
        $(event.target).html(showIcon + "Show");
      } else {
        work.addClass(unhideClassFragment);
        note.html(`<span class=\"${CSS_NAMESPACE}-icon\" style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconEye}') no-repeat center/contain;-webkit-mask:url('${iconEye}') no-repeat center/contain;\"></span>${message}`);
        $(event.target).html(hideIcon + "Hide");
      }
    });

    return button;
  }

  function getReasonSpan(reasons) {
    const span = $(`<span class="${CSS_NAMESPACE}-reason"></span>`);

    if (!reasons || reasons.length === 0) {
      return span;
    }

    const reasonTexts = [];

    reasons.forEach((reason) => {
      if (reason.completionStatus) {
        reasonTexts.push(reason.completionStatus);
      }
      if (reason.wordCount) {
        reasonTexts.push(reason.wordCount);
      }
      if (reason.tags) {
        if (reason.tags.length === 1) {
          reasonTexts.push(`tags include <strong>${reason.tags[0]}</strong>`);
        } else {
          const tagList = reason.tags.map(tag => `<strong>${tag}</strong>`).join(', ');
          reasonTexts.push(`tags include ${tagList}`);
        }
      }
      if (reason.authors) {
        if (reason.authors.length === 1) {
          reasonTexts.push(`author is <strong>${reason.authors[0]}</strong>`);
        } else {
          const authorList = reason.authors.map(author => `<strong>${author}</strong>`).join(', ');
          reasonTexts.push(`authors include ${authorList}`);
        }
      }
      if (reason.titles) {
        if (reason.titles.length === 1) {
          reasonTexts.push(`title matches <strong>${reason.titles[0]}</strong>`);
        } else {
          const titleList = reason.titles.map(title => `<strong>${title}</strong>`).join(', ');
          reasonTexts.push(`title matches ${titleList}`);
        }
      }
      if (reason.summaryTerms) {
        if (reason.summaryTerms.length === 1) {
          reasonTexts.push(`summary includes <strong>${reason.summaryTerms[0]}</strong>`);
        } else {
          const termList = reason.summaryTerms.map(term => `<strong>${term}</strong>`).join(', ');
          reasonTexts.push(`summary includes ${termList}`);
        }
      }
      if (reason.language) {
        reasonTexts.push(`language is <strong>${reason.language}</strong>`);
      }
      if (reason.crossovers !== undefined) {
        const max = (window.ao3Blocker && window.ao3Blocker.config && window.ao3Blocker.config.maxCrossovers) || 0;
        reasonTexts.push(`too many fandoms: <strong>${reason.crossovers} &gt; ${max}</strong>`);
      }
      if (reason.primaryPairing) {
        reasonTexts.push(`<strong>${reason.primaryPairing}</strong>`);
      }
    });

    if (reasonTexts.length > 0) {
      const reasonText = reasonTexts.join('; ');
      span.html(`(Reason: ${reasonText}.)`);
    }

    return span;
  }

  function blockWork(work, reasons, config) {
    if (!reasons) return;

    if (config.showPlaceholders) {
      const fold = getFold(reasons);
      const cut = getCut(work);

      work.addClass(`${CSS_NAMESPACE}-work`);
      work.html(fold);
      work.append(cut);

      if (!config.showReasons) {
        work.addClass(`${CSS_NAMESPACE}-hide-reasons`);
      }
    } else {
      work.addClass(`${CSS_NAMESPACE}-hidden`);
    }
  }

  function matchTermsWithWildCard(term0, pattern0) {
    const term = term0.toLowerCase();
    const pattern = pattern0.toLowerCase();

    if (term === pattern) return true;
    if (pattern.indexOf("*") === -1) return false;

    const lastMatchedIndex = pattern.split("*").filter(Boolean).reduce((prevIndex, chunk) => {
      const matchedIndex = term.indexOf(chunk);
      return prevIndex >= 0 && prevIndex <= matchedIndex ? matchedIndex : -1;
    }, 0);

    return lastMatchedIndex >= 0;
  }

  function isTagWhitelisted(tags, whitelist) {
    const whitelistLookup = whitelist.reduce((lookup, tag) => {
      lookup[tag.toLowerCase()] = true;
      return lookup;
    }, {});

    return tags.some((tag) => {
      return !!whitelistLookup[tag.toLowerCase()];
    });
  }

  // Primary Pairing Check Function
  function checkPrimaryPairing(blockables, config) {
    const primaryRelationships = config.primaryRelationships || [];
    const primaryCharacters = config.primaryCharacters || [];
    const relpad = config.primaryRelpad || 1;
    const charpad = config.primaryCharpad || 5;

    // If no primary pairing settings, skip check
    if (primaryRelationships.length === 0 && primaryCharacters.length === 0) {
      return null;
    }

    // Get relationship and character tags from the work
    const relationshipTags = blockables.tags.filter(tag =>
      tag.includes('/') && !tag.includes('&')
    ).slice(0, relpad);

    const characterTags = blockables.tags.filter(tag =>
      !tag.includes('/') && !tag.includes('&')
    ).slice(0, charpad);

    let missingRelationships = [];
    let missingCharacters = [];

    // Check relationships
    if (primaryRelationships.length > 0) {
      const hasPrimaryRelationship = primaryRelationships.some(rel =>
        relationshipTags.includes(rel)
      );
      if (!hasPrimaryRelationship) {
        missingRelationships = primaryRelationships;
      }
    }

    // Check characters
    if (primaryCharacters.length > 0) {
      const hasPrimaryCharacter = primaryCharacters.some(char =>
        characterTags.includes(char)
      );
      if (!hasPrimaryCharacter) {
        missingCharacters = primaryCharacters;
      }
    }

    // If both are missing, create combined reason
    if (missingRelationships.length > 0 && missingCharacters.length > 0) {
      return {
        primaryPairing: `Missing primary relationship(s) and character(s)`
      };
    } else if (missingRelationships.length > 0) {
      return {
        primaryPairing: `Missing primary relationship(s)`
      };
    } else if (missingCharacters.length > 0) {
      return {
        primaryPairing: `Missing primary character(s)`
      };
    }

    return null;
  }

  function getBlockReason(_ref, _ref2) {
  const completionStatus = _ref.completionStatus;

  const authors = _ref.authors === undefined ? [] : _ref.authors,
    title = _ref.title === undefined ? "" : _ref.title,
    tags = _ref.tags === undefined ? [] : _ref.tags,
    summary = _ref.summary === undefined ? "" : _ref.summary,
    language = _ref.language === undefined ? "" : _ref.language,
    fandomCount = _ref.fandomCount === undefined ? 0 : _ref.fandomCount,
    wordCount = _ref.wordCount === undefined ? null : _ref.wordCount;
  const authorBlacklist = _ref2.authorBlacklist === undefined ? [] : _ref2.authorBlacklist,
    titleBlacklist = _ref2.titleBlacklist === undefined ? [] : _ref2.titleBlacklist,
    tagBlacklist = _ref2.tagBlacklist === undefined ? [] : _ref2.tagBlacklist,
    tagWhitelist = _ref2.tagWhitelist === undefined ? [] : _ref2.tagWhitelist,
    summaryBlacklist = _ref2.summaryBlacklist === undefined ? [] : _ref2.summaryBlacklist,
    allowedLanguages = _ref2.allowedLanguages === undefined ? [] : _ref2.allowedLanguages,
    maxCrossovers = _ref2.maxCrossovers === undefined ? 0 : _ref2.maxCrossovers,
    minWords = _ref2.minWords === undefined ? null : _ref2.minWords,
    maxWords = _ref2.maxWords === undefined ? null : _ref2.maxWords;
  const blockComplete = _ref2.blockComplete === undefined ? false : _ref2.blockComplete;
  const blockOngoing = _ref2.blockOngoing === undefined ? false : _ref2.blockOngoing;

  // If whitelisted, don't block regardless of other conditions
  if (isTagWhitelisted(tags, tagWhitelist)) {
    return null;
  }

  const reasons = [];

  // Primary Pairing Check (before other conditions)
  const primaryPairingReason = checkPrimaryPairing({ tags }, _ref2);
  if (primaryPairingReason) {
    reasons.push(primaryPairingReason);
  }

  // Completion status filter
  if (blockComplete && completionStatus === 'complete') {
    reasons.push({ completionStatus: 'Status: Complete' });
  }
  if (blockOngoing && completionStatus === 'ongoing') {
    reasons.push({ completionStatus: 'Status: Ongoing' });
  }

  // Language allowlist: if set and work language not included, block
  if (allowedLanguages.length > 0) {
    const lang = (language || "").toLowerCase().trim();
    const allowed = allowedLanguages.includes(lang);
    if (!allowed) {
      reasons.push({ language: lang || "unknown" });
    }
  }

  // Max crossovers: if set and fandomCount exceeds, block
  if (typeof maxCrossovers === 'number' && maxCrossovers > 0 && fandomCount > maxCrossovers) {
    reasons.push({ crossovers: fandomCount });
  }

  // Word count filter (after whitelist check, before other reasons)
  if (minWords != null || maxWords != null) {
    const wc = wordCount;
    const wcHit = (function() {
      if (wc == null) return null;
      if (minWords != null && wc < minWords) return { over: false, limit: minWords };
      if (maxWords != null && wc > maxWords) return { over: true,  limit: maxWords };
      return null;
    })();
    if (wcHit) {
      const wcStr = wc?.toLocaleString?.() ?? wc;
      const limStr = wcHit.limit?.toLocaleString?.() ?? wcHit.limit;
      reasons.push({ wordCount: `Words: ${wcStr} ${wcHit.over ? '>' : '<'} ${limStr}` });
    }
  }

  // Check for blocked tags (collect all matching tags)
  const blockedTags = [];
  tags.forEach((tag) => {
    tagBlacklist.forEach((blacklistedTag) => {
      if (blacklistedTag.trim() && matchTermsWithWildCard(tag.toLowerCase(), blacklistedTag.toLowerCase())) {
        blockedTags.push(blacklistedTag);
      }
    });
  });
  if (blockedTags.length > 0) {
    reasons.push({ tags: blockedTags });
  }

  // Check for blocked authors (collect all matching authors)
  const blockedAuthors = [];
  authors.forEach((author) => {
    authorBlacklist.forEach((blacklistedAuthor) => {
      if (blacklistedAuthor.trim() && author.toLowerCase() === blacklistedAuthor.toLowerCase()) {
        blockedAuthors.push(blacklistedAuthor);
      }
    });
  });
  if (blockedAuthors.length > 0) {
    reasons.push({ authors: blockedAuthors });
  }

  // Check for blocked title
  const blockedTitles = [];
  titleBlacklist.forEach((blacklistedTitle) => {
    if (blacklistedTitle.trim() && matchTermsWithWildCard(title.toLowerCase(), blacklistedTitle.toLowerCase())) {
      blockedTitles.push(blacklistedTitle);
    }
  });
  if (blockedTitles.length > 0) {
    reasons.push({ titles: blockedTitles });
  }

  // Check for blocked summary terms
  const blockedSummaryTerms = [];
  summaryBlacklist.forEach((summaryTerm) => {
    if (summaryTerm.trim() && summary.toLowerCase().indexOf(summaryTerm.toLowerCase()) !== -1) {
      blockedSummaryTerms.push(summaryTerm);
    }
  });
  if (blockedSummaryTerms.length > 0) {
    reasons.push({ summaryTerms: blockedSummaryTerms });
  }

  return reasons.length > 0 ? reasons : null;
  }

  const _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

  function getText(element) {
    return $(element).text().replace(/^\s*|\s*$/g, "");
  }
  function selectTextsIn(root, selector) {
    return $.makeArray($(root).find(selector)).map(getText);
  }

  function selectFromWork(container) {
    return _extends({}, selectFromBlurb(container), {
      title: selectTextsIn(container, ".title")[0],
      summary: selectTextsIn(container, ".summary .userstuff")[0]
    });
  }

  function selectFromBlurb(blurb) {
    const fandoms = $(blurb).find('h5.fandoms.heading a.tag');
    let completionStatus = null;
    let chaptersNum = null, chaptersDenom = null;
    const chaptersNode = $(blurb).find('dd.chapters').first();
    if (chaptersNode.length) {
      const a = chaptersNode.find('a').first();
      if (a.length) {
        chaptersNum = a.text().trim();
        let raw = chaptersNode.html();
        raw = raw.replace(/<a[^>]*>.*?<\/a>/, '');
        raw = raw.replace(/&nbsp;/gi, ' ');
        const match = raw.match(/\/\s*([\d\?]+)/);
        if (match) {
          chaptersDenom = match[1].trim();
        }
      } else {
        let txt = chaptersNode.text().replace(/&nbsp;/gi, ' ').trim();
        const match = txt.match(/^(\d+)\s*\/\s*([\d\?]+)/);
        if (match) {
          chaptersNum = match[1].trim();
          chaptersDenom = match[2].trim();
        }
      }
    }
    if (chaptersNum && chaptersDenom) {
      if (chaptersDenom === '?') {
        completionStatus = 'ongoing';
      } else {
        const current = parseInt(chaptersNum.replace(/\D/g, ''), 10);
        const total = parseInt(chaptersDenom.replace(/\D/g, ''), 10);
        if (!isNaN(current) && !isNaN(total)) {
          if (current < total) {
            completionStatus = 'ongoing';
          } else if (current === total) {
            completionStatus = 'complete';
          } else if (current > total) {
            completionStatus = 'ongoing';
          }
        } else {
          completionStatus = 'ongoing';
        }
      }
    }
    return {
      authors: selectTextsIn(blurb, "a[rel=author]"),
      tags: [].concat(selectTextsIn(blurb, "a.tag"), selectTextsIn(blurb, ".required-tags .text")),
      title: selectTextsIn(blurb, ".header .heading a:first-child")[0],
      summary: selectTextsIn(blurb, "blockquote.summary")[0],
      language: selectTextsIn(blurb, "dd.language")[0],
      fandomCount: fandoms.length,
      wordCount: getWordCount($(blurb)),
      completionStatus: completionStatus
    };
  }

  function checkWorks() {
    const debugMode = window.ao3Blocker.config.debugMode;
    const config = window.ao3Blocker.config;
    const workContainer = $("#main.works-show") || $("#main.chapters-show");
    let blocked = 0;
    let total = 0;

    if (debugMode) {
      console.groupCollapsed("Advanced Blocker");
      if (!config) {
        console.warn("Exiting due to missing config.");
        return;
      }
    }

    // Exclude user dashboard and user works/drafts pages
    const isUserDashboard = (
      /^\/users\/[^\/]+\/?$/.test(window.location.pathname) ||
      /^\/users\/[^\/]+\/pseuds\/[^\/]+\/?$/.test(window.location.pathname)
    );
    const isUserWorksOrDraftsPage = (
      /^\/users\/[^\/]+\/works\/?$/.test(window.location.pathname) ||
      /^\/users\/[^\/]+\/works\/drafts\/?$/.test(window.location.pathname)
    );
    if (isUserDashboard || isUserWorksOrDraftsPage) {
      if (debugMode) {
        console.info("Advanced Blocker: Skipping user dashboard, user works, or user drafts page.");
      }
      return;
    }

    const isBookmarksPage = /\/users\/[^\/]+\/bookmarks(\/|$)/.test(window.location.pathname);
    const isCollectionsPage = /\/collections\/[^\/]+(\/|$)/.test(window.location.pathname);
    const disableOnBookmarks = !!config.disableOnBookmarks;
    const disableOnCollections = !!config.disableOnCollections;

    $.makeArray($("li.blurb")).forEach((blurb) => {
      blurb = $(blurb);
      const isWorkOrBookmark = (blurb.hasClass("work") || blurb.hasClass("bookmark")) && !blurb.hasClass("picture");
      let reason = null;
      let blockables = selectFromBlurb(blurb);

      if (debugMode && isWorkOrBookmark) {
        console.log(`[Advanced Blocker][DEBUG] Work ID: ${blurb.attr("id") || "(no id)"}`);
        console.log(`[Advanced Blocker][DEBUG] Parsed completionStatus:`, blockables.completionStatus);
        console.log(`[Advanced Blocker][DEBUG] blockComplete:`, config.blockComplete, `blockOngoing:`, config.blockOngoing);
        console.log(`[Advanced Blocker][DEBUG] All blockables:`, blockables);
      }

      if (isWorkOrBookmark && !((isBookmarksPage && disableOnBookmarks) || (isCollectionsPage && disableOnCollections))) {
        reason = getBlockReason(blockables, config);
        total++;
      }

      if (reason) {
        blockWork(blurb, reason, config);
        blocked++;
        if (debugMode) {
          console.groupCollapsed(`- blocked ${blurb.attr("id")}`);
          console.log(blurb.html(), reason);
          console.groupEnd();
        }
      } else if (debugMode && isWorkOrBookmark) {
        console.groupCollapsed(`  skipped ${blurb.attr("id")}`);
        console.log(blurb.html());
        console.groupEnd();
      }

      // Highlighting is allowed for all blurbs
      blockables.tags.forEach((tag) => {
        if (config.tagHighlights.includes(tag.toLowerCase())) {
          blurb.addClass("ao3-blocker-highlight");
          const color = config.highlightColor || '#fff9b1';
          blurb[0].setAttribute('style', (blurb[0].getAttribute('style') || '') + `;background-color:${color} !important;`);
          if (blurb[0].id && blurb[0].id.trim() !== "") {
            const styleId = 'ao3-blocker-style-' + blurb[0].id;
            if (!document.getElementById(styleId)) {
              const style = document.createElement('style');
              style.id = styleId;
              style.textContent = `#${blurb[0].id}.ao3-blocker-highlight { background-color: ${color} !important; }`;
              document.head.appendChild(style);
            }
          }
          if (debugMode) {
            console.groupCollapsed(`? highlighted ${blurb.attr("id")}`);
            console.log(blurb.html());
            console.groupEnd();
          }
        }
      });
    });

    if (debugMode) {
      console.log(`Blocked ${blocked} out of ${total} works`);
      console.groupEnd();
    }
  }
}());

function initBlockerMenu() {
  if (typeof window.AO3UserScriptMenu !== "undefined" && typeof AO3UserScriptMenu.register === "function") {
    AO3UserScriptMenu.register({
      label: "Advanced Blocker Settings",
      onClick: showBlockerMenu,
    });
  } else {
    addMenu(); // fallback for Chrome/Safari
  }
}

document.addEventListener("DOMContentLoaded", initBlockerMenu);