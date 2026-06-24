// ==UserScript==
// @name          AO3: Chapter Shortcuts
// @version       2.6.7
// @description   Add shortcuts for first and last chapters on AO3 works. Customize the latest chapter symbol on work titles.
// @author        BlackBatCat
// @license       MIT
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/works?*
// @match         *://archiveofourown.org/chapters/*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @require       https://update.greasyfork.org/scripts/552743/1859007/AO3%3A%20Menu%20Helpers%20Library.js?v=2.3.0
// @grant         none
// ==/UserScript==

(function () {
    "use strict";
    const html = (strings, ...values) =>
        strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");

    // Wait for library to load
    if (!window.AO3MenuHelpers) {
        console.error("[AO3: Chapter Shortcuts] Menu Helpers library not loaded!");
        return;
    }

    // ============================================================
    // CONSTANTS
    // ============================================================

    const helpers = window.AO3MenuHelpers;

    const CHAPTER_SHORTCUTS_CONFIG_KEY = "ao3_chapter_shortcuts_config";
    const DEFAULT_CHAPTER_SHORTCUTS_CONFIG = {
        lastChapterSymbol: "»",
        enableLastChapterSymbol: true,
        bookmarksOnly: false,
        hideMenuOptions: false,
        enableBottomButtons: true,
        disableTopNavButtons: false,
        hideEntireWorkButton: false,
        hideShareButton: false,
        hideDownloadButton: false,
        hideInviteButton: false,
    };

    // ============================================================
    // STATE
    // ============================================================

    let CHAPTER_SHORTCUTS_CONFIG = { ...DEFAULT_CHAPTER_SHORTCUTS_CONFIG };

    // Dedup in-flight chapter fetches by story ID
    const CHAPTER_FETCH_IN_FLIGHT = new Map();

    // sessionStorage key prefix for caching last-chapter URLs
    const CHAPTER_CACHE_PREFIX = "ao3_cs_last_chap_";

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Extract the work ID from the current page URL or chapter select form.
     * @returns {string|null} work ID
     */
    function getStoryId() {
        const match = window.location.pathname.match(/works\/(\d+)/);
        if (match !== null) {
            return match[1];
        }
        const chapterForm = document.querySelector("#chapter_index li form");
        if (chapterForm && chapterForm.getAttribute("action")) {
            const actionMatch = chapterForm.getAttribute("action").match(/works\/(\d+)/);
            if (actionMatch) {
                return actionMatch[1];
            }
        }
        return null;
    }

    /**
     * Detects the logged-in username via MHL. This script has no persisted
     * config field for it, so every call re-resolves from the DOM/URL —
     * cheap enough since it's only used to check `isUsersBookmarksPage`.
     */
    function detectUsername() {
        return window.AO3MenuHelpers.detectUsername().username;
    }

    function isUsersBookmarksPage(username) {
        if (!username) return false;
        const path = window.location.pathname;
        const search = window.location.search;
        const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        // /users/{name}[/pseuds/{psued}]/bookmarks
        if (new RegExp(`^/users/${escaped}(?:/pseuds/[^/]+)?/bookmarks/?`, "i").test(path))
            return true;
        // /bookmarks?...&user_id={name} or /bookmarks?user_id={name}...
        if (
            /^\/bookmarks\/?/.test(path) &&
            new RegExp(`(?:^|&)user_id=${escaped}(?:&|$)`, "i").test(search.slice(1))
        )
            return true;
        return false;
    }

    // ============================================================
    // STORAGE
    // ============================================================

    /** Load config from localStorage, merging with defaults. */
    function loadChapterShortcutsConfig() {
        try {
            const saved = localStorage.getItem(CHAPTER_SHORTCUTS_CONFIG_KEY);
            if (saved) {
                CHAPTER_SHORTCUTS_CONFIG = {
                    ...DEFAULT_CHAPTER_SHORTCUTS_CONFIG,
                    ...JSON.parse(saved),
                };
            }
        } catch (e) {
            console.error("Error loading config:", e);
        }
    }

    /** Persist current config to localStorage. */
    function saveChapterShortcutsConfig() {
        try {
            localStorage.setItem(
                CHAPTER_SHORTCUTS_CONFIG_KEY,
                JSON.stringify(CHAPTER_SHORTCUTS_CONFIG),
            );
        } catch (e) {
            console.error("Error saving config:", e);
        }
    }

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /**
     * Hide work page action buttons (Entire Work, Share, Download, Invite)
     * based on user config.
     */
    function hideWorkPageButtons() {
        if (CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton) {
            document.querySelectorAll("li.chapter.entire").forEach((el) => {
                el.style.display = "none";
            });
        }

        if (CHAPTER_SHORTCUTS_CONFIG.hideShareButton) {
            document.querySelectorAll('a.modal[title="Share Work"]').forEach((el) => {
                if (el.parentElement) el.parentElement.style.display = "none";
            });
        }

        if (CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton) {
            document.querySelectorAll("li.download").forEach((el) => {
                el.style.display = "none";
            });
        }

        if (CHAPTER_SHORTCUTS_CONFIG.hideInviteButton) {
            document.querySelectorAll("a.collection_item_form_placement_open").forEach((el) => {
                el.style.display = "none";
            });
        }
    }

    /**
     * Create a First Chapter navigation button.
     * @param {string} id - element ID
     * @returns {HTMLLIElement}
     */
    function createFirstChapterButton(id) {
        const btn = document.createElement("li");
        btn.id = id;
        btn.innerHTML = html`<a>First Chapter</a>`;
        btn.addEventListener("click", function () {
            const id = getStoryId();
            if (id) window.location.href = `/works/${id}`;
        });
        return btn;
    }

    /**
     * Create a Last Chapter navigation button.
     * @param {string} id - element ID
     * @returns {HTMLLIElement}
     */
    function createLastChapterButton(id) {
        const btn = document.createElement("li");
        btn.id = id;
        btn.innerHTML = html`<a>Last Chapter</a>`;
        btn.addEventListener("click", function () {
            const select = document.querySelector("#selected_id");
            if (select && select.options.length > 0) {
                const id = getStoryId();
                if (!id) return;
                const lastChapterId = select.options[select.options.length - 1].value;
                window.location.href = `/works/${id}/chapters/${lastChapterId}`;
            }
        });
        return btn;
    }

    /**
     * Add First/Last Chapter navigation buttons (top + bottom) and
     * last-chapter links on work listing headings.
     * @param {boolean} forceRerender - remove existing buttons before adding
     */
    function addChapterButtons(forceRerender = false) {
        // Remove any previous custom links/buttons if rerendering
        if (forceRerender) {
            document
                .querySelectorAll(
                    "#go_to_last_chap, #go_to_first_chap, #go_to_last_chap_bottom, #go_to_first_chap_bottom",
                )
                .forEach((el) => el.remove());
            document.querySelectorAll(".ao3-last-chapter-link").forEach((el) => el.remove());
        }

        // Check if we're on a work page with chapter navigation
        const workNav = document.querySelector("ul.work");
        const navList = document.querySelector("ul.work.navigation.actions");
        const indexList = document.querySelector("ul.index");
        const hasNext = navList && navList.querySelector("li.next");
        const hasPrev = navList && navList.querySelector("li.previous");
        if (workNav && !indexList) {
            // Insert First Chapter button before Last Chapter button (top nav)
            if (!CHAPTER_SHORTCUTS_CONFIG.disableTopNavButtons) {
                let firstChapterBtn = null;
                let lastChapterBtn = null;
                if (hasPrev) {
                    firstChapterBtn = createFirstChapterButton("go_to_first_chap");
                    workNav.prepend(firstChapterBtn);
                }
                if (hasNext) {
                    lastChapterBtn = createLastChapterButton("go_to_last_chap");
                    if (firstChapterBtn && firstChapterBtn.nextSibling) {
                        firstChapterBtn.insertAdjacentElement("afterend", lastChapterBtn);
                    } else {
                        workNav.prepend(lastChapterBtn);
                    }
                }
            }
        }

        // Insert bottom navigation buttons using the beta approach
        const actionsUl = document.querySelector("#feedback ul.actions");
        if (actionsUl && CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons && workNav && !indexList) {
            // Remove any previously added bottom buttons
            actionsUl
                .querySelectorAll("#go_to_first_chap_bottom, #go_to_last_chap_bottom")
                .forEach((el) => el.remove());
            const topLi = actionsUl.querySelector('li a[href="#main"]');
            if (topLi && topLi.parentElement) {
                let insertAfter = topLi.parentElement;
                // Always insert First Chapter before Last Chapter
                let firstChapterBtn = null;
                let lastChapterBtn = null;
                if (hasPrev) {
                    firstChapterBtn = createFirstChapterButton("go_to_first_chap_bottom");
                    insertAfter.insertAdjacentElement("afterend", firstChapterBtn);
                    insertAfter = firstChapterBtn;
                }
                if (hasNext) {
                    lastChapterBtn = createLastChapterButton("go_to_last_chap_bottom");
                    insertAfter.insertAdjacentElement("afterend", lastChapterBtn);
                }
            }
        }

        // Add last chapter links to work listings (staggered eager fetch, sessionStorage-cached)
        if (
            CHAPTER_SHORTCUTS_CONFIG.enableLastChapterSymbol &&
            (!CHAPTER_SHORTCUTS_CONFIG.bookmarksOnly || isUsersBookmarksPage(detectUsername())) &&
            document.querySelector(".header h4.heading")
        ) {
            const headings = document.querySelectorAll(".header h4.heading");
            let delay = 0;
            headings.forEach((heading) => {
                const link = heading.querySelector("a");
                if (!link) return;
                const storyPath = link.getAttribute("href");
                const match = storyPath.match(/works\/(\d+)/);
                if (!match) return;
                const storyId = match[1];
                const cacheKey = CHAPTER_CACHE_PREFIX + storyId;

                const injectLastChapterLink = (lastChapterPath) => {
                    if (heading.querySelector(".ao3-last-chapter-link")) return;
                    const lastChapterEl = document.createElement("a");
                    lastChapterEl.href = lastChapterPath;
                    lastChapterEl.title = "Jump to last chapter";
                    lastChapterEl.textContent = ` ${
                        CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol || "»"
                    }`;
                    lastChapterEl.className = "ao3-last-chapter-link";
                    heading.appendChild(lastChapterEl);
                };

                // Skip single-chapter works
                const blurb = heading.closest("li.blurb");
                const chaptersText = blurb?.querySelector("dd.chapters")?.textContent?.trim();
                if (chaptersText) {
                    const chaptersMatch = chaptersText
                        .replace(/&nbsp;/g, " ")
                        .match(/^(\d+)\s*\/\s*([\d?]+)/);
                    if (
                        chaptersMatch &&
                        chaptersMatch[2] !== "?" &&
                        parseInt(chaptersMatch[2], 10) === 1
                    )
                        return;
                }

                // If cached, inject immediately with no fetch
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    injectLastChapterLink(cached);
                    return;
                }

                if (CHAPTER_FETCH_IN_FLIGHT.has(storyId)) return;
                CHAPTER_FETCH_IN_FLIGHT.set(storyId, true);

                setTimeout(() => {
                    fetch(`/works/${storyId}/navigate`)
                        .then((response) => response.text())
                        .then((data) => {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(data, "text/html");
                            const lastChapterLink = doc.querySelector("ol li:last-child a");
                            if (lastChapterLink) {
                                const lastChapterPath = lastChapterLink.getAttribute("href");
                                try {
                                    sessionStorage.setItem(cacheKey, lastChapterPath);
                                } catch (_) {}
                                injectLastChapterLink(lastChapterPath);
                            }
                        })
                        .catch((error) => console.error("Error fetching chapter data:", error))
                        .finally(() => CHAPTER_FETCH_IN_FLIGHT.delete(storyId));
                }, delay);
                delay += 150;
            });
        }
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    /**
     * Build and display the settings dialog using MHL form controls.
     * Configures last-chapter symbol, bottom buttons, hide-work-buttons.
     */
    function showChapterShortcutsMenu() {
        try {
            helpers.removeAllDialogs();

            const dialog = helpers.createDialog("🏃🏻 Chapter Shortcuts 🏃🏻", {
                maxWidth: "600px",
            });

            // ── Last Chapter Symbol ──────────────────────────
            const symbolSection = helpers.createSection("🔤 Last Chapter Symbol");
            const presetGroup = helpers.createSettingGroup();
            presetGroup.appendChild(helpers.createLabel("Choose a Last Chapter symbol:"));

            const presetSymbols = ["»", "➼", "➺", "✦", "♥", "✿", "ɞɞ"];
            const presetButtons = presetSymbols.map((symbol) => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "preset-symbol";
                btn.dataset.symbol = symbol;
                btn.textContent = symbol;
                btn.style.cssText =
                    "display: inline-flex; align-items: center; justify-content: center; font-family: inherit; font-size: inherit; line-height: 1; color: inherit;";
                return btn;
            });

            const buttonContainer = helpers.createHorizontalLayout(presetButtons, {
                gap: "10px",
                justifyContent: "center",
            });
            buttonContainer.style.marginBottom = "10px";
            presetGroup.appendChild(buttonContainer);

            symbolSection.appendChild(presetGroup);

            const customInput = helpers.createTextInput({
                id: "custom-symbol",
                label: "Or enter your own:",
                value: CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol,
                placeholder: "",
            });
            const customSymbolInput = customInput.querySelector("#custom-symbol");
            if (customSymbolInput) customSymbolInput.maxLength = 4;
            symbolSection.appendChild(customInput);

            // Add preset button click handlers
            presetButtons.forEach((btn) => {
                btn.addEventListener("click", () => {
                    const el = document.getElementById("custom-symbol");
                    if (el) el.value = btn.dataset.symbol;
                });
            });

            const hideLastChapterSymbolCheckbox = helpers.createCheckbox({
                id: "hide-last-chapter-symbol",
                label: "Hide last chapter symbol",
                checked: CHAPTER_SHORTCUTS_CONFIG.enableLastChapterSymbol === false,
            });
            symbolSection.appendChild(hideLastChapterSymbolCheckbox);

            const bookmarksOnlyCheckbox = helpers.createCheckbox({
                id: "bookmarks-only-symbol",
                label: "Show on bookmarks pages only",
                checked: CHAPTER_SHORTCUTS_CONFIG.bookmarksOnly === true,
            });
            symbolSection.appendChild(bookmarksOnlyCheckbox);

            // Toggle picker and bookmarks-only visibility when symbol is hidden
            function updateSymbolVisibility() {
                const hidden = helpers.getValue("hide-last-chapter-symbol");
                presetGroup.style.display = hidden ? "none" : "";
                customInput.style.display = hidden ? "none" : "";
                bookmarksOnlyCheckbox.style.display = hidden ? "none" : "";
            }
            updateSymbolVisibility();
            hideLastChapterSymbolCheckbox
                .querySelector("input[type=checkbox]")
                ?.addEventListener("change", updateSymbolVisibility);

            dialog.appendChild(symbolSection);

            // ── Options ───────────────────────────────────────
            const optionsSection = helpers.createSection("⚙️ Options");

            const showTopNavCheckbox = helpers.createCheckbox({
                id: "show-top-nav-buttons",
                label: "Show First/Last Chapter buttons",
                checked: !CHAPTER_SHORTCUTS_CONFIG.disableTopNavButtons,
            });
            optionsSection.appendChild(showTopNavCheckbox);

            const enableBottomCheckbox = helpers.createCheckbox({
                id: "enable-bottom-buttons",
                label: "Show bottom navigation buttons",
                checked: CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons,
            });
            optionsSection.appendChild(enableBottomCheckbox);

            const hideButtonsSubsettings = helpers.createSubsettings();

            const hideButtonsRow1 = helpers.createTwoColumnLayout(
                helpers.createCheckbox({
                    id: "hide-entire-work-button",
                    label: "Entire work",
                    checked: CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton,
                    inGroup: false,
                }),
                helpers.createCheckbox({
                    id: "hide-share-button",
                    label: "Share",
                    checked: CHAPTER_SHORTCUTS_CONFIG.hideShareButton,
                    inGroup: false,
                }),
            );
            hideButtonsSubsettings.appendChild(hideButtonsRow1);

            const hideButtonsRow2 = helpers.createTwoColumnLayout(
                helpers.createCheckbox({
                    id: "hide-download-button",
                    label: "Download",
                    checked: CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton,
                    inGroup: false,
                }),
                helpers.createCheckbox({
                    id: "hide-invite-button",
                    label: "Invite to collections",
                    checked: CHAPTER_SHORTCUTS_CONFIG.hideInviteButton,
                    inGroup: false,
                }),
            );
            hideButtonsSubsettings.appendChild(hideButtonsRow2);

            const hideButtonsCheckbox = helpers.createConditionalCheckbox({
                id: "hide-buttons-option",
                label: "Hide buttons on work pages",
                checked:
                    CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton ||
                    CHAPTER_SHORTCUTS_CONFIG.hideShareButton ||
                    CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton ||
                    CHAPTER_SHORTCUTS_CONFIG.hideInviteButton,
                subsettings: hideButtonsSubsettings,
            });
            optionsSection.appendChild(hideButtonsCheckbox);

            const hideMenuCheckbox = helpers.createHideMenuCheckbox({
                id: "hide-menu-option",
                checked: CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions,
            });
            optionsSection.appendChild(hideMenuCheckbox);

            dialog.appendChild(optionsSection);

            // ── Buttons ───────────────────────────────────────
            const buttons = helpers.createButtonGroup([
                {
                    text: "Save",
                    id: "chapter-shortcuts-save",
                    primary: true,
                    onClick: () => {
                        CHAPTER_SHORTCUTS_CONFIG.enableLastChapterSymbol =
                            helpers.getValue("hide-last-chapter-symbol") !== true;
                        CHAPTER_SHORTCUTS_CONFIG.bookmarksOnly =
                            helpers.getValue("bookmarks-only-symbol") === true;
                        CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol =
                            helpers.getValue("custom-symbol") || "»";
                        CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions =
                            helpers.getValue("hide-menu-option");
                        CHAPTER_SHORTCUTS_CONFIG.disableTopNavButtons =
                            !helpers.getValue("show-top-nav-buttons");
                        CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons =
                            helpers.getValue("enable-bottom-buttons");
                        CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton =
                            helpers.getValue("hide-entire-work-button");
                        CHAPTER_SHORTCUTS_CONFIG.hideShareButton =
                            helpers.getValue("hide-share-button");
                        CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton =
                            helpers.getValue("hide-download-button");
                        CHAPTER_SHORTCUTS_CONFIG.hideInviteButton =
                            helpers.getValue("hide-invite-button");
                        saveChapterShortcutsConfig();
                        dialog.remove();
                        addChapterButtons(true);
                        hideWorkPageButtons();
                    },
                },
                {
                    text: "Cancel",
                    id: "chapter-shortcuts-cancel",
                    onClick: () => {
                        dialog.remove();
                    },
                },
            ]);
            dialog.appendChild(buttons);

            document.body.appendChild(dialog);

            // Close on background click
            dialog.addEventListener("click", (e) => {
                if (e.target === dialog) dialog.remove();
            });
        } catch (e) {
            console.error("[AO3: Chapter Shortcuts] Menu error:", e);
            alert("Chapter Shortcuts: " + (e && e.message ? e.message : e));
        }
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    /**
     * Watch for dynamically-added bottom navigation UL and inject
     * First/Last Chapter buttons when it appears.
     */
    function setupBottomNavObserver() {
        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                processMutations();
            }, 50);
        });

        function processMutations() {
            // Check the entire DOM for bottom nav (not per-node — debounce aggregates)
            const bottomNav = document
                .querySelector('ul.actions a[href="#main"]')
                ?.closest("ul.actions");
            if (bottomNav) {
                // Add bottom buttons if enabled and on work page
                const workNav = document.querySelector("ul.work");
                const indexList = document.querySelector("ul.index");
                if (workNav && !indexList && CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons) {
                    const topLink = bottomNav.querySelector('a[href="#main"]');
                    if (topLink) {
                        // Guard: skip if buttons already present (prevents observer self-trigger loop)
                        const alreadyFirst = bottomNav.querySelector("#go_to_first_chap_bottom");
                        const alreadyLast = bottomNav.querySelector("#go_to_last_chap_bottom");
                        if (alreadyFirst || alreadyLast) return;

                        const topLi = topLink.parentElement;
                        const navList = document.querySelector("ul.work.navigation.actions");
                        const hasNext = navList && navList.querySelector("li.next");
                        const hasPrev = navList && navList.querySelector("li.previous");

                        // Add First Chapter button if not on the first chapter
                        if (hasPrev) {
                            const firstChapterBtnBottom =
                                createFirstChapterButton("go_to_first_chap_bottom");
                            topLi.after(firstChapterBtnBottom);
                        }

                        // Add Last Chapter button if not on the last chapter
                        if (hasNext) {
                            const lastChapterBtnBottom =
                                createLastChapterButton("go_to_last_chap_bottom");
                            // Insert after first chapter or after top
                            const firstBtn = bottomNav.querySelector("#go_to_first_chap_bottom");
                            if (firstBtn) {
                                firstBtn.after(lastChapterBtnBottom);
                            } else {
                                topLi.after(lastChapterBtnBottom);
                            }
                        }
                    }
                }
            }
        }
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    loadChapterShortcutsConfig();

    console.log("[AO3: Chapter Shortcuts] loaded.");

    // Fix: other MHL instances destroy shared stylesheet; re-inject at init time
    if (!document.getElementById("ao3-menu-helpers-styles")) {
        const style = document.createElement("style");
        style.id = "ao3-menu-helpers-styles";
        style.textContent = helpers._generateSharedStyles();
        document.head.appendChild(style);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initMenu();
            addChapterButtons();
            hideWorkPageButtons();
            setupBottomNavObserver();
        });
    } else {
        initMenu();
        addChapterButtons();
        hideWorkPageButtons();
        setupBottomNavObserver();
    }

    /** Register shared menu item */
    function initMenu() {
        if (!CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions || helpers.isAO3Homepage()) {
            helpers.addToSharedMenu({
                id: "opencfg_chapter_shortcuts",
                text: "Chapter Shortcuts",
                onClick: showChapterShortcutsMenu,
            });
        }
    }
})();
