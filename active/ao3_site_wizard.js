// ==UserScript==
// @name         AO3: Site Wizard
// @version      1.1
// @description  Adds some useful features to format the works pages.
// @author       Blackbatcat
// @match        http://archiveofourown.org/*
// @match        https://archiveofourown.org/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // --- SETTINGS STORAGE ---
  const FORMATTER_CONFIG_KEY = "ao3_formatter_config";
  const DEFAULT_FORMATTER_CONFIG = {
    paragraphWidthPercent: 70, // percent
    paragraphFontSizePercent: 100, // percent
    paragraphTextAlign: "left", // left, justify
    paragraphFontFamily: "", // empty means inherit
    fixParagraphSpacing: true, // toggle for spacing fix (enabled by default)
    paragraphGap: 1.286, // multiplier of font size
    siteFontFamily: "",
    siteFontWeight: "",
    siteFontSizePercent: 100,
    headerFontFamily: "",
    headerFontWeight: "",
    codeFontFamily: "",
    codeFontStyle: "",
    codeFontSize: "",
  };
  // FORMATTER_CONFIG is declared only once below
  let FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };

  function loadFormatterConfig() {
    try {
      const saved = localStorage.getItem(FORMATTER_CONFIG_KEY);
      if (saved) {
        FORMATTER_CONFIG = {
          ...DEFAULT_FORMATTER_CONFIG,
          ...JSON.parse(saved),
        };
      }
    } catch (e) {
      console.error("Error loading config:", e);
    }
  }
  function saveFormatterConfig() {
    try {
      localStorage.setItem(
        FORMATTER_CONFIG_KEY,
        JSON.stringify(FORMATTER_CONFIG)
      );
    } catch (e) {
      console.error("Error saving config:", e);
    }
  }

  // --- APPLY WIDTH ---
  function applyParagraphWidth() {
    const percent = FORMATTER_CONFIG.paragraphWidthPercent;
    const fontSize = FORMATTER_CONFIG.paragraphFontSizePercent;
    const textAlign = FORMATTER_CONFIG.paragraphTextAlign;
    let fontFamily = FORMATTER_CONFIG.paragraphFontFamily;
    const gap = FORMATTER_CONFIG.paragraphGap;
    const styleId = "ao3-formatter-width-style";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `#workskin p { max-width: ${percent}% !important; margin-left: auto !important; margin-right: auto !important; font-size: ${fontSize}% !important; text-align: ${textAlign} !important;${
      fontFamily ? ` font-family: ${fontFamily} !important;` : ""
    } margin-top: 0 !important; margin-bottom: ${gap}em !important; }`;

    // --- SITE-WIDE STYLES ---
    const siteStyleId = "ao3-sitewide-style";
    let siteStyle = document.getElementById(siteStyleId);
    if (!siteStyle) {
      siteStyle = document.createElement("style");
      siteStyle.id = siteStyleId;
      document.head.appendChild(siteStyle);
    }
    // General text selectors
    const generalSelectors = `body, input, .toggled form, .dynamic form, .secondary, .dropdown, blockquote, .prompt .blurb h6, .bookmark .user .meta, a.work, span.symbol, .heading .actions, .heading .action, .heading span.actions, button, span.unread, .replied, span.claimed, .actions span.defaulted, .splash .news .meta, .datetime, h5.fandoms.heading a.tag, dd.fandom.tags a, select`;
    // Header selectors
    const headerSelectors = `h1, h2, h3, h4, h5, h6, .heading`;
    // Code selectors
    const codeSelectors = `kbd, tt, code, var, pre, samp, textarea, textarea#skin_css, .css.module blockquote pre, #floaty-textarea`;
    siteStyle.textContent = `
      html { font-size: ${
        FORMATTER_CONFIG.siteFontSizePercent || 100
      }% !important; }
      ${generalSelectors} {
        ${
          FORMATTER_CONFIG.siteFontFamily
            ? `font-family: ${FORMATTER_CONFIG.siteFontFamily} !important;`
            : ""
        }
        ${
          FORMATTER_CONFIG.siteFontWeight
            ? `font-weight: ${FORMATTER_CONFIG.siteFontWeight} !important;`
            : ""
        }
      }
      ${headerSelectors} {
        ${
          FORMATTER_CONFIG.headerFontFamily
            ? `font-family: ${FORMATTER_CONFIG.headerFontFamily} !important;`
            : FORMATTER_CONFIG.siteFontFamily
            ? `font-family: ${FORMATTER_CONFIG.siteFontFamily} !important;`
            : ""
        }
        ${
          FORMATTER_CONFIG.headerFontWeight
            ? `font-weight: ${FORMATTER_CONFIG.headerFontWeight} !important;`
            : ""
        }
      }
      ${codeSelectors} {
        ${
          FORMATTER_CONFIG.codeFontFamily
            ? `font-family: ${FORMATTER_CONFIG.codeFontFamily} !important;`
            : ""
        }
        ${
          FORMATTER_CONFIG.codeFontStyle
            ? `font-style: ${FORMATTER_CONFIG.codeFontStyle} !important;`
            : ""
        }
        ${
          FORMATTER_CONFIG.codeFontSize
            ? `font-size: ${FORMATTER_CONFIG.codeFontSize} !important;`
            : ""
        }
      }
    `;
    // Add !important to all applicable settings for maximum override
    siteStyle.textContent = siteStyle.textContent
      .replace(/(font-family:[^;]+;)/g, "$1 !important;")
      .replace(/(font-weight:[^;]+;)/g, "$1 !important;")
      .replace(/(font-size:[^;]+;)/g, "$1 !important;")
      .replace(/(font-style:[^;]+;)/g, "$1 !important;");

    // Fix paragraph spacing if enabled
    if (FORMATTER_CONFIG.fixParagraphSpacing) {
      fixParagraphSpacing();
    }
  }

  // --- PARAGRAPH SPACING FIX ---
  function fixParagraphSpacing() {
    // Helper functions
    function stripBrs(el, leading = true, trailing = true) {
      if (leading) {
        while (el.firstChild && el.firstChild.tagName === "BR") {
          el.firstChild.remove();
        }
      }
      if (trailing) {
        while (el.lastChild && el.lastChild.tagName === "BR") {
          el.lastChild.remove();
        }
      }
    }
    function removeEmptyElement(el) {
      const content =
        el.textContent && el.textContent.replace(/\u00A0/g, "").trim();
      if (
        !content &&
        el.tagName !== "BR" &&
        el.tagName !== "HR" &&
        !el.querySelector("img, embed, iframe, video")
      ) {
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

    document.querySelectorAll(".userstuff").forEach((userstuff) => {
      // Only run once per userstuff
      if (userstuff.getAttribute("data-formatter-spacing-fixed")) return;
      userstuff.setAttribute("data-formatter-spacing-fixed", "true");

      // Clean up allowed tags
      [
        "p",
        "div",
        "span",
        "blockquote",
        "pre",
        "li",
        "ul",
        "ol",
        "table",
        "tr",
        "td",
        "th",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ].forEach((tag) => {
        userstuff.querySelectorAll(tag).forEach((child) => {
          stripBrs(child);
          removeEmptyElement(child);
        });
      });
      reduceBrs(userstuff);
    });
  }

  // --- SETTINGS MENU ---
  function showFormatterMenu() {
    document
      .querySelectorAll(".ao3-formatter-menu-dialog")
      .forEach((d) => d.remove());

    // Get AO3 input field background color
    let inputBg = "#fffaf5";
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

    const dialog = document.createElement("div");
    dialog.className = "ao3-formatter-menu-dialog";
    dialog.style.cssText = `
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
    max-width: 900px;
    max-height: 80vh;
    overflow-y: auto;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    box-sizing: border-box;
  `;

    // Add CSS for the improved layout
    const style = document.createElement("style");
    style.textContent = `
    .ao3-formatter-menu-dialog .settings-section {
      background: rgba(0,0,0,0.03);
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 20px;
      border-left: 4px solid currentColor;
    }

    .ao3-formatter-menu-dialog .section-title {
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 1.2em;
      font-weight: bold;
      color: inherit;
      opacity: 0.85;
    }

    .ao3-formatter-menu-dialog .setting-group {
      margin-bottom: 15px;
    }

    .ao3-formatter-menu-dialog .setting-label {
      display: block;
      margin-bottom: 6px;
      font-weight: bold;
      color: inherit;
      opacity: 0.9;
    }

    .ao3-formatter-menu-dialog .setting-description {
      display: block;
      margin-bottom: 8px;
      font-size: 0.9em;
      color: inherit;
      opacity: 0.6;
      line-height: 1.4;
    }

    .ao3-formatter-menu-dialog .two-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .ao3-formatter-menu-dialog .slider-with-value {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ao3-formatter-menu-dialog .slider-with-value input[type="range"] {
      flex-grow: 1;
    }

    .ao3-formatter-menu-dialog .value-display {
      min-width: 40px;
      text-align: center;
      font-weight: bold;
      color: inherit;
      opacity: 0.8;
    }

    .ao3-formatter-menu-dialog .button-group {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin-top: 20px;
    }

    .ao3-formatter-menu-dialog .button-group button {
      flex: 1;
      padding: 10px;
      color: inherit;
      opacity: 0.9;
    }

    .ao3-formatter-menu-dialog .reset-link {
      text-align: center;
      margin-top: 10px;
      color: inherit;
      opacity: 0.7;
    }
  `;
    document.head.appendChild(style);

    dialog.innerHTML = `
    <h3 style="text-align: center; margin-top: 0; color: inherit;">🪄 AO3 Wizard Settings 🪄</h3>
    
    <div class="settings-section">
      <h4 class="section-title">📱 Site-Wide Display</h4>
      
      <div class="setting-group">
        <label class="setting-label">Base Font Size</label>
        <span class="setting-description">Adjust the overall text size for the entire site (percentage of browser default)</span>
        <div class="slider-with-value">
          <input type="range" id="site-fontsize-input" min="50" max="200" step="5" value="${
            FORMATTER_CONFIG.siteFontSizePercent
          }">
          <span class="value-display"><span id="site-fontsize-value">${
            FORMATTER_CONFIG.siteFontSizePercent
          }</span>%</span>
        </div>
      </div>
      
      <div class="two-column">
        <div class="setting-group">
          <label class="setting-label" for="site-fontfamily-input">General Text Font</label>
          <span class="setting-description">Font for most site text</span>
          <input type="text" id="site-fontfamily-input" value="${
            FORMATTER_CONFIG.siteFontFamily
          }" placeholder="Arial, sans-serif">
        </div>
        
        <div class="setting-group">
          <label class="setting-label" for="site-fontweight-input">Font Weight</label>
          <span class="setting-description">Boldness of general text</span>
          <input type="text" id="site-fontweight-input" value="${
            FORMATTER_CONFIG.siteFontWeight
          }" placeholder="400, normal">
        </div>
      </div>
    </div>
    
    <div class="settings-section">
      <h4 class="section-title">📝 Paragraph Formatting</h4>
      
      <div class="two-column">
        <div class="setting-group">
          <label class="setting-label">Paragraph Width</label>
          <span class="setting-description">Maximum width of text paragraphs</span>
          <div class="slider-with-value">
            <input type="range" id="paragraph-width-slider" min="10" max="100" step="5" value="${
              FORMATTER_CONFIG.paragraphWidthPercent
            }">
            <span class="value-display"><span id="paragraph-width-value">${
              FORMATTER_CONFIG.paragraphWidthPercent
            }</span>%</span>
          </div>
        </div>
        
        <div class="setting-group">
          <label class="setting-label">Font Size</label>
          <span class="setting-description">Size relative to site base size</span>
          <div class="slider-with-value">
            <input type="range" id="paragraph-fontsize-slider" min="50" max="200" step="5" value="${
              FORMATTER_CONFIG.paragraphFontSizePercent
            }">
            <span class="value-display"><span id="paragraph-fontsize-value">${
              FORMATTER_CONFIG.paragraphFontSizePercent
            }</span>%</span>
          </div>
        </div>
      </div>
      
      <div class="two-column">
        <div class="setting-group">
          <label class="setting-label" for="paragraph-align-select">Text Alignment</label>
          <span class="setting-description">How text is aligned within paragraphs</span>
          <select id="paragraph-align-select">
            <option value="left" ${
              FORMATTER_CONFIG.paragraphTextAlign === "left" ? "selected" : ""
            }>Left Aligned</option>
            <option value="justify" ${
              FORMATTER_CONFIG.paragraphTextAlign === "justify"
                ? "selected"
                : ""
            }>Justified</option>
          </select>
        </div>
        
        <div class="setting-group">
          <label class="setting-label" for="paragraph-gap-input">Line Spacing</label>
          <span class="setting-description">Vertical space between paragraphs (multiplier)</span>
          <input type="number" id="paragraph-gap-input" min="0" step="0.1" value="${
            FORMATTER_CONFIG.paragraphGap
          }">
        </div>
      </div>
      
      <div class="setting-group">
        <label class="setting-label" for="paragraph-fontfamily-input">Paragraph Font</label>
        <span class="setting-description">Font family for story paragraphs</span>
        <input type="text" id="paragraph-fontfamily-input" value="${
          FORMATTER_CONFIG.paragraphFontFamily
        }" placeholder="Arial, sans-serif">
      </div>
      
      <div class="setting-group">
        <label class="checkbox-label">
          <input type="checkbox" id="fix-paragraph-spacing-checkbox" ${
            FORMATTER_CONFIG.fixParagraphSpacing ? "checked" : ""
          }>
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
          <input type="text" id="header-fontfamily-input" value="${
            FORMATTER_CONFIG.headerFontFamily
          }" placeholder="Arial, sans-serif">
        </div>
        
        <div class="setting-group">
          <label class="setting-label" for="header-fontweight-input">Header Weight</label>
          <span class="setting-description">Boldness of header text</span>
          <input type="text" id="header-fontweight-input" value="${
            FORMATTER_CONFIG.headerFontWeight
          }" placeholder="700, bold">
        </div>
      </div>
      
      <div class="two-column">
        <div class="setting-group">
          <label class="setting-label" for="code-fontfamily-input">Code/Monospace Font</label>
          <span class="setting-description">Font for code blocks and preformatted text</span>
          <input type="text" id="code-fontfamily-input" value="${
            FORMATTER_CONFIG.codeFontFamily
          }" placeholder="'Courier New', monospace">
        </div>
        
        <div class="setting-group">
          <label class="setting-label" for="code-fontstyle-select">Code Font Style</label>
          <span class="setting-description">Style for code text</span>
          <select id="code-fontstyle-select">
            <option value="" ${
              FORMATTER_CONFIG.codeFontStyle === "" ? "selected" : ""
            }>Normal</option>
            <option value="italic" ${
              FORMATTER_CONFIG.codeFontStyle === "italic" ? "selected" : ""
            }>Italic</option>
          </select>
        </div>
      </div>
      
      <div class="setting-group">
        <label class="setting-label" for="code-fontsize-input">Code Font Size</label>
        <span class="setting-description">Size relative to surrounding text</span>
        <input type="text" id="code-fontsize-input" value="${
          FORMATTER_CONFIG.codeFontSize
        }" placeholder="0.9em, 14px">
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

    // Add event listeners for sliders to update values in real-time
    const sliders = [
      { slider: "site-fontsize-input", value: "site-fontsize-value" },
      { slider: "paragraph-width-slider", value: "paragraph-width-value" },
      {
        slider: "paragraph-fontsize-slider",
        value: "paragraph-fontsize-value",
      },
    ];

    sliders.forEach(({ slider, value }) => {
      const sliderEl = dialog.querySelector(`#${slider}`);
      const valueEl = dialog.querySelector(`#${value}`);
      if (sliderEl && valueEl) {
        sliderEl.addEventListener("input", () => {
          valueEl.textContent = sliderEl.value;
        });
      }
    });

    // Save button handler
    dialog.querySelector("#formatter-save").addEventListener("click", () => {
      // Get all values
      FORMATTER_CONFIG.siteFontSizePercent =
        parseInt(dialog.querySelector("#site-fontsize-input").value, 10) ||
        DEFAULT_FORMATTER_CONFIG.siteFontSizePercent;
      FORMATTER_CONFIG.siteFontFamily = dialog
        .querySelector("#site-fontfamily-input")
        .value.trim();
      FORMATTER_CONFIG.siteFontWeight = dialog
        .querySelector("#site-fontweight-input")
        .value.trim();

      FORMATTER_CONFIG.paragraphWidthPercent =
        parseInt(dialog.querySelector("#paragraph-width-slider").value, 10) ||
        DEFAULT_FORMATTER_CONFIG.paragraphWidthPercent;
      FORMATTER_CONFIG.paragraphFontSizePercent =
        parseInt(
          dialog.querySelector("#paragraph-fontsize-slider").value,
          10
        ) || DEFAULT_FORMATTER_CONFIG.paragraphFontSizePercent;
      FORMATTER_CONFIG.paragraphTextAlign =
        dialog.querySelector("#paragraph-align-select").value ||
        DEFAULT_FORMATTER_CONFIG.paragraphTextAlign;
      FORMATTER_CONFIG.paragraphFontFamily = dialog
        .querySelector("#paragraph-fontfamily-input")
        .value.trim();

      FORMATTER_CONFIG.paragraphGap =
        parseFloat(dialog.querySelector("#paragraph-gap-input").value) ||
        DEFAULT_FORMATTER_CONFIG.paragraphGap;
      FORMATTER_CONFIG.fixParagraphSpacing = dialog.querySelector(
        "#fix-paragraph-spacing-checkbox"
      ).checked;

      FORMATTER_CONFIG.headerFontFamily = dialog
        .querySelector("#header-fontfamily-input")
        .value.trim();
      FORMATTER_CONFIG.headerFontWeight = dialog
        .querySelector("#header-fontweight-input")
        .value.trim();
      FORMATTER_CONFIG.codeFontFamily = dialog
        .querySelector("#code-fontfamily-input")
        .value.trim();
      FORMATTER_CONFIG.codeFontStyle = dialog.querySelector(
        "#code-fontstyle-select"
      ).value;
      FORMATTER_CONFIG.codeFontSize = dialog
        .querySelector("#code-fontsize-input")
        .value.trim();

      saveFormatterConfig();
      dialog.remove();
      applyParagraphWidth();
    });

    // Cancel button handler
    dialog.querySelector("#formatter-cancel").addEventListener("click", () => {
      dialog.remove();
    });

    // Reset link handler
    dialog
      .querySelector("#resetFormatterSettingsLink")
      .addEventListener("click", function (e) {
        e.preventDefault();
        FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };
        saveFormatterConfig();
        dialog.remove();
        applyParagraphWidth();
      });
  }

  // --- SHARED MENU MANAGEMENT ---
  function initSharedMenu() {
    // Create shared menu object if it doesn't exist
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
    
    // Register this script's menu item
    window.AO3UserScriptMenu.register({
      label: "AO3 Wizard Settings",
      onClick: showFormatterMenu
    });
  }

  // --- INITIALIZATION ---
  loadFormatterConfig();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyParagraphWidth();
      initSharedMenu();
    });
  } else {
    applyParagraphWidth();
    initSharedMenu();
  }
})();