// ==UserScript==
// @name          AO3: Advanced Blocker
// @description   Fork of ao3 savior; blocks works based on certain conditions
// @author        BlackBatCat
// @namespace     
// @license       MIT
// @match         http*://archiveofourown.org/*
// @version       1
// @require       https://openuserjs.org/src/libs/sizzle/GM_config.js
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js
// @grant         GM.getValue
// @grant         GM.setValue
// @run-at        document-end
// ==/UserScript==

/* globals $, GM_config */

(function () {
  "use strict";
  window.ao3Blocker = {};

  // Define the CSS namespace. All CSS classes are prefixed with this.
  const CSS_NAMESPACE = "ao3-blocker";

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
`;

  // Initialize GM_config options
  GM_config.init({
    "id": "ao3Blocker",
    "title": "Advanced Blocker",
    "fields": {
      "tagBlacklist": {
        "label": "Tag Blacklist",
        "type": "text",
        "default": ""
      },
      "tagWhitelist": {
        "label": "Tag Whitelist",
        "type": "text",
        "default": ""
      },
      "tagHighlights": {
        "label": "Highlighted Tags",
        "type": "text",
        "default": ""
      },
      "highlightColor": {
        "label": "Highlight Color",
        "type": "text",
        "default": "#fff9b1"
      },
      "minWords": {
        "label": "Min Words",
        "title": "Hide works under this many words. Leave empty to ignore.",
        "type": "text",
        "default": ""
      },
      "maxWords": {
        "label": "Max Words",
        "title": "Hide works over this many words. Leave empty to ignore.",
        "type": "text",
        "default": ""
      },
      "blockComplete": {
        "label": "Block Complete Works",
        "type": "checkbox",
        "default": false
      },
      "blockOngoing": {
        "label": "Block Ongoing Works",
        "type": "checkbox",
        "default": false
      },
      "authorBlacklist": {
        "label": "Author Blacklist",
        "type": "text",
        "default": ""
      },
      "titleBlacklist": {
        "label": "Title Blacklist",
        "type": "text",
        "default": ""
      },
      "summaryBlacklist": {
        "label": "Summary Blacklist",
        "type": "text",
        "default": ""
      },
      "showReasons": {
        "label": "Show Block Reason",
        "type": "checkbox",
        "default": true
      },
      "showPlaceholders": {
        "label": "Show Work Placeholder",
        "type": "checkbox",
        "default": true
      },
      // Removed: alertOnVisit
      "debugMode": {
        "label": "Debug Mode",
        "type": "checkbox",
        "default": false
      },
      "allowedLanguages": {
        "label": "Allowed Languages (show only these; empty = allow all)",
        "type": "text",
        "default": ""
      },
      "maxCrossovers": {
        "label": "Max Fandoms (crossovers)",
        "type": "text",
        "default": "3"
      },
      "disableOnBookmarks": {
        "label": "Disable Blocking on Bookmarks Pages",
        "type": "checkbox",
        "default": false
      },
      "disableOnCollections": {
        "label": "Disable Blocking on Collections Pages",
        "type": "checkbox",
        "default": false
      }
    },
    "events": {
      "save": () => {
        window.ao3Blocker.updated = true;
        alert("Your changes have been saved.");
      },
      "close": () => {
        if (window.ao3Blocker.updated) location.reload();
      },
      "init": () => {
        // Config is now available
        window.ao3Blocker.config = {
          "showReasons": GM_config.get("showReasons"),
          "showPlaceholders": GM_config.get("showPlaceholders"),
          // Removed: alertOnVisit
          "authorBlacklist": GM_config.get("authorBlacklist").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "titleBlacklist": GM_config.get("titleBlacklist").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagBlacklist": GM_config.get("tagBlacklist").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagWhitelist": GM_config.get("tagWhitelist").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "tagHighlights": GM_config.get("tagHighlights").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),
          "summaryBlacklist": GM_config.get("summaryBlacklist").toLowerCase().split(/,(?:\s)?/g).map(i => i.trim()),

          "highlightColor": GM_config.get("highlightColor"),
          "debugMode": GM_config.get("debugMode"),
          "allowedLanguages": GM_config
            .get("allowedLanguages")
            .toLowerCase()
            .split(/,(?:\s)?/g)
            .map(s => s.trim())
            .filter(Boolean),
          "maxCrossovers": (function() {
            const val = GM_config.get("maxCrossovers");
            const parsed = parseInt(val, 10);
            return (val === undefined || val === null || val === "" || isNaN(parsed)) ? null : parsed;
          })(),
          "minWords": (function () {
            const v = GM_config.get("minWords");
            const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
            return Number.isFinite(n) ? n : null;
          })(),
          "maxWords": (function () {
            const v = GM_config.get("maxWords");
            const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
            return Number.isFinite(n) ? n : null;
          })(),
          "disableOnBookmarks": GM_config.get("disableOnBookmarks"),
          "disableOnCollections": GM_config.get("disableOnCollections"),
          "blockComplete": GM_config.get("blockComplete"),
          "blockOngoing": GM_config.get("blockOngoing")
        }

        
        // Try to join the shared "Userscripts" menu non-destructively; fallback to legacy menu
        ;(function initBlockerMenu() {
          function safeInit() {
            try {
              if (!addBlockerToSharedMenu()) {
                try { if (!addBlockerToSharedMenu()) { try { addMenu(); } catch(_) {} } } catch (_) {}
              }
            } catch (e) {
              try { if (!addBlockerToSharedMenu()) { try { addMenu(); } catch(_) {} } } catch (_) {}
            }
          }
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", safeInit);
          } else {
            safeInit();
          }
        })();

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

// --- NON-DESTRUCTIVE SHARED MENU ATTACH ---
function addBlockerToSharedMenu() {
  // 1) Try to find an existing "Userscripts" dropdown UL
  let menuList =
    document.querySelector("#ao3-userscript-menu ul.menu") ||
    (function () {
      const headerMenu = document.querySelector("ul.primary.navigation.actions");
      if (!headerMenu) return null;
      // Try to find a dropdown whose <a> text is "Userscripts"
      const dropdowns = headerMenu.querySelectorAll("li.dropdown");
      for (const li of dropdowns) {
        const a = li.querySelector(":scope > a");
        const ul = li.querySelector(":scope > ul.menu");
        if (a && ul && a.textContent && a.textContent.trim().toLowerCase() === "userscripts") {
          return ul;
        }
      }
      return null;
    })();

  // 2) If no shared menu exists, create one (but do NOT clear or touch others)
  if (!menuList) {
    const headerMenu = document.querySelector("ul.primary.navigation.actions");
    const searchItem = headerMenu ? headerMenu.querySelector("li.search") : null;
    if (!headerMenu || !searchItem) {
      // No AO3 header yet: bail; caller can retry later or fall back
      return false;
    }
    const container = document.createElement("li");
    container.className = "dropdown";
    container.id = "ao3-userscript-menu";
    const title = document.createElement("a");
    title.href = "#";
    title.textContent = "Userscripts";
    const ul = document.createElement("ul");
    ul.className = "menu dropdown-menu";
    container.appendChild(title);
    container.appendChild(ul);
    headerMenu.insertBefore(container, searchItem);
    menuList = ul;
  }

  // 3) Add (or refresh) ONLY our own menu item — do not rebuild the whole list
  const ITEM_ID = "ao3-blocker-menu-item";
  let li = menuList.querySelector("#" + ITEM_ID);
  if (!li) {
    li = document.createElement("li");
    li.id = ITEM_ID;
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = "Advanced Blocker";
    a.addEventListener("click", function (e) {
      e.preventDefault();
      try { showBlockerMenu(); } catch (err) { console.error("[Advanced Blocker] showBlockerMenu error", err); }
    });
    li.appendChild(a);
    menuList.appendChild(li);
  } else {
    // If it already exists, make sure the click still works (in case of SPA nav)
    const a = li.querySelector("a");
    if (a) {
      a.onclick = function (e) { e.preventDefault(); try { showBlockerMenu(); } catch (err) { console.error(err); } };
    }
  }
  return true;
}


  function addMenu() {
    // Define our custom menu and add it to the AO3 menu bar
    const headerMenu = $("ul.primary.navigation.actions");
    const blockerMenu = $("<li class=\"dropdown\"></li>").html("<a>Advanced Blocker</a>");
    headerMenu.find("li.search").before(blockerMenu);
    const dropMenu = $("<ul class=\"menu dropdown-menu\"></ul>");
    blockerMenu.append(dropMenu);

    // Add an option to show the improved config dialog
    const settingsButton = $("<li></li>").html("<a>Blocker Settings</a>");
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
          <textarea id="tag-blacklist-input" placeholder="Explicit, Major Character Death, Abandoned, Time Travel" title="Blocks if any tag matches. * is a wildcard.">${GM_config.get("tagBlacklist")}</textarea>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="tag-whitelist-input">Whitelist Tags</label>
          <span class="setting-description ao3-blocker-inline-help" style="display:block;">
            Always shows the work even if it matches the blacklist.
          </span>
          <textarea id="tag-whitelist-input" placeholder="Happy Ending, Angst with a Happy Ending, Comedy" title="Always shows the work, even if blacklisted.">${GM_config.get("tagWhitelist")}</textarea>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="tag-highlights-input">Highlight Tags
              <span class="symbol question" title="Make these works stand out."><span>?</span></span>
            </label>
            <textarea id="tag-highlights-input" placeholder="Hurt/Comfort, Found Family, Slow Burn" title="Keep and mark works with these tags.">${GM_config.get("tagHighlights")}</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="highlight-color-input">Highlight Color
              <span class="symbol question" title="Pick a background color for these works."><span>?</span></span>
            </label>
            <input type="color" id="highlight-color-input" value="${GM_config.get("highlightColor") || "#fff9b1"}" title="Pick the highlight color.">
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
                     value="${GM_config.get("allowedLanguages") || ""}"
                     title="Only show these languages. Leave empty for all.">
            </div>
            <div class="setting-group">
              <label class="setting-label" for="min-words-input">Min Words
                <span class="symbol question" title="Hide works under this many words."><span>?</span></span>
              </label>
              <input id="min-words-input" type="text" style="width:100%;" placeholder="e.g. 1000" value="${GM_config.get("minWords") || ''}" title="Hide works under this many words.">
            </div>
            <div class="setting-group">
              <label class="checkbox-label" for="block-ongoing-checkbox">
                <input type="checkbox" id="block-ongoing-checkbox" ${GM_config.get("blockOngoing") ? "checked" : ""}>
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
                     value="${GM_config.get("maxCrossovers") || ''}" 
                     title="Hide works with more than this many fandoms.">
            </div>
            <div class="setting-group">
              <label class="setting-label" for="max-words-input">Max Words
                <span class="symbol question" title="Hide works over this many words."><span>?</span></span>
              </label>
              <input id="max-words-input" type="text" style="width:100%;" placeholder="e.g. 100000" value="${GM_config.get("maxWords") || ''}" title="Hide works over this many words.">
            </div>
            <div class="setting-group">
              <label class="checkbox-label" for="block-complete-checkbox">
                <input type="checkbox" id="block-complete-checkbox" ${GM_config.get("blockComplete") ? "checked" : ""}>
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
            <textarea id="author-blacklist-input" placeholder="DetectiveMittens, BlackBatCat" title="Match the author name exactly. Commas or semicolons.">${GM_config.get("authorBlacklist")}</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="title-blacklist-input">Blacklist Titles
              <span class="symbol question" title="Blocks if the title contains your text. * works."><span>?</span></span>
            </label>
            <textarea id="title-blacklist-input" placeholder="Week 2025" title="Blocks if the title contains your text. * works.">${GM_config.get("titleBlacklist")}</textarea>
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="summary-blacklist-input">Blacklist Summary
            <span class="symbol question" title="Blocks if the summary has these words/phrases."><span>?</span></span>
          </label>
          <textarea id="summary-blacklist-input" placeholder="phrase with spaces" title="Blocks if the summary has these words/phrases.">${GM_config.get("summaryBlacklist")}</textarea>
        </div>
      </div>

      <!-- 4. Display Options -->
      <div class="settings-section">
        <h4 class="section-title">Display Options ⚙️</h4>
        <div class="two-column">
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="show-reasons-checkbox" ${GM_config.get("showReasons") ? "checked" : ""}>
                Show Block Reason
                <span class="symbol question" title="List what triggered the block."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="show-placeholders-checkbox" ${GM_config.get("showPlaceholders") ? "checked" : ""}>
                Show Work Placeholder
                <span class="symbol question" title="Leave a stub you can click to reveal."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="debug-mode-checkbox" ${GM_config.get("debugMode") ? "checked" : ""}>
                Debug Mode
                <span class="symbol question" title="Log details to the console."><span>?</span></span>
              </label>
            </div>
            <!-- Removed: Warn on Open setting -->
          </div>
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="disable-on-bookmarks-checkbox" ${GM_config.get("disableOnBookmarks") ? "checked" : ""}>
                Disable Blocking on Bookmarks
                <span class="symbol question" title="If checked, works will not be blocked on bookmarks pages. Highlighting still works."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="disable-on-collections-checkbox" ${GM_config.get("disableOnCollections") ? "checked" : ""}>
                Disable Blocking on Collections
                <span class="symbol question" title="If checked, works will not be blocked on collections pages. Highlighting still works."><span>?</span></span>
              </label>
            </div>
            <!-- Debug Mode moved above -->
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
        const fields = GM_config.fields;
        const data = {};
        Object.keys(fields).forEach(key => {
          // Always include all options, using current value if set, otherwise default
          let val = GM_config.get(key);
          if (typeof val === 'undefined') {
            val = fields[key].default;
          }
          data[key] = val;
        });
        // Get today's date in YYYY-MM-DD format
        const now = new Date();
        const pad = n => n.toString().padStart(2, '0');
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const filename = `ao3_advanced_blocker_config_${dateStr}.json`;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
      dialog.find("#ao3-import").val(""); // clear previous
      dialog.find("#ao3-import").trigger("click");
    });
    dialog.find("#ao3-import").on("change", function(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const json = JSON.parse(evt.target.result);
          if (typeof json !== "object" || !json) throw new Error("Invalid JSON");
          // Validate keys: only apply known fields
          const fields = GM_config.fields;
          let applied = 0;
          Object.keys(fields).forEach(key => {
            if (json.hasOwnProperty(key)) {
              GM_config.set(key, json[key]);
              applied++;
            }
          });
          if (applied === 0) throw new Error("No valid settings found in file.");
          GM_config.save();
          alert("Settings imported! Reloading...");
          location.reload();
        } catch (err) {
          alert("Import failed: " + (err && err.message ? err.message : err));
        }
      };
      reader.readAsText(file);
    });

    $("body").append(dialog);

    // Save button handler
    dialog.find("#blocker-save").on("click", () => {
    // Get all values
  GM_config.set("tagBlacklist", dialog.find("#tag-blacklist-input").val());
  GM_config.set("tagWhitelist", dialog.find("#tag-whitelist-input").val());
  GM_config.set("tagHighlights", dialog.find("#tag-highlights-input").val());
  GM_config.set("authorBlacklist", dialog.find("#author-blacklist-input").val());
  GM_config.set("titleBlacklist", dialog.find("#title-blacklist-input").val());
  GM_config.set("summaryBlacklist", dialog.find("#summary-blacklist-input").val());
  GM_config.set("showReasons", dialog.find("#show-reasons-checkbox").is(":checked"));
  GM_config.set("showPlaceholders", dialog.find("#show-placeholders-checkbox").is(":checked"));
  // Removed: alertOnVisit
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
      // Save help toggle state (off after save)
      window.ao3Blocker.showHelp = false;
      // Save and close
      GM_config.save();
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
        // Disable Save/Cancel to prevent double actions
        dialog.find("#blocker-save, #blocker-cancel").prop("disabled", true);
        GM_config.reset();
        // Manually reset all dialog fields to their default values
        // Textareas and text/number inputs: clear
        dialog.find("textarea, input[type='text'], input[type='number']").val("");
        // Highlight color: set to default
        dialog.find("#highlight-color-input").val("#fff9b1");
        // Display Options checkboxes: set Show Block Reason and Show Work Placeholder checked, others unchecked
        dialog.find("#show-reasons-checkbox").prop("checked", true);
        dialog.find("#show-placeholders-checkbox").prop("checked", true);
  // Removed: alertOnVisit
        dialog.find("#debug-mode-checkbox").prop("checked", false);
        dialog.find("#disable-on-bookmarks-checkbox").prop("checked", false);
        dialog.find("#disable-on-collections-checkbox").prop("checked", false);
        // Optionally, re-enable Save/Cancel so user can save the cleared state
        dialog.find("#blocker-save, #blocker-cancel").prop("disabled", false);
      }
    });
  }


  // getWordCount($work) - Extracts the word count from a work blurb or work page
  function getWordCount($work) {
  // AO3 markup: <dd class="words">12,345</dd> or <dd class="words">10 683</dd>
  let txt = $work.find("dd.words").first().text().trim();
  // Remove both commas and spaces between digits (thousands separators)
  txt = txt.replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, "");
  // Remove any remaining non-digit characters (just in case)
  txt = txt.replace(/[^\d]/g, "");
  const n = parseInt(txt, 10);
  return Number.isFinite(n) ? n : null;
  }

  // violatesWordCount(cfg, count) - Returns reason if word count is out of bounds, else null
  function violatesWordCount(cfg, count) {
    if (count == null) return null; // don't nuke on parse issues
    if (cfg.minWords != null && count < cfg.minWords) return { over: false, limit: cfg.minWords };
    if (cfg.maxWords != null && count > cfg.maxWords) return { over: true,  limit: cfg.maxWords };
    return null;
  }

  // getCut(work) - Move standard AO3 work information (tags, summary, etc.) to a custom element for blocked works. This will be hidden by default on blocked works but can be shown if thre user chooses.
  function getCut(work) {
    const cut = $(`<div class="${CSS_NAMESPACE}-cut"></div>`);

    $.makeArray(work.children()).forEach((child) => {
      return cut.append(child);
    });

    return cut;
  }

  // getFold(reason) - Create the work placeholder for blocked works. Optionally, this will show why the work was blocked and give the user the option to unhide it.
  function getFold(reasons) {
    const fold = $(`<div class="${CSS_NAMESPACE}-fold"></div>`);
    const note = $(`<span class="${CSS_NAMESPACE}-note"></span>`);
    // Only show reason message and icon if config.showReasons is true
    let message = "";
    const config = window.ao3Blocker && window.ao3Blocker.config;
    const showReasons = config && config.showReasons !== false; // default true
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
      });
      message = parts.join('; ');
      // Only show icon if reason is shown
      const iconUrl = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-hidden.svg";
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconUrl}') no-repeat center/contain;-webkit-mask:url('${iconUrl}') no-repeat center/contain;"></span>`;
    }
    note.html(`${iconHtml}${message}`);
    fold.html(note);
    fold.append(getToggleButton());
    return fold;
  }

  // getToggleButton() - Create a button that will show or hide the "cut" on blocked works.
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
      // Find the current message (after the icon span)
      let message = note.html();
      // Remove the icon span HTML to get the message only
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

  // getReasonSpan(reason) - Create the element that holds the block reason information on blocked works.
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
    });

    if (reasonTexts.length > 0) {
      // Join multiple reasons with semicolons for better readability
      const reasonText = reasonTexts.join('; ');
      span.html(`(Reason: ${reasonText}.)`);
    }

    return span;
  }

  // blockWork(work, reason, config) - Replace the standard AO3 work information with the placeholder "fold", and place the "cut" below it, hidden.
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

  function findBlacklistedItem(list, blacklist, comparator) {
    let matchingEntry = void 0;

    list.some((item) => {
      blacklist.some((entry) => {
        const matched = comparator(item.toLowerCase(), entry.toLowerCase());

        if (matched) matchingEntry = entry;

        return matched;
      });
    });

    return matchingEntry;
  }

  function equals(a, b) {
    return a === b;
  }
  function contains(a, b) {
    return a.indexOf(b) !== -1;
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
    // Completion status filter
    if (blockComplete && completionStatus === 'complete') {
      return [{ completionStatus: 'Status: Complete' }];
    }
    if (blockOngoing && completionStatus === 'ongoing') {
      return [{ completionStatus: 'Status: Ongoing' }];
    }

  const reasons = [];
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
        // Reason string: Words: 480 < 1000 or Words: 128,400 > 100,000
        const wcStr = wc?.toLocaleString?.() ?? wc;
        const limStr = wcHit.limit?.toLocaleString?.() ?? wcHit.limit;
        reasons.push({ wordCount: `Words: ${wcStr} ${wcHit.over ? '>' : '<'} ${limStr}` });
      }
    }

    // If whitelisted, don't block regardless of other conditions
    if (isTagWhitelisted(tags, tagWhitelist)) {
      return null;
    }

    // Language allowlist: if set and work language not included, block
    if (allowedLanguages.length > 0) {
      const lang = (language || "").toLowerCase().trim();
      const allowed = allowedLanguages.includes(lang);
      if (!allowed) {
        return [{ language: lang || "unknown" }];
      }
    }

    // Max crossovers: if set and fandomCount exceeds, block
    if (typeof maxCrossovers === 'number' && maxCrossovers > 0 && fandomCount > maxCrossovers) {
      return [{ crossovers: fandomCount }];
    }

    // Check for blocked tags (collect all matching tags)
    const blockedTags = [];
    tags.forEach((tag) => {
      tagBlacklist.forEach((blacklistedTag) => {
        // Skip empty or whitespace-only terms
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
        // Skip empty or whitespace-only terms
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
      // Skip empty or whitespace-only terms
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
      // Skip empty or whitespace-only terms
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
    // Parse completion status from chapters
    let completionStatus = null;
    // AO3 chapter markup: <dd class="chapters"><a>14</a>/25</dd>, <dd class="chapters">1/1</dd>, <dd class="chapters">7/?</dd>
    let chaptersNum = null, chaptersDenom = null;
    const chaptersNode = $(blurb).find('dd.chapters').first();
    if (chaptersNode.length) {
      // Try to get numerator and denominator from <a> and text node (old logic)
      const a = chaptersNode.find('a').first();
      if (a.length) {
        chaptersNum = a.text().trim();
        // Get denominator: text after the <a>
        let raw = chaptersNode.html();
        raw = raw.replace(/<a[^>]*>.*?<\/a>/, '');
        raw = raw.replace(/&nbsp;/gi, ' ');
        // Match e.g. '/?', '/ ?', '/ 27', etc. (allow spaces)
        const match = raw.match(/\/\s*([\d\?]+)/);
        if (match) {
          chaptersDenom = match[1].trim();
        }
      } else {
        // No <a>, so try to parse plain text like '1/1', '7/?', etc.
        let txt = chaptersNode.text().replace(/&nbsp;/gi, ' ').trim();
        // Match e.g. '1/1', '7/?', '12 / 27', '20 / ?'
        const match = txt.match(/^(\d+)\s*\/\s*([\d\?]+)/);
        if (match) {
          chaptersNum = match[1].trim();
          chaptersDenom = match[2].trim();
        }
      }
    }
    if (chaptersNum && chaptersDenom) {
      // Always treat '?' as ongoing
      if (chaptersDenom === '?') {
        completionStatus = 'ongoing';
      } else {
        // Try to parse both as numbers
        const current = parseInt(chaptersNum.replace(/\D/g, ''), 10);
        const total = parseInt(chaptersDenom.replace(/\D/g, ''), 10);
        if (!isNaN(current) && !isNaN(total)) {
          if (current < total) {
            completionStatus = 'ongoing';
          } else if (current === total) {
            completionStatus = 'complete';
          } else if (current > total) {
            // Defensive: if current > total, treat as ongoing (edge case)
            completionStatus = 'ongoing';
          }
        } else {
          // If denominator is not '?', but not a number, treat as ongoing (defensive)
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

  // checkWorks() - Scan all works on the page and block them if they match one of the conditions set by the user.
  function checkWorks() {
    const debugMode = window.ao3Blocker.config.debugMode;

    const config = window.ao3Blocker.config;
    // If this is a work page, save the element for future use.
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

    // Exclude user dashboard (e.g. /users/USERNAME, /users/USERNAME/, /users/USERNAME/pseuds/USERNAME, /users/USERNAME/pseuds/USERNAME/)
    const isUserDashboard = (
      /^\/users\/[^\/]+\/?$/.test(window.location.pathname) ||
      /^\/users\/[^\/]+\/pseuds\/[^\/]+\/?$/.test(window.location.pathname)
    );
    // Exclude user works and drafts pages
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
    // Only block works/bookmarks, not picture blurbs or others. Highlighting is allowed for all.
    // If on bookmarks page or collections page and disabling is enabled, skip blocking (but still allow highlighting)
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
        // Log parsed completion status and config for each work
        console.log(`[Advanced Blocker][DEBUG] Work ID: ${blurb.attr("id") || "(no id)"}`);
        console.log(`[Advanced Blocker][DEBUG] Parsed completionStatus:`, blockables.completionStatus);
        console.log(`[Advanced Blocker][DEBUG] blockComplete:`, config.blockComplete, `blockOngoing:`, config.blockOngoing);
        console.log(`[Advanced Blocker][DEBUG] All blockables:`, blockables);
      }
      // Only block if not on bookmarks/collections page or disabling is off
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
          // Set the highlight color with !important using inline style (for maximum override)
          const color = config.highlightColor || '#fff9b1';
          blurb[0].setAttribute('style', (blurb[0].getAttribute('style') || '') + `;background-color:${color} !important;`);
          // Only add style if blurb[0].id is non-empty and not just whitespace
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

    // Removed: Warn on Open feature

    if (debugMode) {
      console.log(`Blocked ${blocked} out of ${total} works`);
      console.groupEnd();
    }
  }
}());