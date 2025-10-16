// ==UserScript==
// @name         AO3: Menu Helpers Library
// @version      1.0.5
// @description  Shared UI components and styling for AO3 userscripts
// @author       BlackBatCat
// @match        *://archiveofourown.org/*
// @license      MIT
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // Prevent multiple injections
  if (window.AO3MenuHelpers) {
    return;
  }

  // Cache for background color to avoid repeated DOM operations
  let cachedInputBg = null;
  let stylesInjected = false;

  window.AO3MenuHelpers = {
    version: "1.0.5",

    /**
     * Detects AO3's input field background color from current theme
     * Uses caching to avoid repeated DOM operations
     * @returns {string} Background color (hex or rgba format)
     */
    getAO3InputBackground() {
      if (cachedInputBg) return cachedInputBg;

      let inputBg = "#fffaf5"; // Fallback default
      const testInput = document.createElement("input");
      document.body.appendChild(testInput);

      try {
        const computedStyle = window.getComputedStyle(testInput);
        const computedBg = computedStyle.backgroundColor;
        if (
          computedBg &&
          computedBg !== "rgba(0, 0, 0, 0)" &&
          computedBg !== "transparent"
        ) {
          inputBg = computedBg;
        }
      } catch (e) {
        // Failed to detect background color
      } finally {
        testInput.remove();
      }

      cachedInputBg = inputBg;
      return inputBg;
    },

    /**
     * Injects shared CSS styles for all menu components
     * Only injects once per page load, safe to call multiple times
     * Automatically called when library loads
     */
    injectSharedStyles() {
      if (stylesInjected) return;
      if (!document.head) {
        return;
      }

      const existingStyle = document.getElementById("ao3-menu-helpers-styles");
      if (existingStyle) {
        stylesInjected = true;
        return;
      }

      const inputBg = this.getAO3InputBackground();

      const style = document.createElement("style");
      style.id = "ao3-menu-helpers-styles";
      style.textContent = `
            /* Dialog Container */
            .ao3-menu-dialog {
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
              max-width: 600px;
              max-height: 80vh;
              overflow-y: auto;
              font-family: inherit;
              font-size: inherit;
              color: inherit;
              box-sizing: border-box;
            }

            /* Mobile: Full width with minimal padding */
            @media (max-width: 768px) {
              .ao3-menu-dialog {
                width: 100%;
                max-width: 100%;
                height: 100vh;
                max-height: 100vh;
                top: 0;
                left: 0;
                transform: none;
                border-radius: 0;
                padding: 15px;
              }
            }
            
            .ao3-menu-dialog h3 {
              text-align: center;
              margin-top: 0;
              color: inherit;
              font-family: inherit;
            }
            
            /* Settings Sections */
            .ao3-menu-dialog .settings-section {
              background: rgba(0,0,0,0.03);
              border-radius: 6px;
              padding: 15px;
              margin-bottom: 20px;
              border-left: 4px solid currentColor;
            }
            
            .ao3-menu-dialog .section-title {
              margin-top: 0;
              margin-bottom: 15px;
              font-size: 1.2em;
              font-weight: bold;
              color: inherit;
              opacity: 0.85;
              font-family: inherit;
            }
            
            /* Setting Groups */
            .ao3-menu-dialog .setting-group {
              margin-bottom: 15px;
            }
            
            .ao3-menu-dialog .setting-label {
              display: block;
              margin-bottom: 6px;
              font-weight: bold;
              color: inherit;
              opacity: 0.9;
            }
            
            .ao3-menu-dialog .setting-description {
              display: block;
              margin-bottom: 8px;
              font-size: 0.9em;
              color: inherit;
              opacity: 0.6;
              line-height: 1.4;
            }
            
            /* Checkbox and Radio Labels */
            .ao3-menu-dialog .checkbox-label {
              display: block;
              font-weight: normal;
              color: inherit;
              margin-bottom: 8px;
            }
            
            .ao3-menu-dialog .radio-label {
              display: block;
              font-weight: normal;
              color: inherit;
              margin-left: 20px;
              margin-bottom: 8px;
            }
            
            /* Subsettings (indented settings) */
            .ao3-menu-dialog .subsettings {
              padding-left: 20px;
              margin-top: 10px;
            }
            
            /* Layout Helpers */
            .ao3-menu-dialog .two-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            
            .ao3-menu-dialog .setting-group + .two-column {
              margin-top: 15px;
            }
            
            /* Slider with Value Display */
            .ao3-menu-dialog .slider-with-value {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            .ao3-menu-dialog .slider-with-value input[type="range"] {
              flex-grow: 1;
            }
            
            .ao3-menu-dialog .value-display {
              min-width: 40px;
              text-align: center;
              font-weight: bold;
              color: inherit;
              opacity: 0.6;
            }
            
            /* Form Inputs */
            .ao3-menu-dialog input[type="text"],
            .ao3-menu-dialog input[type="number"],
            .ao3-menu-dialog input[type="color"],
            .ao3-menu-dialog select,
            .ao3-menu-dialog textarea {
              width: 100%;
              box-sizing: border-box;
            }
            
            .ao3-menu-dialog textarea {
              min-height: 100px;
              resize: vertical;
              font-family: inherit;
            }
            
            .ao3-menu-dialog input[type="text"]:focus,
            .ao3-menu-dialog input[type="number"]:focus,
            .ao3-menu-dialog input[type="color"]:focus,
            .ao3-menu-dialog select:focus,
            .ao3-menu-dialog textarea:focus {
              background: ${inputBg} !important;
            }
            
            .ao3-menu-dialog input::placeholder,
            .ao3-menu-dialog textarea::placeholder {
              opacity: 0.6 !important;
            }
            
            /* Buttons */
            .ao3-menu-dialog .button-group {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              margin-top: 20px;
            }
            
            .ao3-menu-dialog .button-group button {
              flex: 1;
              padding: 10px;
              color: inherit;
              opacity: 0.9;
            }
            
            /* Reset Link */
            .ao3-menu-dialog .reset-link {
              text-align: center;
              margin-top: 10px;
              color: inherit;
              opacity: 0.7;
            }
            
            /* Tooltips */
            .ao3-menu-dialog .symbol.question {
              font-size: 0.5em;
              vertical-align: middle;
              margin-left: 0.1em;
            }
            
            /* Keyboard key styling */
            .ao3-menu-dialog kbd {
              padding: 2px 6px;
              background: rgba(0,0,0,0.1);
              border-radius: 3px;
              font-family: monospace;
              font-size: 0.9em;
            }
          `;

      document.head.appendChild(style);
      stylesInjected = true;
    },

    /**
     * Creates a dialog/popup container
     * @param {string} title - Dialog title (can include emoji)
     * @param {Object} [options={}] - Optional configuration
     * @param {string} [options.width='90%'] - Dialog width
     * @param {string} [options.maxWidth='600px'] - Maximum dialog width
     * @param {string} [options.maxHeight='80vh'] - Maximum dialog height
     * @param {string} [options.className=''] - Additional CSS classes
     * @returns {HTMLElement} Dialog container element
     */
    createDialog(title, options = {}) {
      // Ensure styles are injected before creating dialog
      this.injectSharedStyles();

      const {
        width = "90%",
        maxWidth = "600px",
        maxHeight = "80vh",
        className = "",
      } = options;

      const dialog = document.createElement("div");
      dialog.className = `ao3-menu-dialog ${className}`.trim();

      if (width !== "90%") dialog.style.width = width;
      if (maxWidth !== "600px") dialog.style.maxWidth = maxWidth;
      if (maxHeight !== "80vh") dialog.style.maxHeight = maxHeight;

      const titleElement = document.createElement("h3");
      titleElement.textContent = title;
      dialog.appendChild(titleElement);

      return dialog;
    },

    /**
     * Creates a settings section with colored border
     * @param {string} title - Section title
     * @param {string|HTMLElement} [content=''] - Section content (HTML string or element)
     * @returns {HTMLElement} Section container
     */
    createSection(title, content = "") {
      const section = document.createElement("div");
      section.className = "settings-section";

      const titleElement = document.createElement("h4");
      titleElement.className = "section-title";
      titleElement.textContent = title;
      section.appendChild(titleElement);

      if (typeof content === "string" && content) {
        section.innerHTML += content;
      } else if (content instanceof HTMLElement) {
        section.appendChild(content);
      }

      return section;
    },

    /**
     * Creates a setting group container
     * @param {string|HTMLElement} content - Group content
     * @returns {HTMLElement} Setting group div
     */
    createSettingGroup(content = "") {
      const group = document.createElement("div");
      group.className = "setting-group";

      if (typeof content === "string" && content) {
        group.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        group.appendChild(content);
      }

      return group;
    },

    /**
     * Creates a tooltip help icon
     * @param {string} text - Tooltip text
     * @returns {HTMLElement} Tooltip span element
     */
    createTooltip(text) {
      if (!text) return document.createTextNode("");

      const tooltip = document.createElement("span");
      tooltip.className = "symbol question";
      tooltip.title = text;

      const questionMark = document.createElement("span");
      questionMark.textContent = "?";
      tooltip.appendChild(questionMark);

      return tooltip;
    },

    /**
     * Creates a label element with optional tooltip
     * @param {string} text - Label text
     * @param {string} [forId=''] - ID of associated input
     * @param {string} [tooltip=''] - Optional tooltip text
     * @param {string} [className='setting-label'] - CSS class name
     * @returns {HTMLElement} Label element
     */
    createLabel(text, forId = "", tooltip = "", className = "setting-label") {
      const label = document.createElement("label");
      label.className = className;
      if (forId) label.setAttribute("for", forId);

      label.textContent = text;

      if (tooltip) {
        label.appendChild(document.createTextNode(" "));
        label.appendChild(this.createTooltip(tooltip));
      }

      return label;
    },

    /**
     * Creates an inline help/description text element
     * @param {string} text - Help text
     * @returns {HTMLElement} Description span element
     */
    createDescription(text) {
      const help = document.createElement("span");
      help.className = "setting-description";
      help.textContent = text;
      return help;
    },

    /**
     * Creates a range slider input
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {number} config.min - Minimum value
     * @param {number} config.max - Maximum value
     * @param {number} config.step - Step increment
     * @param {number} config.value - Initial value
     * @param {string} [config.label=''] - Optional label text
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @returns {HTMLElement} Container with slider (or just slider if no label)
     */
    createSlider(config) {
      const { id, min, max, step, value, label = "", tooltip = "" } = config;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = id;
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;

      if (!label) return slider;

      const container = this.createSettingGroup();
      container.appendChild(this.createLabel(label, id, tooltip));
      container.appendChild(slider);

      return container;
    },

    /**
     * Creates a slider with synchronized value display
     * Automatically updates value display when slider moves
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.label - Label text
     * @param {number} config.min - Minimum value
     * @param {number} config.max - Maximum value
     * @param {number} config.step - Step increment
     * @param {number} config.value - Initial value
     * @param {string} [config.unit=''] - Unit to display (e.g., '%', 'px')
     * @param {string} [config.tooltip=''] - Optional tooltip text
     * @returns {HTMLElement} Container with label, slider, and value display
     */
    createSliderWithValue(config) {
      const {
        id,
        label,
        min,
        max,
        step,
        value,
        unit = "",
        tooltip = "",
      } = config;

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      const sliderContainer = document.createElement("div");
      sliderContainer.className = "slider-with-value";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = id;
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;

      const valueDisplay = document.createElement("span");
      valueDisplay.className = "value-display";

      const valueSpan = document.createElement("span");
      valueSpan.id = `${id}-value`;
      valueSpan.textContent = value;
      valueDisplay.appendChild(valueSpan);

      if (unit) {
        valueDisplay.appendChild(document.createTextNode(unit));
      }

      // Auto-update value display when slider moves
      slider.addEventListener("input", (e) => {
        valueSpan.textContent = e.target.value;
      });

      sliderContainer.appendChild(slider);
      sliderContainer.appendChild(valueDisplay);
      group.appendChild(sliderContainer);

      return group;
    },

    /**
     * Creates a text input field
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.label - Label text
     * @param {string} [config.value=''] - Initial value
     * @param {string} [config.placeholder=''] - Placeholder text
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @returns {HTMLElement} Container with label and input
     */
    createTextInput(config) {
      const { id, label, value = "", placeholder = "", tooltip = "" } = config;

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      const input = document.createElement("input");
      input.type = "text";
      input.id = id;
      input.value = value;
      if (placeholder) input.placeholder = placeholder;

      group.appendChild(input);
      return group;
    },

    /**
     * Creates a number input field
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.label - Label text
     * @param {number|string} [config.value=''] - Initial value
     * @param {number} [config.min] - Minimum value
     * @param {number} [config.max] - Maximum value
     * @param {number} [config.step=1] - Step increment
     * @param {string} [config.placeholder=''] - Placeholder text
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @returns {HTMLElement} Container with label and input
     */
    createNumberInput(config) {
      const {
        id,
        label,
        value = "",
        min,
        max,
        step = 1,
        placeholder = "",
        tooltip = "",
      } = config;

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      const input = document.createElement("input");
      input.type = "number";
      input.id = id;
      if (value !== "" && value !== null && value !== undefined) {
        input.value = value;
      }
      input.step = step;
      if (min !== undefined) input.min = min;
      if (max !== undefined) input.max = max;
      if (placeholder) input.placeholder = placeholder;

      group.appendChild(input);
      return group;
    },

    /**
     * Creates a textarea input field
     * @param {Object} config - Configuration object
     * @param {string} config.id - Textarea ID
     * @param {string} config.label - Label text
     * @param {string} [config.value=''] - Initial value
     * @param {string} [config.placeholder=''] - Placeholder text
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @param {string} [config.description=''] - Optional description text below label
     * @param {string} [config.rows='4'] - Number of visible rows
     * @param {string} [config.minHeight='100px'] - Minimum height
     * @returns {HTMLElement} Container with label, optional description, and textarea
     */
    createTextarea(config) {
      const {
        id,
        label,
        value = "",
        placeholder = "",
        tooltip = "",
        description = "",
        rows = "4",
        minHeight = "100px",
      } = config;

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      // Add description if provided
      if (description) {
        group.appendChild(this.createDescription(description));
      }

      const textarea = document.createElement("textarea");
      textarea.id = id;
      textarea.value = value;
      textarea.rows = rows;
      textarea.style.minHeight = minHeight;
      textarea.style.resize = "vertical";
      if (placeholder) textarea.placeholder = placeholder;

      group.appendChild(textarea);
      return group;
    },

    /**
     * Creates a checkbox input
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.label - Label text
     * @param {boolean} [config.checked=false] - Initial checked state
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @param {boolean} [config.inGroup=true] - Wrap in setting-group div
     * @returns {HTMLElement} Label element (or container if inGroup=true)
     */
    createCheckbox(config) {
      const {
        id,
        label,
        checked = false,
        tooltip = "",
        inGroup = true,
      } = config;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = id;
      checkbox.checked = checked;

      const labelElement = document.createElement("label");
      labelElement.className = "checkbox-label";
      labelElement.appendChild(checkbox);
      labelElement.appendChild(document.createTextNode(" " + label));

      if (tooltip) {
        labelElement.appendChild(document.createTextNode(" "));
        labelElement.appendChild(this.createTooltip(tooltip));
      }

      if (!inGroup) return labelElement;

      const group = this.createSettingGroup();
      group.appendChild(labelElement);
      return group;
    },

    /**
     * Creates a checkbox with conditional subsettings that show/hide
     * Common pattern: checkbox that reveals additional options when checked
     * @param {Object} config - Configuration object
     * @param {string} config.id - Checkbox ID
     * @param {string} config.label - Checkbox label
     * @param {boolean} [config.checked=false] - Initial checked state
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @param {HTMLElement|Array<HTMLElement>} config.subsettings - Elements to show/hide
     * @returns {HTMLElement} Container with checkbox and conditional subsettings
     */
    createConditionalCheckbox(config) {
      const { id, label, checked = false, tooltip = "", subsettings } = config;

      const container = this.createSettingGroup();

      // Create checkbox
      const checkboxLabel = this.createCheckbox({
        id,
        label,
        checked,
        tooltip,
        inGroup: false,
      });
      container.appendChild(checkboxLabel);

      // Create subsettings container
      const subsettingsContainer = this.createSubsettings();
      subsettingsContainer.style.display = checked ? "" : "none";

      // Add subsettings content
      if (Array.isArray(subsettings)) {
        subsettings.forEach((element) => {
          if (element instanceof HTMLElement) {
            subsettingsContainer.appendChild(element);
          }
        });
      } else if (subsettings instanceof HTMLElement) {
        subsettingsContainer.appendChild(subsettings);
      }

      container.appendChild(subsettingsContainer);

      // Auto-toggle visibility using getElementById (more robust than querySelector)
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          subsettingsContainer.style.display = e.target.checked ? "" : "none";
        });
      }

      return container;
    },

    /**
     * Creates a radio button group
     * @param {Object} config - Configuration object
     * @param {string} config.name - Radio group name (all radios share this)
     * @param {string} config.label - Group label text
     * @param {Array<{value: string, label: string, checked?: boolean}>} config.options - Radio options
     * @param {string} [config.tooltip=''] - Optional tooltip for group label
     * @returns {HTMLElement} Container with label and radio buttons
     */
    createRadioGroup(config) {
      const { name, label, options, tooltip = "" } = config;

      if (!options || !Array.isArray(options)) {
        return this.createSettingGroup();
      }

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, "", tooltip));

      options.forEach((option) => {
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = name;
        radio.value = option.value;
        radio.id = `${name}-${option.value}`;
        if (option.checked) radio.checked = true;

        const radioLabel = document.createElement("label");
        radioLabel.className = "radio-label";
        radioLabel.appendChild(radio);
        radioLabel.appendChild(document.createTextNode(" " + option.label));

        group.appendChild(radioLabel);
      });

      return group;
    },

    /**
     * Creates a select dropdown
     * @param {Object} config - Configuration object
     * @param {string} config.id - Select ID
     * @param {string} config.label - Label text
     * @param {Array<{value: string, label: string, selected?: boolean}>} config.options - Select options
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @returns {HTMLElement} Container with label and select
     */
    createSelect(config) {
      const { id, label, options, tooltip = "" } = config;

      if (!options || !Array.isArray(options)) {
        return this.createSettingGroup();
      }

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      const select = document.createElement("select");
      select.id = id;

      options.forEach((option) => {
        const optionElement = document.createElement("option");
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        if (option.selected) optionElement.selected = true;
        select.appendChild(optionElement);
      });

      group.appendChild(select);
      return group;
    },

    /**
     * Creates a color picker input
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.label - Label text
     * @param {string} [config.value='#000000'] - Initial color value
     * @param {string} [config.tooltip=''] - Optional tooltip
     * @returns {HTMLElement} Container with label and color input
     */
    createColorPicker(config) {
      const { id, label, value = "#000000", tooltip = "" } = config;

      const group = this.createSettingGroup();
      group.appendChild(this.createLabel(label, id, tooltip));

      const input = document.createElement("input");
      input.type = "color";
      input.id = id;
      input.value = value;

      group.appendChild(input);
      return group;
    },

    /**
     * Creates a two-column layout
     * @param {HTMLElement} leftContent - Left column content
     * @param {HTMLElement} rightContent - Right column content
     * @returns {HTMLElement} Two-column container
     */
    createTwoColumnLayout(leftContent, rightContent) {
      const container = document.createElement("div");
      container.className = "two-column";

      if (leftContent instanceof HTMLElement) {
        container.appendChild(leftContent);
      }
      if (rightContent instanceof HTMLElement) {
        container.appendChild(rightContent);
      }

      return container;
    },

    /**
     * Creates a subsettings container (indented settings)
     * @param {HTMLElement|string} [content=''] - Content to place inside
     * @returns {HTMLElement} Subsettings div
     */
    createSubsettings(content = "") {
      const subsettings = document.createElement("div");
      subsettings.className = "subsettings";

      if (typeof content === "string" && content) {
        subsettings.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        subsettings.appendChild(content);
      }

      return subsettings;
    },

    /**
     * Creates a button group (typically for Save/Cancel)
     * @param {Array<{text: string, id: string, primary?: boolean, onClick?: function}>} buttons - Button configurations
     * @returns {HTMLElement} Button group container
     */
    createButtonGroup(buttons) {
      if (!buttons || !Array.isArray(buttons)) {
        return document.createElement("div");
      }

      const group = document.createElement("div");
      group.className = "button-group";

      buttons.forEach((btnConfig) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = btnConfig.text;
        if (btnConfig.id) button.id = btnConfig.id;
        if (btnConfig.primary) button.classList.add("primary");
        if (btnConfig.onClick)
          button.addEventListener("click", btnConfig.onClick);

        group.appendChild(button);
      });

      return group;
    },

    /**
     * Creates a reset link
     * @param {string} text - Link text
     * @param {function} onResetCallback - Function to call when clicked
     * @returns {HTMLElement} Reset link container
     */
    createResetLink(text, onResetCallback) {
      const container = document.createElement("div");
      container.className = "reset-link";

      const link = document.createElement("a");
      link.href = "#";
      link.textContent = text;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof onResetCallback === "function") {
          onResetCallback();
        }
      });

      container.appendChild(link);
      return container;
    },

    /**
     * Creates a keyboard key visual element
     * @param {string} keyText - Text to display (e.g., 'Alt', 'Ctrl')
     * @returns {HTMLElement} Styled kbd element
     */
    createKeyboardKey(keyText) {
      const kbd = document.createElement("kbd");
      kbd.textContent = keyText;
      return kbd;
    },

    /**
     * Creates an info/tip box with border and background
     * @param {string|HTMLElement} content - HTML content, text, or element
     * @param {Object} [options={}] - Optional styling
     * @param {string} [options.icon='💡'] - Icon to display
     * @param {string} [options.title=''] - Optional title
     * @returns {HTMLElement} Styled info box
     */
    createInfoBox(content, options = {}) {
      const { icon = "💡", title = "" } = options;

      const box = document.createElement("div");
      box.style.cssText = `
            padding: 12px;
            margin: 15px 0;
            background: rgba(0,0,0,0.03);
            border-radius: 6px;
            border-left: 4px solid currentColor;
          `;

      const p = document.createElement("p");
      p.style.cssText = "margin: 0; font-size: 0.9em; opacity: 0.8;";

      let html = "";
      if (title) {
        html += `<strong>${icon} ${title}:</strong> `;
      } else if (icon) {
        html += `${icon} `;
      }

      if (typeof content === "string") {
        p.innerHTML = html + content;
      } else if (content instanceof HTMLElement) {
        if (html) {
          const span = document.createElement("span");
          span.innerHTML = html;
          p.appendChild(span);
        }
        p.appendChild(content);
      } else {
        p.innerHTML = html + String(content);
      }

      box.appendChild(p);
      return box;
    },

    /**
     * Creates a file input button with custom styling
     * @param {Object} config - Configuration object
     * @param {string} config.id - Input ID
     * @param {string} config.buttonText - Button text
     * @param {string} [config.accept=''] - File accept attribute
     * @param {function} [config.onChange] - Change event handler (receives file as parameter)
     * @returns {Object} Object with {button, input} elements
     */
    createFileInput(config) {
      const { id, buttonText, accept = "", onChange } = config;

      const input = document.createElement("input");
      input.type = "file";
      input.id = id;
      input.style.display = "none";
      if (accept) input.accept = accept;

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = buttonText;
      button.addEventListener("click", () => {
        input.value = "";
        input.click();
      });

      if (onChange) {
        input.addEventListener("change", (e) => {
          const file = e.target.files && e.target.files[0];
          if (file) onChange(file);
        });
      }

      return { button, input };
    },

    /**
     * Creates a horizontal layout container
     * @param {Array<HTMLElement>} elements - Elements to place horizontally
     * @param {Object} [options={}] - Layout options
     * @param {string} [options.gap='8px'] - Gap between elements
     * @param {string} [options.justifyContent='flex-start'] - Flex justify-content
     * @param {string} [options.alignItems='center'] - Flex align-items
     * @returns {HTMLElement} Horizontal layout container
     */
    createHorizontalLayout(elements, options = {}) {
      const {
        gap = "8px",
        justifyContent = "flex-start",
        alignItems = "center",
      } = options;

      const container = document.createElement("div");
      container.style.cssText = `
            display: flex;
            gap: ${gap};
            justify-content: ${justifyContent};
            align-items: ${alignItems};
            flex-wrap: wrap;
          `;

      if (Array.isArray(elements)) {
        elements.forEach((el) => {
          if (el instanceof HTMLElement) {
            container.appendChild(el);
          }
        });
      }

      return container;
    },

    /**
     * Removes all dialogs with .ao3-menu-dialog class from the page
     */
    removeAllDialogs() {
      document.querySelectorAll(".ao3-menu-dialog").forEach((dialog) => {
        dialog.remove();
      });
    },

    /**
     * Helper to get value from an input by ID
     * Returns appropriate type based on input type
     * @param {string} id - Input element ID
     * @returns {string|number|boolean|null} Input value or null if not found
     */
    getValue(id) {
      const element = document.getElementById(id);
      if (!element) return null;

      if (element.type === "checkbox") {
        return element.checked;
      } else if (element.type === "number" || element.type === "range") {
        const val = parseFloat(element.value);
        return isNaN(val) ? null : val;
      } else if (element.type === "radio") {
        const name = element.name || "";
        // Use getElementById with checked property instead of querySelector for safety
        const radios = document.querySelectorAll(
          `input[type="radio"][name="${name}"]`
        );
        for (const radio of radios) {
          if (radio.checked) return radio.value;
        }
        return null;
      }

      return element.value;
    },

    /**
     * Helper to set value of an input by ID
     * Handles different input types appropriately
     * @param {string} id - Input element ID
     * @param {*} value - Value to set
     * @returns {boolean} True if successful, false otherwise
     */
    setValue(id, value) {
      const element = document.getElementById(id);
      if (!element) return false;

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else if (element.type === "radio") {
        const radio = document.querySelector(
          `input[name="${element.name}"][value="${value}"]`
        );
        if (radio) radio.checked = true;
      } else {
        element.value = value;
      }

      // Trigger change/input events
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));

      return true;
    },

    /**
     * Creates a clickable list item (for menus/selection lists)
     * @param {Object} config - Configuration object
     * @param {string} config.text - Item text
     * @param {function} config.onClick - Click handler
     * @param {string} [config.dataAttribute=''] - Data attribute name (e.g., 'data-id')
     * @param {string} [config.dataValue=''] - Data attribute value
     * @param {string} [config.icon=''] - Optional icon/emoji to display
     * @param {string} [config.badge=''] - Optional badge text
     * @param {Object} [config.badgeStyles={}] - Custom badge styling
     * @returns {HTMLElement} Styled list item
     */
    createListItem(config) {
      const {
        text,
        onClick,
        dataAttribute = "",
        dataValue = "",
        icon = "",
        badge = "",
        badgeStyles = {},
      } = config;

      const item = document.createElement("div");
      item.className = "menu-list-item";
      item.style.cssText = `
            padding: 12px;
            margin: 8px 0;
            background: rgba(0,0,0,0.03);
            border: 1px solid rgba(0,0,0,0.2);
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.2s;
            color: inherit;
          `;

      if (dataAttribute && dataValue) {
        item.setAttribute(dataAttribute, dataValue);
      }

      const contentDiv = document.createElement("div");
      contentDiv.style.cssText = "display: flex; align-items: center; flex: 1;";

      const textSpan = document.createElement("span");
      textSpan.textContent = text;
      contentDiv.appendChild(textSpan);

      // Add badge if provided
      if (badge) {
        const badgeElement = document.createElement("span");
        badgeElement.className = "item-badge";
        badgeElement.textContent = badge;

        const defaultBadgeStyles = {
          marginLeft: "8px",
          whiteSpace: "nowrap",
          display: "inline-block",
          padding: "2px 6px",
          fontSize: "0.75em",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "#bbb",
          borderRadius: "3px",
        };

        const finalStyles = { ...defaultBadgeStyles, ...badgeStyles };
        badgeElement.style.cssText = Object.entries(finalStyles)
          .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            return `${cssKey}: ${value}`;
          })
          .join("; ");

        contentDiv.appendChild(badgeElement);
      }

      item.appendChild(contentDiv);

      // Add icon section if provided
      if (icon) {
        const iconDiv = document.createElement("div");
        iconDiv.style.cssText = "display: flex; align-items: center; gap: 8px;";
        iconDiv.innerHTML = icon;
        item.appendChild(iconDiv);
      }

      item.addEventListener("click", onClick);

      return item;
    },

    /**
     * Creates a dialog header with title and action icons
     * @param {Object} config - Configuration object
     * @param {string} config.title - Dialog title (can include emoji)
     * @param {Array<{icon: string, title: string, onClick: function, id?: string}>} [config.actions=[]] - Action buttons
     * @param {boolean} [config.includeCloseButton=true] - Whether to include X close button
     * @returns {HTMLElement} Header container with title and icons
     */
    createDialogHeader(config) {
      const { title, actions = [], includeCloseButton = true } = config;

      const header = document.createElement("div");
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        flex-shrink: 0;
      `;

      const titleElement = document.createElement("h3");
      titleElement.style.cssText = "margin: 0; color: inherit;";
      titleElement.textContent = title;
      header.appendChild(titleElement);

      const actionsContainer = document.createElement("div");
      actionsContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
      `;

      // Add custom action buttons
      actions.forEach((action) => {
        const button = document.createElement("button");
        if (action.id) button.id = action.id;
        button.title = action.title;
        button.className = "icon-button";
        button.style.cssText = `
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          display: flex;
          align-items: center;
          padding: 0;
          opacity: 0.7;
          transition: opacity 0.2s;
        `;
        button.innerHTML = action.icon;
        button.addEventListener("click", action.onClick);
        actionsContainer.appendChild(button);
      });

      // Add close button
      if (includeCloseButton) {
        const closeBtn = document.createElement("button");
        closeBtn.id = "dialog-close-btn";
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 1.5em;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          color: inherit;
        `;
        closeBtn.innerHTML = "&times;";
        actionsContainer.appendChild(closeBtn);
      }

      header.appendChild(actionsContainer);
      return header;
    },

    /**
     * Creates a scrollable content area for dialogs
     * @param {HTMLElement|string} content - Content to place inside
     * @param {Object} [options={}] - Optional styling
     * @param {string} [options.maxHeight=''] - Maximum height (e.g., '400px')
     * @param {string} [options.flex='1 1 0%'] - Flex properties
     * @returns {HTMLElement} Scrollable container
     */
    createScrollableContent(content, options = {}) {
      const { maxHeight = "", flex = "1 1 0%" } = options;

      const container = document.createElement("div");
      container.style.cssText = `
        overflow-y: auto;
        flex: ${flex};
        box-sizing: border-box;
      `;

      if (maxHeight) {
        container.style.maxHeight = maxHeight;
      }

      if (typeof content === "string") {
        container.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        container.appendChild(content);
      }

      return container;
    },

    /**
     * Creates a fixed-height dialog with header and scrollable content
     * Common pattern for list/menu dialogs
     * @param {Object} config - Configuration object
     * @param {string} config.title - Dialog title
     * @param {HTMLElement|string} config.content - Scrollable content
     * @param {Array} [config.headerActions=[]] - Header action buttons
     * @param {string} [config.height='450px'] - Dialog height
     * @param {string} [config.width='90%'] - Dialog width
     * @param {string} [config.maxWidth='500px'] - Maximum width
     * @returns {HTMLElement} Complete dialog element
     */
    createFixedHeightDialog(config) {
      const {
        title,
        content,
        headerActions = [],
        height = "450px",
        width = "90%",
        maxWidth = "500px",
      } = config;

      this.injectSharedStyles();
      const inputBg = this.getAO3InputBackground();

      const dialog = document.createElement("div");
      dialog.className = "ao3-menu-dialog";
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
            width: ${width};
            max-width: ${maxWidth};
            height: ${height};
            display: flex;
            flex-direction: column;
            overflow: hidden;
            font-family: inherit;
            font-size: inherit;
            color: inherit;
          `;

      // Create header
      const header = this.createDialogHeader({
        title,
        actions: headerActions,
        includeCloseButton: true,
      });
      dialog.appendChild(header);

      // Create scrollable content
      const scrollable = this.createScrollableContent(content);
      dialog.appendChild(scrollable);

      // Add close functionality
      const closeBtn = dialog.querySelector("#dialog-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => dialog.remove());
      }

      // Close on background click
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog) dialog.remove();
      });

      return dialog;
    },

    /**
     * Injects additional styles for list items and icon buttons
     * Called automatically by createFixedHeightDialog
     * Safe to call multiple times
     */
    injectListItemStyles() {
      if (document.getElementById("ao3-list-item-styles")) return;

      const style = document.createElement("style");
      style.id = "ao3-list-item-styles";
      style.textContent = `
            .menu-list-item:hover {
              background: rgba(0,0,0,0.08) !important;
            }
            
            .ao3-menu-dialog a:hover {
              border-bottom: none !important;
              text-decoration: none !important;
              transform: none !important;
            }
            
            .ao3-menu-dialog .icon-button {
              transform: none !important;
            }
            
            .icon-button:hover {
              opacity: 1 !important;
              transform: none !important;
            }
            
            .item-badge {
              margin-left: 8px;
              white-space: nowrap;
              display: inline-block;
            }
          `;

      document.head.appendChild(style);
    },

    /**
     * Samples styling from an existing AO3 element class
     * Useful for matching theme styles (e.g., .unread, .replied)
     * @param {string} selector - CSS selector for element to sample
     * @param {Array<string>} properties - CSS properties to extract
     * @returns {Object} Object with CSS property:value pairs
     */
    sampleElementStyles(selector, properties) {
      const element = document.querySelector(selector);
      if (!element) return {};

      const computed = window.getComputedStyle(element);
      const styles = {};

      properties.forEach((prop) => {
        const value = computed[prop];
        if (
          value &&
          value !== "none" &&
          value !== "0px" &&
          value !== "rgba(0, 0, 0, 0)" &&
          value !== "transparent"
        ) {
          styles[prop] = value;
        }
      });

      return styles;
    },

    /**
     * Creates a checkmark icon (using AO3's .replied style if available)
     * @param {Object} [options={}] - Optional configuration
     * @param {string} [options.title='active'] - Title attribute
     * @param {boolean} [options.useRepliedClass=true] - Use AO3's .replied class styling
     * @returns {HTMLElement} Checkmark span element
     */
    createCheckmarkIcon(options = {}) {
      const { title = "active", useRepliedClass = true } = options;

      const checkmark = document.createElement("span");
      checkmark.title = title;
      checkmark.textContent = "✓";

      if (useRepliedClass) {
        checkmark.className = "replied";
        checkmark.style.cssText = `
              border: none !important;
              background: none !important;
              font-size: 1em;
              vertical-align: middle;
              padding: 0;
            `;
      } else {
        checkmark.style.cssText = `
              font-size: 1em;
              vertical-align: middle;
              color: inherit;
              opacity: 0.7;
            `;
      }

      return checkmark;
    },

    /**
     * Creates an SVG icon for edit button
     * @returns {string} SVG markup for edit icon
     */
    getEditIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    },

    /**
     * Creates an SVG icon for home button
     * @returns {string} SVG markup for home icon
     */
    getHomeIconSVG() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
    },

    /**
     * Detects border styling from current theme
     * Samples from inputs, buttons, or specified elements
     * @param {Array<string>} [selectors=[]] - Custom selectors to check
     * @returns {Object} Object with borderRadius and borderColor
     */
    detectBorderStyling(selectors = []) {
      let borderRadius = "8px";
      let borderColor = "rgba(0,0,0,0.2)";

      const defaultSelectors = ["input", "button", ".actions a"];

      const elementsToCheck = [...selectors, ...defaultSelectors]
        .map((sel) => document.querySelector(sel))
        .filter((el) => el !== null);

      for (const elem of elementsToCheck) {
        const computed = window.getComputedStyle(elem);

        if (computed.borderRadius && computed.borderRadius !== "0px") {
          borderRadius = computed.borderRadius;
        }

        if (
          computed.borderColor &&
          computed.borderColor !== "rgba(0, 0, 0, 0)"
        ) {
          borderColor = computed.borderColor;
        }

        if (borderRadius !== "8px" && borderColor !== "rgba(0,0,0,0.2)") {
          break;
        }
      }

      return { borderRadius, borderColor };
    },

    /**
     * Adds an item to the shared Userscripts dropdown menu
     * Creates the dropdown if it doesn't exist
     * @param {Object} config - Configuration object
     * @param {string} config.id - Menu item link ID
     * @param {string} config.text - Menu item text
     * @param {function} config.onClick - Click handler
     * @param {string} [config.position='append'] - 'append' or 'prepend' to control order
     * @param {string} [config.menuTitle='Userscripts'] - Dropdown menu title
     * @returns {boolean} True if successful, false otherwise
     */
    addToSharedMenu(config) {
      const {
        id,
        text,
        onClick,
        position = "append",
        menuTitle = "Userscripts",
      } = config;

      if (!id || !text || typeof onClick !== "function") {
        console.error(
          "[AO3: Menu Helpers] addToSharedMenu: id, text, and onClick are required"
        );
        return false;
      }

      // Create menu container if needed
      let menuContainer = document.getElementById("scriptconfig");
      if (!menuContainer) {
        const headerMenu = document.querySelector(
          "ul.primary.navigation.actions"
        );
        const searchItem = headerMenu?.querySelector("li.search");
        if (!headerMenu || !searchItem) {
          console.warn(
            "[AO3: Menu Helpers] Could not find header menu to add userscripts dropdown"
          );
          return false;
        }

        menuContainer = document.createElement("li");
        menuContainer.className = "dropdown";
        menuContainer.id = "scriptconfig";
        menuContainer.innerHTML = `<a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">${menuTitle}</a><ul class="menu dropdown-menu"></ul>`;
        headerMenu.insertBefore(menuContainer, searchItem);
      }

      // Add menu item if it doesn't already exist
      const menu = menuContainer.querySelector(".dropdown-menu");
      if (menu && !menu.querySelector(`#${id}`)) {
        const menuItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = "javascript:void(0);";
        link.id = id;
        link.textContent = text;
        link.addEventListener("click", onClick);
        menuItem.appendChild(link);

        if (position === "prepend") {
          menu.insertBefore(menuItem, menu.firstChild);
        } else {
          menu.appendChild(menuItem);
        }

        return true;
      }

      return false;
    },
  };

  console.log(
    "[AO3: Menu Helpers] Library loaded, version",
    window.AO3MenuHelpers.version
  );
})();
