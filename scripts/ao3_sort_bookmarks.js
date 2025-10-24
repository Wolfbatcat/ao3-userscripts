// ==UserScript==
// @name         AO3: Bookmarks Sort by Kudos
// @version      1.0
// @description  Sorts AO3 bookmarks by kudos count
// @author       BlackBatCat
// @match        *://archiveofourown.org/*/bookmarks*
// @match        *://archiveofourown.org/bookmarks*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // Helper function to get URL parameters (handles encoded brackets)
  const getParam = (name) => {
    const search = window.location.search;
    const encodedName = name.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
    const regex = new RegExp("[?&]" + encodedName + "=([^&#]*)");
    const results = regex.exec(search);
    return results ? decodeURIComponent(results[1]) : null;
  };

  // Fetch all bookmark pages recursively with limit
  const fetchAllBookmarks = async (url, maxPages = 10) => {
    const bookmarks = [];
    let currentUrl = url.replace(/[?&]page=\d+/, "");
    let pageCount = 0;

    while (currentUrl && pageCount < maxPages) {
      const response = await fetch(currentUrl);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Collect bookmarks from current page
      const pageBookmarks = Array.from(doc.querySelectorAll("li.bookmark"));
      bookmarks.push(...pageBookmarks);

      pageCount++;

      // Check for next page
      const nextLink = doc.querySelector(".pagination .next a");
      currentUrl = nextLink ? nextLink.href : null;
    }

    if (pageCount >= maxPages && currentUrl) {
      console.warn(
        `Kudos sort: Limited to ${maxPages} pages (${bookmarks.length} bookmarks). Increase maxPages if needed.`
      );
    }

    return bookmarks;
  };

  // Extract kudos count from bookmark element
  const getKudosCount = (bookmark) => {
    const kudosLink = bookmark.querySelector("dd.kudos a");
    return kudosLink ? parseInt(kudosLink.textContent) || 0 : 0;
  };

  // Check if work is complete
  const isComplete = (bookmark) => {
    const chaptersEl = bookmark.querySelector("dd.chapters");
    if (!chaptersEl) return false;

    const chapters = chaptersEl.textContent.split("/");
    return chapters[0] === chapters[1] && chapters[0] !== "?";
  };

  // Check if work is complete
  const isComplete = (bookmark) => {
    const chaptersEl = bookmark.querySelector("dd.chapters");
    if (!chaptersEl) return false;

    const chapters = chaptersEl.textContent.split("/");
    return chapters[0] === chapters[1] && chapters[0] !== "?";
  };

  // Main function
  const sortBookmarks = async () => {
    const sortByKudos =
      getParam("bookmark_search[sort_column]") === "kudos_count";

    if (!sortByKudos) return;

    // Show loading indicator
    const heading = document.querySelector("h2.heading");
    const originalHeading = heading.textContent;
    heading.textContent = "Loading bookmarks...";

    try {
      // Fetch all bookmarks
      let bookmarks = await fetchAllBookmarks(window.location.href);

      // Sort by kudos
      bookmarks.sort((a, b) => getKudosCount(b) - getKudosCount(a));

      // Paginate results
      const currentPage = parseInt(getParam("page")) || 1;
      const perPage = 20;
      const startIdx = (currentPage - 1) * perPage;
      const endIdx = startIdx + perPage;
      const pageBookmarks = bookmarks.slice(startIdx, endIdx);

      // Replace bookmarks on page
      const bookmarkList = document.querySelector("ol.bookmark");
      bookmarkList.innerHTML = "";
      pageBookmarks.forEach((bookmark) => bookmarkList.appendChild(bookmark));

      // Update heading with count
      const totalCount = bookmarks.length;
      const displayStart = startIdx + 1;
      const displayEnd = Math.min(endIdx, totalCount);
      heading.textContent = originalHeading.replace(
        /\d+ - \d+ of \d+/,
        `${displayStart} - ${displayEnd} of ${totalCount}`
      );

      // Update pagination
      const totalPages = Math.ceil(totalCount / perPage);
      document.querySelectorAll(".pagination li").forEach((li) => {
        const link = li.querySelector("a");
        if (link && !isNaN(link.textContent)) {
          const pageNum = parseInt(link.textContent);
          if (pageNum > totalPages) li.remove();
        }
      });

      // Disable next link on last page
      if (currentPage >= totalPages) {
        document.querySelectorAll(".pagination .next").forEach((next) => {
          next.innerHTML = '<span class="disabled">Next →</span>';
        });
      }
    } catch (error) {
      console.error("Error sorting bookmarks:", error);
      heading.textContent = originalHeading;
    }
  };

  // Add sort option to UI
  const addSortOptions = () => {
    // Add kudos option to sort dropdown
    const sortSelect = document.querySelector("#bookmark_search_sort_column");
    if (
      sortSelect &&
      !sortSelect.querySelector('option[value="kudos_count"]')
    ) {
      const kudosOption = document.createElement("option");
      kudosOption.value = "kudos_count";
      kudosOption.textContent = "Kudos";
      sortSelect.appendChild(kudosOption);

      if (getParam("bookmark_search[sort_column]") === "kudos_count") {
        sortSelect.value = "kudos_count";
      }
    }
  };

  // Initialize
  addSortOptions();
  sortBookmarks();
})();
