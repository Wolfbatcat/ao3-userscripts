// ==UserScript==
// @name         AO3: No Re-Kudos
// @version      1.2.0
// @author       BlackBatCat
// @description  Hide kudos button if you've already left kudos.
// @license      MIT
// @match        *://archiveofourown.org/works/*
// @match        *://archiveofourown.org/chapters/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // ============================================================
    // CONSTANTS
    // ============================================================

    const STORAGE_KEY = "ao3_no_rekudos_config";
    const FICTRACKER_KEY = "FT_kudosGiven"; // read-only cross-compat with AO3 FicTracker

    // ============================================================
    // STORAGE
    // ============================================================

    /**
     * Load kudos history from localStorage, returning empty object on failure.
     * @returns {Object} kudosHistory map of workId → true
     */
    function loadKudosHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        } catch (e) {
            return {};
        }
    }

    /** Check FicTracker's kudos history (comma-separated work IDs) as a fallback. */
    function hasFicTrackerKudos(workId) {
        try {
            const raw = localStorage.getItem(FICTRACKER_KEY) || "";
            return raw.split(",").includes(workId);
        } catch (e) {
            return false;
        }
    }

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /** Get work ID from the kudos form (not URL — chapter IDs differ from work IDs). */
    const kudoButton = document.getElementById("kudo_submit");
    if (!kudoButton) return;

    const workIdInput = document.getElementById("kudo_commentable_id");
    if (!workIdInput) return;

    const workId = workIdInput.value;
    if (!workId) return;

    const kudosHistory = loadKudosHistory();

    if (kudosHistory[workId] || hasFicTrackerKudos(workId)) {
        kudoButton.style.display = "none";
    } else {
        // Record kudos on click, then hide button
        kudoButton.addEventListener("click", function () {
            const kudosHistory = loadKudosHistory();
            kudosHistory[workId] = true;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(kudosHistory));
            } catch (e) {}
            this.style.display = "none";
        });
    }
})();
