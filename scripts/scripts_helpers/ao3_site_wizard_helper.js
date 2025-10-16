// ==UserScript==
// @name          AO3: Site Wizard - Helper
// @version       2.8
// @description   Make AO3 easier to read: customize fonts and sizes across the entire site, adjust work reader margins, fix spacing issues, and configure text alignment preferences.
// @author        Blackbatcat
// @match         *://archiveofourown.org/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1678821/AO3%3A%20Menu%20Helpers%20Library.js
// @grant         none
// @run-at        document-start
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
    codeFontStyle: "normal",
    codeFontSize: "",
    expandCodeFontUsage: false,
  };

  const WORKS_PAGE_REGEX =
    /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;

  // --- STATE ---
  let FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };
  let cachedElements = {
    paraStyle: null,
    siteStyle: null,
  };

  // --- UTILITIES ---
  function getOrCreateStyle(id) {
    if (!document.head) return null;
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

  // --- APPLY STYLES ---
  function applyParagraphWidth() {
    if (!cachedElements.paraStyle) {
      cachedElements.paraStyle = getOrCreateStyle(
        "ao3-formatter-paragraph-style"
      );
      if (!cachedElements.paraStyle) return;
    }

    if (WORKS_PAGE_REGEX.test(window.location.href)) {
      const {
        paragraphWidthPercent,
        paragraphFontSizePercent,
        paragraphTextAlign,
        paragraphGap,
      } = FORMATTER_CONFIG;

      cachedElements.paraStyle.textContent = `
        #workskin p { text-align: ${paragraphTextAlign} !important; }
        ${
          paragraphTextAlign === "justify" || paragraphTextAlign === "left"
            ? `#workskin dd { text-align: ${paragraphTextAlign} !important; }`
            : ""
        }
        ${
          paragraphTextAlign === "justify" || paragraphTextAlign === "left"
            ? `#workskin blockquote { text-align: ${paragraphTextAlign} !important; }`
            : ""
        }
        #workskin {
          max-width: ${paragraphWidthPercent}vw !important;
          font-size: ${paragraphFontSizePercent}% !important;
        }
        #workskin p {
          margin-bottom: ${paragraphGap}em !important;
        }
        #workskin p[align] {
          text-align: ${paragraphTextAlign} !important;
        }
        ${
          paragraphTextAlign === "right"
            ? `
        #workskin ul, #workskin ol {
          direction: rtl !important;
          text-align: right !important;
        }
        #workskin li {
          text-align: right !important;
        }
        #workskin dl {
          direction: rtl !important;
        }
        #workskin dt, #workskin dd {
          text-align: right !important;
        }
        #workskin blockquote {
          text-align: right !important;
        }
        #workskin summary {
          text-align: right !important;
        }
        #workskin h1, #workskin h2, #workskin h3,
        #workskin h4, #workskin h5, #workskin h6 {
          text-align: right !important;
        }
        `
            : ""
        }
      `;

      const workskin = document.getElementById("workskin");
      if (workskin) {
        if (paragraphTextAlign === "right") {
          workskin.setAttribute("dir", "rtl");
        } else {
          workskin.removeAttribute("dir");
        }
      }
    } else {
      cachedElements.paraStyle.textContent = "";
    }

    applySiteWideStyles();
  }

  function applySiteWideStyles() {
    if (!cachedElements.siteStyle) {
      cachedElements.siteStyle = getOrCreateStyle("ao3-sitewide-style");
      if (!cachedElements.siteStyle) return;
    }

    const {
      siteFontSizePercent,
      siteFontFamily,
      siteFontWeight,
      headerFontFamily,
      headerFontWeight,
      paragraphFontFamily,
      codeFontFamily,
      codeFontStyle,
      codeFontSize,
      expandCodeFontUsage,
    } = FORMATTER_CONFIG;

    const rules = [];

    rules.push(`html { font-size: ${siteFontSizePercent}% !important; }`);

    if (siteFontFamily) {
      if (expandCodeFontUsage) {
        rules.push(
          `body, body *:not(textarea):not(textarea *):not(code):not(pre):not(tt):not(kbd):not(samp):not(var), input:not([type="file"]), select, button:not(.comment-format button):not(ul.comment-format button) { font-family: ${siteFontFamily} !important; }`
        );
      } else {
        rules.push(
          `body, body *:not(code):not(pre):not(tt):not(kbd):not(samp):not(var), input:not([type="file"]), textarea:not(#skin_css):not(#floaty-textarea), select, button:not(.comment-format button):not(ul.comment-format button) { font-family: ${siteFontFamily} !important; }`
        );
      }
    }

    if (siteFontWeight) {
      const textareaSelector = expandCodeFontUsage
        ? ""
        : ", textarea:not(#skin_css):not(#floaty-textarea)";

      rules.push(
        `body, body *, input:not([type="file"])${textareaSelector}, select, button:not(.comment-format button):not(ul.comment-format button) { font-weight: ${siteFontWeight} !important; }`
      );
    }

    if (paragraphFontFamily) {
      const textareaExclusion = expandCodeFontUsage ? ":not(textarea)" : "";

      if (headerFontFamily) {
        rules.push(
          `#workskin:not(h1):not(h2):not(h3):not(h4):not(h5):not(h6),
           #workskin *:not(code):not(pre):not(tt):not(kbd):not(samp):not(var):not(h1):not(h2):not(h3):not(h4):not(h5):not(h6):not(h1 *):not(h2 *):not(h3 *):not(h4 *):not(h5 *):not(h6 *)${textareaExclusion} { font-family: ${paragraphFontFamily} !important; }`
        );
      } else {
        rules.push(
          `#workskin, #workskin *:not(code):not(pre):not(tt):not(kbd):not(samp):not(var)${textareaExclusion} { font-family: ${paragraphFontFamily} !important; }`
        );
      }
    }

    if (headerFontFamily) {
      rules.push(
        `h1, h1 *, h2, h2 *, h3, h3 *, h4, h4 *, h5, h5 *, h6, h6 *, .heading, .heading *,
         #workskin h1, #workskin h1 *, #workskin h2, #workskin h2 *, #workskin h3, #workskin h3 *,
         #workskin h4, #workskin h4 *, #workskin h5, #workskin h5 *, #workskin h6, #workskin h6 * { font-family: ${headerFontFamily} !important; }`
      );
    } else if (paragraphFontFamily) {
      rules.push(
        `#chapters h3.title,
         #chapters h3.byline.heading,
         .chapter .preface h3.title,
         .chapter .preface h3.byline.heading,
         .preface h3.title,
         .preface h3.byline { font-family: ${paragraphFontFamily} !important; }`
      );
    }

    if (headerFontWeight) {
      rules.push(
        `h1, h1 *, h2, h2 *, h3, h3 *, h4, h4 *, h5, h5 *, h6, h6 *, .heading, .heading *,
         #workskin h1, #workskin h1 *, #workskin h2, #workskin h2 *, #workskin h3, #workskin h3 *,
         #workskin h4, #workskin h4 *, #workskin h5, #workskin h5 *, #workskin h6, #workskin h6 * { font-weight: ${headerFontWeight} !important; }`
      );
    }

    const codeRules = [];
    if (codeFontFamily)
      codeRules.push(`font-family: ${codeFontFamily} !important`);
    if (codeFontStyle && codeFontStyle !== "normal")
      codeRules.push(`font-style: ${codeFontStyle} !important`);
    if (codeFontSize) codeRules.push(`font-size: ${codeFontSize} !important`);

    if (codeRules.length > 0) {
      const baseCodeSelectors =
        "code, code *, pre, pre *, tt, tt *, kbd, kbd *, samp, samp *, var, var *, textarea#skin_css, .css.module blockquote pre, #floaty-textarea, #workskin code, #workskin code *, #workskin pre, #workskin pre *, #workskin tt, #workskin tt *, #workskin kbd, #workskin kbd *, #workskin samp, #workskin samp *, #workskin var, #workskin var *";

      const codeSelectors = expandCodeFontUsage
        ? "code, code *, pre, pre *, tt, tt *, kbd, kbd *, samp, samp *, var, var *, textarea, textarea#skin_css, .css.module blockquote pre, #floaty-textarea, #workskin code, #workskin code *, #workskin pre, #workskin pre *, #workskin tt, #workskin tt *, #workskin kbd, #workskin kbd *, #workskin samp, #workskin samp *, #workskin var, #workskin var *, #workskin textarea"
        : baseCodeSelectors;

      rules.push(`${codeSelectors} { ${codeRules.join("; ")}; }`);
    }

    if (codeRules.length === 0) {
      rules.push(
        `code, code *, pre, pre *, tt, tt *, kbd, kbd *, samp, samp *, var, var *, #workskin code, #workskin code *, #workskin pre, #workskin pre *, #workskin tt, #workskin tt *, #workskin kbd, #workskin kbd *, #workskin samp, #workskin samp *, #workskin var, #workskin var * { font-family: monospace !important; }`
      );

      if (expandCodeFontUsage) {
        rules.push(
          `textarea, #workskin textarea { font-family: monospace !important; }`
        );
      }
    }

    rules.push(
      `#workskin .preface .title.heading,
       #workskin .preface .byline.heading,
       #workskin .preface .title,
       #workskin .preface .byline,
       #workskin .title.heading,
       #workskin .byline.heading {
         text-align: center !important;
         direction: ltr !important;
       }`
    );

    rules.push(
      `#workskin pre {
         text-align: left !important;
         direction: ltr !important;
       }`
    );

    rules.push(
      `#cmtFmtDialog #stdbutton label, ul.comment-format, ul.comment-format * { font-family: "FontAwesome", sans-serif !important; font-weight: normal !important; }`,
      `ul.actions.comment-format { text-align: left !important; }`
    );

    cachedElements.siteStyle.textContent = rules.join("\n");
  }

  // --- PARAGRAPH SPACING FIX ---
  const fixParagraphSpacing = (() => {
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

    const ALLOWED_TAGS = [
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
    ];

    return function () {
      if (!WORKS_PAGE_REGEX.test(window.location.href)) return;

      document
        .querySelectorAll(
          "#workskin .userstuff:not([data-formatter-spacing-fixed])"
        )
        .forEach((userstuff) => {
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
    // Safety check: ensure library is loaded
    if (!window.AO3MenuHelpers) {
      console.error("[AO3: Site Wizard] Menu Helpers library not loaded");
      alert(
        "Error: Menu Helpers library not loaded. Please check your userscript manager."
      );
      return;
    }

    window.AO3MenuHelpers.removeAllDialogs();

    const dialog = window.AO3MenuHelpers.createDialog(
      "🪄 Site Wizard Settings 🪄",
      {
        maxWidth: "700px",
      }
    );

    // Site-Wide Display Section
    const siteSection = window.AO3MenuHelpers.createSection(
      "📱 Site-Wide Display"
    );

    const siteFontSize = window.AO3MenuHelpers.createSliderWithValue({
      id: "site-fontsize-input",
      label: "Base Font Size",
      min: 50,
      max: 200,
      step: 5,
      value: FORMATTER_CONFIG.siteFontSizePercent,
      unit: "%",
      tooltip:
        "Adjust the overall text size for the entire site (percentage of browser default)",
    });
    siteSection.appendChild(siteFontSize);

    const siteFontFamily = window.AO3MenuHelpers.createTextInput({
      id: "site-fontfamily-input",
      label: "General Text Font",
      value: FORMATTER_CONFIG.siteFontFamily,
      placeholder: "Figtree, sans-serif",
      tooltip: "Font for most site text",
    });

    const siteFontWeight = window.AO3MenuHelpers.createTextInput({
      id: "site-fontweight-input",
      label: "Font Weight",
      value: FORMATTER_CONFIG.siteFontWeight,
      placeholder: "400, normal",
      tooltip: "Boldness of general text",
    });

    const siteFontRow = window.AO3MenuHelpers.createTwoColumnLayout(
      siteFontFamily,
      siteFontWeight
    );
    siteSection.appendChild(siteFontRow);

    dialog.appendChild(siteSection);

    // Work Formatting Section
    const workSection =
      window.AO3MenuHelpers.createSection("📖 Work Formatting");

    const workWidth = window.AO3MenuHelpers.createSliderWithValue({
      id: "paragraph-width-slider",
      label: "Work Margin Width",
      min: 10,
      max: 100,
      step: 5,
      value: FORMATTER_CONFIG.paragraphWidthPercent,
      unit: "%",
      tooltip: "Maximum width of work reader",
    });
    workSection.appendChild(workWidth);

    const workFontSize = window.AO3MenuHelpers.createSliderWithValue({
      id: "paragraph-fontsize-slider",
      label: "Work Font Size",
      min: 50,
      max: 200,
      step: 5,
      value: FORMATTER_CONFIG.paragraphFontSizePercent,
      unit: "%",
      tooltip: "Size relative to site base size",
    });
    workSection.appendChild(workFontSize);

    const workFont = window.AO3MenuHelpers.createTextInput({
      id: "paragraph-fontfamily-input",
      label: "Work Font",
      value: FORMATTER_CONFIG.paragraphFontFamily,
      placeholder: "Figtree, sans-serif",
      tooltip: "Font family for reader",
    });
    workSection.appendChild(workFont);

    const textAlign = window.AO3MenuHelpers.createSelect({
      id: "paragraph-align-select",
      label: "Text Alignment",
      options: [
        {
          value: "left",
          label: "Left Aligned",
          selected: FORMATTER_CONFIG.paragraphTextAlign === "left",
        },
        {
          value: "justify",
          label: "Justified",
          selected: FORMATTER_CONFIG.paragraphTextAlign === "justify",
        },
        {
          value: "right",
          label: "Right Aligned",
          selected: FORMATTER_CONFIG.paragraphTextAlign === "right",
        },
      ],
      tooltip: "How text is aligned within paragraphs",
    });

    const lineSpacing = window.AO3MenuHelpers.createNumberInput({
      id: "paragraph-gap-input",
      label: "Line Spacing",
      value: FORMATTER_CONFIG.paragraphGap,
      min: 0,
      step: 0.1,
      tooltip:
        "Vertical space between paragraphs (multiplier). Default is 1.286.",
    });

    const alignSpacingRow = window.AO3MenuHelpers.createTwoColumnLayout(
      textAlign,
      lineSpacing
    );
    workSection.appendChild(alignSpacingRow);

    const fixSpacing = window.AO3MenuHelpers.createCheckbox({
      id: "fix-paragraph-spacing-checkbox",
      label: "Fix excessive paragraph spacing",
      checked: FORMATTER_CONFIG.fixParagraphSpacing,
      tooltip: "Remove unnecessary blank space between paragraphs",
    });
    workSection.appendChild(fixSpacing);

    dialog.appendChild(workSection);

    // Element-Specific Fonts Section
    const elementSection = window.AO3MenuHelpers.createSection(
      "🎯 Element-Specific Fonts"
    );

    const headerFont = window.AO3MenuHelpers.createTextInput({
      id: "header-fontfamily-input",
      label: "Header Font",
      value: FORMATTER_CONFIG.headerFontFamily,
      placeholder: "Figtree, sans-serif",
      tooltip: "Font for headings (H1-H6)",
    });

    const headerWeight = window.AO3MenuHelpers.createTextInput({
      id: "header-fontweight-input",
      label: "Header Weight",
      value: FORMATTER_CONFIG.headerFontWeight,
      placeholder: "700, bold",
      tooltip: "Boldness of header text",
    });

    const headerRow = window.AO3MenuHelpers.createTwoColumnLayout(
      headerFont,
      headerWeight
    );
    elementSection.appendChild(headerRow);

    const codeFont = window.AO3MenuHelpers.createTextInput({
      id: "code-fontfamily-input",
      label: "Code/Monospace Font",
      value: FORMATTER_CONFIG.codeFontFamily,
      placeholder: "Victor Mono Medium, monospace",
      tooltip: "Font for code blocks and preformatted text",
    });
    elementSection.appendChild(codeFont);

    const codeFontSize = window.AO3MenuHelpers.createTextInput({
      id: "code-fontsize-input",
      label: "Code Font Size",
      value: FORMATTER_CONFIG.codeFontSize,
      placeholder: "0.9em, 14px",
      tooltip: "Size relative to surrounding text",
    });

    const codeFontStyle = window.AO3MenuHelpers.createSelect({
      id: "code-fontstyle-select",
      label: "Code Font Style",
      options: [
        {
          value: "normal",
          label: "Normal",
          selected:
            !FORMATTER_CONFIG.codeFontStyle ||
            FORMATTER_CONFIG.codeFontStyle === "normal",
        },
        {
          value: "italic",
          label: "Italic",
          selected: FORMATTER_CONFIG.codeFontStyle === "italic",
        },
      ],
      tooltip: "Style for code text",
    });

    const codeRow = window.AO3MenuHelpers.createTwoColumnLayout(
      codeFontSize,
      codeFontStyle
    );
    elementSection.appendChild(codeRow);

    const expandCodeFont = window.AO3MenuHelpers.createCheckbox({
      id: "expand-code-font-checkbox",
      label: "Apply code font to comments",
      checked: FORMATTER_CONFIG.expandCodeFontUsage,
      tooltip:
        "Applies code font to all textareas. Requires a code/monospace font to be specified above.",
    });
    elementSection.appendChild(expandCodeFont);

    dialog.appendChild(elementSection);

    // Buttons
    const buttons = window.AO3MenuHelpers.createButtonGroup([
      { text: "Apply Settings", id: "formatter-save" },
      { text: "Cancel", id: "formatter-cancel" },
    ]);
    dialog.appendChild(buttons);

    // Reset Link
    const resetLink = window.AO3MenuHelpers.createResetLink(
      "Reset to Default Settings",
      () => {
        FORMATTER_CONFIG = { ...DEFAULT_FORMATTER_CONFIG };
        saveFormatterConfig();
        dialog.remove();
        applyParagraphWidth();
      }
    );
    dialog.appendChild(resetLink);

    // Event Handlers
    dialog.querySelector("#formatter-save").addEventListener("click", () => {
      FORMATTER_CONFIG.siteFontSizePercent =
        window.AO3MenuHelpers.getValue("site-fontsize-input") ||
        DEFAULT_FORMATTER_CONFIG.siteFontSizePercent;
      FORMATTER_CONFIG.siteFontFamily =
        window.AO3MenuHelpers.getValue("site-fontfamily-input") || "";
      FORMATTER_CONFIG.siteFontWeight =
        window.AO3MenuHelpers.getValue("site-fontweight-input") || "";
      FORMATTER_CONFIG.paragraphWidthPercent =
        window.AO3MenuHelpers.getValue("paragraph-width-slider") ||
        DEFAULT_FORMATTER_CONFIG.paragraphWidthPercent;
      FORMATTER_CONFIG.paragraphFontSizePercent =
        window.AO3MenuHelpers.getValue("paragraph-fontsize-slider") ||
        DEFAULT_FORMATTER_CONFIG.paragraphFontSizePercent;
      FORMATTER_CONFIG.paragraphTextAlign =
        window.AO3MenuHelpers.getValue("paragraph-align-select") ||
        DEFAULT_FORMATTER_CONFIG.paragraphTextAlign;
      FORMATTER_CONFIG.paragraphFontFamily =
        window.AO3MenuHelpers.getValue("paragraph-fontfamily-input") || "";
      FORMATTER_CONFIG.paragraphGap =
        window.AO3MenuHelpers.getValue("paragraph-gap-input") ||
        DEFAULT_FORMATTER_CONFIG.paragraphGap;
      FORMATTER_CONFIG.fixParagraphSpacing =
        window.AO3MenuHelpers.getValue("fix-paragraph-spacing-checkbox") ??
        false;
      FORMATTER_CONFIG.headerFontFamily =
        window.AO3MenuHelpers.getValue("header-fontfamily-input") || "";
      FORMATTER_CONFIG.headerFontWeight =
        window.AO3MenuHelpers.getValue("header-fontweight-input") || "";
      FORMATTER_CONFIG.codeFontFamily =
        window.AO3MenuHelpers.getValue("code-fontfamily-input") || "";
      FORMATTER_CONFIG.codeFontStyle =
        window.AO3MenuHelpers.getValue("code-fontstyle-select") || "normal";
      FORMATTER_CONFIG.codeFontSize =
        window.AO3MenuHelpers.getValue("code-fontsize-input") || "";
      FORMATTER_CONFIG.expandCodeFontUsage =
        window.AO3MenuHelpers.getValue("expand-code-font-checkbox") ?? false;

      saveFormatterConfig();
      dialog.remove();
      applyParagraphWidth();

      if (FORMATTER_CONFIG.paragraphTextAlign === "right") {
        location.reload();
      }
    });

    dialog.querySelector("#formatter-cancel").addEventListener("click", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);
  }

  // --- SHARED MENU MANAGEMENT ---
  function initSharedMenu() {
    if (window.AO3MenuHelpers) {
      window.AO3MenuHelpers.addToSharedMenu({
        id: "opencfg_site_wizard",
        text: "Site Wizard",
        onClick: showFormatterMenu,
      });
    }
  }

  // --- INITIALIZATION ---
  loadFormatterConfig();
  console.log("[AO3: Site Wizard] loaded.");

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

  function runParagraphSpacingFixIfEnabled() {
    if (
      FORMATTER_CONFIG.fixParagraphSpacing &&
      WORKS_PAGE_REGEX.test(window.location.href)
    ) {
      fixParagraphSpacing();
    }
  }

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
})();
