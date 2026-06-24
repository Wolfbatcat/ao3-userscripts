// ==UserScript==
// @name         AO3: Auto Pseud
// @version      1.0.2
// @description  Assign pseuds based on fandoms when commenting and bookmarking works
// @author       BlackBatCat
// @match        *://archiveofourown.org/users/*/pseuds/*/edit
// @match        *://archiveofourown.org/users/*/pseuds/*/bookmarks*
// @match        *://archiveofourown.org/works*
// @match        *://archiveofourown.org/chapters/*
// @match        *://archiveofourown.org/collections/*/bookmarks
// @grant        none
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    console.log("[AO3: Auto Pseud] loaded.");

    const html = (strings, ...values) =>
        strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ""), "");

    // ============================================================
    // CONSTANTS
    // ============================================================

    const STORAGE_KEY = "ao3_auto_pseud_config";

    const WORKS_PAGE_REGEX = /^https?:\/\/archiveofourown\.org\/(?:.*\/)?(works|chapters)(\/|$)/;
    const PSEUD_EDIT_REGEX = /^https?:\/\/archiveofourown\.org\/users\/.*\/pseuds\/.*\/edit$/;
    const BOOKMARKS_PAGE_REGEX =
        /^https?:\/\/archiveofourown\.org\/(?:collections\/.*\/)?(?:users\/.*\/(?:pseuds\/.*\/)?)?bookmarks(?:\/.*)?$/;

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /**
     * Extract current pseud name from URL path.
     * @returns {string|null}
     */
    function getCurrentPseudName() {
        const urlParts = window.location.pathname.split("/");
        const pseudIndex = urlParts.indexOf("pseuds");
        return pseudIndex !== -1 ? urlParts[pseudIndex + 1] : null;
    }

    /**
     * Find which pseud ID matches the given work fandoms.
     * @param {string[]} workFandoms
     * @returns {string|null} pseud ID if match found
     */
    function findMatchingPseud(workFandoms) {
        try {
            const config = getConfig();

            for (const [pseudName, pseudData] of Object.entries(config.pseuds)) {
                const pseudFandoms = pseudData.fandoms || [];
                const pseudId = pseudData.id;

                if (!pseudId) continue;

                for (const workFandom of workFandoms) {
                    if (pseudFandoms.includes(workFandom)) {
                        return pseudId;
                    }
                }
            }

            return null;
        } catch (e) {
            console.error("[AO3: Auto Pseud] Error finding matching pseud:", e);
            return null;
        }
    }

    // ============================================================
    // STORAGE
    // ============================================================

    /**
     * Load config from localStorage with defaults applied.
     * @returns {{ pseuds: Object, enableComments: boolean, enableBookmarks: boolean }}
     */
    function getConfig() {
        try {
            const config = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            if (!config.pseuds) config.pseuds = {};
            if (config.enableComments === undefined) config.enableComments = false;
            if (config.enableBookmarks === undefined) config.enableBookmarks = false;
            return config;
        } catch (e) {
            console.error("[AO3: Auto Pseud] Error loading config:", e);
            return { pseuds: {}, enableComments: false, enableBookmarks: false };
        }
    }

    /**
     * Persist config to localStorage.
     * @param {Object} config
     */
    function saveConfig(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        } catch (e) {
            console.error("[AO3: Auto Pseud] Error saving config:", e);
        }
    }

    /** @param {string} pseudName @returns {string[]} */
    function getStoredFandoms(pseudName) {
        const config = getConfig();
        return config.pseuds[pseudName]?.fandoms || [];
    }

    /** @param {string} pseudName @param {string[]} fandoms */
    function saveFandomsForPseud(pseudName, fandoms) {
        const config = getConfig();
        if (!config.pseuds[pseudName]) {
            config.pseuds[pseudName] = {};
        }
        config.pseuds[pseudName].fandoms = fandoms;
        saveConfig(config);
    }

    /** @param {string} pseudName @param {string} pseudId */
    function savePseudNameMapping(pseudName, pseudId) {
        const config = getConfig();
        if (!config.pseuds[pseudName]) {
            config.pseuds[pseudName] = {};
        }
        config.pseuds[pseudName].id = pseudId;
        saveConfig(config);
    }

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /**
     * Extract fandom tag names from the current work page or a specific blurb.
     * Uses multiple fallback strategies for different AO3 page layouts.
     * @param {string|null} workId
     * @returns {string[]}
     */
    function getWorkFandoms(workId = null) {
        if (workId) {
            // Try standard AO3 blurb class .work-<id>
            let blurb = document.querySelector(`.work-${workId}`);
            if (!blurb) {
                // Fallback: search all li elements for class containing work-<id>
                blurb = Array.from(
                    document.querySelectorAll("li.bookmark, li.blurb, li.group"),
                ).find((el) => el.className && el.className.includes(`work-${workId}`));
            }
            if (!blurb) {
                // Fallback: try by id attribute
                blurb =
                    document.getElementById(`work-${workId}`) ||
                    document.getElementById(`bookmark_${workId}`);
            }
            if (blurb) {
                let fandomTags = blurb.querySelectorAll("h5.fandoms.heading a.tag");
                if (fandomTags.length === 0) {
                    fandomTags = blurb.querySelectorAll("a.tag");
                }
                const fandoms = Array.from(fandomTags).map((tag) => tag.textContent.trim());
                return fandoms;
            }
        }

        // On bookmark list pages, don't auto-select to avoid cross-work contamination
        if (
            BOOKMARKS_PAGE_REGEX.test(window.location.href) &&
            !window.location.href.includes("/edit")
        ) {
            return [];
        }
        // Work page: dd.fandom.tags
        let fandomTags = document.querySelectorAll("dd.fandom.tags a.tag");
        if (fandomTags.length === 0) {
            // Bookmark page: h5.fandoms.heading
            fandomTags = document.querySelectorAll("h5.fandoms.heading a.tag");
        }
        return Array.from(fandomTags).map((tag) => tag.textContent.trim());
    }

    /**
     * Build pseud name→ID map from comment form select options.
     */
    function buildPseudMapFromCommentForm() {
        const commentSelect = document.querySelector('select[name="comment[pseud_id]"]');
        if (!commentSelect) return;

        const options = commentSelect.querySelectorAll("option");
        options.forEach((option) => {
            const pseudId = option.value;
            const pseudName = option.textContent.trim();
            savePseudNameMapping(pseudName, pseudId);
        });
    }

    /**
     * Build pseud name→ID map from bookmark form select options.
     */
    function buildPseudMapFromBookmarkForm() {
        const bookmarkSelect = document.querySelector('select[name="bookmark[pseud_id]"]');
        if (!bookmarkSelect) return;

        const options = bookmarkSelect.querySelectorAll("option");
        options.forEach((option) => {
            const pseudId = option.value;
            const pseudName = option.textContent.trim();
            savePseudNameMapping(pseudName, pseudId);
        });
    }

    /**
     * Switch comment form pseud select to the matching pseud for current work's fandoms.
     */
    function switchCommentPseud() {
        const config = getConfig();
        if (!config.enableComments) return;

        const workFandoms = getWorkFandoms();
        if (workFandoms.length === 0) return;

        buildPseudMapFromCommentForm();

        const matchingPseudId = findMatchingPseud(workFandoms);
        if (!matchingPseudId) return;

        const commentSelects = document.querySelectorAll('select[name="comment[pseud_id]"]');
        commentSelects.forEach((select) => {
            const option = select.querySelector(`option[value="${matchingPseudId}"]`);
            if (option) {
                select.value = matchingPseudId;
            }
        });
    }

    /**
     * Switch bookmark form pseud select to the matching pseud.
     * Resolves work ID from the form's action attribute to get correct fandoms.
     */
    function switchBookmarkPseud() {
        const config = getConfig();
        if (!config.enableBookmarks) {
            return;
        }

        const bookmarkSelects = document.querySelectorAll('select[name="bookmark[pseud_id]"]');
        if (bookmarkSelects.length === 0) {
            return;
        }
        bookmarkSelects.forEach((select) => {
            const form = select.closest('form[action^="/works/"]');
            let workId = null;
            if (form) {
                const match = form.getAttribute("action").match(/\/works\/(\d+)/);
                if (match) workId = match[1];
            }
            if (!workId) {
                return;
            }
            const workFandoms = getWorkFandoms(workId);
            if (workFandoms.length === 0) {
                return;
            }
            buildPseudMapFromBookmarkForm();
            const matchingPseudId = findMatchingPseud(workFandoms);
            if (!matchingPseudId) {
                return;
            }
            const option = select.querySelector(`option[value="${matchingPseudId}"]`);
            if (option) {
                select.value = matchingPseudId;
            }
        });
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    /**
     * Display a modal explaining fandom-pseud association.
     * Exposed globally for onclick handler in injected HTML.
     */
    function showFandomHelpModal() {
        // Remove any existing modal/background
        const oldModal = document.getElementById("modal-wrap");
        if (oldModal?.parentNode) oldModal.parentNode.removeChild(oldModal);
        const oldBg = document.getElementById("modal-background");
        if (oldBg?.parentNode) oldBg.parentNode.removeChild(oldBg);

        // AO3 native modal uses overlay first, then modal-wrap
        const background = document.createElement("div");
        background.id = "modal-background";
        background.className = "modal-closer";
        background.style.display = "block";
        background.style.position = "fixed";
        background.style.top = "0";
        background.style.left = "0";
        background.style.width = "100%";
        background.style.height = "100%";
        background.style.backgroundColor = "rgba(0,0,0,0.5)";
        background.style.zIndex = "1000";
        document.body.appendChild(background);

        const modalWrap = document.createElement("div");
        modalWrap.id = "modal-wrap";
        modalWrap.className = "modal-closer";
        modalWrap.style.display = "block";
        modalWrap.style.position = "fixed";
        modalWrap.style.top = "50%";
        modalWrap.style.left = "50%";
        modalWrap.style.transform = "translate(-50%, -50%)";
        modalWrap.style.zIndex = "1001";
        modalWrap.innerHTML = html`
            <div id="modal" style="display: inline-block;">
                <div class="content userstuff">
                    <p>
                        Associate fandoms with this pseud. When you comment on or bookmark works in
                        these fandoms, this pseud will be suggested automatically.
                    </p>
                </div>
                <div class="footer">
                    <span class="title">Associate fandoms with this pseud</span>
                    <a class="action modal-closer" href="#">Close</a>
                </div>
            </div>
        `;
        document.body.appendChild(modalWrap);

        // Add close handler (click overlay or close link)
        function closeHandler(e) {
            if (e.target === background || e.target.classList.contains("action")) {
                if (background.parentNode) background.parentNode.removeChild(background);
                if (modalWrap.parentNode) modalWrap.parentNode.removeChild(modalWrap);
            }
        }
        background.addEventListener("click", closeHandler);
        const actionBtn = modalWrap.querySelector(".action");
        if (actionBtn) actionBtn.addEventListener("click", closeHandler);
    }

    // Expose for onclick handler in injected HTML
    window.showFandomHelpModal = showFandomHelpModal;

    /**
     * Inject fandom association fieldset into the pseud edit form.
     * Adds autocomplete input for fandoms plus enable/disable checkboxes.
     */
    function addFandomFieldset() {
        const form = document.querySelector("form.edit_pseud");
        if (!form) {
            console.error("[AO3: Auto Pseud] Could not find pseud edit form");
            return;
        }

        if (!form.querySelector("dd.submit.actions")) {
            console.error("[AO3: Auto Pseud] Could not find submit button");
            return;
        }

        const pseudName = getCurrentPseudName();
        const storedFandoms = pseudName ? getStoredFandoms(pseudName) : [];
        const fandomValue = storedFandoms.join(", ");

        const fandomDt = document.createElement("dt");
        fandomDt.className = "fandom";
        fandomDt.innerHTML = html`
            <label for="pseud_fandom_autocomplete" title="fandoms">Fandoms</label>
            <a
                class="help symbol question"
                title="Associate fandoms with this pseud for automatic selection when commenting and bookmarking"
                href="#"
                onclick="window.showFandomHelpModal(); return false;">
                <span class="symbol question"><span>?</span></span>
            </a>
        `;

        const config = getConfig();
        const fandomDd = document.createElement("dd");
        fandomDd.className = "fandom";
        fandomDd.setAttribute("title", "fandoms");
        fandomDd.innerHTML = html`
            <input
                type="text"
                name="pseud[fandom_string]"
                id="pseud_fandom"
                value="${fandomValue}"
                class="autocomplete"
                data-autocomplete-method="/autocomplete/fandom"
                data-autocomplete-hint-text="Start typing for suggestions!"
                data-autocomplete-no-results-text="(No suggestions found)"
                data-autocomplete-min-chars="1"
                data-autocomplete-searching-text="Searching..."
                title="fandoms" />
            <div style="margin-top: 0.5em;">
                <label
                    ><input
                        type="checkbox"
                        id="enable_comments"
                        ${config.enableComments ? "checked" : ""} />
                    Assign pseud to comments</label
                ><br />
                <label
                    ><input
                        type="checkbox"
                        id="enable_bookmarks"
                        ${config.enableBookmarks ? "checked" : ""} />
                    Assign pseud to bookmarks</label
                >
            </div>
        `;

        const submitDt = form.querySelector("dt.landmark");
        if (!submitDt) {
            console.error("[AO3: Auto Pseud] Could not find dt.landmark in form");
            return;
        }
        submitDt.parentNode.insertBefore(fandomDt, submitDt);
        submitDt.parentNode.insertBefore(fandomDd, submitDt);
    }

    /**
     * Intercept pseud edit form submission to persist fandom list and pseud ID.
     */
    function interceptFormSubmit() {
        const form = document.querySelector("form.edit_pseud");
        if (!form) return;

        const formAction = form.getAttribute("action");
        const pseudId = formAction ? formAction.split("/").pop() : null;

        form.addEventListener("submit", function (e) {
            const pseudName = getCurrentPseudName();
            const fandomInput = document.querySelector("#pseud_fandom");

            if (pseudName && fandomInput) {
                const fandoms = fandomInput.value
                    .split(",")
                    .map((f) => f.trim())
                    .filter((f) => f.length > 0);

                saveFandomsForPseud(pseudName, fandoms);

                if (pseudId) {
                    savePseudNameMapping(pseudName, pseudId);
                }

                fandomInput.disabled = true;
                const autocompleteInput = document.querySelector("#pseud_fandom_autocomplete");
                if (autocompleteInput) autocompleteInput.disabled = true;
            }
        });
    }

    /**
     * Persist enableComments/enableBookmarks toggles on checkbox change.
     */
    function saveOptions() {
        const enableCommentsCheckbox = document.querySelector("#enable_comments");
        const enableBookmarksCheckbox = document.querySelector("#enable_bookmarks");

        if (enableCommentsCheckbox && enableBookmarksCheckbox) {
            const config = getConfig();
            config.enableComments = enableCommentsCheckbox.checked;
            config.enableBookmarks = enableBookmarksCheckbox.checked;
            saveConfig(config);
        }
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    /**
     * Watch comment fieldsets for pseud select injection, then auto-switch.
     * Handles both static and dynamically-added comment forms (e.g. replies).
     */
    function observeCommentFieldsets() {
        const commentLegends = document.querySelectorAll("fieldset legend");
        commentLegends.forEach((legend) => {
            const legendText = legend.textContent.trim();
            if (legendText === "Comment" || legendText === "Post Comment") {
                const fieldset = legend.closest("fieldset");
                if (!fieldset) return;
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (
                                node.nodeType === 1 &&
                                node.matches('select[name="comment[pseud_id]"]')
                            ) {
                                switchCommentPseud();
                                observer.disconnect();
                                return;
                            }
                        }
                    }
                });
                observer.observe(fieldset, { childList: true, subtree: true });
                // Also check if select is already present
                const existingSelect = fieldset.querySelector('select[name="comment[pseud_id]"]');
                if (existingSelect) {
                    switchCommentPseud();
                }
            }
        });
    }

    /**
     * Watch bookmark fieldsets for pseud select injection, then auto-switch.
     */
    function observeBookmarkFieldsets() {
        const bookmarkLegends = document.querySelectorAll("fieldset legend");
        bookmarkLegends.forEach((legend) => {
            if (legend.textContent.trim() === "Bookmark") {
                const fieldset = legend.closest("fieldset");
                if (!fieldset) return;
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (
                                node.nodeType === 1 &&
                                node.matches('select[name="bookmark[pseud_id]"]')
                            ) {
                                switchBookmarkPseud();
                                observer.disconnect();
                                return;
                            }
                        }
                    }
                });
                observer.observe(fieldset, { childList: true, subtree: true });
                // Also check if select is already present
                const existingSelect = fieldset.querySelector('select[name="bookmark[pseud_id]"]');
                if (existingSelect) {
                    switchBookmarkPseud();
                }
            }
        });
    }

    /**
     * Global observer: detect dynamically-added comment fieldsets (reply forms).
     */
    function observeForNewCommentFieldsets() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    // Collect the node itself if it's a fieldset, plus any nested fieldsets
                    const candidates = node.matches("fieldset") ? [node] : [];
                    node.querySelectorAll("fieldset").forEach((f) => candidates.push(f));
                    for (const fieldset of candidates) {
                        const legend = fieldset.querySelector("legend");
                        if (!legend) continue;
                        const legendText = legend.textContent.trim();
                        if (legendText === "Comment" || legendText === "Post Comment") {
                            switchCommentPseud();
                            return;
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Global observer: detect dynamically-added bookmark fieldsets and forms.
     * Handles both fieldset-based and #bookmark-form-based layouts.
     */
    function observeForNewBookmarkFieldsets() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.matches("fieldset")) {
                        const legend = node.querySelector("legend");
                        if (legend && legend.textContent.trim() === "Bookmark") {
                            observeBookmarkFieldsets();
                        }
                    }
                    // Handle AO3 collection bookmarks: <div id="bookmark-form">
                    if (node.nodeType === 1 && node.id === "bookmark-form") {
                        // Watch for the select being added inside #bookmark-form
                        const formObserver = new MutationObserver((mutations) => {
                            for (const mutation of mutations) {
                                for (const added of mutation.addedNodes) {
                                    if (
                                        added.nodeType === 1 &&
                                        added.matches('select[name="bookmark[pseud_id]"]')
                                    ) {
                                        switchBookmarkPseud();
                                        formObserver.disconnect();
                                        return;
                                    }
                                }
                            }
                        });
                        formObserver.observe(node, { childList: true, subtree: true });
                        // Also check if select is already there
                        const existingSelect = node.querySelector(
                            'select[name="bookmark[pseud_id]"]',
                        );
                        if (existingSelect) {
                            switchBookmarkPseud();
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    /**
     * Initialize pseud edit page: inject fandom fieldset, intercept form submit.
     */
    function initPseudEditPage() {
        addFandomFieldset();
        interceptFormSubmit();

        const enableCommentsCheckbox = document.querySelector("#enable_comments");
        const enableBookmarksCheckbox = document.querySelector("#enable_bookmarks");

        if (enableCommentsCheckbox) {
            enableCommentsCheckbox.addEventListener("change", saveOptions);
        }
        if (enableBookmarksCheckbox) {
            enableBookmarksCheckbox.addEventListener("change", saveOptions);
        }
    }

    /**
     * Initialize work page: switch pseuds and wire up observers.
     */
    function initWorksPage() {
        switchCommentPseud();
        switchBookmarkPseud();
        observeCommentFieldsets();
        observeBookmarkFieldsets();
        observeForNewCommentFieldsets();
        observeForNewBookmarkFieldsets();
    }

    /**
     * Initialize bookmarks page: switch bookmark pseud and wire up observers.
     */
    function initBookmarksPage() {
        switchBookmarkPseud();
        observeBookmarkFieldsets();
        observeForNewBookmarkFieldsets();
    }

    /**
     * Route to the correct page initializer based on current URL.
     */
    function initializeScript() {
        const currentUrl = window.location.href;
        if (PSEUD_EDIT_REGEX.test(currentUrl)) {
            initPseudEditPage();
        } else if (WORKS_PAGE_REGEX.test(currentUrl)) {
            initWorksPage();
        } else if (BOOKMARKS_PAGE_REGEX.test(currentUrl)) {
            initBookmarksPage();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeScript);
    } else {
        initializeScript();
    }
})();
