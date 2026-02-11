// ==UserScript==
// @name          AO3: Reorder Ship Tags
// @version       1.0.2
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

  function reorderItems(items, container, insertBefore = null) {
    if (items.length <= 1) return;

    const romantic = [];
    const minorOrBackground = [];
    const platonic = [];
    let needsReorder = false;

    for (let i = 0; i < items.length; i++) {
      const text = items[i].textContent;
      const link = items[i].querySelector('a');
      const href = link ? link.getAttribute('href') : '';

      if (href.includes('/tags/Minor%20or%20Background%20Relationship(s)/works')) {
        if (platonic.length > 0) needsReorder = true;
        minorOrBackground.push(items[i]);
      } else if (text.includes("/")) {
        if (platonic.length > 0 || minorOrBackground.length > 0) needsReorder = true;
        romantic.push(items[i]);
      } else if (text.includes("&")) {
        platonic.push(items[i]);
      }
    }

    if (!needsReorder || (romantic.length === 0 && minorOrBackground.length === 0) || platonic.length === 0) return;

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

  function reorderRelationshipTags(blurbElement) {
    const tagsContainer = blurbElement.querySelector("ul.tags");
    if (!tagsContainer) return;

    const items = tagsContainer.querySelectorAll("li.relationships");
    const referenceNode = items[0]?.nextSibling;
    reorderItems(items, tagsContainer, referenceNode);
  }

  function reorderWorkPageTags(workElement) {
    const tagsContainer = workElement.querySelector("dd.relationship.tags ul.commas");
    if (!tagsContainer) return;

    const items = tagsContainer.querySelectorAll("li");
    reorderItems(items, tagsContainer);
  }

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

  // Initialize on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reorderAllBlurbs);
  } else {
    reorderAllBlurbs();
  }
})();
