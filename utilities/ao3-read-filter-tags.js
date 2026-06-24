// ==UserScript==
// @name          AO3: Read Filter Tags
// @version       1.0.0
// @description   Reads all tags from AO3's include/exclude autocomplete fields and logs them as comma-separated values to the console.
// @author        BlackBatCat
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/collections*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
    "use strict";

    function readAutocompleteField(hiddenInputId, label) {
        const hiddenInput = document.getElementById(hiddenInputId);
        if (!hiddenInput) return;

        const tags = hiddenInput.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);

        if (tags.length === 0) {
            console.log(`[AO3 Read Filter Tags] ${label}: (none)`);
        } else {
            console.log(`[AO3 Read Filter Tags] ${label}:\n${tags.join(", ")}`);
        }
    }

    readAutocompleteField("work_search_other_tag_names", "Include tags");
    readAutocompleteField("work_search_excluded_tag_names", "Exclude tags");
})();
