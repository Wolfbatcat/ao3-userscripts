// ==UserScript==
// @name         AO3: EPUB Download Button - Custom
// @version      3.0
// @description  Adds a customizable EPUB download button next to dates on AO3 blurbs
// @author       ravenothere, BlackBatCat
// @license      MIT
// @match        *://archiveofourown.org/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ============================================================================
  // CUSTOMIZATION: Change the button symbol/text here
  // ============================================================================
  const BUTTON_TEXT = "✿"; // You can change this to any symbol or text!
  // Examples: '⬇', '📖', '💾', 'EPUB', '⇩', '⤓', '⭳', '↓'
  // ============================================================================

  console.log("[AO3: EPUB Download Button] loaded.");

  /**
   * Adds EPUB download buttons to work title headings found within `root`.
   * Scoping to a specific subtree avoids re-querying the whole document.
   */
  function addEpubButtonsToScope(root) {
    const headings = root.querySelectorAll(".header h4.heading");

    headings.forEach((heading) => {
      const header = heading.closest(".header");
      if (!header) return;

      // Skip if button already exists anywhere in this header block
      if (header.querySelector(".ao3-epub-download-btn")) return;

      // Find the work link
      const workLink = heading.querySelector('a[href*="/works/"]');
      if (!workLink) return;

      // Use pathname (shorter string) instead of full absolute href
      const workId = workLink.pathname.match(/\/works\/(\d+)/)?.[1];
      if (!workId) return;

      // Create the download button
      const button = document.createElement("a");
      button.className = "ao3-epub-download-btn";
      button.href = `/downloads/${workId}/work.epub`;
      button.title = "Download EPUB";
      button.textContent = BUTTON_TEXT;

      // Prepend inside p.datetime so the button sits to the left of the date
      // within the same absolutely-positioned container.
      const datetimeEl = header.querySelector("p.datetime");
      if (datetimeEl) {
        datetimeEl.prepend(button, document.createTextNode(" "));
      } else {
        heading.after(button);
      }
    });
  }

  /** Convenience wrapper that scopes to the full document. */
  function addEpubButtons() {
    addEpubButtonsToScope(document);
  }

  /**
   * Removes all existing buttons then re-adds them.
   * Only needed when another script inserts elements *after* our buttons
   * and ordering must be corrected (e.g. Chapter Shortcuts adding »).
   */
  function repositionButtons() {
    document
      .querySelectorAll(".ao3-epub-download-btn")
      .forEach((btn) => btn.remove());
    addEpubButtons();
  }

  // Initial load — single pass, no polling timeout needed.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addEpubButtons);
  } else {
    addEpubButtons();
  }

  // Watch for dynamically loaded content.
  // Observe #main where works are rendered; fall back to body if absent.
  const observerRoot = document.querySelector("#main") ?? document.body;
  let debounceTimer = null;

  const observer = new MutationObserver((mutations) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      let needsReposition = false;
      const scopedRoots = [];

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;

          if (node.classList.contains("ao3-last-chapter-link")) {
            // Chapter Shortcuts inserted after our button — fix ordering
            needsReposition = true;
            break;
          }

          if (
            node.matches?.(".blurb") ||
            node.querySelector?.(".header h4.heading")
          ) {
            // New work blurb(s) added — only process the new subtree
            scopedRoots.push(node);
          }
        }
        if (needsReposition) break;
      }

      if (needsReposition) {
        repositionButtons();
      } else {
        scopedRoots.forEach((root) => addEpubButtonsToScope(root));
      }
    }, 50);
  });

  observer.observe(observerRoot, { childList: true, subtree: true });
})();
