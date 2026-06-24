// ==UserScript==
// @name          AO3: Clear Bookmark Tags
// @version       1.0.0
// @description   Adds a small "clear tags" link next to the bookmark form's "Your tags" label to remove all bookmarker tags without submitting the form.
// @author        BlackBatCat
// @match         *://archiveofourown.org/works/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/series/*
// @match         *://archiveofourown.org/tags/*
// @license       MIT
// @grant         none
// ==/UserScript==

(function () {
    "use strict";

    console.log("[AO3: Clear Bookmark Tags] loaded.");

    const INJECTED_FLAG = "ao3ClearTagsInjected";

    // Tags left untouched when clearing (case-insensitive).
    const PROTECTED_TAGS = new Set(
        [
            "To Read",
            "Finished Reading",
            "Reading",
            "Subscribed",
            "Spicy",
            "Dropped",
            "Favorite",
        ].map((t) => t.toLowerCase()),
    );

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /** Tag name is the li's own text, excluding the nested delete span/link text. */
    function getTagName(li) {
        const deleteSpan = li.querySelector("span.delete");
        const clone = li.cloneNode(true);
        if (deleteSpan) clone.querySelector("span.delete")?.remove();
        return clone.textContent.trim();
    }

    /** Click each non-protected tag's own delete (×) link so AO3's existing removal logic stays in sync. */
    function clearTags(label) {
        const dd = label.closest("dt")?.nextElementSibling;
        if (!dd) return;

        const tagItems = Array.from(dd.querySelectorAll("ul.autocomplete li.added.tag"));
        tagItems.forEach((li) => {
            if (PROTECTED_TAGS.has(getTagName(li).toLowerCase())) return;
            li.querySelector("span.delete a")?.click();
        });
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    /** Inserts a "clear tags" link next to a "Your tags" label, once per label. */
    function injectClearLink(label) {
        if (label.dataset[INJECTED_FLAG]) return;
        label.dataset[INJECTED_FLAG] = "true";

        const link = document.createElement("a");
        link.href = "#";
        link.className = "clear-bookmark-tags";
        link.textContent = "clear tags";
        link.style.marginLeft = "0.5em";
        link.style.fontSize = "0.85em";

        link.addEventListener("click", (event) => {
            event.preventDefault();
            clearTags(label);
        });

        label.insertAdjacentElement("afterend", link);
    }

    /** Scans the whole document for bookmark "Your tags" labels and injects the clear link. */
    function scanForTagLabels() {
        document
            .querySelectorAll('label[for="bookmark_tag_string_autocomplete"]')
            .forEach(injectClearLink);
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function init() {
        scanForTagLabels();

        let pending = false;
        const observer = new MutationObserver(() => {
            if (pending) return;
            pending = true;
            setTimeout(() => {
                pending = false;
                scanForTagLabels();
            }, 50);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
