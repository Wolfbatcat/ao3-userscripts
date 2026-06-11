// ==UserScript==
// @name          AO3: Reorder Ship Tags
// @version       1.0.5
// @description   Reorders relationship tags on blurbs so platonic ships (&) appear after romantic ships (/)
// @author        BlackBatCat
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works
// @match         *://archiveofourown.org/works?*
// @match         *://archiveofourown.org/works/*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @grant         none
// ==/UserScript==

(function () {
    "use strict";
    console.log("[AO3: Reorder Ship Tags] loaded.");

    // ============================================================
    // CORE LOGIC
    // ============================================================

    /**
     * Reorders relationship tag <li> elements so romantic (/) appear
     * first, then minor/background relationships, then platonic (&).
     * @param {NodeList|HTMLElement[]} items - relationship <li> elements
     * @param {HTMLElement} container - parent <ul> or <dd>
     * @param {Node|null} [insertBefore=null] - reference node for insertBefore
     */
    function reorderItems(items, container, insertBefore = null) {
        if (items.length <= 1) return;

        const romantic = [];
        const minorOrBackground = [];
        const platonic = [];
        // Early exit optimization: track if reorder is actually needed.
        // If all items are already in correct order, skip DOM manipulation entirely.
        let needsReorder = false;

        for (let i = 0; i < items.length; i++) {
            const text = items[i].textContent;

            if (/\brelationship\b/i.test(text)) {
                if (platonic.length > 0) needsReorder = true;
                minorOrBackground.push(items[i]);
            } else if (text.includes("/")) {
                if (platonic.length > 0 || minorOrBackground.length > 0) needsReorder = true;
                romantic.push(items[i]);
            } else if (text.includes("&")) {
                platonic.push(items[i]);
            }
        }

        if (!needsReorder) return;

        romantic.forEach((li) => li.remove());
        minorOrBackground.forEach((li) => li.remove());
        platonic.forEach((li) => li.remove());

        const fragment = document.createDocumentFragment();
        romantic.forEach((li) => fragment.appendChild(li));
        minorOrBackground.forEach((li) => fragment.appendChild(li));
        platonic.forEach((li) => fragment.appendChild(li));

        if (insertBefore) {
            container.insertBefore(fragment, insertBefore);
        } else {
            container.appendChild(fragment);
        }
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    /**
     * Reorders relationship tag &lt;li&gt; elements within a blurb listing.
     * Queries `ul.tags` for `li.relationships` items.
     */
    function reorderRelationshipTags(blurbElement) {
        const tagsContainer = blurbElement.querySelector("ul.tags");
        if (!tagsContainer) return;

        const items = tagsContainer.querySelectorAll("li.relationships");
        const referenceNode = items[0]?.nextSibling;
        reorderItems(items, tagsContainer, referenceNode);
    }

    /**
     * Reorders relationship tags on a work page metadata block.
     * Queries `dd.relationship.tags ul.commas` for all child `li` items.
     */
    function reorderWorkPageTags(workElement) {
        const tagsContainer = workElement.querySelector("dd.relationship.tags ul.commas");
        if (!tagsContainer) return;

        const items = tagsContainer.querySelectorAll("li");
        reorderItems(items, tagsContainer);
    }

    /**
     * Scans all blurbs and work pages, reordering relationship tags.
     * Two-pass approach: li.blurb for listings, dl.work.meta.group for work pages.
     */
    function reorderAllBlurbs() {
        const blurbs = document.querySelectorAll("li.blurb");
        for (let i = 0; i < blurbs.length; i++) {
            reorderRelationshipTags(blurbs[i]);
        }

        const workPages = document.querySelectorAll("dl.work.meta.group");
        for (let i = 0; i < workPages.length; i++) {
            reorderWorkPageTags(workPages[i]);
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", reorderAllBlurbs);
    } else {
        reorderAllBlurbs();
    }
})();
