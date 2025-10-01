// ==UserScript==
// @name         AO3: Site Wizard
// @version      1.4
// @description  Change fonts and font sizes across the site easily and fix paragraph spacing issues.
// @author       Blackbatcat
// @match        *://archiveofourown.org/*
// @license      MIT
// @grant        none
// @run-at       document-start
// @namespace https://greasyfork.org/users/1498004
// ==/UserScript==

(function () {
  "use strict";

  // --- CONSTANTS ---
  const FORMATTER_CONFIG_KEY = "ao3_wizard_config";
  const DEFAULT_FORMATTER_CONFIG = {
    paragraphWidthPercent: 70,
    paragraphFontSizePercent: 100,
    paragraphTextAlign: "left",
    paragraphFontFamily: "",
    fixParagraphSpacing: true,
    paragraphGap: 1.286,
    siteFontFamily: "",
    siteFontWeight: "",
    siteFontSizePercent: 100,
    headerFontFamily: "",
    headerFontWeight: "",
    codeFontFamily: "",
    codeFontStyle: "",
    codeFontSize: "",
  };

  const WORKS_PAGE_REGEX = /^https:\/\/archiveofourown\.org\/works\//;

  // --- STATE ---
  let FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };
  let cachedElements = {
    paraStyle: null,
    siteStyle: null,
    workskin: null,
  };

  // Cache current page type
  let isWorksPage = WORKS_PAGE_REGEX.test(window.location.href);

  // --- UTILITIES ---
  function getOrCreateStyle(id) {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement("style");
      style.id = id;
      document.head.appendChild(style);
    }
    return style;
  }

  function loadFormatterConfig() {
    try {
      const saved = localStorage.getItem(FORMATTER_CONFIG_KEY);
      if (saved) {
        FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Error loading config:", e);
    }
  }

  function saveFormatterConfig() {
    try {
      localStorage.setItem(FORMATTER_CONFIG_KEY, JSON.stringify(FORMATTER_CONFIG));
    } catch (e) {
      console.error("Error saving config:", e);
    }
  }

  // --- APPLY STYLES ---
  function applyParagraphWidth() {
    if (!cachedElements.paraStyle) {
      cachedElements.paraStyle = getOrCreateStyle("ao3-formatter-paragraph-style");
    }

    if (isWorksPage) {
      const { paragraphWidthPercent, paragraphFontSizePercent, paragraphTextAlign, paragraphFontFamily, paragraphGap } = FORMATTER_CONFIG;
      
      cachedElements.paraStyle.textContent = `
        .userstuff { text-align: ${paragraphTextAlign} !important; }
        #workskin {
          max-width: ${paragraphWidthPercent}vw !important;
          font-size: ${paragraphFontSizePercent}% !important;
        }
        #workskin p {
          margin-bottom: ${paragraphGap}em !important;
          ${paragraphFontFamily ? `font-family: ${paragraphFontFamily} !important;` : ""}
        }
      `;

      // Cache workskin element
      if (!cachedElements.workskin) {
        cachedElements.workskin = document.getElementById("workskin");
      }

      if (cachedElements.workskin) {
        if (paragraphTextAlign === "right") {
          cachedElements.workskin.setAttribute("dir", "rtl");
        } else {
          cachedElements.workskin.removeAttribute("dir");
        }
      }
    } else {
      cachedElements.paraStyle.textContent = "";
      if (cachedElements.workskin) {
        cachedElements.workskin.removeAttribute("dir");
      }
    }

    applySiteWideStyles();
  }

  function applySiteWideStyles() {
    if (!cachedElements.siteStyle) {
      cachedElements.siteStyle = getOrCreateStyle("ao3-sitewide-style");
    }

    const { siteFontSizePercent, siteFontFamily, siteFontWeight, headerFontWeight, codeFontFamily, codeFontStyle, codeFontSize } = FORMATTER_CONFIG;

    // Build CSS more efficiently
    const rules = [];
    
    rules.push(`html { font-size: ${siteFontSizePercent}% !important; }`);

    if (siteFontFamily) {
      rules.push(`body, input, textarea, select, button, .toggled form, .dynamic form, .secondary, .dropdown, blockquote, .prompt .blurb h6, .bookmark .user .meta, a.work, span.symbol, .heading .actions, .heading .action, .heading span.actions, button, span.unread, .replied, span.claimed, .actions span.defaulted, .splash .news .meta, .datetime, h5.fandoms.heading a.tag, dd.fandom.tags a, #dashboard, #header, #main, #footer, .navigation, .menu, .dropdown-menu, .blurb, .meta, .stats, .tags, .module, .wrapper, .region, li, span, div, a, p, label, .user, .current, .action, .notice, .comment, .thread, .work, .bookmark, .series, .pagination, .current, h1, h2, h3, h4, h5, h6, .heading { font-family: ${siteFontFamily} !important; }`);
    }

    if (siteFontWeight) {
      rules.push(`body, input, textarea, select, button, .toggled form, .dynamic form, .secondary, .dropdown, blockquote, .prompt .blurb h6, .bookmark .user .meta, a.work, span.symbol, .heading .actions, .heading .action, .heading span.actions, button, span.unread, .replied, span.claimed, .actions span.defaulted, .splash .news .meta, .datetime, h5.fandoms.heading a.tag, dd.fandom.tags a, #dashboard, #header, #main, #footer, .navigation, .menu, .dropdown-menu, .blurb, .meta, .stats, .tags, .module, .wrapper, .region, li, span, div, a, p, label, .user, .current, .action, .notice, .comment, .thread, .work, .bookmark, .series, .pagination, .current { font-weight: ${siteFontWeight} !important; }`);
    }

    if (headerFontWeight) {
      rules.push(`h1, h2, h3, h4, h5, h6, .heading { font-weight: ${headerFontWeight} !important; }`);
    }

    if (codeFontFamily || codeFontStyle || codeFontSize) {
      const codeRules = [];
      if (codeFontFamily) codeRules.push(`font-family: ${codeFontFamily} !important`);
      if (codeFontStyle) codeRules.push(`font-style: ${codeFontStyle} !important`);
      if (codeFontSize) codeRules.push(`font-size: ${codeFontSize} !important`);
      rules.push(`kbd, tt, code, var, pre, samp, textarea, textarea#skin_css, .css.module blockquote pre, #floaty-textarea { ${codeRules.join('; ')}; }`);
    }

    cachedElements.siteStyle.textContent = rules.join('\n');
  }

  // --- PARAGRAPH SPACING FIX ---
  const fixParagraphSpacing = (() => {
    // Create closure with helper functions
    function stripBrs(el, leading = true, trailing = true) {
      if (leading) {
        while (el.firstChild?.tagName === "BR") {
          el.firstChild.remove();
        }
      }
      if (trailing) {
        while (el.lastChild?.tagName === "BR") {
          el.lastChild.remove();
        }
      }
    }

    function removeEmptyElement(el) {
      const content = el.textContent?.replace(/\u00A0/g, "").trim();
      if (!content && el.tagName !== "BR" && el.tagName !== "HR" && !el.querySelector("img, embed, iframe, video")) {
        el.remove();
      }
    }

    function reduceBrs(userstuff) {
      let el = userstuff.querySelector("br + br + br");
      while (el) {
        el.remove();
        el = userstuff.querySelector("br + br + br");
      }
    }

    const ALLOWED_TAGS = ["p", "div", "span", "blockquote", "pre", "li", "ul", "ol", "table", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6"];

    return function() {
      if (!isWorksPage) return;

      document.querySelectorAll(".userstuff:not([data-formatter-spacing-fixed])").forEach((userstuff) => {
        userstuff.setAttribute("data-formatter-spacing-fixed", "true");

        ALLOWED_TAGS.forEach((tag) => {
          userstuff.querySelectorAll(tag).forEach((child) => {
            stripBrs(child);
            removeEmptyElement(child);
          });
        });
        reduceBrs(userstuff);
      });
    };
  })();

  // --- SETTINGS MENU ---
  function showFormatterMenu() {
    // Remove existing dialogs
    document.querySelectorAll(".ao3-formatter-menu-dialog").forEach((d) => d.remove());

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

    const dialog = document.createElement("div");
    dialog.className = "ao3-formatter-menu-dialog";
    dialog.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: ${inputBg}; padding: 20px; border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,0.2); z-index: 10000; width: 90%; max-width: 900px; max-height: 80vh; overflow-y: auto; font-family: inherit; font-size: inherit; color: inherit; box-sizing: border-box;`;

    // Add CSS for the layout
    const style = document.createElement("style");
    style.textContent = `.ao3-formatter-menu-dialog .settings-section { background: rgba(0,0,0,0.03); border-radius: 6px; padding: 15px; margin-bottom: 20px; border-left: 4px solid currentColor; } .ao3-formatter-menu-dialog .section-title { margin-top: 0; margin-bottom: 15px; font-size: 1.2em; font-weight: bold; color: inherit; opacity: 0.85; font-family: inherit; } .ao3-formatter-menu-dialog .setting-group { margin-bottom: 15px; } .ao3-formatter-menu-dialog .setting-label { display: block; margin-bottom: 6px; font-weight: bold; color: inherit; opacity: 0.9; } .ao3-formatter-menu-dialog .setting-description { display: block; margin-bottom: 8px; font-size: 0.9em; color: inherit; opacity: 0.6; line-height: 1.4; } .ao3-formatter-menu-dialog .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; } .ao3-formatter-menu-dialog .slider-with-value { display: flex; align-items: center; gap: 10px; } .ao3-formatter-menu-dialog .slider-with-value input[type="range"] { flex-grow: 1; } .ao3-formatter-menu-dialog .value-display { min-width: 40px; text-align: center; font-weight: bold; color: inherit; opacity: 0.6; } .ao3-formatter-menu-dialog .button-group { display: flex; justify-content: space-between; gap: 10px; margin-top: 20px; } .ao3-formatter-menu-dialog .button-group button { flex: 1; padding: 10px; color: inherit; opacity: 0.9; } .ao3-formatter-menu-dialog .reset-link { text-align: center; margin-top: 10px; color: inherit; opacity: 0.7; }`;
    document.head.appendChild(style);

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    dialog.innerHTML = `
      <h3 style="text-align: center; margin-top: 0; color: inherit;">⚙️ Site Wizard Settings ⚙️</h3>
      <div class="settings-section">
        <h4 class="section-title">📱 Site-Wide Display</h4>
        <div class="setting-group">
          <label class="setting-label">Base Font Size</label>
          <span class="setting-description">Adjust the overall text size for the entire site (percentage of browser default)</span>
          <div class="slider-with-value">
            <input type="range" id="site-fontsize-input" min="50" max="200" step="5" value="${FORMATTER_CONFIG.siteFontSizePercent}">
            <span class="value-display"><span id="site-fontsize-value">${FORMATTER_CONFIG.siteFontSizePercent}</span>%</span>
          </div>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="site-fontfamily-input">General Text Font</label>
            <span class="setting-description">Font for most site text</span>
            <input type="text" id="site-fontfamily-input" value="${FORMATTER_CONFIG.siteFontFamily}" placeholder="Figtree, sans-serif">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="site-fontweight-input">Font Weight</label>
            <span class="setting-description">Boldness of general text</span>
            <input type="text" id="site-fontweight-input" value="${FORMATTER_CONFIG.siteFontWeight}" placeholder="400, normal">
          </div>
        </div>
      </div>
      <div class="settings-section">
        <h4 class="section-title">📖 Work Formatting</h4>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label">Work Margin Width</label>
            <span class="setting-description">Maximum width of work reader</span>
            <div class="slider-with-value">
              <input type="range" id="paragraph-width-slider" min="10" max="100" step="5" value="${FORMATTER_CONFIG.paragraphWidthPercent}">
              <span class="value-display"><span id="paragraph-width-value">${FORMATTER_CONFIG.paragraphWidthPercent}</span>%</span>
            </div>
          </div>
          <div class="setting-group">
            <label class="setting-label">Font Size</label>
            <span class="setting-description">Size relative to site base size</span>
            <div class="slider-with-value">
              <input type="range" id="paragraph-fontsize-slider" min="50" max="200" step="5" value="${FORMATTER_CONFIG.paragraphFontSizePercent}">
              <span class="value-display"><span id="paragraph-fontsize-value">${FORMATTER_CONFIG.paragraphFontSizePercent}</span>%</span>
            </div>
          </div>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="paragraph-align-select">Text Alignment</label>
            <span class="setting-description">How text is aligned within paragraphs</span>
            <select id="paragraph-align-select">
              <option value="left" ${FORMATTER_CONFIG.paragraphTextAlign === "left" ? "selected" : ""}>Left Aligned</option>
              <option value="justify" ${FORMATTER_CONFIG.paragraphTextAlign === "justify" ? "selected" : ""}>Justified</option>
              <option value="right" ${FORMATTER_CONFIG.paragraphTextAlign === "right" ? "selected" : ""}>Right Aligned</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="paragraph-gap-input">Line Spacing</label>
            <span class="setting-description">Vertical space between paragraphs (multiplier)</span>
            <input type="number" id="paragraph-gap-input" min="0" step="0.1" value="${FORMATTER_CONFIG.paragraphGap}">
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="paragraph-fontfamily-input">Work Font</label>
          <span class="setting-description">Font family for reader</span>
          <input type="text" id="paragraph-fontfamily-input" value="${FORMATTER_CONFIG.paragraphFontFamily}" placeholder="Figtree, sans-serif">
        </div>
        <div class="setting-group">
          <label class="checkbox-label">
            <input type="checkbox" id="fix-paragraph-spacing-checkbox" ${FORMATTER_CONFIG.fixParagraphSpacing ? "checked" : ""}>
            Fix excessive paragraph spacing
          </label>
          <span class="setting-description">Remove unnecessary blank space between paragraphs</span>
        </div>
      </div>
      <div class="settings-section">
        <h4 class="section-title">🎯 Element-Specific Fonts</h4>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="header-fontfamily-input">Header Font</label>
            <span class="setting-description">Font for headings (H1-H6)</span>
            <input type="text" id="header-fontfamily-input" value="${FORMATTER_CONFIG.headerFontFamily}" placeholder="Figtree, sans-serif">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="header-fontweight-input">Header Weight</label>
            <span class="setting-description">Boldness of header text</span>
            <input type="text" id="header-fontweight-input" value="${FORMATTER_CONFIG.headerFontWeight}" placeholder="700, bold">
          </div>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="code-fontsize-input">Code Font Size</label>
            <span class="setting-description">Size relative to surrounding text</span>
            <input type="text" id="code-fontsize-input" value="${FORMATTER_CONFIG.codeFontSize}" placeholder="0.9em, 14px">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="code-fontstyle-select">Code Font Style</label>
            <span class="setting-description">Style for code text</span>
            <select id="code-fontstyle-select">
              <option value="" ${FORMATTER_CONFIG.codeFontStyle === "" ? "selected" : ""}>Normal</option>
              <option value="italic" ${FORMATTER_CONFIG.codeFontStyle === "italic" ? "selected" : ""}>Italic</option>
            </select>
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="code-fontfamily-input">Code/Monospace Font</label>
          <span class="setting-description">Font for code blocks and preformatted text</span>
          <input type="text" id="code-fontfamily-input" value="${FORMATTER_CONFIG.codeFontFamily}" placeholder="Victor Mono Medium, monospace">
        </div>
      </div>
      <div class="button-group">
        <button id="formatter-save">Apply Settings</button>
        <button id="formatter-cancel">Cancel</button>
      </div>
      <div class="reset-link">
        <a href="#" id="resetFormatterSettingsLink">Reset to Default Settings</a>
      </div>
    `;

    document.body.appendChild(dialog);

    // Event delegation for sliders
    dialog.addEventListener('input', (e) => {
      const target = e.target;
      if (target.type === 'range') {
        const valueId = target.id.replace('-input', '-value').replace('-slider', '-value');
        const valueEl = dialog.querySelector(`#${valueId}`);
        if (valueEl) valueEl.textContent = target.value;
      }
    });

    // Save button handler
    dialog.querySelector("#formatter-save").addEventListener("click", () => {
      const getValue = (id) => dialog.querySelector(id)?.value?.trim() || "";
      const getInt = (id, def) => parseInt(getValue(id), 10) || def;
      const getFloat = (id, def) => parseFloat(getValue(id)) || def;

      FORMATTER_CONFIG.siteFontSizePercent = getInt("#site-fontsize-input", DEFAULT_FORMATTER_CONFIG.siteFontSizePercent);
      FORMATTER_CONFIG.siteFontFamily = getValue("#site-fontfamily-input");
      FORMATTER_CONFIG.siteFontWeight = getValue("#site-fontweight-input");
      FORMATTER_CONFIG.paragraphWidthPercent = getInt("#paragraph-width-slider", DEFAULT_FORMATTER_CONFIG.paragraphWidthPercent);
      FORMATTER_CONFIG.paragraphFontSizePercent = getInt("#paragraph-fontsize-slider", DEFAULT_FORMATTER_CONFIG.paragraphFontSizePercent);
      FORMATTER_CONFIG.paragraphTextAlign = getValue("#paragraph-align-select") || DEFAULT_FORMATTER_CONFIG.paragraphTextAlign;
      FORMATTER_CONFIG.paragraphFontFamily = getValue("#paragraph-fontfamily-input");
      FORMATTER_CONFIG.paragraphGap = getFloat("#paragraph-gap-input", DEFAULT_FORMATTER_CONFIG.paragraphGap);
      FORMATTER_CONFIG.fixParagraphSpacing = dialog.querySelector("#fix-paragraph-spacing-checkbox").checked;
      FORMATTER_CONFIG.headerFontFamily = getValue("#header-fontfamily-input");
      FORMATTER_CONFIG.headerFontWeight = getValue("#header-fontweight-input");
      FORMATTER_CONFIG.codeFontFamily = getValue("#code-fontfamily-input");
      FORMATTER_CONFIG.codeFontStyle = getValue("#code-fontstyle-select");
      FORMATTER_CONFIG.codeFontSize = getValue("#code-fontsize-input");

      saveFormatterConfig();
      dialog.remove();
      applyParagraphWidth();
      
      if (FORMATTER_CONFIG.paragraphTextAlign === "right") {
        location.reload();
      }
    });

    dialog.querySelector("#formatter-cancel").addEventListener("click", () => dialog.remove());

    dialog.querySelector("#resetFormatterSettingsLink").addEventListener("click", (e) => {
      e.preventDefault();
      FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };
      saveFormatterConfig();
      dialog.remove();
      applyParagraphWidth();
    });
  }

  // --- SHARED MENU MANAGEMENT ---
  function initSharedMenu() {
    let menuContainer = document.getElementById("scriptconfig");
    
    if (!menuContainer) {
      const headerMenu = document.querySelector("ul.primary.navigation.actions");
      const searchItem = headerMenu?.querySelector("li.search");
      if (!headerMenu || !searchItem) return;

      menuContainer = document.createElement("li");
      menuContainer.className = "dropdown";
      menuContainer.id = "scriptconfig";
      menuContainer.innerHTML = `
        <a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a>
        <ul class="menu dropdown-menu"></ul>
      `;
      headerMenu.insertBefore(menuContainer, searchItem);
    }

    const menu = menuContainer.querySelector(".dropdown-menu");
    if (menu && !menu.querySelector("#opencfg_site_wizard")) {
      const menuItem = document.createElement("li");
      menuItem.innerHTML = '<a href="javascript:void(0);" id="opencfg_site_wizard">Site Wizard</a>';
      menuItem.querySelector("a").addEventListener("click", showFormatterMenu);
      menu.appendChild(menuItem);
    }
  }

  // --- INITIALIZATION ---
  loadFormatterConfig();
  console.log("[AO3: Site Wizard] loaded.");

  // Apply styles with proper sequencing
  function initStyles() {
    if (document.head) {
      applyParagraphWidth();
    } else {
      const observer = new MutationObserver(() => {
        if (document.head) {
          observer.disconnect();
          applyParagraphWidth();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    }
  }

  // Run paragraph spacing fix
  function runParagraphSpacingFixIfEnabled() {
    if (FORMATTER_CONFIG.fixParagraphSpacing && isWorksPage) {
      fixParagraphSpacing();
    }
  }

  // Setup mutation observer for new userstuff elements
  function setupUserstuffObserver() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", setupUserstuffObserver);
      return;
    }

    if (!FORMATTER_CONFIG.fixParagraphSpacing || !isWorksPage) return;

    const userstuffObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          
          if (node.classList?.contains("userstuff") && !node.getAttribute("data-formatter-spacing-fixed")) {
            fixParagraphSpacing();
          } else if (node.querySelectorAll) {
            const userstuffs = node.querySelectorAll(".userstuff:not([data-formatter-spacing-fixed])");
            if (userstuffs.length > 0) {
              fixParagraphSpacing();
            }
          }
        }
      }
    });

    userstuffObserver.observe(document.body, { childList: true, subtree: true });
  }

  // Initialize everything
  initStyles();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      runParagraphSpacingFixIfEnabled();
      initSharedMenu();
    });
  } else {
    runParagraphSpacingFixIfEnabled();
    initSharedMenu();
  }

  if (document.body) {
    setupUserstuffObserver();
  } else {
    document.addEventListener("DOMContentLoaded", setupUserstuffObserver);
  }
})();