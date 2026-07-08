// ==UserScript==
// @name          AO3: Quick Hide
// @version       1.1.1
// @description   Quickly hide works, bookmarks, and comments while browsing AO3. Collapse state is saved so you can hide things you've read or aren't interested in.
// @author        BlackBatCat
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/chapters/*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1859007/AO3%3A%20Menu%20Helpers%20Library.js?v=2.3.0
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
    "use strict";
    const html = (strings, ...values) =>
        strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");

    // ============================================================
    // CONSTANTS
    // ============================================================

    const STORAGE_KEY = "ao3_quick_hide_config";
    const SETTINGS_KEY = "ao3_quick_hide_settings";

    const TIMING = {
        TOUCH_EXPAND_DELAY: 150,
        TOUCH_COLLAPSE_DELAY: 300,
        CONFIG_SAVE_DEBOUNCE: 100,
        MUTATION_OBSERVER_DEBOUNCE: 50,
    };

    const SELECTORS = {
        COMMENTS: 'li.comment[id^="comment_"]',
        WORK_BLURBS: 'li.work.blurb[id^="work_"]',
        BOOKMARKS: 'li.bookmark.blurb[id^="bookmark_"]',
    };

    const DEFAULTS = {
        enableComments: true,
        enableWorks: true,
        enableBookmarks: true,
        linkWorkBookmarkStates: true,
        collapseStyle: "default",
        collapsedOpacity: 0.4,
        hoverExpand: true,
        overrideFicTrackerStyle: true,
        hideMenuOptions: false,
        username: null,
    };

    // ============================================================
    // STATE
    // ============================================================

    let SETTINGS = { ...DEFAULTS };

    let configCache = null;
    let saveTimer = null;
    let cachedUsername = null;
    let initialSetupComplete = false;

    const touchTimers = new WeakMap();

    let debounceTimer = null;

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /** @param {string} context @param {Error} error */
    function handleError(context, error) {
        console.error(`[AO3: Quick Hide] ${context}`, error);
    }

    /**
     * Detects the logged-in username, memoized for the lifetime of the page.
     * Delegates to MHL, which only persists authoritative (header-derived)
     * detections — never the non-authoritative URL fallback. Only
     * authoritative results are cached here too, so a later call (after the
     * header has rendered) can still recover the real username instead of
     * being stuck on an unreliable URL guess for the rest of the page.
     */
    function detectUsername() {
        if (cachedUsername) return cachedUsername;
        const { username, isAuthoritative } = window.AO3MenuHelpers.detectUsername({
            getStored: () => SETTINGS.username,
            setStored: (username) => {
                SETTINGS.username = username;
                saveSettings();
            },
        });
        if (username && isAuthoritative) cachedUsername = username;
        return username;
    }

    /** Check if current page is the logged-in user's bookmarks page. */
    function isMyBookmarksPage(username) {
        if (!username || !username.trim()) return false;

        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const path = window.location.pathname;

        const myBookmarksRegex = new RegExp(
            `^/users/${escapedUsername}(?:/pseuds/[^/]+)?/bookmarks/?(?:$|[?#])`,
            "i",
        );
        if (myBookmarksRegex.test(path)) return true;

        // Check ?user_id= param for filtered bookmark views

        const params = new URLSearchParams(window.location.search);
        const userId = params.get("user_id");
        if (userId && userId.toLowerCase() === username.toLowerCase()) {
            if (path.includes("/bookmarks")) return true;
        }

        if (path.match(/^\/bookmarks\/\d+$/)) {
            // Verify we're on our own bookmark by checking for a link to our user page
            const userLink = document.querySelector(`a[href="/users/${username}"]`);
            if (userLink) return true;
        }

        return false;
    }

    /** Extract work ID from page URL or DOM links. */
    function getWorkId() {
        let match = window.location.pathname.match(/\/works\/(\d+)/);
        if (match) return match[1];

        match = window.location.pathname.match(/\/chapters\/(\d+)/);
        if (match) {
            const workIdLink = document.querySelector('a[href*="work_id="]');
            if (workIdLink) {
                const workIdMatch = workIdLink.href.match(/work_id=(\d+)/);
                if (workIdMatch) return workIdMatch[1];
            }

            const workLink = document.querySelector(
                '.work.navigation a[href*="/works/"], #workskin .preface a[href*="/works/"]',
            );
            if (workLink) {
                const workMatch = workLink.href.match(/\/works\/(\d+)/);
                if (workMatch) return workMatch[1];
            }
        }

        return null;
    }

    /** @param {HTMLElement} element @returns {string|null} */
    function getCommentId(element) {
        const id = element.id;
        return id ? id.replace("comment_", "") : null;
    }

    /** @param {HTMLElement} element @returns {string|null} */
    function getBlurbWorkId(element) {
        const id = element.id;
        return id ? id.replace("work_", "") : null;
    }

    /** @param {HTMLElement} element @returns {string|null} */
    function getWorkIdFromBookmark(element) {
        const workLink = element.querySelector('a[href*="/works/"]');
        if (workLink) {
            const match = workLink.href.match(/\/works\/(\d+)/);
            if (match) return match[1];
        }
        return null;
    }

    /** @returns {boolean} */
    function isFicTrackerDetected() {
        return !!document.querySelector(".FT_collapsable, .work_quicktag_btn");
    }

    /** Skip elements managed by Advanced Blocker (fold/cut/hidden).
     *  Prevents Quick Hide from interfering with blocker's collapsed works. */
    function shouldSkipElement(element) {
        if (
            element.classList.contains("ao3-blocker-work") ||
            element.classList.contains("ao3-blocker-hidden") ||
            element.classList.contains("ao3-blocker-unhide") ||
            element.querySelector(".ao3-blocker-cut, .ao3-blocker-fold, .ao3-blocker-toggle")
        ) {
            return true;
        }
        return false;
    }

    /** @param {EventTarget} target @returns {boolean} */
    function shouldIgnoreClick(target) {
        return (
            target.tagName === "A" ||
            target.tagName === "BUTTON" ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.tagName === "SUMMARY" ||
            target.closest("a, button, input, textarea, select, form, summary, details") ||
            target.closest(".ao3-blocker-fold, .ao3-blocker-toggle") ||
            target.closest(".actions, .user-note-preview, .navigation.actions, ul[role='menu']")
        );
    }

    /** @param {Node} node @param {string} selector @returns {boolean} */
    function elementMatchesOrContains(node, selector) {
        return (
            (node.matches && node.matches(selector)) ||
            (node.querySelector && node.querySelector(selector))
        );
    }

    // ============================================================
    // STORAGE
    // ============================================================

    /** Load collapse-state config with v0.x migration. */
    function loadConfig() {
        if (configCache) return configCache;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            configCache = saved
                ? JSON.parse(saved)
                : { comments: {}, works: {}, bookmarksUnlinked: {} };

            // Migrate old data format (v0.x compatibility)
            if (configCache.blurbs || configCache.bookmarks) {
                if (!configCache.works) configCache.works = {};
                if (configCache.blurbs) {
                    Object.assign(configCache.works, configCache.blurbs);
                    delete configCache.blurbs;
                }
                if (configCache.bookmarks) {
                    Object.assign(configCache.works, configCache.bookmarks);
                    delete configCache.bookmarks;
                }
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(configCache));
                } catch (e) {
                    handleError("Failed to save migrated config", e);
                }
            }

            if (!configCache.bookmarksUnlinked) {
                configCache.bookmarksUnlinked = {};
            }

            return configCache;
        } catch (e) {
            handleError("Failed to load config", e);
            return { comments: {}, works: {}, bookmarksUnlinked: {} };
        }
    }

    /** Debounced save of collapse-state config. */
    function saveConfig(config) {
        configCache = config;

        if (saveTimer) clearTimeout(saveTimer);

        saveTimer = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
                saveTimer = null;
            } catch (e) {
                handleError("Failed to save config", e);
            }
        }, TIMING.CONFIG_SAVE_DEBOUNCE);
    }

    /** Load display/behavior settings with defaults. */
    function loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) {
                SETTINGS = { ...DEFAULTS, ...JSON.parse(saved) };
            }
        } catch (e) {
            handleError("Failed to load settings", e);
            SETTINGS = { ...DEFAULTS };
        }
    }

    /** Persist display/behavior settings. */
    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
        } catch (e) {
            handleError("Failed to save settings", e);
        }
    }

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /** Toggle single comment collapse state. */
    function toggleComment(commentElement, workId, config = null) {
        const commentId = getCommentId(commentElement);
        if (!commentId) return;

        const isCollapsed = commentElement.classList.toggle("ao3-comment-collapsed");

        const shouldSave = !config;
        if (!config) {
            config = loadConfig();
        }

        if (!config.comments[workId]) {
            config.comments[workId] = {};
        }

        if (isCollapsed) {
            config.comments[workId][commentId] = true;
        } else {
            delete config.comments[workId][commentId];
            if (Object.keys(config.comments[workId]).length === 0) {
                delete config.comments[workId];
            }
        }

        if (shouldSave) {
            saveConfig(config);
        }

        return isCollapsed;
    }

    /** Toggle single work blurb collapse state. */
    function toggleBlurb(blurbElement, config = null) {
        const blurbWorkId = getBlurbWorkId(blurbElement);
        if (!blurbWorkId) return;

        const isCollapsed = blurbElement.classList.toggle("ao3-blurb-collapsed");

        const shouldSave = !config;
        if (!config) {
            config = loadConfig();
        }

        if (isCollapsed) {
            config.works[blurbWorkId] = true;
        } else {
            delete config.works[blurbWorkId];
        }

        if (shouldSave) {
            saveConfig(config);
        }

        return isCollapsed;
    }

    /** Toggle single bookmark collapse state (respects linkWorkBookmarkStates). */
    function toggleBookmark(bookmarkElement, config = null) {
        const workId = getWorkIdFromBookmark(bookmarkElement);
        if (!workId) return;

        const isCollapsed = bookmarkElement.classList.toggle("ao3-bookmark-collapsed");

        const shouldSave = !config;
        if (!config) {
            config = loadConfig();
        }

        const storageKey = SETTINGS.linkWorkBookmarkStates ? "works" : "bookmarksUnlinked";

        if (isCollapsed) {
            config[storageKey][workId] = true;
        } else {
            delete config[storageKey][workId];
        }

        if (shouldSave) {
            saveConfig(config);
        }

        return isCollapsed;
    }

    /** Collapse or expand all top-level comments on current work page. */
    function toggleAllComments(collapse) {
        const workId = getWorkId();
        if (!workId) return;

        const config = loadConfig();
        if (!config.comments[workId]) {
            config.comments[workId] = {};
        }

        const allComments = document.querySelectorAll(SELECTORS.COMMENTS);

        allComments.forEach((comment) => {
            if (collapse) {
                const parentThread = comment.parentElement;
                const isTopLevel =
                    parentThread &&
                    parentThread.tagName === "OL" &&
                    parentThread.classList.contains("thread") &&
                    (!parentThread.parentElement || parentThread.parentElement.tagName !== "LI");

                if (!isTopLevel) return;
            }

            const commentId = getCommentId(comment);
            if (!commentId) return;

            if (collapse) {
                comment.classList.add("ao3-comment-collapsed");
                config.comments[workId][commentId] = true;
            } else {
                comment.classList.remove("ao3-comment-collapsed");
                delete config.comments[workId][commentId];
            }
        });

        if (Object.keys(config.comments[workId]).length === 0) {
            delete config.comments[workId];
        }

        saveConfig(config);
    }

    /** Collapse or expand all work blurbs visible on page. */
    function toggleAllBlurbs(collapse) {
        const config = loadConfig();
        const allBlurbs = document.querySelectorAll(SELECTORS.WORK_BLURBS);

        allBlurbs.forEach((blurb) => {
            const blurbWorkId = getBlurbWorkId(blurb);
            if (!blurbWorkId) return;

            if (shouldSkipElement(blurb)) return;

            if (collapse) {
                blurb.classList.add("ao3-blurb-collapsed");
                config.works[blurbWorkId] = true;
            } else {
                blurb.classList.remove("ao3-blurb-collapsed");
                delete config.works[blurbWorkId];
            }
        });

        saveConfig(config);
    }

    /** Collapse or expand all bookmarks visible on page. */
    function toggleAllBookmarks(collapse) {
        const config = loadConfig();
        const storageKey = SETTINGS.linkWorkBookmarkStates ? "works" : "bookmarksUnlinked";
        const allBookmarks = document.querySelectorAll(SELECTORS.BOOKMARKS);

        allBookmarks.forEach((bookmark) => {
            const workId = getWorkIdFromBookmark(bookmark);
            if (!workId) return;

            if (shouldSkipElement(bookmark)) return;

            if (collapse) {
                bookmark.classList.add("ao3-bookmark-collapsed");
                config[storageKey][workId] = true;
            } else {
                bookmark.classList.remove("ao3-bookmark-collapsed");
                delete config[storageKey][workId];
            }
        });

        saveConfig(config);
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    function updateStyleVariables() {
        document.documentElement.style.setProperty(
            "--ao3-collapse-opacity",
            SETTINGS.collapsedOpacity,
        );
    }

    function updateHoverClass() {
        if (SETTINGS.hoverExpand) {
            document.documentElement.classList.add("ao3-hover-expand-enabled");
        } else {
            document.documentElement.classList.remove("ao3-hover-expand-enabled");
        }
    }

    // ── Style injection ──────────────────────────────────

    /**
     * Generates the combined stylesheet CSS based on current collapseStyle,
     * opacity, hoverExpand, and overrideFicTrackerStyle settings.
     * @returns {string} CSS content
     */
    function getStyleContent() {
        const isMinimal = SETTINGS.collapseStyle === "minimal";
        const isFicTracker = SETTINGS.collapseStyle === "fictracker";

        return `
      :root {
        --ao3-collapse-opacity: ${SETTINGS.collapsedOpacity};
      }
      
      /* Comment styles - hide content but keep heading and profile pic visible */
      .ao3-comment-collapsed > *:not(.heading.byline):not(.icon) {
        display: none !important;
      }
      
      .ao3-comment-collapsed {
        opacity: var(--ao3-collapse-opacity);
      }
      
      .ao3-hover-expand-enabled .ao3-comment-collapsed:hover {
        opacity: 1;
      }
      
      /* Hide nested thread when parent is collapsed */
      .ao3-comment-collapsed + li > ol.thread {
        display: none !important;
      }
      
      li.comment {
        cursor: pointer;
      }
      
      /* Keep normal cursor for interactive elements */
      li.comment a,
      li.comment button,
      li.comment input,
      li.comment textarea,
      li.comment select {
        cursor: default;
      }
      
      .ao3-blurb-collapsed .landmark,
      .ao3-blurb-collapsed .tags,
      .ao3-blurb-collapsed .series,
      .ao3-blurb-collapsed h5.fandoms.heading,
      .ao3-blurb-collapsed .userstuff.summary,
      .ao3-blurb-collapsed ul.actions {
        display: none !important;
      }
      
      .ao3-blurb-collapsed .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }
      
      /* Minimal mode - hide required-tags, stats, and notes */
      ${
          isMinimal
              ? `
      .ao3-blurb-collapsed .required-tags,
      .ao3-blurb-collapsed .stats,
      .ao3-blurb-collapsed .user-note-preview {
        display: none !important;
      }
      `
              : ""
      }
      
      /* Default mode - hide stats and notes but keep required-tags visible */
      ${
          !isMinimal && !isFicTracker
              ? `
      .ao3-blurb-collapsed .stats,
      .ao3-blurb-collapsed .user-note-preview {
        display: none !important;
      }
      `
              : ""
      }
      
      .ao3-blurb-collapsed {
        opacity: var(--ao3-collapse-opacity) !important;
      }
      
      .ao3-hover-expand-enabled .ao3-blurb-collapsed:hover {
        opacity: 1 !important;
      }
      
      /* Prevent opacity transition during temporary hover/touch expansion */
      .ao3-blurb-collapsed.ao3-hover-expanded {
        transition: none !important;
        opacity: 1;
      }
      
      li.work.blurb:not(.ao3-blocker-work):not(.FT_collapsable) {
        cursor: pointer;
      }
      
      li.work.blurb a,
      li.work.blurb button,
      li.work.blurb input,
      li.work.blurb textarea,
      li.work.blurb select {
        cursor: default;
      }
      
      .ao3-bookmark-collapsed .landmark,
      .ao3-bookmark-collapsed .tags,
      .ao3-bookmark-collapsed .series,
      .ao3-bookmark-collapsed h5.fandoms.heading,
      .ao3-bookmark-collapsed .userstuff.summary,
      .ao3-bookmark-collapsed ul.actions {
        display: none !important;
      }
      
      .ao3-bookmark-collapsed .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }
      
      /* Minimal mode - hide required-tags, stats, and notes */
      ${
          isMinimal
              ? `
      .ao3-bookmark-collapsed .required-tags,
      .ao3-bookmark-collapsed .stats,
      .ao3-bookmark-collapsed .user-note-preview {
        display: none !important;
      }
      `
              : ""
      }
      
      /* Default mode - hide stats and notes but keep required-tags visible */
      ${
          !isMinimal && !isFicTracker
              ? `
      .ao3-bookmark-collapsed .stats,
      .ao3-bookmark-collapsed .user-note-preview {
        display: none !important;
      }
      `
              : ""
      }
      
      .ao3-bookmark-collapsed {
        opacity: var(--ao3-collapse-opacity) !important;
      }
      
      .ao3-hover-expand-enabled .ao3-bookmark-collapsed:hover {
        opacity: 1 !important;
      }
      
      /* Prevent opacity transition during temporary hover/touch expansion */
      .ao3-bookmark-collapsed.ao3-hover-expanded {
        transition: none !important;
        opacity: 1;
      }
      
      li.bookmark.blurb:not(.ao3-blocker-work):not(.FT_collapsable) {
        cursor: pointer;
      }
      
      li.bookmark.blurb a,
      li.bookmark.blurb button,
      li.bookmark.blurb input,
      li.bookmark.blurb textarea,
      li.bookmark.blurb select {
        cursor: default;
      }

      /* FicTracker collapse style override */
      ${
          SETTINGS.overrideFicTrackerStyle
              ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .landmark,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .tags,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .series,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) h5.fandoms.heading,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .userstuff,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) ul.actions {
        display: none !important;
      }

      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }

      ${
          isMinimal
              ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .required-tags,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .stats,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .user-note-preview {
        display: none !important;
      }
      `
              : !isFicTracker
                ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .stats,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .user-note-preview {
        display: none !important;
      }
      `
                : ""
      }

      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) {
        opacity: var(--ao3-collapse-opacity) !important;
        cursor: pointer;
      }
      `
              : ""
      }
    `;
    }

    function injectStyles() {
        const style = document.createElement("style");
        style.id = "ao3-collapsible-styles";
        style.textContent = getStyleContent();
        document.head.appendChild(style);
    }

    function updateStyles() {
        const existingStyles = document.getElementById("ao3-collapsible-styles");
        if (existingStyles) {
            existingStyles.textContent = getStyleContent();
        } else {
            injectStyles();
        }
        updateHoverClass();
    }

    // ── Settings dialog ──────────────────────────────────

    /** Build and display the settings dialog using MHL form controls. */
    function showSettingsPopup() {
        if (!window.AO3MenuHelpers) {
            alert("Menu Helpers library not loaded. Please refresh the page.");
            return;
        }

        const MH = window.AO3MenuHelpers;
        MH.removeAllDialogs();

        const dialog = MH.createDialog("🕶️ Quick Hide 🕶️", {
            maxWidth: "500px",
        });

        const generalSection = MH.createSection("👀 Hide Settings");

        generalSection.appendChild(
            MH.createCheckbox({
                id: "enableWorks",
                label: "Enable work blurbs",
                checked: SETTINGS.enableWorks,
            }),
        );

        generalSection.appendChild(
            MH.createCheckbox({
                id: "enableBookmarks",
                label: "Enable bookmarks",
                checked: SETTINGS.enableBookmarks,
            }),
        );

        const linkBookmarksCheckbox = MH.createCheckbox({
            id: "linkWorkBookmarkStates",
            label: "Sync work and bookmark states",
            checked: SETTINGS.linkWorkBookmarkStates,
            tooltip: "Collapsing a work also collapses its bookmark, and vice versa",
        });
        linkBookmarksCheckbox.style.marginLeft = "20px";
        linkBookmarksCheckbox.style.fontSize = "0.95em";

        if (!SETTINGS.enableBookmarks) {
            linkBookmarksCheckbox.style.display = "none";
        }

        generalSection.appendChild(linkBookmarksCheckbox);

        generalSection.appendChild(
            MH.createCheckbox({
                id: "enableComments",
                label: "Enable comments",
                checked: SETTINGS.enableComments,
            }),
        );

        dialog.appendChild(generalSection);

        const visualSection = MH.createSection("🎨 Visual Styling");

        const styleGroup = document.createElement("div");
        styleGroup.className = "setting-group";

        const styleLabel = document.createElement("label");
        styleLabel.className = "setting-label";
        styleLabel.textContent = "Collapse Style";
        styleGroup.appendChild(styleLabel);

        const defaultRadio = document.createElement("label");
        defaultRadio.className = "radio-label";
        const defaultInput = document.createElement("input");
        defaultInput.type = "radio";
        defaultInput.name = "collapseStyle";
        defaultInput.value = "default";
        defaultInput.id = "collapseStyle-default";
        defaultInput.checked = SETTINGS.collapseStyle === "default";
        defaultRadio.appendChild(defaultInput);
        defaultRadio.appendChild(document.createTextNode(" Default "));
        const defaultTooltip = MH.createTooltip("Shows title, author, date, and ratings");
        defaultRadio.appendChild(defaultTooltip);
        styleGroup.appendChild(defaultRadio);

        const minimalRadio = document.createElement("label");
        minimalRadio.className = "radio-label";
        const minimalInput = document.createElement("input");
        minimalInput.type = "radio";
        minimalInput.name = "collapseStyle";
        minimalInput.value = "minimal";
        minimalInput.id = "collapseStyle-minimal";
        minimalInput.checked = SETTINGS.collapseStyle === "minimal";
        minimalRadio.appendChild(minimalInput);
        minimalRadio.appendChild(document.createTextNode(" Minimal "));
        const minimalTooltip = MH.createTooltip("Shows only title, author, and date");
        minimalRadio.appendChild(minimalTooltip);
        styleGroup.appendChild(minimalRadio);

        const ficTrackerRadio = document.createElement("label");
        ficTrackerRadio.className = "radio-label";
        const ficTrackerInput = document.createElement("input");
        ficTrackerInput.type = "radio";
        ficTrackerInput.name = "collapseStyle";
        ficTrackerInput.value = "fictracker";
        ficTrackerInput.id = "collapseStyle-fictracker";
        ficTrackerInput.checked = SETTINGS.collapseStyle === "fictracker";
        ficTrackerRadio.appendChild(ficTrackerInput);
        ficTrackerRadio.appendChild(document.createTextNode(" FicTracker "));
        const ficTrackerTooltip = MH.createTooltip(
            "Shows title, author, date, ratings, stats, and FicTracker notes",
        );
        ficTrackerRadio.appendChild(ficTrackerTooltip);
        styleGroup.appendChild(ficTrackerRadio);

        visualSection.appendChild(styleGroup);

        visualSection.appendChild(
            MH.createSlider({
                id: "collapsedOpacity",
                label: "Collapsed Opacity",
                min: 0.1,
                max: 1,
                step: 0.05,
                value: SETTINGS.collapsedOpacity,
            }),
        );

        dialog.appendChild(visualSection);

        const behaviorSection = MH.createSection("⚙️ Options");
        behaviorSection.appendChild(
            MH.createCheckbox({
                id: "hoverExpand",
                label: "Expand on hover",
                checked: SETTINGS.hoverExpand,
            }),
        );

        if (isFicTrackerDetected()) {
            const overrideFTCheckbox = MH.createCheckbox({
                id: "overrideFicTrackerStyle",
                label: "Apply collapse style to FicTracker ",
                checked: SETTINGS.overrideFicTrackerStyle,
            });
            const overrideFTTooltip = MH.createTooltip(
                "Makes FicTracker-collapsed works use Quick Hide's current collapse style and opacity",
            );
            overrideFTCheckbox.querySelector("label").appendChild(overrideFTTooltip);
            behaviorSection.appendChild(overrideFTCheckbox);
        }

        behaviorSection.appendChild(
            MH.createHideMenuCheckbox({
                id: "hideMenuOptions",
                checked: SETTINGS.hideMenuOptions,
            }),
        );

        dialog.appendChild(behaviorSection);

        dialog.appendChild(
            MH.createButtonGroup([
                { text: "Save", id: "saveButton" },
                { text: "Cancel", id: "closeButton" },
            ]),
        );

        dialog.appendChild(
            MH.createImportExportRow({
                onReset: () => {
                    SETTINGS = { ...DEFAULTS };
                    saveSettings();
                    updateStyleVariables();
                    updateStyles();

                    dialog.remove();

                    const workId = getWorkId();
                    if (workId) {
                        setupComments();
                    }
                    setupBlurbs();
                    setupBookmarks();
                    addToggleAllButtons();
                },
                exportData: () => ({
                    version: "1.0.0",
                    exportDate: new Date().toISOString(),
                    settings: SETTINGS,
                    config: loadConfig(),
                }),
                exportPrefix: "ao3_quick_hide_config",
                onImport: (file) => {
                    const reader = new FileReader();
                    reader.onload = function (evt) {
                        try {
                            const importedData = JSON.parse(evt.target.result);

                            if (
                                typeof importedData !== "object" ||
                                !importedData ||
                                !importedData.settings ||
                                !importedData.config
                            ) {
                                throw new Error("Invalid file format");
                            }

                            SETTINGS = { ...DEFAULTS, ...importedData.settings };
                            saveSettings();

                            const currentConfig = loadConfig();

                            if (importedData.config.comments) {
                                Object.keys(importedData.config.comments).forEach((workId) => {
                                    if (!currentConfig.comments[workId]) {
                                        currentConfig.comments[workId] = {};
                                    }
                                    Object.assign(
                                        currentConfig.comments[workId],
                                        importedData.config.comments[workId],
                                    );
                                });
                            }

                            if (importedData.config.works) {
                                Object.assign(currentConfig.works, importedData.config.works);
                            }

                            if (importedData.config.bookmarksUnlinked) {
                                Object.assign(
                                    currentConfig.bookmarksUnlinked,
                                    importedData.config.bookmarksUnlinked,
                                );
                            }

                            saveConfig(currentConfig);

                            alert("Settings imported successfully! Reloading page...");
                            location.reload();
                        } catch (err) {
                            alert("Import failed: " + (err?.message || err));
                        }
                    };
                    reader.onerror = () => alert("Failed to read file.");
                    reader.readAsText(file);
                },
            }),
        );

        dialog.querySelector("#enableComments")?.addEventListener("change", (e) => {
            SETTINGS.enableComments = e.target.checked;
        });

        dialog.querySelector("#enableWorks")?.addEventListener("change", (e) => {
            SETTINGS.enableWorks = e.target.checked;
        });

        dialog.querySelector("#enableBookmarks")?.addEventListener("change", (e) => {
            SETTINGS.enableBookmarks = e.target.checked;
            linkBookmarksCheckbox.style.display = e.target.checked ? "" : "none";
        });

        dialog.querySelector("#linkWorkBookmarkStates")?.addEventListener("change", (e) => {
            SETTINGS.linkWorkBookmarkStates = e.target.checked;
        });

        dialog.querySelectorAll('input[name="collapseStyle"]').forEach((radio) => {
            radio.addEventListener("change", (e) => {
                if (e.target.checked) {
                    SETTINGS.collapseStyle = e.target.value;
                }
            });
        });

        dialog.querySelector("#collapsedOpacity")?.addEventListener("input", (e) => {
            SETTINGS.collapsedOpacity = parseFloat(e.target.value);
            updateStyleVariables();
        });

        dialog.querySelector("#hoverExpand")?.addEventListener("change", (e) => {
            SETTINGS.hoverExpand = e.target.checked;
        });

        dialog.querySelector("#overrideFicTrackerStyle")?.addEventListener("change", (e) => {
            SETTINGS.overrideFicTrackerStyle = e.target.checked;
            updateStyles();
        });

        dialog.querySelector("#hideMenuOptions")?.addEventListener("change", (e) => {
            SETTINGS.hideMenuOptions = e.target.checked;
        });

        dialog.querySelector("#saveButton")?.addEventListener("click", () => {
            const oldLinkSetting = SETTINGS.linkWorkBookmarkStates;
            const oldEnableComments = SETTINGS.enableComments;
            const oldEnableWorks = SETTINGS.enableWorks;
            const oldEnableBookmarks = SETTINGS.enableBookmarks;

            saveSettings();
            updateStyleVariables();

            if (oldLinkSetting !== SETTINGS.linkWorkBookmarkStates) {
                const config = loadConfig();
                if (SETTINGS.linkWorkBookmarkStates) {
                    Object.assign(config.works, config.bookmarksUnlinked);
                    config.bookmarksUnlinked = {};
                } else {
                    Object.assign(config.bookmarksUnlinked, config.works);
                }
                saveConfig(config);
            }

            updateStyles();
            if (SETTINGS.overrideFicTrackerStyle) {
                setupFicTrackerCollapses();
            }

            dialog.remove();

            const enableSettingsChanged =
                oldEnableComments !== SETTINGS.enableComments ||
                oldEnableWorks !== SETTINGS.enableWorks ||
                oldEnableBookmarks !== SETTINGS.enableBookmarks;

            if (enableSettingsChanged) {
                const workId = getWorkId();
                if (workId && SETTINGS.enableComments) {
                    setupComments();
                }
                if (SETTINGS.enableWorks) {
                    setupBlurbs();
                }
                if (SETTINGS.enableBookmarks) {
                    setupBookmarks();
                }
                addToggleAllButtons();
            }
        });

        dialog.querySelector("#closeButton")?.addEventListener("click", () => {
            loadSettings();
            dialog.remove();
        });

        document.body.appendChild(dialog);
    }

    // ── Shared menu ──────────────────────────────────────

    function initSharedMenu() {
        if (!window.AO3MenuHelpers) {
            console.warn("[AO3: Quick Hide] Menu Helpers library not available");
            return;
        }

        if (!SETTINGS.hideMenuOptions || window.AO3MenuHelpers.isAO3Homepage()) {
            window.AO3MenuHelpers.addToSharedMenu({
                id: "collapsible-comments-settings",
                text: "Quick Hide",
                onClick: showSettingsPopup,
            });
        }
    }

    // ── Collapse/Expand All buttons ─────────────────────

    /** Adds "Collapse All" / "Expand All" buttons to pagination bars when
     *  comments, works, or bookmarks are present on the page. */
    function addToggleAllButtons() {
        // Skip inbox page — no collapsible content there
        if (window.location.pathname.includes("/inbox")) return;

        const paginations = document.querySelectorAll(
            "ol.pagination.actions:not(.ao3-toggle-button-added)",
        );

        if (paginations.length === 0) return;

        const hasComments =
            SETTINGS.enableComments && document.querySelector(SELECTORS.COMMENTS) !== null;
        const hasWorkBlurbs =
            SETTINGS.enableWorks && document.querySelector(SELECTORS.WORK_BLURBS) !== null;
        const hasBookmarks =
            SETTINGS.enableBookmarks && document.querySelector(SELECTORS.BOOKMARKS) !== null;

        if (!hasComments && !hasWorkBlurbs && !hasBookmarks) return;

        paginations.forEach((pagination) => {
            pagination.classList.add("ao3-toggle-button-added");

            const collapseAllLi = document.createElement("li");
            collapseAllLi.innerHTML = '<a href="#">Collapse All</a>';
            const collapseAllLink = collapseAllLi.querySelector("a");
            collapseAllLink.addEventListener("click", (e) => {
                e.preventDefault();
                if (hasComments) toggleAllComments(true);
                if (hasWorkBlurbs) toggleAllBlurbs(true);
                if (hasBookmarks) toggleAllBookmarks(true);
            });

            const expandAllLi = document.createElement("li");
            expandAllLi.innerHTML = '<a href="#">Expand All</a>';
            const expandAllLink = expandAllLi.querySelector("a");
            expandAllLink.addEventListener("click", (e) => {
                e.preventDefault();
                if (hasComments) toggleAllComments(false);
                if (hasWorkBlurbs) toggleAllBlurbs(false);
                if (hasBookmarks) toggleAllBookmarks(false);
            });

            pagination.appendChild(expandAllLi);
            pagination.appendChild(collapseAllLi);
        });
    }

    // ── Setup: Comments ──────────────────────────────────

    /**
     * Initializes comment collapse on the current work page.
     * Applies saved collapse state and wires click handlers.
     */
    function setupComments() {
        if (!SETTINGS.enableComments) return;

        const workId = getWorkId();
        if (!workId) return;

        const config = loadConfig();
        const workConfig = config.comments[workId] || {};

        const comments = document.querySelectorAll(SELECTORS.COMMENTS);

        if (comments.length === 0) return;

        comments.forEach((comment) => {
            const commentId = getCommentId(comment);
            if (!commentId) return;

            // Guard against double-initialization (setup may run multiple times via observer)
            if (comment.classList.contains("ao3-collapse-setup")) {
                return;
            }

            comment.classList.add("ao3-collapse-setup");

            if (workConfig[commentId]) {
                comment.classList.add("ao3-comment-collapsed");
            }

            comment.addEventListener("click", function (e) {
                const target = e.target;

                // Skip links, buttons, inputs, selects, textareas, details/summary — let them handle their own clicks
                if (
                    target.tagName === "A" ||
                    target.tagName === "BUTTON" ||
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT" ||
                    target.tagName === "SUMMARY" ||
                    target.closest("a, button, input, textarea, select, form, summary, details")
                ) {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                toggleComment(comment, workId);
            });

            addHoverExpandBehavior(comment, "ao3-comment-collapsed");
            addTouchExpandBehavior(comment, "ao3-comment-collapsed");
        });
    }

    // ── Setup: Work blurbs ───────────────────────────────

    /**
     * Initializes work blurb collapse on listing pages.
     * Applies saved collapse state and wires click/hover/touch handlers.
     */
    function setupBlurbs() {
        if (!SETTINGS.enableWorks) return;

        const config = loadConfig();

        const blurbs = document.querySelectorAll(SELECTORS.WORK_BLURBS);

        if (blurbs.length === 0) return;

        blurbs.forEach((blurb) => {
            const blurbWorkId = getBlurbWorkId(blurb);
            if (!blurbWorkId) return;

            if (shouldSkipElement(blurb)) {
                return;
            }

            // Let FicTracker handle its own collapsible works (overrideFicTrackerStyle merges, doesn't replace)
            if (SETTINGS.overrideFicTrackerStyle && blurb.classList.contains("FT_collapsable")) {
                return;
            }

            if (blurb.classList.contains("ao3-blurb-collapse-setup")) {
                return;
            }

            blurb.classList.add("ao3-blurb-collapse-setup");

            if (config.works[blurbWorkId]) {
                blurb.classList.add("ao3-blurb-collapsed");
            }

            blurb.addEventListener("click", function (e) {
                if (shouldSkipElement(blurb)) return;

                if (
                    SETTINGS.overrideFicTrackerStyle &&
                    blurb.classList.contains("FT_collapsable")
                ) {
                    return;
                }

                const target = e.target;
                if (shouldIgnoreClick(target)) return;

                e.preventDefault();
                e.stopPropagation();

                if (blurb.classList.contains("ao3-hover-expanded")) {
                    blurb.classList.remove("ao3-hover-expanded");
                }

                toggleBlurb(blurb);
            });

            addHoverExpandBehavior(blurb, "ao3-blurb-collapsed");
            addTouchExpandBehavior(blurb, "ao3-blurb-collapsed");
        });
    }

    // ── Setup: Bookmarks ─────────────────────────────────

    /**
     * Initializes bookmark collapse on listing pages, respecting
     * linkWorkBookmarkStates setting for storage key selection.
     */
    function setupBookmarks() {
        const bookmarks = document.querySelectorAll(SELECTORS.BOOKMARKS);
        if (bookmarks.length === 0) return;

        const config = loadConfig();
        const username = detectUsername();
        const onMyBookmarksPage = isMyBookmarksPage(username);

        // On your own bookmarks page, use dedicated bookmark toggle setting.
        // On other pages (tag listings, collections, etc.), reuse work toggle setting
        // so collapsing a work also collapses its bookmark listing.
        const shouldSetupPage = onMyBookmarksPage ? SETTINGS.enableBookmarks : SETTINGS.enableWorks;
        if (!shouldSetupPage) return;

        const storageKey =
            onMyBookmarksPage && !SETTINGS.linkWorkBookmarkStates ? "bookmarksUnlinked" : "works";

        bookmarks.forEach((bookmark) => {
            const workId = getWorkIdFromBookmark(bookmark);
            if (!workId) return;

            if (shouldSkipElement(bookmark)) return;

            if (SETTINGS.overrideFicTrackerStyle && bookmark.classList.contains("FT_collapsable")) {
                return;
            }

            if (bookmark.classList.contains("ao3-bookmark-collapse-setup")) {
                return;
            }

            bookmark.classList.add("ao3-bookmark-collapse-setup");

            if (config[storageKey][workId]) {
                bookmark.classList.add("ao3-bookmark-collapsed");
            }

            bookmark.addEventListener("click", function (e) {
                if (shouldSkipElement(bookmark)) return;

                if (
                    SETTINGS.overrideFicTrackerStyle &&
                    bookmark.classList.contains("FT_collapsable")
                ) {
                    return;
                }

                const target = e.target;
                if (shouldIgnoreClick(target)) return;

                e.preventDefault();
                e.stopPropagation();

                if (bookmark.classList.contains("ao3-hover-expanded")) {
                    bookmark.classList.remove("ao3-hover-expanded");
                }

                toggleBookmark(bookmark);
            });

            addHoverExpandBehavior(bookmark, "ao3-bookmark-collapsed");
            addTouchExpandBehavior(bookmark, "ao3-bookmark-collapsed");
        });
    }

    // ── Setup: FicTracker overrides ─────────────────────

    /**
     * Applies Quick Hide collapse styling to FicTracker-managed works.
     * Wires hover expand or click toggle based on hoverExpand setting.
     */
    function setupFicTrackerCollapses() {
        if (!SETTINGS.overrideFicTrackerStyle) return;

        const ftWorks = document.querySelectorAll(
            "li.work.blurb.FT_collapsable:not(.ao3-ft-collapse-setup), li.bookmark.blurb.FT_collapsable:not(.ao3-ft-collapse-setup)",
        );
        if (ftWorks.length === 0) return;

        ftWorks.forEach((el) => {
            // Mark as set up to avoid double-processing
            el.classList.add("ao3-ft-collapse-setup");

            if (shouldSkipElement(el)) return;

            if (SETTINGS.hoverExpand) {
                // Hover mode: expand on mouseenter, collapse on mouseleave
                el.addEventListener("mouseenter", function () {
                    el.classList.add("ao3-ft-user-expanded");
                });
                el.addEventListener("mouseleave", function () {
                    el.classList.remove("ao3-ft-user-expanded");
                });
            } else {
                // Click mode: toggle expanded state and clear any stored collapse for this work
                el.addEventListener("click", function (e) {
                    if (shouldIgnoreClick(e.target)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.toggle("ao3-ft-user-expanded");
                    // Also clear Quick Hide's own collapsed state so expand is visible
                    if (el.classList.contains("ao3-ft-user-expanded")) {
                        if (el.classList.contains("ao3-blurb-collapsed")) {
                            el.classList.remove("ao3-blurb-collapsed");
                            const blurbWorkId = getBlurbWorkId(el);
                            if (blurbWorkId) {
                                const config = loadConfig();
                                delete config.works[blurbWorkId];
                                saveConfig(config);
                            }
                        }
                        if (el.classList.contains("ao3-bookmark-collapsed")) {
                            el.classList.remove("ao3-bookmark-collapsed");
                            const workId = getWorkIdFromBookmark(el);
                            if (workId) {
                                const config = loadConfig();
                                const storageKey = SETTINGS.linkWorkBookmarkStates
                                    ? "works"
                                    : "bookmarksUnlinked";
                                delete config[storageKey][workId];
                                saveConfig(config);
                            }
                        }
                    }
                });
            }
        });
    }

    // ── Hover / Touch expand ─────────────────────────────

    /**
     * Wires mouseenter/mouseleave handlers to temporarily expand
     * collapsed elements on hover.
     * @param {HTMLElement} element
     * @param {string} collapsedClass - CSS class indicating collapsed state
     */
    function addHoverExpandBehavior(element, collapsedClass) {
        if (!SETTINGS.hoverExpand) return;

        element.addEventListener("mouseenter", function () {
            if (element.classList.contains(collapsedClass)) {
                element.classList.remove(collapsedClass);
                element.classList.add("ao3-hover-expanded");
            }
        });

        element.addEventListener("mouseleave", function () {
            if (element.classList.contains("ao3-hover-expanded")) {
                element.classList.remove("ao3-hover-expanded");
                element.classList.add(collapsedClass);
            }
        });
    }

    /**
     * Wires touchstart/touchend handlers to temporarily expand
     * collapsed elements on long-press, collapsing after a delay.
     * Uses WeakMap for per-element timer tracking (auto-cleaned when element removed from DOM).
     * @param {HTMLElement} element
     * @param {string} collapsedClass
     */
    function addTouchExpandBehavior(element, collapsedClass) {
        if (!SETTINGS.hoverExpand) return;

        element.addEventListener("touchstart", function (e) {
            if (element.classList.contains(collapsedClass)) {
                const timer = setTimeout(() => {
                    element.classList.remove(collapsedClass);
                    element.classList.add("ao3-hover-expanded");
                }, TIMING.TOUCH_EXPAND_DELAY);
                touchTimers.set(element, timer);
            }
        });

        element.addEventListener("touchend", function (e) {
            const timer = touchTimers.get(element);
            if (timer) {
                clearTimeout(timer);
                touchTimers.delete(element);
            }
            if (element.classList.contains("ao3-hover-expanded")) {
                setTimeout(() => {
                    if (element.classList.contains("ao3-hover-expanded")) {
                        element.classList.remove("ao3-hover-expanded");
                        element.classList.add(collapsedClass);
                    }
                }, TIMING.TOUCH_COLLAPSE_DELAY);
            }
        });

        element.addEventListener("touchcancel", function (e) {
            const timer = touchTimers.get(element);
            if (timer) {
                clearTimeout(timer);
                touchTimers.delete(element);
            }
            if (element.classList.contains("ao3-hover-expanded")) {
                element.classList.remove("ao3-hover-expanded");
                element.classList.add(collapsedClass);
            }
        });
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    // ── AJAX content observer ────────────────────────────

    /**
     * Watches the main content area for dynamically-added comments,
     * works, and bookmarks, then re-runs setup for new elements.
     */
    function setupContentObserver() {
        // AO3 page loads wrapped in <main> or #main; fall back to <body> for older pages
        const mainContent = document.querySelector("main, #main, body");
        if (!mainContent) return;

        const contentObserver = new MutationObserver((mutations) => {
            clearTimeout(debounceTimer);

            debounceTimer = setTimeout(() => {
                let hasNewComments = false;
                let hasNewWorks = false;

                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            if (elementMatchesOrContains(node, SELECTORS.COMMENTS)) {
                                hasNewComments = true;
                            }

                            if (
                                elementMatchesOrContains(node, SELECTORS.WORK_BLURBS) ||
                                elementMatchesOrContains(node, SELECTORS.BOOKMARKS)
                            ) {
                                hasNewWorks = true;
                            }

                            if (
                                elementMatchesOrContains(node, "#comments_placeholder, #feedback")
                            ) {
                                hasNewComments = true;
                            }
                        }

                        if (hasNewComments && hasNewWorks) break;
                    }
                    if (hasNewComments && hasNewWorks) break;
                }

                if (hasNewComments) {
                    setupComments();
                    addToggleAllButtons();
                }
                if (hasNewWorks) {
                    setupBlurbs();
                    setupBookmarks();
                    setupFicTrackerCollapses();
                    addToggleAllButtons();
                }
            }, TIMING.MUTATION_OBSERVER_DEBOUNCE);
        });

        contentObserver.observe(mainContent, {
            childList: true,
            subtree: true,
        });

        initialSetupComplete = true;
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    loadSettings();

    /**
     * Initializes Quick Hide: injects styles, sets up shared menu,
     * initializes collapsible elements, and starts the content observer.
     */
    function init() {
        console.log("[AO3: Quick Hide] Loaded.");
        injectStyles();
        updateStyleVariables();
        updateHoverClass();
        initSharedMenu();

        const workId = getWorkId();
        if (workId) {
            setupComments();
        }
        setupBlurbs();
        setupBookmarks();
        setupFicTrackerCollapses();
        addToggleAllButtons();

        // FicTracker collapses may load after Quick Hide setup; retry once
        setTimeout(() => setupFicTrackerCollapses(), 300);

        setupContentObserver();

        // Fallback: Re-run setup after delay to catch late-loading AJAX if observer failed
        setTimeout(() => {
            if (!initialSetupComplete) {
                if (getWorkId()) {
                    setupComments();
                }
                setupBlurbs();
                setupBookmarks();
                setupFicTrackerCollapses();
                addToggleAllButtons();
                initialSetupComplete = true;
            }
        }, 1000);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
