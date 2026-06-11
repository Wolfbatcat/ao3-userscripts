// ==UserScript==
// @name         AO3: Menu Helpers Library
// @version      2.2.0
// @description  Shared UI components and styling for AO3 userscripts
// @author       BlackBatCat
// @match        *://archiveofourown.org/*
// @license      MIT
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    "use strict";

    const html = (strings, ...values) =>
        strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");

    const VERSION = "2.2.0";

    // Prevent multiple injections - but always replace old versions without version property
    if (window.AO3MenuHelpers) {
        // Remove stale injected style so re-inject picks up latest CSS
        const stale = document.getElementById("ao3-menu-helpers-styles");
        if (stale) stale.remove();
        const staleList = document.getElementById("ao3-list-item-styles");
        if (staleList) staleList.remove();

        if (!window.AO3MenuHelpers.version) {
            console.log("[AO3: Menu Helpers] Replacing old library version with", VERSION);
        } else {
            function compareVersions(a, b) {
                const partsA = a.split(".").map(Number);
                const partsB = b.split(".").map(Number);

                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    const partA = partsA[i] || 0;
                    const partB = partsB[i] || 0;

                    if (partA > partB) return 1;
                    if (partA < partB) return -1;
                }

                return 0;
            }

            const currentVersion = window.AO3MenuHelpers.version;

            if (compareVersions(VERSION, currentVersion) <= 0) {
                // This version is older or equal - skip silently
                return;
            } else {
                console.log(
                    "[AO3: Menu Helpers] Replacing version",
                    currentVersion,
                    "with newer version",
                    VERSION,
                );
            }
        }
    }

    let stylesInjected = false;

    // Excludes #000 and #fff since skins legitimately use those
    const AO3_DEFAULT_RGB = new Set([
        "rgb(221,221,221)",
        "rgb(221, 221, 221)", // #ddd — listbox bg
        "rgb(240,240,240)",
        "rgb(240, 240, 240)", // #f0f0f0 — alternate row
        "rgb(249,249,249)",
        "rgb(249, 249, 249)", // #f9f9f9 — fieldset bg
        "rgb(238,238,238)",
        "rgb(238, 238, 238)", // #eee
    ]);

    // ============================================================
    // FALLBACK PALETTES
    // ============================================================

    const FALLBACK_PALETTES = {
        light: {
            // Rosé Pine Dawn
            dialog: {
                backgroundColor: "#fffaf5",
                borderColor: "#e4d1c9",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "none",
            },
            fieldset: {
                backgroundColor: "#fffaf5",
                borderColor: "#e4d1c9",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "0 2px 8px 0 #c8b6ad33, 0 1.5px 0 0 #e7d3cb80",
            },
            input: {
                backgroundColor: "#fffaf5",
                borderColor: "#e4d1c9",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#575279",
                padding: "0.25em 0.5em",
            },
            button: {
                backgroundColor: "#fffaf5",
                borderColor: "#D7BFB6",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#575279",
                boxShadow: "0 2px 6px 0 #c8b6ad33, 0 1.5px 0 0 #e7d3cb80",
            },
            buttonHover: {
                backgroundColor: "linear-gradient(to bottom right, #EA9A97, #eb6f92)",
                borderColor: "#00000005",
                color: "#ffffff",
            },
            buttonActive: {
                backgroundColor: "#c75080",
                borderColor: "#00000010",
                color: "#ffffff",
            },
            control: {
                backgroundColor: "#fffaf5",
                borderColor: "#e4d1c9",
                borderRadius: "0.75rem",
                checkedColor: "#eb6f92",
                checkmarkColor: "#ffffff",
                hoverBorderColor: "#eb6f92",
                disabledColor: "#e7d3cb",
                focusColor: "#eb6f92",
                radioCheckedColor: "#fffaf5",
            },
            tooltip: {
                backgroundColor: "#575279",
                borderColor: "#443e6b",
                color: "#fffaf5",
                shadow: "0 1.5px 4px 0 #c8b6ad22, 0 1px 0 0 #e7d3cb40",
            },
            scrollbar: {
                trackColor: "#fffaf5",
                thumbColor: "#D7BFB6",
                thumbHoverColor: "#eb6f92",
            },
            blurb: {
                backgroundColor: "#fffaf5",
                borderColor: "#e4d1c9",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "0 2px 8px 0 #c8b6ad33, 0 1.5px 0 0 #e7d3cb80",
                padding: "0.75em",
            },
            badge: {
                backgroundColor: "#fceaf3",
                borderColor: "#eb6f92",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#eb6f92",
                fontFamily: "inherit",
                padding: "0.25em 0.75em",
                fontWeight: "inherit",
                opacity: "1",
                boxShadow: "none",
            },
            textColor: "#575279",
            linkColor: "#eb6f92",
            linkHoverColor: "#eb6f92",
            linkVisitedColor: "#3e8fb0",
            headingBorderColor: "#D7BFB6",
        },
        dark: {
            // Rosé Pine Moon
            dialog: {
                backgroundColor: "#2a273f",
                borderColor: "#3f3857",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "none",
            },
            fieldset: {
                backgroundColor: "#2a273f",
                borderColor: "#3f3857",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "0 3px 10px 0 rgba(35,33,54,0.28), 0 2px 0 0 rgba(35,33,54,0.17)",
            },
            input: {
                backgroundColor: "#28253c",
                borderColor: "#3f3857",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#e0def4",
                padding: "0.25em 0.5em",
            },
            button: {
                backgroundColor: "#2e2c44",
                borderColor: "#463e61",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#e0def4",
                boxShadow: "0 3px 8px 0 rgba(35,33,54,0.33), 0 2px 0 0 rgba(100,90,120,0.15)",
            },
            buttonHover: {
                backgroundColor:
                    "linear-gradient(to bottom right, #ebbcba 0%, #ea9a97 33%, #eb6f92 100%)",
                borderColor: "#00000020",
                color: "#ffffff",
            },
            buttonActive: {
                backgroundColor: "#c75080",
                borderColor: "#00000030",
                color: "#ffffff",
            },
            control: {
                backgroundColor: "#2a273f",
                borderColor: "#3f3857",
                borderRadius: "0.75rem",
                checkedColor: "#eb6f92",
                checkmarkColor: "#ffffff",
                hoverBorderColor: "#eb6f92",
                disabledColor: "#36324e",
                focusColor: "#eb6f92",
                radioCheckedColor: "#2a273f",
            },
            blurb: {
                backgroundColor: "#2a273f",
                borderColor: "#3f3857",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                boxShadow: "0 3px 10px 0 rgba(35,33,54,0.28), 0 2px 0 0 rgba(35,33,54,0.17)",
                padding: "0.75em",
            },
            badge: {
                backgroundColor: "#2a1820",
                borderColor: "#eb6f92",
                borderWidth: "1px",
                borderRadius: "0.75rem",
                color: "#eb6f92",
                fontFamily: "inherit",
                padding: "0.25em 0.75em",
                fontWeight: "inherit",
                opacity: "1",
                boxShadow: "none",
            },
            tooltip: {
                backgroundColor: "#e0def4",
                borderColor: "#3f3857",
                color: "#232136",
                shadow: "0 3px 10px 0 rgba(35,33,54,0.28), 0 2px 0 0 rgba(35,33,54,0.17)",
            },
            scrollbar: {
                trackColor: "#2a273f",
                thumbColor: "#463e61",
                thumbHoverColor: "#eb6f92",
            },
            textColor: "#e0def4",
            linkColor: "#eb6f92",
            linkHoverColor: "#eb6f92",
            linkVisitedColor: "#9ccfd8",
            headingBorderColor: "#463e61",
        },
    };

    // ============================================================
    // THEME DETECTION SYSTEM
    // ============================================================

    const ThemeDetector = {
        cache: {},
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
        ),

        _isTransparent(color) {
            return (
                !color ||
                color === "rgba(0, 0, 0, 0)" ||
                color === "transparent" ||
                color === "rgba(0,0,0,0)"
            );
        },

        _isSkinStyled(styles) {
            return (
                styles &&
                !this._isTransparent(styles.backgroundColor) &&
                !AO3_DEFAULT_RGB.has(styles.backgroundColor)
            );
        },

        _createTempElement(tag, className) {
            const element = document.createElement(tag);
            if (tag === "input" && className) {
                element.type = className;
            } else if (className) {
                element.className = className;
            }
            element.style.cssText = "position:absolute;left:-9999px;visibility:hidden;";
            if (!document.body) {
                return null;
            }
            document.body.appendChild(element);
            return element;
        },

        _getComputedStyle(selector, tempConfig) {
            let element = selector ? document.querySelector(selector) : null;
            let cleanup = false;

            if (!element && tempConfig) {
                element = this._createTempElement(tempConfig.tag, tempConfig.className);
                if (!element) return null;
                cleanup = true;
            }

            if (!element) return null;

            const styles = window.getComputedStyle(element);
            const result = {
                backgroundColor: styles.backgroundColor,
                borderColor: styles.borderColor,
                borderWidth: styles.borderWidth,
                borderRadius: styles.borderRadius,
                boxShadow: styles.boxShadow,
                color: styles.color,
                fontFamily: styles.fontFamily,
                fontWeight: styles.fontWeight,
                opacity: styles.opacity,
                padding: styles.padding,
            };

            if (cleanup) element.remove();
            return result;
        },

        getDialogStyles() {
            if (this.cache.dialog) return this.cache.dialog;

            // Always sample #modal first — keep its border/radius/shadow values even
            // if the background is transparent or default. Only fall back for individual
            // properties that are transparent/zero.
            const modalEl = document.querySelector("#modal");
            const modalStyles =
                modalEl && !modalEl.classList.contains("ao3-menu-modal")
                    ? this._getComputedStyle("#modal")
                    : null;

            // If native #modal is missing or replaced by MHL modal, use snapshot or fieldset
            if (!modalStyles) {
                if (this.nativeModalSnapshot && this.nativeModalSnapshot.dialog) {
                    this.cache.dialog = {
                        ...this.nativeModalSnapshot.dialog,
                        boxShadow: "none",
                    };
                } else {
                    const fieldset = this.getFieldsetStyles();
                    this.cache.dialog = {
                        backgroundColor: fieldset.backgroundColor,
                        borderColor: fieldset.borderColor,
                        borderWidth: fieldset.borderWidth,
                        borderRadius: fieldset.borderRadius,
                        boxShadow: "none",
                    };
                }
                return this.cache.dialog;
            }

            let backgroundColor = modalStyles?.backgroundColor || null;
            let borderColor = modalStyles?.borderColor || null;
            let borderWidth = modalStyles?.borderWidth || null;
            let borderRadius = modalStyles?.borderRadius || null;
            let boxShadow = modalStyles?.boxShadow || null;

            // Fall back to fieldset for individual properties that are transparent/default
            const fieldset = this.getFieldsetStyles();

            if (this._isTransparent(backgroundColor) || AO3_DEFAULT_RGB.has(backgroundColor)) {
                backgroundColor = fieldset.backgroundColor;
            }

            if (this._isTransparent(borderColor)) {
                borderColor = fieldset.borderColor;
            }

            // Only replace radius from fieldset if truly missing (null/undefined/transparent).
            // Keep 0px/0 — skin may intentionally set no rounding, v2.1.7 kept it.
            if (!borderRadius || this._isTransparent(borderRadius)) {
                borderRadius = fieldset.borderRadius;
            }

            if (borderWidth === "0px" || borderWidth === "0" || !borderWidth) {
                borderWidth = fieldset.borderWidth;
            }

            // No box-shadow on MHL dialogs/modals
            boxShadow = "none";

            this.cache.dialog = {
                backgroundColor: backgroundColor || "#ffffff",
                borderColor: borderColor || "#d1d1d1",
                borderWidth:
                    borderWidth === "0px" || borderWidth === "0" ? "0" : borderWidth || "1px",
                borderRadius: borderRadius || "8px",
                boxShadow: "none",
            };

            return this.cache.dialog;
        },

        getModalContentStyles() {
            if (this.cache.modalContent) return this.cache.modalContent;

            // Sample #modal .content directly for border-bottom color.
            // Don't gate on _isSkinStyled — bg may be transparent but borderColor valid.
            const isMHLModal = document.querySelector("#modal.ao3-menu-modal");

            // If MHL modal is active, use snapshot from before native #modal was removed
            if (isMHLModal && this.nativeModalSnapshot && this.nativeModalSnapshot.modalContent) {
                this.cache.modalContent = { ...this.nativeModalSnapshot.modalContent };
                return this.cache.modalContent;
            }

            let styles = !isMHLModal ? this._getComputedStyle("#modal .content") : null;

            if (!styles && !isMHLModal) {
                styles = this._getComputedStyle("#modal .content.userstuff");
            }

            // If MHL modal is in DOM, sample its actual content (old stylesheet already removed)
            if (!styles && isMHLModal) {
                styles = this._getComputedStyle("#modal.ao3-menu-modal .content.userstuff");
            }

            // Temp div only if native #modal .content doesn't exist
            if (!styles) {
                styles = this._getComputedStyle(null, {
                    tag: "div",
                    className: "content",
                });
            }

            let borderColor = styles?.borderColor;

            // rgb(0,0,0) = temp div default, not a real border color
            if (
                this._isTransparent(borderColor) ||
                borderColor === "rgb(0,0,0)" ||
                borderColor === "rgb(0, 0, 0)"
            ) {
                const fieldset = this.getFieldsetStyles();
                borderColor = fieldset.borderColor;
            }

            this.cache.modalContent = {
                borderColor: borderColor || "#d1d1d1",
            };

            return this.cache.modalContent;
        },

        getModalFooterStyles() {
            if (this.cache.modalFooter) return this.cache.modalFooter;

            const isMHLModal = document.querySelector("#modal.ao3-menu-modal");

            // If MHL modal is active, use snapshot from before native #modal was removed
            if (isMHLModal && this.nativeModalSnapshot && this.nativeModalSnapshot.modalFooter) {
                this.cache.modalFooter = { ...this.nativeModalSnapshot.modalFooter };
                return this.cache.modalFooter;
            }

            let styles = !isMHLModal ? this._getComputedStyle("#modal .footer") : null;

            if (!styles || (!isMHLModal && !this._isSkinStyled(styles))) {
                styles = this._getComputedStyle(null, {
                    tag: "div",
                    className: "footer",
                });
            }

            let backgroundColor = styles?.backgroundColor;
            let borderColor = styles?.borderColor;
            let borderWidth = styles?.borderWidth;
            let padding = styles?.padding;

            if (this._isTransparent(backgroundColor) || this._isTransparent(borderColor)) {
                const fieldset = this.getFieldsetStyles();
                if (this._isTransparent(backgroundColor)) {
                    backgroundColor = fieldset.backgroundColor;
                }
                if (this._isTransparent(borderColor)) {
                    borderColor = fieldset.borderColor;
                    borderWidth = fieldset.borderWidth;
                }
            }

            this.cache.modalFooter = {
                backgroundColor: backgroundColor || null,
                borderColor: borderColor || "#d1d1d1",
                borderWidth:
                    borderWidth === "0px" || borderWidth === "0" ? "0" : borderWidth || "1px",
                padding: padding || null,
            };

            return this.cache.modalFooter;
        },

        getBlurbStyles() {
            if (this.cache.blurb) return this.cache.blurb;

            let styles = this._getComputedStyle("li.blurb");

            if (!this._isSkinStyled(styles)) {
                styles = this._getComputedStyle(null, {
                    tag: "li",
                    className: "blurb",
                });
            }

            this.cache.blurb = {
                backgroundColor:
                    styles?.backgroundColor && !this._isTransparent(styles.backgroundColor)
                        ? styles.backgroundColor
                        : "#f5f5f5",
                borderColor:
                    styles?.borderColor && !this._isTransparent(styles.borderColor)
                        ? styles.borderColor
                        : "#d1d1d1",
                borderWidth:
                    styles?.borderWidth === "0px" || styles?.borderWidth === "0"
                        ? "0"
                        : styles?.borderWidth || "1px",
                borderRadius: styles?.borderRadius || "8px",
                boxShadow: styles?.boxShadow || "none",
                padding: styles?.padding || "0.75em",
            };

            return this.cache.blurb;
        },

        getBadgeStyles() {
            if (this.cache.badge) return this.cache.badge;

            let styles = this._getComputedStyle("span.unread");

            if (!this._isSkinStyled(styles)) {
                styles = this._getComputedStyle(null, {
                    tag: "span",
                    className: "unread",
                });
            }

            const linkColor = this.getLinkColor();
            const backgroundColor =
                styles?.backgroundColor && !this._isTransparent(styles.backgroundColor)
                    ? styles.backgroundColor
                    : linkColor;
            const borderColor =
                styles?.borderColor && !this._isTransparent(styles.borderColor)
                    ? styles.borderColor
                    : backgroundColor;

            this.cache.badge = {
                backgroundColor,
                borderColor,
                borderWidth:
                    styles?.borderWidth === "0px" || styles?.borderWidth === "0"
                        ? "0"
                        : styles?.borderWidth || "1px",
                borderRadius: styles?.borderRadius || "0.25em",
                color: styles?.color || "#ffffff",
                fontFamily: styles?.fontFamily || "inherit",
                padding: "0.25em 0.75em",
                fontWeight: styles?.fontWeight || "bold",
                opacity: styles?.opacity || "1",
                boxShadow: styles?.boxShadow || "none",
            };

            return this.cache.badge;
        },

        getButtonStyles() {
            if (this.cache.button) return this.cache.button;

            let styles = this._getComputedStyle('.actions li input[type="submit"]');

            if (!styles) {
                styles = this._getComputedStyle('input[type="submit"]');
            }

            if (!styles) {
                styles = this._getComputedStyle("button");
            }

            if (!styles) {
                styles = this._getComputedStyle(".actions a");
            }

            if (!styles || this._isTransparent(styles.backgroundColor)) {
                styles = this._getComputedStyle(null, {
                    tag: "input",
                    className: "submit",
                });
            }

            // Fall back to blurb colors if button detection failed
            let backgroundColor = styles?.backgroundColor;
            let borderColor = styles?.borderColor;

            if (this._isTransparent(backgroundColor) || this._isTransparent(borderColor)) {
                const blurb = this.getBlurbStyles();
                if (this._isTransparent(backgroundColor)) {
                    backgroundColor = blurb.backgroundColor;
                }
                if (this._isTransparent(borderColor)) {
                    borderColor = blurb.borderColor;
                }
            }

            this.cache.button = {
                backgroundColor: backgroundColor || "#e8e8e8",
                borderColor: borderColor || "#999999",
                borderWidth:
                    styles?.borderWidth === "0px" || styles?.borderWidth === "0"
                        ? "0"
                        : styles?.borderWidth || "1px",
                borderRadius: styles?.borderRadius || "4px",
                color: styles?.color || "#000000",
                boxShadow: styles?.boxShadow || "none",
            };

            return this.cache.button;
        },

        getButtonHoverStyles() {
            if (this.cache.buttonHover) return this.cache.buttonHover;

            // Match the skin's :is(:hover,:focus) selector patterns
            const hoverSubstrings = [
                'input[type="submit"]:is(:hover',
                "input[type=submit]:is(:hover",
                "button:is(:hover",
                'input[type="submit"]:hover',
                "input[type=submit]:hover",
                '.actions input[type="submit"]:hover',
                '.actions li input[type="submit"]:hover',
                "button:hover",
            ];

            let hoverBg = null;
            let hoverColor = null;
            let hoverBorder = null;

            const resolveVars = (val) => {
                if (!val) return val;
                return val.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, prop) => {
                    const resolved = window
                        .getComputedStyle(document.documentElement)
                        .getPropertyValue(prop)
                        .trim();
                    return resolved || _;
                });
            };

            try {
                for (const sheet of document.styleSheets) {
                    try {
                        const rules = sheet.cssRules || sheet.rules || [];
                        for (const rule of rules) {
                            if (!rule.selectorText) continue;
                            const sel = rule.selectorText.trim();
                            if (hoverSubstrings.some((p) => sel.includes(p))) {
                                // Read `background` shorthand first (catches var() values), fall back to backgroundColor
                                const bg =
                                    (rule.style && rule.style.background) ||
                                    (rule.style && rule.style.backgroundColor);
                                const color = rule.style && rule.style.color;
                                const border =
                                    (rule.style && rule.style.borderColor) ||
                                    (rule.style && rule.style.border);
                                const resolvedBg = resolveVars(bg);
                                const resolvedColor = resolveVars(color);
                                const resolvedBorder = resolveVars(border);
                                if (resolvedBg && !this._isTransparent(resolvedBg))
                                    hoverBg = resolvedBg;
                                if (resolvedColor) hoverColor = resolvedColor;
                                if (resolvedBorder && !this._isTransparent(resolvedBorder))
                                    hoverBorder = resolvedBorder;
                            }
                        }
                    } catch (_e) {
                        // cross-origin sheet, skip
                    }
                }
            } catch (_e) {}

            this.cache.buttonHover = {
                backgroundColor: hoverBg,
                color: hoverColor,
                borderColor: hoverBorder,
            };

            return this.cache.buttonHover;
        },

        getControlStyles() {
            if (this.cache.control) return this.cache.control;

            let bg = null;
            let border = null;
            let borderRadius = null;

            const el = this._createTempElement("input", "checkbox");
            if (el) {
                el.type = "checkbox";
                const s = window.getComputedStyle(el);
                bg = s.backgroundColor;
                border = s.borderColor;
                borderRadius = s.borderRadius;
                el.remove();
            }

            this.cache.control = {
                backgroundColor: bg && !this._isTransparent(bg) ? bg : null,
                borderColor: border && !this._isTransparent(border) ? border : null,
                borderRadius: borderRadius || "50%",
            };

            return this.cache.control;
        },

        getInputStyles() {
            if (this.cache.input) return this.cache.input;

            const styles = this._getComputedStyle(null, {
                tag: "input",
                className: "text",
            });

            // Fall back to dialog colors if input detection failed
            let backgroundColor = styles?.backgroundColor;
            let borderColor = styles?.borderColor;

            if (this._isTransparent(backgroundColor) || this._isTransparent(borderColor)) {
                const dialog = this.getDialogStyles();
                if (this._isTransparent(backgroundColor)) {
                    backgroundColor = dialog.backgroundColor;
                }
                if (this._isTransparent(borderColor)) {
                    borderColor = dialog.borderColor;
                }
            }

            this.cache.input = {
                backgroundColor: backgroundColor || "#ffffff",
                borderColor: borderColor || "#b0b0b0",
                borderWidth:
                    styles?.borderWidth === "0px" || styles?.borderWidth === "0"
                        ? "0"
                        : styles?.borderWidth || "1px",
                borderRadius: styles?.borderRadius || "4px",
                color: styles?.color || "#000000",
            };

            return this.cache.input;
        },

        getFieldsetStyles() {
            if (this.cache.fieldset) return this.cache.fieldset;

            let styles = null;

            // Works page: sample from work meta group (skin usually styles this)
            const WORKS_PAGE_REGEX =
                /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
            if (WORKS_PAGE_REGEX.test(window.location.href)) {
                styles = this._getComputedStyle("dl.work.meta.group");
                if (!this._isSkinStyled(styles)) {
                    styles = this._getComputedStyle("dl.work.meta.group dd");
                }
            }

            // Prefer .listbox — skins commonly target this class selector
            if (!this._isSkinStyled(styles)) {
                styles = this._getComputedStyle(".listbox");
            }

            // Fall back to fieldset (skins may not style bare fieldset)
            if (!this._isSkinStyled(styles)) {
                styles = this._getComputedStyle("fieldset");
            }

            // Temp fieldset as fallback
            if (!this._isSkinStyled(styles)) {
                styles = this._getComputedStyle(null, {
                    tag: "fieldset",
                    className: "",
                });
            }

            // Body bg as universal fallback
            if (!this._isSkinStyled(styles)) {
                const bodyStyles = window.getComputedStyle(document.body);
                if (
                    bodyStyles.backgroundColor &&
                    !this._isTransparent(bodyStyles.backgroundColor)
                ) {
                    styles = { backgroundColor: bodyStyles.backgroundColor };
                }
            }

            // If everything failed, pull from blurb styles
            let backgroundColor = styles?.backgroundColor;
            let borderColor = styles?.borderColor;
            let borderWidth = styles?.borderWidth;

            if (
                this._isTransparent(backgroundColor) ||
                this._isTransparent(borderColor) ||
                AO3_DEFAULT_RGB.has(backgroundColor)
            ) {
                const blurb = this.getBlurbStyles();
                if (this._isTransparent(backgroundColor) || AO3_DEFAULT_RGB.has(backgroundColor)) {
                    backgroundColor = blurb.backgroundColor;
                }
                if (this._isTransparent(borderColor)) {
                    borderColor = blurb.borderColor;
                    borderWidth = blurb.borderWidth;
                }
            }

            this.cache.fieldset = {
                backgroundColor: backgroundColor || "#f9f9f9",
                borderColor: borderColor || "#d1d1d1",
                borderWidth:
                    borderWidth === "0px" || borderWidth === "0" ? "0" : borderWidth || "1px",
                borderRadius: styles?.borderRadius || "8px",
                boxShadow: styles?.boxShadow || "none",
            };

            return this.cache.fieldset;
        },

        getTextColor() {
            if (this.cache.textColor) return this.cache.textColor;

            const body = document.body || document.documentElement;
            if (!body) {
                this.cache.textColor = "#000000";
                return this.cache.textColor;
            }

            const styles = window.getComputedStyle(body);
            this.cache.textColor = styles.color || "#000000";
            return this.cache.textColor;
        },

        getLinkColor() {
            if (this.cache.linkColor) return this.cache.linkColor;

            let link = document.querySelector("a");
            let cleanup = false;

            if (!link) {
                link = this._createTempElement("a", "");
                if (!link) {
                    this.cache.linkColor = "#0000ff";
                    return this.cache.linkColor;
                }
                cleanup = true;
            }

            const styles = window.getComputedStyle(link);
            this.cache.linkColor = styles.color || "#0000ff";

            if (cleanup) link.remove();

            return this.cache.linkColor;
        },

        clearCache() {
            this.cache = {};
            // Preserve native modal snapshot across cache clears
            // (snapshot is set before createMenuModal removes native #modal)
        },

        _snapshotNativeModal() {
            if (this.nativeModalSnapshot) return;
            // Only snapshot if a real native AO3 #modal exists (not MHL modal)
            const modalEl = document.getElementById("modal");
            if (!modalEl || modalEl.classList.contains("ao3-menu-modal")) {
                return;
            }
            // Cache current dialog/content/footer from native #modal before removal
            this.getDialogStyles();
            this.getModalContentStyles();
            this.getModalFooterStyles();
            this.nativeModalSnapshot = {
                dialog: this.cache.dialog ? { ...this.cache.dialog } : null,
                modalContent: this.cache.modalContent ? { ...this.cache.modalContent } : null,
                modalFooter: this.cache.modalFooter ? { ...this.cache.modalFooter } : null,
            };
        },

        /**
         * On mobile, retry theme detection after a delay if we got transparent values
         */
        retryOnMobile() {
            if (!this.isMobile) return;

            // Clear cache and retry after a short delay
            setTimeout(() => {
                this.clearCache();
                // Trigger style re-injection if needed
                if (window.AO3MenuHelpers) {
                    stylesInjected = false;
                    window.AO3MenuHelpers.injectSharedStyles();
                }
            }, 100);
        },
    };

    // ============================================================
    // MAIN LIBRARY
    // ============================================================

    window.AO3MenuHelpers = {
        version: VERSION,
        themeDetector: ThemeDetector,

        /**
         * Returns stored section collapse/expand states from localStorage.
         * @returns {Object}
         * @private
         */
        _getSectionStates() {
            const stored = localStorage.getItem("ao3_menu_helpers");
            return stored ? JSON.parse(stored) : {};
        },

        /**
         * Persists section collapse/expand states to localStorage.
         * @param {Object} states
         * @private
         */
        _saveSectionStates(states) {
            localStorage.setItem("ao3_menu_helpers", JSON.stringify(states));
        },

        // ── Fallback theme mode ──────────────────────────────────

        /**
         * Returns the current fallback theme mode.
         * @returns {string|null} "light", "dark", or null (auto mode)
         */
        getFallbackMode() {
            const config = this._getSectionStates();
            return config.fallbackTheme ?? null;
        },

        /**
         * Sets the fallback theme mode and re-injects styles.
         * Pass null for auto mode (detect from skin).
         * @param {string|null} value - "light", "dark", or null
         */
        setFallbackMode(value) {
            const config = this._getSectionStates();
            if (value === null) {
                delete config.fallbackTheme;
                this.themeDetector.clearCache();
            } else {
                config.fallbackTheme = value;
            }
            this._saveSectionStates(config);
            const existing = document.getElementById("ao3-menu-helpers-styles");
            if (existing) existing.remove();
            stylesInjected = false;
            this.injectSharedStyles();
        },

        /**
         * Cycles through fallback modes: null → "light" → "dark" → null.
         * @returns {string|null} the new mode
         */
        cycleFallbackMode() {
            const current = this.getFallbackMode();
            const next = current === null ? "light" : current === "light" ? "dark" : null;
            this.setFallbackMode(next);
            return next;
        },

        /**
         * Returns the active palette object for the current fallback mode, or null in auto mode.
         * @returns {Object|null} FALLBACK_PALETTES.light, FALLBACK_PALETTES.dark, or null
         * @private
         */
        _getEffectivePalette() {
            const mode = this.getFallbackMode();
            return mode ? FALLBACK_PALETTES[mode] : null;
        },

        // ── Style injection ──────────────────────────────────

        /**
         * Injects the shared MHL stylesheet (dialog, overlay, form controls, etc.)
         * into the document head. Safe to call multiple times — only injects once.
         */
        injectSharedStyles() {
            if (stylesInjected) return;
            if (!document.head) {
                if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", () => {
                        this.injectSharedStyles();
                    });
                }
                return;
            }

            const existingStyle = document.getElementById("ao3-menu-helpers-styles");
            if (existingStyle) {
                stylesInjected = true;
                return;
            }

            // On mobile, if we got transparent backgrounds, retry once
            // (use cached getters — full theme computation deferred to _generateSharedStyles)
            if (this.themeDetector.isMobile && !stylesInjected) {
                const ds = this.themeDetector.getDialogStyles();
                const bs = this.themeDetector.getButtonStyles();
                if (
                    this.themeDetector._isTransparent(ds.backgroundColor) ||
                    this.themeDetector._isTransparent(bs.backgroundColor)
                ) {
                    this.themeDetector.retryOnMobile();
                }
            }

            const style = document.createElement("style");
            style.id = "ao3-menu-helpers-styles";
            style.textContent = this._generateSharedStyles();

            document.head.appendChild(style);
            stylesInjected = true;
        },

        /**
         * Injects the shared list-item stylesheet into the document head.
         * Safe to call multiple times — only injects once.
         */
        injectListItemStyles() {
            if (document.getElementById("ao3-list-item-styles")) return;

            const style = document.createElement("style");
            style.id = "ao3-list-item-styles";
            style.textContent = `
            .ao3-menu-dialog .ao3-menu-list-item:hover,
            .menu-list-item:hover {
              background: rgba(0,0,0,0.1) !important;
            }
            
            .ao3-menu-dialog a:hover {
              border-bottom: none !important;
              text-decoration: none !important;
              transform: none !important;
            }
            
            .ao3-theme-toggle svg {
              width: 1em;
              height: 1em;
              display: block;
              pointer-events: none;
            }

            .ao3-menu-dialog .icon-button svg {
              width: 1.2em;
              height: 1.2em;
              display: block;
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
         * Generates the shared stylesheet CSS string.
         * Computes all theme values (palette or auto-detected) and returns the
         * full CSS for .ao3-menu-dialog, #modal.ao3-menu-modal, form controls, etc.
         * @returns {string} CSS stylesheet content
         * @private
         */
        _generateSharedStyles() {
            const palette = this._getEffectivePalette();
            const dialogTheme = palette ? palette.dialog : this.themeDetector.getDialogStyles();
            const inputTheme = palette ? palette.input : this.themeDetector.getInputStyles();
            const buttonTheme = palette ? palette.button : this.themeDetector.getButtonStyles();
            const buttonHoverSampled = !palette ? this.themeDetector.getButtonHoverStyles() : null;
            const buttonHoverTheme = palette ? palette.buttonHover : null;
            const hoverCSS =
                buttonHoverSampled && buttonHoverSampled.backgroundColor
                    ? `background: ${buttonHoverSampled.backgroundColor}; color: ${buttonHoverSampled.color || "inherit"};${buttonHoverSampled.borderColor ? ` border-color: ${buttonHoverSampled.borderColor};` : ""} box-shadow: none;`
                    : "opacity: 0.85;";
            const controlTheme = palette ? palette.control : this.themeDetector.getControlStyles();
            const fieldsetTheme = palette
                ? palette.fieldset
                : this.themeDetector.getFieldsetStyles();
            const blurbTheme = palette ? palette.blurb : this.themeDetector.getBlurbStyles();
            const badgeTheme = palette ? palette.badge : this.themeDetector.getBadgeStyles();
            const modalContentTheme = !palette ? this.themeDetector.getModalContentStyles() : null;
            const modalFooterTheme = !palette ? this.themeDetector.getModalFooterStyles() : null;
            const textColor = palette ? palette.textColor : this.themeDetector.getTextColor();
            const linkColor = palette ? palette.linkColor : this.themeDetector.getLinkColor();
            const linkHoverColor = palette ? palette.linkHoverColor : null;
            const linkVisitedColor = palette ? palette.linkVisitedColor : null;
            const scrollbarTheme = palette
                ? palette.scrollbar
                : {
                      trackColor: dialogTheme.backgroundColor,
                      thumbColor: inputTheme.borderColor,
                      thumbHoverColor: linkColor,
                  };

            const css = `
            /* Meyer's Reset (scoped) */
            .ao3-menu-dialog div,
            .ao3-menu-dialog span,
            .ao3-menu-dialog applet,
            .ao3-menu-dialog object,
            .ao3-menu-dialog iframe,
            .ao3-menu-dialog h1,
            .ao3-menu-dialog h2,
            .ao3-menu-dialog h3,
            .ao3-menu-dialog h4,
            .ao3-menu-dialog h5,
            .ao3-menu-dialog h6,
            .ao3-menu-dialog p,
            .ao3-menu-dialog blockquote,
            .ao3-menu-dialog pre,
            .ao3-menu-dialog a,
            .ao3-menu-dialog abbr,
            .ao3-menu-dialog acronym,
            .ao3-menu-dialog address,
            .ao3-menu-dialog big,
            .ao3-menu-dialog cite,
            .ao3-menu-dialog code,
            .ao3-menu-dialog del,
            .ao3-menu-dialog dfn,
            .ao3-menu-dialog em,
            .ao3-menu-dialog img,
            .ao3-menu-dialog ins,
            .ao3-menu-dialog q,
            .ao3-menu-dialog s,
            .ao3-menu-dialog samp,
            .ao3-menu-dialog small,
            .ao3-menu-dialog strike,
            .ao3-menu-dialog strong,
            .ao3-menu-dialog sub,
            .ao3-menu-dialog sup,
            .ao3-menu-dialog tt,
            .ao3-menu-dialog var,
            .ao3-menu-dialog dl,
            .ao3-menu-dialog dt,
            .ao3-menu-dialog dd,
            .ao3-menu-dialog ol,
            .ao3-menu-dialog ul,
            .ao3-menu-dialog li,
            .ao3-menu-dialog fieldset,
            .ao3-menu-dialog form,
            .ao3-menu-dialog label,
            .ao3-menu-dialog legend,
            .ao3-menu-dialog table,
            .ao3-menu-dialog caption,
            .ao3-menu-dialog tbody,
            .ao3-menu-dialog tfoot,
            .ao3-menu-dialog thead,
            .ao3-menu-dialog tr,
            .ao3-menu-dialog th,
            .ao3-menu-dialog td {
              border: 0;
              outline: 0;
              font-weight: inherit;
              font-style: inherit;
              font-size: 100%;
              font-family: inherit;
              vertical-align: baseline;
              list-style: none;
              margin: 0;
              padding: 0;
            }

            /* Badge-like spans are sampled from AO3 span.unread, then pinned inside dialogs. */
            .ao3-menu-dialog .item-badge.unread,
            .ao3-menu-dialog span.unread:not(.replied):not(.claimed) {
              background: ${badgeTheme.backgroundColor} !important;
              border: ${badgeTheme.borderWidth} solid ${badgeTheme.borderColor} !important;
              border-radius: ${badgeTheme.borderRadius} !important;
              box-shadow: ${badgeTheme.boxShadow} !important;
              color: ${badgeTheme.color} !important;
              font-family: ${badgeTheme.fontFamily} !important;
              font-weight: ${badgeTheme.fontWeight} !important;
              opacity: ${badgeTheme.opacity} !important;
              padding: ${badgeTheme.padding} !important;
            }

            .ao3-menu-dialog span.replied,
            .ao3-menu-dialog span.claimed {
              border: revert;
              background-color: revert;
              color: revert;
              padding: revert;
              border-radius: revert;
            }

            /* Dialog Container */
            .ao3-menu-dialog {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: ${dialogTheme.backgroundColor};
              padding: 20px;
              border: ${dialogTheme.borderWidth} solid ${dialogTheme.borderColor};
              border-radius: ${dialogTheme.borderRadius};
              box-shadow: ${dialogTheme.boxShadow};
              z-index: 10000;
              width: 90%;
              max-width: 600px;
              max-height: 80vh;
              overflow-y: auto;
              font-family: inherit;
              font-size: inherit;
              color: ${textColor};
              box-sizing: border-box;
              scrollbar-color: ${scrollbarTheme.thumbColor} ${scrollbarTheme.trackColor};
              scrollbar-width: thin;
            }

            .ao3-menu-dialog::-webkit-scrollbar {
              width: 8px;
            }

            .ao3-menu-dialog::-webkit-scrollbar-track {
              background: ${scrollbarTheme.trackColor};
            }

            .ao3-menu-dialog::-webkit-scrollbar-thumb {
              background: ${scrollbarTheme.thumbColor};
              border-radius: 4px;
            }

            .ao3-menu-dialog::-webkit-scrollbar-thumb:hover {
              background: ${scrollbarTheme.thumbHoverColor};
            }

            .ao3-menu-dialog a,
            #modal.tall.ao3-menu-modal a {
              color: ${linkColor};
              border-bottom: none;
            }

            ${
                linkVisitedColor
                    ? `
            .ao3-menu-dialog a:visited,
            #modal.tall.ao3-menu-modal a:visited {
              color: ${linkVisitedColor};
            }
            `
                    : ""
            }

            .ao3-menu-dialog a:hover,
            .ao3-menu-dialog a:focus,
            #modal.tall.ao3-menu-modal a:hover,
            #modal.tall.ao3-menu-modal a:focus {
              color: ${linkHoverColor || linkColor};
              border-bottom: 1px solid ${linkHoverColor || linkColor};
            }

            /* AO3-native modal theming — scoped to .ao3-menu-modal to avoid AO3's own modals */
            #modal.tall.ao3-menu-modal {
              background: ${dialogTheme.backgroundColor};
              border: ${dialogTheme.borderWidth} solid ${dialogTheme.borderColor};
              border-radius: ${dialogTheme.borderRadius};
              box-shadow: ${dialogTheme.boxShadow};
              color: ${textColor};
              overflow-y: auto;
              margin: 0;
            }

            #modal.tall.ao3-menu-modal .content.userstuff {
              color: ${textColor};
              border-bottom: 1px solid ${modalContentTheme ? modalContentTheme.borderColor : dialogTheme.borderColor} !important;
            }

            #modal.tall.ao3-menu-modal .footer {
              background: ${modalFooterTheme ? modalFooterTheme.backgroundColor || "inherit" : "inherit"};
              border-color: ${modalFooterTheme ? modalFooterTheme.borderColor || "inherit" : "inherit"};
              border-width: ${modalFooterTheme && modalFooterTheme.borderWidth ? modalFooterTheme.borderWidth : ""};
              padding: 0 0.6432em !important;
              border-radius: 0 0 ${dialogTheme.borderRadius} ${dialogTheme.borderRadius};
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            @media (max-width: 768px) {
              .ao3-menu-dialog {
                width: 96% !important;
                max-width: 96% !important;
                height: auto !important;
                max-height: calc(100vh - 120px) !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) !important;
                padding: 15px !important;
              }
              .ao3-menu-dialog .two-column {
                grid-template-columns: 1fr !important;
              }
            }
            
            .ao3-menu-dialog h1,
            .ao3-menu-dialog h2,
            .ao3-menu-dialog h3,
            .ao3-menu-dialog h4,
            .ao3-menu-dialog h5,
            .ao3-menu-dialog h6,
            .ao3-menu-dialog .heading {
              font-style: normal;
              overflow-wrap: anywhere;
            }

            .ao3-menu-dialog,
            .ao3-menu-dialog p,
            .ao3-menu-dialog span {
              line-height: normal;
              text-underline-offset: auto;
              word-break: normal;
            }

            .ao3-menu-dialog p {
              margin: 0.643em 0;
            }

            .ao3-menu-dialog h3 {
              text-align: center;
              font-size: 1.286em;
              line-height: 1;
              margin: 0.5375em 0;
              margin-top: 0;
              font-weight: bold;
              color: inherit;
              font-family: inherit;
            }
            
            .ao3-menu-dialog .settings-section {
              background: ${fieldsetTheme.backgroundColor};
              border: ${fieldsetTheme.borderWidth} solid ${fieldsetTheme.borderColor};
              border-radius: ${fieldsetTheme.borderRadius};
              padding: 15px;
              margin-bottom: 20px;
              box-shadow: ${fieldsetTheme.boxShadow};
            }

            .ao3-menu-dialog .settings-section > *:last-child,
            .ao3-menu-dialog .settings-section > *:last-child > *:last-child {
              margin-bottom: 0 !important;
            }

            .ao3-menu-dialog .settings-section > *:last-child > *:last-child .checkbox-label:last-child {
              margin-bottom: 0 !important;
            }
            

            .ao3-menu-dialog .section-title {
              margin: 0.5em 0;
              margin-top: 0;
              margin-bottom: 15px;
              line-height: 1.125;
              font-size: 1.2em;
              font-weight: bold;
              color: inherit;
              opacity: 0.85;
              font-family: inherit;
              cursor: pointer;
            }

            .ao3-menu-dialog .section-title.collapsed {
              margin-bottom: 5px;
            }

            .ao3-menu-dialog .section-title.collapsed::after {
              content: none !important;
            }
            
            .ao3-menu-dialog .section-content {
              margin-top: 10px;
            }
            
            .ao3-menu-dialog .setting-group {
              margin-bottom: 15px;
            }

            .ao3-menu-dialog .setting-group:last-child {
              margin-bottom: 0;
            }
            
            .ao3-menu-dialog label {
              line-height: normal;
              cursor: default;
            }

            .ao3-menu-dialog label[for] {
              line-height: normal;
              cursor: default;
            }

            .ao3-menu-dialog .setting-label {
              display: block;
              margin: 0;
              margin-bottom: 6px;
              font-weight: bold;
              color: inherit;
              opacity: 0.9;
              border: 0;
              outline: 0;
              padding: 0;
            }
            
            .ao3-menu-dialog .setting-description {
              display: block;
              margin-bottom: 8px;
              font-size: 0.9em;
              color: inherit;
              opacity: 0.6;
              line-height: 1.4;
            }
            
            .ao3-menu-dialog .checkbox-label {
              display: block;
              font-weight: normal;
              color: inherit;
              margin-bottom: 15px;
            }
            
            .ao3-menu-dialog .radio-label {
              display: block;
              font-weight: normal;
              color: inherit;
              margin-left: 20px;
              margin-bottom: 8px;
            }
            
            .ao3-menu-dialog .subsettings {
              padding-left: 20px;
              margin-bottom: 15px;
            }

            .ao3-menu-dialog .subsettings > :last-child {
              margin-bottom: 0;
            }

            .ao3-menu-dialog .two-column .subsettings {
              margin-bottom: 0;
            }
            
            .ao3-menu-dialog .two-column {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 15px;
            }

            
            .ao3-menu-dialog .setting-group + .two-column {
              margin-top: 15px;
            }

            .ao3-menu-dialog .two-column > .checkbox-label,
            .ao3-menu-dialog .two-column > * > .checkbox-label:only-child {
              margin-bottom: 0 !important;
            }
            
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
              word-break: keep-all;
            }
            
            .ao3-menu-dialog input[type="text"],
            .ao3-menu-dialog input[type="number"],
            .ao3-menu-dialog select,
            .ao3-menu-dialog textarea {
              width: 100%;
              box-sizing: border-box;
              padding: ${inputTheme.padding || "0.25em 0.5em"};
              background: ${inputTheme.backgroundColor};
              border: ${inputTheme.borderWidth} solid ${inputTheme.borderColor};
              border-radius: ${inputTheme.borderRadius};
              box-shadow: none;
              color: ${inputTheme.color};
              font-size: 100%;
              background-image: none;
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
              background: ${inputTheme.backgroundColor} !important;
              outline: 2px solid ${linkColor};
            }

            .ao3-menu-dialog input[type="text"]:hover,
            .ao3-menu-dialog input[type="number"]:hover,
            .ao3-menu-dialog select:hover,
            .ao3-menu-dialog textarea:hover {
              background: ${inputTheme.backgroundColor} !important;
              border-color: ${inputTheme.borderColor} !important;
              box-shadow: none !important;
              color: ${inputTheme.color} !important;
            }
            
            .ao3-menu-dialog input::placeholder,
            .ao3-menu-dialog textarea::placeholder {
              opacity: 0.6 !important;
            }
            
            .ao3-menu-dialog .button-group {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              margin-top: 20px;
            }
            
            ${
                palette
                    ? `
            .ao3-menu-dialog input[type="text"],
            .ao3-menu-dialog input[type="number"],
            .ao3-menu-dialog label,
            .ao3-menu-dialog a {
              background-image: none !important;
            }

            .ao3-menu-dialog input[type="text"]:hover,
            .ao3-menu-dialog input[type="number"]:hover,
            .ao3-menu-dialog select:hover,
            .ao3-menu-dialog textarea:hover {
              background: ${inputTheme.backgroundColor} !important;
              border-color: ${inputTheme.borderColor} !important;
              box-shadow: none !important;
              color: ${inputTheme.color} !important;
            }

            .ao3-menu-dialog input[type="submit"] {
              padding: ${buttonTheme.padding || "0.25em 0.75em"} !important;
              background: ${buttonTheme.backgroundColor} !important;
              background-image: none !important;
              border: ${buttonTheme.borderWidth} solid ${buttonTheme.borderColor} !important;
              border-radius: ${buttonTheme.borderRadius} !important;
              color: ${buttonTheme.color} !important;
              box-shadow: ${buttonTheme.boxShadow} !important;
              cursor: pointer !important;
              font-size: 1.1em !important;
              transition: 25ms ease-out !important;
            }

            .ao3-menu-dialog input[type="submit"]:hover,
            .ao3-menu-dialog input[type="submit"]:focus {
              background: ${buttonHoverTheme.backgroundColor} !important;
              border-color: ${buttonHoverTheme.borderColor} !important;
              color: ${buttonHoverTheme.color} !important;
              box-shadow: none !important;
              outline: none !important;
            }

            .ao3-menu-dialog input[type="submit"]:active {
              background: ${palette.buttonActive.backgroundColor} !important;
              border-color: ${palette.buttonActive.borderColor} !important;
              color: ${palette.buttonActive.color} !important;
              box-shadow: none !important;
            }

            .ao3-menu-dialog .button-group input[type="submit"] {
              flex: 1 !important;
              padding: ${buttonTheme.padding || "10px"} !important;
            }

            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]) {
              padding: ${buttonTheme.padding || "0.25em 0.75em"} !important;
              background: ${buttonTheme.backgroundColor} !important;
              background-image: none !important;
              border: ${buttonTheme.borderWidth} solid ${buttonTheme.borderColor} !important;
              border-radius: ${buttonTheme.borderRadius} !important;
              color: ${buttonTheme.color} !important;
              box-shadow: ${buttonTheme.boxShadow} !important;
              cursor: pointer !important;
              opacity: 0.8 !important;
              transition: 25ms ease-out !important;
            }

            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]):hover,
            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]):focus {
              background: ${buttonHoverTheme.backgroundColor} !important;
              border-color: ${buttonHoverTheme.borderColor} !important;
              color: ${buttonHoverTheme.color} !important;
              box-shadow: none !important;
              opacity: 1 !important;
              outline: none !important;
            }

            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]):active {
              background: ${palette.buttonActive.backgroundColor} !important;
              border-color: ${palette.buttonActive.borderColor} !important;
              color: ${palette.buttonActive.color} !important;
              box-shadow: none !important;
            }

            #modal.tall.ao3-menu-modal .footer button.modal-closer {
              padding: ${buttonTheme.padding || "0.25em 0.75em"} !important;
              background: ${buttonTheme.backgroundColor} !important;
              background-image: none !important;
              border: ${buttonTheme.borderWidth} solid ${buttonTheme.borderColor} !important;
              border-radius: ${buttonTheme.borderRadius} !important;
              color: ${buttonTheme.color} !important;
              box-shadow: ${buttonTheme.boxShadow} !important;
              cursor: pointer !important;
              opacity: 1 !important;
              transition: 25ms ease-out !important;
              font-size: inherit;
              font-family: inherit;
              line-height: normal;
              margin-right: 8px !important;
              flex-shrink: 0 !important;
            }

            #modal.tall.ao3-menu-modal .footer button.modal-closer:hover,
            #modal.tall.ao3-menu-modal .footer button.modal-closer:focus {
              background: ${buttonHoverTheme.backgroundColor} !important;
              border-color: ${buttonHoverTheme.borderColor} !important;
              color: ${buttonHoverTheme.color} !important;
              box-shadow: none !important;
              opacity: 1 !important;
              outline: none !important;
            }

            .ao3-menu-dialog input[type="checkbox"],
            .ao3-menu-dialog input[type="radio"] {
              flex-shrink: 0 !important;
              appearance: none !important;
              display: inline-block !important;
              position: relative !important;
              top: auto !important;
              box-sizing: border-box !important;
              width: 1em !important;
              height: 1em !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              box-shadow: none !important;
              border: 1.5px solid ${controlTheme.borderColor} !important;
              border-radius: ${controlTheme.borderRadius} !important;
              background-color: ${controlTheme.backgroundColor} !important;
              background-image: none !important;
              color: ${controlTheme.checkmarkColor} !important;
              user-select: none !important;
              cursor: pointer !important;
            }

            .ao3-menu-dialog input[type="radio"] {
              border-radius: 100% !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:hover,
            .ao3-menu-dialog input[type="checkbox"]:focus,
            .ao3-menu-dialog input[type="radio"]:hover,
            .ao3-menu-dialog input[type="radio"]:focus {
              border-color: ${controlTheme.hoverBorderColor} !important;
              color: ${controlTheme.hoverBorderColor} !important;
              outline: none !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:disabled,
            .ao3-menu-dialog input[type="radio"]:disabled {
              border-color: ${controlTheme.disabledColor} !important;
              background-color: ${controlTheme.disabledColor} !important;
              cursor: not-allowed !important;
            }

            .ao3-menu-dialog input[type="checkbox"]::before {
              position: absolute !important;
              width: 50% !important;
              height: inherit !important;
              border-right: 0.25em solid !important;
              border-bottom: 0.25em solid !important;
              color: ${controlTheme.checkmarkColor} !important;
              content: "" !important;
              transform: translate(15%, -20%) scale(0.5) rotate(45deg) !important;
              opacity: 0 !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:checked,
            .ao3-menu-dialog input[type="checkbox"]:checked {
              border-color: ${controlTheme.checkedColor} !important;
              background-color: ${controlTheme.checkedColor} !important;
              color: ${controlTheme.checkmarkColor} !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:checked::before {
              opacity: 1 !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:checked:hover {
              border-color: ${controlTheme.hoverBorderColor} !important;
              background-color: ${controlTheme.hoverBorderColor} !important;
            }

            .ao3-menu-dialog input[type="radio"]:checked {
              border-color: ${controlTheme.checkedColor} !important;
              box-shadow: inset 0 0 0 2.5px !important;
              background-color: ${controlTheme.checkedColor} !important;
              background-image: none !important;
              color: ${controlTheme.radioCheckedColor} !important;
            }

            .ao3-menu-dialog input[type="range"] {
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
            }

            .ao3-menu-dialog input[type="range"]::-moz-range-progress {
              background: ${linkHoverColor} !important;
              height: 0.25em !important;
              border-radius: 0.75em !important;
              box-shadow: none !important;
            }

            .ao3-menu-dialog input[type="range"]::-moz-range-track {
              background: ${textColor} !important;
              border: none !important;
              height: 0.25em !important;
              border-radius: 0.75em !important;
              box-shadow: none !important;
            }

            .ao3-menu-dialog input[type="range"]::-moz-range-thumb {
              background: ${linkHoverColor} !important;
              border: none !important;
              border-radius: 50% !important;
              cursor: pointer !important;
            }

            .ao3-menu-dialog input[type="checkbox"]:checked + [class*="toggle-slider"],
            .ao3-menu-dialog input[type="checkbox"]:checked + [class*="toggle-track"] {
              background-color: ${linkVisitedColor} !important;
            }

            .ao3-menu-dialog .content.userstuff h1,
            #modal.tall.ao3-menu-modal .content.userstuff h1 {
              font-size: 1.6em;
              line-height: 1.2;
              margin: 0.75em 0 0.5em;
              font-weight: 700;
              font-style: normal;
              color: ${textColor};
            }
            .ao3-menu-dialog .content.userstuff h2,
            #modal.tall.ao3-menu-modal .content.userstuff h2 {
              font-size: 1.4em;
              line-height: 1.2;
              margin: 0.6em 0 0.4em;
              font-weight: 700;
              font-style: normal;
              color: ${textColor};
            }
            .ao3-menu-dialog .content.userstuff h3,
            #modal.tall.ao3-menu-modal .content.userstuff h3 {
              font-size: 1.286em;
              line-height: 1;
              padding: 0.125em;
              margin: 0.5375em 0;
              font-weight: 500;
              font-style: normal;
              color: ${textColor};
              text-align: left;
              border-bottom: 0.25em double ${palette.headingBorderColor};
            }
            .ao3-menu-dialog .content.userstuff h4,
            #modal.tall.ao3-menu-modal .content.userstuff h4 {
              font-size: 1.1em;
              line-height: 1.3;
              margin: 0.4em 0 0.2em;
              font-weight: 700;
              font-style: normal;
              color: ${textColor};
            }
            .ao3-menu-dialog .content.userstuff h5,
            #modal.tall.ao3-menu-modal .content.userstuff h5 {
              font-size: 1em;
              line-height: 1.286;
              margin: 0.643em 0;
              font-weight: 600;
              font-style: normal;
              color: ${textColor};
            }
            .ao3-menu-dialog .content.userstuff h6,
            #modal.tall.ao3-menu-modal .content.userstuff h6 {
              font-size: 0.975em;
              line-height: 1.5;
              margin: 1.5em 0;
              font-weight: 900;
              font-style: normal;
              color: ${textColor};
              border-bottom: 1px solid ${palette.headingBorderColor};
            }

            .ao3-menu-dialog kbd,
            #modal.tall.ao3-menu-modal kbd {
              color: ${textColor} !important;
              background: rgba(0,0,0,0.08);
              border: 1px solid ${fieldsetTheme.borderColor} !important;
              border-radius: 4px;
              padding: 0.125em 0.4em;
              font-family: monospace;
              font-size: 0.9em;
              box-shadow: 0 1px 1px ${fieldsetTheme.borderColor}, 0 1px 0 0 rgba(255,255,255,0.4) inset !important;
            }

            .ao3-menu-dialog,
            .ao3-menu-dialog *,
            #modal.tall.ao3-menu-modal,
            #modal.tall.ao3-menu-modal * {
              scrollbar-color: ${scrollbarTheme.thumbColor} ${scrollbarTheme.trackColor} !important;
              scrollbar-width: auto !important;
            }

            .ao3-menu-dialog::-webkit-scrollbar,
            .ao3-menu-dialog *::-webkit-scrollbar,
            #modal.tall.ao3-menu-modal::-webkit-scrollbar,
            #modal.tall.ao3-menu-modal *::-webkit-scrollbar {
              width: 8px;
            }

            .ao3-menu-dialog::-webkit-scrollbar-track,
            .ao3-menu-dialog *::-webkit-scrollbar-track,
            #modal.tall.ao3-menu-modal::-webkit-scrollbar-track,
            #modal.tall.ao3-menu-modal *::-webkit-scrollbar-track {
              background: ${scrollbarTheme.trackColor} !important;
            }

            .ao3-menu-dialog::-webkit-scrollbar-thumb,
            .ao3-menu-dialog *::-webkit-scrollbar-thumb,
            #modal.tall.ao3-menu-modal::-webkit-scrollbar-thumb,
            #modal.tall.ao3-menu-modal *::-webkit-scrollbar-thumb {
              background: ${scrollbarTheme.thumbColor} !important;
            }

            .ao3-menu-dialog::-webkit-scrollbar-thumb:hover,
            .ao3-menu-dialog *::-webkit-scrollbar-thumb:hover,
            #modal.tall.ao3-menu-modal::-webkit-scrollbar-thumb:hover,
            #modal.tall.ao3-menu-modal *::-webkit-scrollbar-thumb:hover {
              background: ${scrollbarTheme.thumbHoverColor} !important;
            }

            .ao3-menu-dialog .checkbox-label,
            #modal.tall.ao3-menu-modal .checkbox-label,
            .ao3-menu-dialog .radio-label,
            #modal.tall.ao3-menu-modal .radio-label {
              display: flex !important;
              align-items: center !important;
              gap: 0.25em;
            }

            .ao3-menu-dialog .checkbox-label input[type="checkbox"],
            #modal.tall.ao3-menu-modal .checkbox-label input[type="checkbox"],
            .ao3-menu-dialog .radio-label input[type="radio"],
            #modal.tall.ao3-menu-modal .radio-label input[type="radio"] {
              flex-shrink: 0 !important;
              margin-top: 0 !important;
            }

            `
                    : `
            .ao3-menu-dialog input[type="submit"] {
              padding: ${buttonTheme.padding || "0.25em 0.75em"};
              cursor: pointer;
              font-size: 1.1em;
              transition: 25ms ease-out;
            }

            .ao3-menu-dialog input[type="submit"]:hover,
            .ao3-menu-dialog input[type="submit"]:focus {
              ${hoverCSS}
            }

            .ao3-menu-dialog .button-group input[type="submit"] {
              flex: 1;
              padding: ${buttonTheme.padding || "10px"};
            }

            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]) {
              padding: 0.25em 0.75em;
              cursor: pointer;
              transition: 25ms ease-out;
            }

            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]):hover,
            .ao3-menu-dialog button:not(.icon-button):not([class*="eye-toggle"]):not([class*="-toggle"]):focus {
              ${hoverCSS}
            }

            #modal.tall.ao3-menu-modal .footer button.modal-closer {
              padding: 0.25em 0.75em;
              cursor: pointer;
              opacity: 1;
              transition: 25ms ease-out;
              font-size: inherit;
              font-family: inherit;
              line-height: normal;
              margin-right: 8px;
              flex-shrink: 0;
            }

            #modal.tall.ao3-menu-modal .footer button.modal-closer:hover,
            #modal.tall.ao3-menu-modal .footer button.modal-closer:focus {
              ${hoverCSS}
              opacity: 1;
            }

            .ao3-menu-dialog .reset-link a:hover,
            .ao3-menu-dialog .reset-link button:hover {
              opacity: 1;
            }

            .ao3-menu-dialog .reset-link a,
            .ao3-menu-dialog .reset-link button {
              opacity: 0.7;
            }
            `
            }

            .ao3-menu-dialog .reset-link {
              text-align: center;
              margin-top: 10px;
              font-size: 0.9em;
              ${palette ? "" : "color: inherit;"}
            }

            ${
                palette
                    ? `
            .ao3-menu-dialog .reset-link a {
              color: ${linkColor};
              opacity: 0.8;
            }

            .ao3-menu-dialog .reset-link a:hover {
              color: ${linkHoverColor};
              border-bottom: 1px solid ${linkHoverColor};
              opacity: 1;
            }
            `
                    : ""
            }

            .ao3-menu-dialog .symbol.question {
              font-size: 0.55em;
              vertical-align: middle;
              margin-left: 0.1em;
            }

            ${
                palette
                    ? `
            .ao3-menu-dialog .symbol.question {
              display: inline-block;
              width: 1.4em;
              height: 1.4em;
              background-color: #eb6f92;
              color: #ffffff;
              border: none;
              border-radius: 100%;
              box-shadow: none;
              line-height: 1.4;
              text-align: center;
            }
            `
                    : ""
            }
            
            .ao3-menu-dialog .icon-button {
              background: none !important;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
              color: inherit !important;
              opacity: 0.7;
              transition: opacity 0.2s;
              transform: none !important;
            }

            .ao3-menu-dialog .icon-button:hover,
            .ao3-menu-dialog .icon-button:focus {
              opacity: 1 !important;
              transform: none !important;
              background: none !important;
              box-shadow: none !important;
            }

            .ao3-menu-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.5);
              z-index: 9999;
            }

            .ao3-menu-info-box {
              background: ${fieldsetTheme.backgroundColor} !important;
              border: ${fieldsetTheme.borderWidth} solid ${fieldsetTheme.borderColor} !important;
              border-radius: ${fieldsetTheme.borderRadius} !important;
              box-shadow: ${fieldsetTheme.boxShadow} !important;
            }

            .ao3-menu-dialog .ao3-menu-list-item {
              padding: 0.75em !important;
              margin: 8px 0 !important;
              background: ${fieldsetTheme.backgroundColor} !important;
              border: ${fieldsetTheme.borderWidth} solid ${fieldsetTheme.borderColor} !important;
              border-radius: ${fieldsetTheme.borderRadius} !important;
              box-shadow: ${fieldsetTheme.boxShadow} !important;
              cursor: pointer !important;
              display: flex !important;
              justify-content: space-between !important;
              align-items: center !important;
              transition: background 0.2s !important;
              color: inherit !important;
            }

          `;

            return css;
        },

        // ── Dialog event helpers ───────────────────────────

        /**
         * Returns the shared icon-button CSS string.
         * @param {string} [extra=""] - additional CSS declarations to insert before transition
         * @returns {string}
         * @private
         */
        _iconButtonStyle(extra = "") {
            return `background: none;border: none;cursor: pointer;color: inherit;display: flex;align-items: center;justify-content: center;padding: 0;width: 1.25em;height: 1.25em;line-height: 0;opacity: 0.7;${extra}transition: opacity 0.2s;flex-shrink: 0;`;
        },

        /**
         * Adds Escape key support: closes the dialog when Escape is pressed.
         * Cleans up the listener via MutationObserver when dialog is removed.
         * Only closes the topmost dialog if multiple are stacked.
         * @param {HTMLElement} dialog
         * @param {Object} [opts]
         * @param {Function} [opts.onRemove] - called after dialog removal detected
         * @private
         */
        _addEscSupport(dialog, opts = {}) {
            const { onRemove } = opts;
            const escHandler = (e) => {
                if (e.key === "Escape") {
                    const dialogs = Array.from(document.querySelectorAll(".ao3-menu-dialog"));
                    if (dialogs[dialogs.length - 1] === dialog) {
                        dialog.remove();
                        document.removeEventListener("keydown", escHandler);
                    }
                }
            };
            document.addEventListener("keydown", escHandler);

            const observer = new MutationObserver(() => {
                if (!document.body.contains(dialog)) {
                    document.removeEventListener("keydown", escHandler);
                    observer.disconnect();
                    if (onRemove) onRemove();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        /**
         * Adds modal overlay support: creates a semi-transparent overlay behind the dialog.
         * Clicking the overlay closes the topmost dialog. Overlay is shared across dialogs.
         * Cleans up via MutationObserver when the last dialog is removed.
         * @param {HTMLElement} dialog
         * @private
         */
        _addModalSupport(dialog) {
            let overlay = document.querySelector(".ao3-menu-overlay");
            if (!overlay) {
                overlay = document.createElement("div");
                overlay.className = "ao3-menu-overlay";
                overlay.addEventListener("click", () => {
                    const dialogs = Array.from(document.querySelectorAll(".ao3-menu-dialog"));
                    const topDialog = dialogs[dialogs.length - 1];
                    if (topDialog) topDialog.remove();
                });
                document.body.appendChild(overlay);
            }

            const observer = new MutationObserver(() => {
                if (!document.body.contains(dialog)) {
                    if (!document.querySelector(".ao3-menu-dialog")) {
                        overlay.remove();
                    }
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        },

        /**
         * Creates the theme toggle button (auto/light/dark) for dialog title bars.
         * Button cycles through the three modes on click.
         * @param {Function} [onToggle] - callback receiving the new mode
         * @returns {HTMLButtonElement}
         * @private
         */
        _createFallbackToggle(onToggle) {
            const ICONS = {
                null: () => this.getAutoIconSVG(),
                light: () => this.getLightIconSVG(),
                dark: () => this.getDarkIconSVG(),
            };
            const TITLES = {
                null: "Auto Mode",
                light: "Light Mode",
                dark: "Dark Mode",
            };

            const btn = document.createElement("button");
            btn.className = "icon-button ao3-theme-toggle";
            btn.style.cssText = this._iconButtonStyle("font-size: 1em;");

            const updateBtn = (targetBtn, mode) => {
                const key = mode === null ? "null" : mode;
                targetBtn.title = TITLES[key];
                targetBtn.setAttribute("aria-label", TITLES[key]);
                targetBtn.innerHTML = ICONS[key]();
                targetBtn.style.opacity = "0.7";
            };

            updateBtn(btn, this.getFallbackMode());

            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const next = this.cycleFallbackMode();
                if (onToggle) onToggle(next);
                document.querySelectorAll(".ao3-theme-toggle").forEach((b) => {
                    updateBtn(b, next);
                });
            });

            return btn;
        },

        // ── Settings / form controls ────────────────────────

        /**
         * Creates a collapsible settings section
         * @param {string} title - Section title
         * @param {string|HTMLElement} [content] - Section content
         */
        createSection(title, content = "") {
            const section = document.createElement("div");
            section.className = "settings-section";

            const titleElement = document.createElement("h4");
            titleElement.className = "section-title";
            titleElement.textContent = title;
            section.appendChild(titleElement);

            const contentDiv = document.createElement("div");
            contentDiv.className = "section-content";

            if (typeof content === "string" && content) {
                contentDiv.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                contentDiv.appendChild(content);
            }

            section.appendChild(contentDiv);

            const sectionId = title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

            const states = this._getSectionStates();
            if (states[sectionId] === "collapsed") {
                contentDiv.style.display = "none";
                titleElement.classList.add("collapsed");
            }

            const originalAppendChild = section.appendChild.bind(section);
            section.appendChild = function (child) {
                if (child === titleElement || child === contentDiv) {
                    return originalAppendChild(child);
                }
                return contentDiv.appendChild(child);
            };

            titleElement.addEventListener("click", () => {
                const isCurrentlyCollapsed = contentDiv.style.display === "none";
                contentDiv.style.display = isCurrentlyCollapsed ? "" : "none";
                titleElement.classList.toggle("collapsed", !isCurrentlyCollapsed);
                const states = this._getSectionStates();
                states[sectionId] = isCurrentlyCollapsed ? "expanded" : "collapsed";
                this._saveSectionStates(states);
            });

            return section;
        },

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

        createTooltip(text) {
            if (!text) return document.createTextNode("");
            if (ThemeDetector.isMobile) return document.createTextNode("");

            const tooltip = document.createElement("span");
            tooltip.className = "symbol question";
            tooltip.title = text;

            const questionMark = document.createElement("span");
            questionMark.textContent = "?";
            tooltip.appendChild(questionMark);

            return tooltip;
        },

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

        createDescription(text) {
            const help = document.createElement("span");
            help.className = "setting-description";
            help.textContent = text;
            return help;
        },

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
         * Creates a slider with value display that auto-updates
         * @param {Object} config - id, label, min, max, step, value, unit, tooltip
         */
        createSliderWithValue(config) {
            const { id, label, min, max, step, value, unit = "", tooltip = "" } = config;

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

            slider.addEventListener("input", (e) => {
                valueSpan.textContent = e.target.value;
            });

            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(valueDisplay);
            group.appendChild(sliderContainer);

            return group;
        },

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

        createCheckbox(config) {
            const { id, label, checked = false, tooltip = "", inGroup = true } = config;

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
         * Creates a checkbox with subsettings that show/hide when checked
         * @param {Object} config - id, label, checked, tooltip, subsettings (element or array)
         */
        createConditionalCheckbox(config) {
            const { id, label, checked = false, tooltip = "", subsettings } = config;

            const container = this.createSettingGroup();

            const checkboxLabel = this.createCheckbox({
                id,
                label,
                checked,
                tooltip,
                inGroup: false,
            });
            container.appendChild(checkboxLabel);

            const subsettingsContainer = this.createSubsettings();
            subsettingsContainer.style.display = checked ? "" : "none";

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

            setTimeout(() => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                    checkbox.addEventListener("change", (e) => {
                        subsettingsContainer.style.display = e.target.checked ? "" : "none";
                    });
                }
            }, 0);

            return container;
        },

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

        // ── Layout & utilities ────────────────────────────

        createTwoColumnLayout(leftContent, rightContent) {
            const container = document.createElement("div");
            container.className = "two-column";

            if (leftContent instanceof HTMLElement) {
                leftContent.classList.remove("setting-group");
                container.appendChild(leftContent);
            }
            if (rightContent instanceof HTMLElement) {
                rightContent.classList.remove("setting-group");
                container.appendChild(rightContent);
            }

            return container;
        },

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
         * @param {Array} buttons - Array of {text, id, primary, onClick}
         */
        createButtonGroup(buttons) {
            if (!buttons || !Array.isArray(buttons)) {
                return document.createElement("div");
            }

            const group = document.createElement("div");
            group.className = "button-group";

            buttons.forEach((btnConfig) => {
                const button = document.createElement("input");
                button.type = "submit";
                button.value = btnConfig.text;
                if (btnConfig.id) button.id = btnConfig.id;
                if (btnConfig.primary) button.classList.add("primary");
                if (btnConfig.onClick) button.addEventListener("click", btnConfig.onClick);

                group.appendChild(button);
            });

            return group;
        },

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

        createKeyboardKey(keyText) {
            const kbd = document.createElement("kbd");
            kbd.textContent = keyText;
            return kbd;
        },

        /**
         * Creates an info/tip box
         * @param {string|HTMLElement} content - Content to display
         * @param {Object} [options] - icon, title
         */
        createInfoBox(content, options = {}) {
            const { icon = "💡", title = "" } = options;

            const box = document.createElement("div");
            box.className = "ao3-menu-info-box";
            box.style.cssText = "padding: 12px; margin: 15px 0;";

            const contentDiv = document.createElement("div");
            contentDiv.style.cssText =
                "display: flex; align-items: center; gap: 8px; font-size: 0.9em; opacity: 0.8;";

            if (icon) {
                if (icon instanceof HTMLElement) {
                    icon.style.cssText =
                        (icon.style.cssText ? icon.style.cssText + "; " : "") + "flex-shrink: 0;";
                    contentDiv.appendChild(icon);
                } else {
                    const iconSpan = document.createElement("span");
                    iconSpan.innerHTML = icon;
                    iconSpan.style.cssText = "flex-shrink: 0;";
                    contentDiv.appendChild(iconSpan);
                }
            }

            const textDiv = document.createElement("div");
            textDiv.style.cssText = "flex: 1; line-height: 1.4;";

            if (title) {
                const titleSpan = document.createElement("strong");
                titleSpan.textContent = `${title}: `;
                textDiv.appendChild(titleSpan);
            }

            if (typeof content === "string") {
                textDiv.appendChild(document.createTextNode(content));
            } else if (content instanceof HTMLElement) {
                textDiv.appendChild(content);
            } else {
                textDiv.appendChild(document.createTextNode(String(content)));
            }

            contentDiv.appendChild(textDiv);
            box.appendChild(contentDiv);
            return box;
        },

        /**
         * Creates a themed tip/info box with an icon and content.
         * @param {string|HTMLElement} content - Tip text or element
         * @param {Object} [options] - icon, id
         */
        createTipBox(content, options = {}) {
            const { icon = "💡", id = "" } = options;
            const box = this.createInfoBox(content, { icon });
            if (id) box.id = id;
            return box;
        },

        /**
         * Creates a file input with custom button
         * @returns {Object} {button, input}
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

        createHorizontalLayout(elements, options = {}) {
            const { gap = "8px", justifyContent = "flex-start", alignItems = "center" } = options;

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
         * Creates a search input styled after AO3's header search bar (#site_search).
         * Samples live AO3 styles for theme responsiveness, falls back to input detection.
         * @param {Object} config - placeholder, value, onInput
         * @returns {HTMLInputElement}
         */
        createSearchInput(config = {}) {
            const { placeholder = "", value = "", onInput = null } = config;

            const palette = this._getEffectivePalette();

            const sampled = this.sampleElementStyles("#site_search", [
                "backgroundColor",
                "borderColor",
                "color",
                "borderRadius",
                "borderWidth",
                "fontFamily",
                "height",
            ]);

            const inputTheme = this.themeDetector.getInputStyles();

            const input = document.createElement("input");
            input.type = "text";
            if (placeholder) input.placeholder = placeholder;
            if (value) input.value = value;

            const bg = palette
                ? palette.input.backgroundColor
                : sampled.backgroundColor || inputTheme.backgroundColor || "#fff";
            const bc = palette
                ? palette.input.borderColor
                : sampled.borderColor || inputTheme.borderColor || "#b0b0b0";
            const bw = palette
                ? palette.input.borderWidth
                : sampled.borderWidth || inputTheme.borderWidth || "1px";
            const clr = palette ? palette.input.color : sampled.color || inputTheme.color || "#000";
            const rad = palette
                ? palette.input.borderRadius
                : sampled.borderRadius || inputTheme.borderRadius || "0.75rem";
            const ff = sampled.fontFamily || "inherit";

            input.style.cssText = `width:100%;box-sizing:border-box;background:${bg};border:${bw} solid ${bc} !important;color:${clr};border-radius:${rad};padding:0.25em 0.5em;font-size:1em;font-family:${ff};background-image:none;`;

            if (onInput) input.addEventListener("input", onInput);

            return input;
        },

        /**
         * Creates a themed horizontal divider
         * @param {string} margin - CSS margin value (default: "4px 0")
         * @returns {HTMLHRElement}
         */
        createDivider(margin = "4px 0", opacity = 0.8, ignorePalette = false) {
            const div = document.createElement("div");
            let bc;
            if (!ignorePalette) {
                const palette = this._getEffectivePalette();
                if (palette) {
                    bc = palette.fieldset.borderColor;
                }
            }
            if (!bc) {
                const fs = this.themeDetector.getFieldsetStyles();
                bc =
                    fs && fs.borderColor && !this.themeDetector._isTransparent(fs.borderColor)
                        ? fs.borderColor
                        : "currentColor";
            }
            div.style.cssText = `margin:${margin};width:100%;height:0;border:none;border-top:1px solid ${bc};opacity:${opacity}`;
            return div;
        },

        /**
         * Creates an export button that downloads config as JSON.
         * @param {Object|Function} config - data object OR function returning data
         * @param {string} filenamePrefix - e.g. "ao3_advanced_blocker_config"
         * @returns {HTMLButtonElement}
         */
        createExportButton(config, filenamePrefix) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = "Export";
            btn.addEventListener("click", () => {
                try {
                    const data = typeof config === "function" ? config() : config;
                    const now = new Date();
                    const pad = (n) => n.toString().padStart(2, "0");
                    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                    const filename = `${filenamePrefix}_${dateStr}.json`;
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                        type: "application/json",
                    });
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
            return btn;
        },

        /**
         * Creates a row with Reset, Export, and Import buttons.
         * @param {Object} config
         * @param {Function} [config.onReset] - reset callback
         * @param {Object|Function} [config.exportData] - data or function for export
         * @param {string} [config.exportPrefix] - filename prefix
         * @param {Function} [config.onImport] - callback receiving File
         * @param {string} [config.importAccept] - accept attribute (default "application/json")
         * @returns {HTMLElement}
         */
        createImportExportRow(config) {
            const {
                onReset,
                exportData,
                exportPrefix,
                onImport,
                importAccept = "application/json",
            } = config;

            const container = document.createElement("div");
            container.className = "reset-link";
            container.style.cssText =
                "margin-top: 18px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;";

            if (onImport) {
                const fileInput = this.createFileInput({
                    id: `${exportPrefix || "settings"}-import`,
                    buttonText: "Import",
                    accept: importAccept,
                    onChange: onImport,
                });
                fileInput.button.innerHTML = this.getImportIconSVG() + " Import";
                fileInput.button.style.display = "inline-flex";
                fileInput.button.style.alignItems = "center";
                fileInput.button.style.gap = "0.3em";
                const importSvg = fileInput.button.querySelector("svg");
                if (importSvg) {
                    importSvg.style.width = "1em";
                    importSvg.style.height = "1em";
                }
                container.appendChild(fileInput.button);
                container.appendChild(fileInput.input);
            }

            if (exportData && exportPrefix) {
                const exportBtn = this.createExportButton(exportData, exportPrefix);
                exportBtn.innerHTML = this.getExportIconSVG() + " Export";
                exportBtn.style.display = "inline-flex";
                exportBtn.style.alignItems = "center";
                exportBtn.style.gap = "0.3em";
                const exportSvg = exportBtn.querySelector("svg");
                if (exportSvg) {
                    exportSvg.style.width = "1em";
                    exportSvg.style.height = "1em";
                }
                container.appendChild(exportBtn);
            }

            if (onReset) {
                const resetBtn = document.createElement("button");
                resetBtn.type = "button";
                resetBtn.innerHTML = this.getRotateIconSVG() + " Reset";
                resetBtn.style.display = "inline-flex";
                resetBtn.style.alignItems = "center";
                resetBtn.style.gap = "0.3em";
                const resetSvg = resetBtn.querySelector("svg");
                if (resetSvg) {
                    resetSvg.style.width = "1em";
                    resetSvg.style.height = "1em";
                }
                resetBtn.addEventListener("click", () => {
                    if (confirm("Are you sure you want to reset all settings to default?")) {
                        onReset();
                    }
                });
                container.appendChild(resetBtn);
            }

            return container;
        },

        // ── Dialog utilities ──────────────────────────────

        /**
         * Removes all MHL dialog elements from the DOM.
         * Useful for cleanup when opening a new dialog.
         */
        removeAllDialogs() {
            document.querySelectorAll(".ao3-menu-dialog").forEach((dialog) => {
                dialog.remove();
            });
        },

        // ── Form value helpers ────────────────────────────

        /**
         * Gets value from input by ID
         * @returns {string|number|boolean|null}
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
                const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
                for (const radio of radios) {
                    if (radio.checked) return radio.value;
                }
                return null;
            }

            return element.value;
        },

        /**
         * Sets value of input by ID
         */
        setValue(id, value) {
            const element = document.getElementById(id);
            if (!element) return false;

            if (element.type === "checkbox") {
                element.checked = Boolean(value);
            } else if (element.type === "radio") {
                const radio = document.querySelector(
                    `input[name="${element.name}"][value="${value}"]`,
                );
                if (radio) radio.checked = true;
            } else {
                element.value = value;
            }

            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));

            return true;
        },

        // ── List items ──────────────────────────────────────

        /**
         * Creates a clickable list item
         * @param {Object} config - text, onClick, dataAttribute, dataValue, icon, badge, badgeClass, badgeSize
         */
        createListItem(config) {
            const {
                text,
                onClick,
                dataAttribute = "",
                dataValue = "",
                icon = "",
                badge = "",
                badgeClass = "unread",
                badgeSize = "0.7em",
            } = config;

            const item = document.createElement("div");
            item.className = "menu-list-item ao3-menu-list-item";

            if (dataAttribute && dataValue) {
                item.setAttribute(dataAttribute, dataValue);
            }

            const contentDiv = document.createElement("div");
            contentDiv.style.cssText = "flex: 1; min-width: 0; overflow-wrap: break-word;";

            const textSpan = document.createElement("span");
            textSpan.textContent = text;
            contentDiv.appendChild(textSpan);

            if (badge) {
                const badgeElement = document.createElement("span");
                badgeElement.className = `item-badge ${badgeClass}`;
                badgeElement.textContent = badge;

                badgeElement.style.cssText = `
          margin-left: 8px;
          white-space: nowrap;
          display: inline-block;
          font-size: ${badgeSize};
        `;

                contentDiv.appendChild(badgeElement);
            }

            item.appendChild(contentDiv);

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
         * Creates a checkmark icon span (✓).
         * @param {Object} [options]
         * @param {string} [options.title="active"] - tooltip text
         * @param {boolean} [options.useRepliedClass=true] - add AO3 "replied" class for theming
         * @returns {HTMLSpanElement}
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

        // ── Dialog variants ─────────────────────────────────

        /**
         * Creates a dialog/popup container
         * @param {string} title - Dialog title
         * @param {Object} [options] - width, maxWidth, maxHeight, className, showThemeToggle
         */
        createDialog(title, options = {}) {
            this.injectSharedStyles();

            const {
                width = "90%",
                maxWidth = "600px",
                maxHeight = "80vh",
                className = "",
                showThemeToggle = true,
                onThemeToggle,
                actions = [],
            } = options;

            const dialog = document.createElement("div");
            dialog.className = `ao3-menu-dialog ${className}`.trim();

            if (width !== "90%") dialog.style.width = width;
            if (maxWidth !== "600px") dialog.style.maxWidth = maxWidth;
            if (maxHeight !== "80vh") dialog.style.maxHeight = maxHeight;

            const titleElement = document.createElement("h3");
            titleElement.textContent = title;

            const dialogTitleRow = document.createElement("div");
            dialogTitleRow.style.cssText =
                "display: flex; align-items: flex-start; gap: 5px; margin-bottom: 0;";

            const closeBtn = document.createElement("button");
            closeBtn.id = "dialog-close-btn";
            closeBtn.className = "icon-button";
            closeBtn.innerHTML = this.getCloseIconSVG();
            closeBtn.style.cssText = this._iconButtonStyle();
            closeBtn.addEventListener("click", () => dialog.remove());

            dialogTitleRow.appendChild(titleElement);
            titleElement.style.cssText = "flex: 1; text-align: center;";

            // Action buttons
            actions.forEach((action) => {
                const btn = document.createElement("button");
                if (action.id) btn.id = action.id;
                btn.title = action.title || "";
                btn.className = "icon-button";
                btn.style.cssText = this._iconButtonStyle();
                btn.innerHTML = action.icon;
                btn.addEventListener("click", action.onClick);
                dialogTitleRow.appendChild(btn);
            });

            if (showThemeToggle)
                dialogTitleRow.appendChild(this._createFallbackToggle(onThemeToggle));
            dialogTitleRow.appendChild(closeBtn);
            dialog.appendChild(dialogTitleRow);

            this._addEscSupport(dialog);
            this._addModalSupport(dialog);

            return dialog;
        },

        /**
         * Creates a dialog header with title and action buttons
         * @param {Object} config - title, actions (array), includeCloseButton
         */
        createDialogHeader(config) {
            const {
                title,
                actions = [],
                includeCloseButton = true,
                showThemeToggle = true,
                onThemeToggle,
            } = config;

            const header = document.createElement("div");
            header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-shrink: 0;
      `;

            const titleElement = document.createElement("h3");
            titleElement.style.cssText = "color: inherit;";
            titleElement.textContent = title;
            header.appendChild(titleElement);

            const actionsContainer = document.createElement("div");
            actionsContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 5px;
      `;

            actions.forEach((action) => {
                const button = document.createElement("button");
                if (action.id) button.id = action.id;
                button.title = action.title;
                button.className = "icon-button";
                button.style.cssText = this._iconButtonStyle();
                button.innerHTML = action.icon;
                button.addEventListener("click", action.onClick);
                actionsContainer.appendChild(button);
            });

            if (showThemeToggle)
                actionsContainer.appendChild(this._createFallbackToggle(onThemeToggle));

            if (includeCloseButton) {
                const closeBtn = document.createElement("button");
                closeBtn.id = "dialog-close-btn";
                closeBtn.className = "icon-button";
                closeBtn.innerHTML = this.getCloseIconSVG();
                closeBtn.style.cssText = this._iconButtonStyle();
                actionsContainer.appendChild(closeBtn);
            }

            header.appendChild(actionsContainer);
            return header;
        },

        createScrollableContent(content, options = {}) {
            const { maxHeight = "", flex = "1 1 0%" } = options;

            const container = document.createElement("div");
            container.style.cssText = `
        overflow-y: auto;
        overflow-x: clip;
        flex: ${flex};
        box-sizing: border-box;
        padding: 0 6px;
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
         * @param {Object} config - title, content, headerActions, height, width, maxWidth
         */
        createFixedHeightDialog(config) {
            const {
                title,
                content,
                headerActions = [],
                height = "450px",
                width = "90%",
                maxWidth = "500px",
                onThemeToggle,
            } = config;

            this.injectSharedStyles();
            this.injectListItemStyles();

            const dialog = document.createElement("div");
            dialog.className = "ao3-menu-dialog";
            dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10000;
            width: ${width};
            max-width: ${maxWidth};
            height: ${height};
            display: flex;
            flex-direction: column;
            overflow: clip;
            font-family: inherit;
            font-size: inherit;
          `;

            const header = this.createDialogHeader({
                title,
                actions: headerActions,
                includeCloseButton: true,
                onThemeToggle,
            });
            dialog.appendChild(header);

            const scrollable = this.createScrollableContent(content);
            dialog.appendChild(scrollable);

            const closeBtn = dialog.querySelector("#dialog-close-btn");
            if (closeBtn) {
                closeBtn.addEventListener("click", () => dialog.remove());
            }

            dialog.addEventListener("click", (e) => {
                if (e.target === dialog) dialog.remove();
            });

            this._addEscSupport(dialog);
            this._addModalSupport(dialog);

            return dialog;
        },

        // ── Utility / style sampling ────────────────────────

        /**
         * Samples styling from an existing AO3 element
         * @param {string} selector - CSS selector
         * @param {Array<string>} properties - CSS properties to extract
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

        // ── SVG icons ──────────────────────────────────────

        getLightIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="icon icon-tabler icons-tabler-filled icon-tabler-sun-high">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M12 19a1 1 0 0 1 1 1v2a1 1 0 0 1 -2 0v-2a1 1 0 0 1 1 -1m-4.95 -2.05a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1 -1.414 -1.414l1.414 -1.414a1 1 0 0 1 1.414 0m11.314 0l1.414 1.414a1 1 0 0 1 -1.414 1.414l-1.414 -1.414a1 1 0 0 1 1.414 -1.414m-5.049 -9.836a5 5 0 1 1 -2.532 9.674a5 5 0 0 1 2.532 -9.674m-9.315 3.886a1 1 0 0 1 0 2h-2a1 1 0 0 1 0 -2zm18 0a1 1 0 0 1 0 2h-2a1 1 0 0 1 0 -2zm-16.364 -6.778l1.414 1.414a1 1 0 0 1 -1.414 1.414l-1.414 -1.414a1 1 0 0 1 1.414 -1.414m14.142 0a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 0 1 -1.414 -1.414l1.414 -1.414a1 1 0 0 1 1.414 0m-7.778 -3.222a1 1 0 0 1 1 1v2a1 1 0 0 1 -2 0v-2a1 1 0 0 1 1 -1" />
            </svg>`;
        },

        getDarkIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-moon-stars">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" />
                <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
                <path d="M19 11h2m-1 -1v2" />
            </svg>`;
        },

        getAutoIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="icon icon-tabler icons-tabler-filled icon-tabler-sparkles">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M16 19a1 1 0 0 1 0 -2a1 1 0 0 0 1 -1c0 -1.333 2 -1.333 2 0a1 1 0 0 0 1 1c1.333 0 1.333 2 0 2a1 1 0 0 0 -1 1c0 1.333 -2 1.333 -2 0a1 1 0 0 0 -1 -1" />
                <path
                    d="M3 11a5 5 0 0 0 5 -5c0 -1.333 2 -1.333 2 0a5 5 0 0 0 5 5c1.333 0 1.333 2 0 2a5 5 0 0 0 -5 5a1 1 0 0 1 -2 0a5 5 0 0 0 -5 -5c-1.333 0 -1.333 -2 0 -2" />
                <path
                    d="M16 7a1 1 0 0 1 0 -2a1 1 0 0 0 1 -1c0 -1.333 2 -1.333 2 0a1 1 0 0 0 1 1c1.333 0 1.333 2 0 2a1 1 0 0 0 -1 1c0 1.333 -2 1.333 -2 0a1 1 0 0 0 -1 -1" />
            </svg>`;
        },

        getEditIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="icon icon-tabler icons-tabler-filled icon-tabler-edit">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M8 7a1 1 0 0 1 -1 1h-1a1 1 0 0 0 -1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1 -1v-1a1 1 0 0 1 2 0v1a3 3 0 0 1 -3 3h-9a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3h1a1 1 0 0 1 1 1" />
                <path
                    d="M14.596 5.011l4.392 4.392l-6.28 6.303a1 1 0 0 1 -.708 .294h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 .294 -.708zm6.496 -2.103a3.097 3.097 0 0 1 .165 4.203l-.164 .18l-.693 .694l-4.387 -4.387l.695 -.69a3.1 3.1 0 0 1 4.384 0" />
            </svg>`;
        },

        getTrashIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-trash">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M4 7l16 0" />
                <path d="M10 11l0 6" />
                <path d="M14 11l0 6" />
                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
            </svg>`;
        },

        getHomeIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="icon icon-tabler icons-tabler-filled icon-tabler-home">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M12.707 2.293l9 9c.63 .63 .184 1.707 -.707 1.707h-1v6a3 3 0 0 1 -3 3h-1v-7a3 3 0 0 0 -2.824 -2.995l-.176 -.005h-2a3 3 0 0 0 -3 3v7h-1a3 3 0 0 1 -3 -3v-6h-1c-.89 0 -1.337 -1.077 -.707 -1.707l9 -9a1 1 0 0 1 1.414 0m.293 11.707a1 1 0 0 1 1 1v7h-4v-7a1 1 0 0 1 .883 -.993l.117 -.007z" />
            </svg>`;
        },

        getCloseIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-x">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M18 6l-12 12" />
                <path d="M6 6l12 12" />
            </svg>`;
        },

        getPinFilledIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="icon icon-tabler icons-tabler-filled icon-tabler-pin">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M15.113 3.21l.094 .083l5.5 5.5a1 1 0 0 1 -1.175 1.59l-3.172 3.171l-1.424 3.797a1 1 0 0 1 -.158 .277l-.07 .08l-1.5 1.5a1 1 0 0 1 -1.32 .082l-.095 -.083l-2.793 -2.792l-3.793 3.792a1 1 0 0 1 -1.497 -1.32l.083 -.094l3.792 -3.793l-2.792 -2.793a1 1 0 0 1 -.083 -1.32l.083 -.094l1.5 -1.5a1 1 0 0 1 .258 -.187l.098 -.042l3.796 -1.425l3.171 -3.17a1 1 0 0 1 1.497 -1.26z" />
            </svg>`;
        },
        getPinIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-pin">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4" />
                <path d="M9 15l-4.5 4.5" />
                <path d="M14.5 4l5.5 5.5" />
            </svg>`;
        },

        getSettingsIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-settings">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                    d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" />
                <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
            </svg>`;
        },

        getHelpIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-help">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                <path d="M12 17l0 .01" />
                <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
            </svg>`;
        },

        getImportIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-download-icon lucide-download">
                <path d="M12 15V3" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="m7 10 5 5 5-5" />
            </svg>`;
        },

        getExportIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-upload-icon lucide-upload">
                <path d="M12 3v12" />
                <path d="m17 8-5-5-5 5" />
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            </svg>`;
        },

        getRotateIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-refresh">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
                <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </svg>`;
        },

        getPlusIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-plus">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 5l0 14" />
                <path d="M5 12l14 0" />
            </svg>`;
        },

        getSwitchVerticalIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-switch-vertical">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M3 8l4 -4l4 4" />
                <path d="M7 4l0 9" />
                <path d="M13 16l4 4l4 -4" />
                <path d="M17 10l0 10" />
            </svg>`;
        },

        getArrowUpIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-up">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 5l0 14" />
                <path d="M18 11l-6 -6" />
                <path d="M6 11l6 -6" />
            </svg>`;
        },

        getArrowDownIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-down">
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M12 5l0 14" />
                <path d="M18 13l-6 6" />
                <path d="M6 13l6 6" />
            </svg>`;
        },

        getCheckIconSVG() {
            return html`<svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-check-icon lucide-check">
                <path d="M20 6 9 17l-5-5" />
            </svg>`;
        },

        // ── Menu integration ───────────────────────────────

        /**
         * Adds an item to the shared Userscripts dropdown menu
         * @param {Object} config - id, text, onClick, position, menuTitle
         */
        addToSharedMenu(config) {
            const { id, text, onClick, position = "append", menuTitle = "Userscripts" } = config;

            if (!id || !text || typeof onClick !== "function") {
                console.error(
                    "[AO3: Menu Helpers] addToSharedMenu: id, text, and onClick are required",
                );
                return false;
            }

            let menuContainer = document.getElementById("scriptconfig");
            if (!menuContainer) {
                const headerMenu = document.querySelector("ul.primary.navigation.actions");
                const searchItem = headerMenu?.querySelector("li.search");
                if (!headerMenu || !searchItem) {
                    console.warn(
                        "[AO3: Menu Helpers] Could not find header menu to add userscripts dropdown",
                    );
                    return false;
                }

                menuContainer = document.createElement("li");
                menuContainer.className = "dropdown";
                menuContainer.id = "scriptconfig";
                menuContainer.innerHTML = `<a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">${menuTitle}</a><ul class="menu dropdown-menu"></ul>`;
                headerMenu.insertBefore(menuContainer, searchItem);
            }

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

        /**
         * Checks if current page is AO3 homepage
         * @returns {boolean}
         */
        isAO3Homepage() {
            return (
                window.location.href === "https://archiveofourown.org/" ||
                window.location.href === "https://archiveofourown.org"
            );
        },

        /**
         * Creates a "Hide menu option" checkbox for scripts that add menu items
         * @param {Object} config - id, checked
         * @returns {HTMLElement}
         */
        createHideMenuCheckbox(config) {
            return this.createCheckbox({
                id: config.id || "hideMenuOptions",
                label: "Hide menu option",
                checked: config.checked !== undefined ? config.checked : false,
                tooltip: "Only show menu item on AO3 homepage to reduce clutter.",
            });
        },

        // ── AO3-native modal ────────────────────────────────

        /**
         * Creates AO3-native help modal near trigger element.
         * Uses #modal/.tall/.content.userstuff/.footer structure matching AO3.
         * @param {Object} config - title, content (string|HTMLElement), footerTitle, closeText, triggerElement
         * @returns {HTMLElement} modal element
         */
        createMenuModal(config = {}) {
            const {
                title = "",
                content = "",
                footerTitle = "",
                closeText = "Close",
                triggerElement = null,
            } = config;

            // Snapshot native modal styles before removal (survives cache clears)
            this.themeDetector._snapshotNativeModal();

            // Save native #modal before removal so AO3 modals still work later
            const nativeModal = document.getElementById("modal");
            const nativeModalParent = nativeModal ? nativeModal.parentNode : null;
            const nativeModalSibling = nativeModal ? nativeModal.nextSibling : null;
            if (nativeModal) nativeModal.remove();

            const modal = document.createElement("div");
            modal.id = "modal";
            modal.className = "tall ao3-menu-modal";
            modal.style.display = "inline-block";

            // Content
            const contentDiv = document.createElement("div");
            contentDiv.className = "content userstuff";

            if (title) {
                const titleRow = document.createElement("div");
                titleRow.style.cssText = "display: flex; align-items: flex-start; gap: 5px;";
                const titleEl = document.createElement("h4");
                titleEl.style.cssText = "flex: 1;";
                titleEl.textContent = title;
                titleRow.appendChild(titleEl);

                const closeBtn = document.createElement("button");
                closeBtn.className = "icon-button";
                closeBtn.innerHTML = this.getCloseIconSVG();
                closeBtn.style.cssText = this._iconButtonStyle();
                closeBtn.addEventListener("click", () => modal.remove());
                titleRow.appendChild(closeBtn);

                contentDiv.appendChild(titleRow);
            }

            if (typeof content === "string") {
                contentDiv.insertAdjacentHTML("beforeend", content);
            } else if (content instanceof HTMLElement) {
                contentDiv.appendChild(content);
            }

            modal.appendChild(contentDiv);
            modal.appendChild(this.createMenuModalFooter({ title: footerTitle, closeText }));

            // Close on modal-closer click
            modal.addEventListener("click", (e) => {
                if (e.target.classList.contains("modal-closer")) {
                    e.preventDefault();
                    modal.remove();
                }
            });

            // Position near trigger, or match .ao3-menu-dialog position+size
            if (triggerElement) {
                this._positionMenuModal(modal, triggerElement);
            } else {
                const sourceDialog = document.querySelector(".ao3-menu-dialog");
                modal.style.position = "fixed";
                modal.style.zIndex = "10000";
                if (sourceDialog) {
                    // Use same centering as .ao3-menu-dialog for perfect overlap
                    modal.style.top = "50%";
                    modal.style.left = "50%";
                    modal.style.transform = "translate(-50%, -50%)";
                    const dr = sourceDialog.getBoundingClientRect();
                    modal.style.width = dr.width + "px";
                    modal.style.maxHeight = "80vh";
                    modal.style.boxSizing = "border-box";
                } else {
                    this._centerMenuModal(modal);
                }
            }

            // Escape key support (auto-cleans up listeners on removal)
            this._setupMenuModalEsc(modal, nativeModal, nativeModalParent, nativeModalSibling);

            // Overlay for click-outside-to-close (auto-cleans up on removal)
            this._setupMenuModalOverlay(modal);

            document.body.appendChild(modal);
            return modal;
        },

        /**
         * Creates footer for AO3-native help modals
         * @param {Object} config - title, closeText
         * @returns {HTMLElement}
         */
        createMenuModalFooter(config = {}) {
            const { title = "", closeText = "Close" } = config;

            const footer = document.createElement("div");
            footer.className = "footer";

            const titleSpan = document.createElement("span");
            titleSpan.className = "title";
            titleSpan.textContent = title;
            footer.appendChild(titleSpan);

            const closeBtn = document.createElement("button");
            closeBtn.className = "modal-closer";
            closeBtn.textContent = closeText;
            footer.appendChild(closeBtn);

            return footer;
        },

        /**
         * Sets up Escape key handler for a menu modal.
         * Auto-cleans up listeners and restores native #modal when modal is removed.
         * @param {HTMLElement} modal
         * @param {HTMLElement|null} nativeModal - original AO3 #modal to restore on close
         * @param {Node|null} nativeModalParent
         * @param {Node|null} nativeModalSibling
         * @private
         */
        _setupMenuModalEsc(modal, nativeModal, nativeModalParent, nativeModalSibling) {
            this._addEscSupport(modal, {
                onRemove: () => {
                    if (nativeModal && !document.getElementById("modal")) {
                        if (nativeModalSibling && nativeModalParent) {
                            nativeModalParent.insertBefore(nativeModal, nativeModalSibling);
                        } else if (nativeModalParent) {
                            nativeModalParent.appendChild(nativeModal);
                        } else {
                            document.body.appendChild(nativeModal);
                        }
                    }
                },
            });
        },

        /**
         * Sets up click-outside-to-close overlay for a menu modal.
         * Delegates to {@link _addModalSupport} — this is an alias for clarity.
         * @param {HTMLElement} modal
         * @private
         */
        _setupMenuModalOverlay(modal) {
            this._addModalSupport(modal);
        },

        /**
         * Positions modal absolutely near trigger element (AO3-native style).
         * Repositions if off-screen.
         * @private
         */
        _positionMenuModal(modal, triggerElement) {
            const triggerRect = triggerElement.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            modal.style.position = "absolute";
            modal.style.zIndex = "10000";

            let top = triggerRect.bottom + window.scrollY;
            let left = triggerRect.left + window.scrollX;

            modal.style.top = top + "px";
            modal.style.left = left + "px";

            requestAnimationFrame(() => {
                const mr = modal.getBoundingClientRect();
                if (mr.right > vw) {
                    modal.style.left = Math.max(0, vw - mr.width - 10) + "px";
                }
                if (mr.bottom > vh) {
                    modal.style.top =
                        Math.max(0, triggerRect.top - mr.height) + window.scrollY + "px";
                }
                if (mr.top < 0) {
                    modal.style.top = Math.max(5, triggerRect.bottom) + window.scrollY + "px";
                }
            });
        },

        /**
         * Centers modal in viewport (fallback when no trigger)
         * @private
         */
        _centerMenuModal(modal) {
            requestAnimationFrame(() => {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const mw = modal.offsetWidth;
                const mh = modal.offsetHeight;
                modal.style.left = Math.max(10, (vw - mw) / 2) + "px";
                modal.style.top = Math.max(10, (vh - mh) / 2) + window.scrollY + "px";
            });
        },
    };

    console.log("[AO3: Menu Helpers] Library loaded, version", window.AO3MenuHelpers.version);
})();
