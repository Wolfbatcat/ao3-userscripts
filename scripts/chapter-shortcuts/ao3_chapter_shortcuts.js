// ==UserScript==
// @name          AO3: Chapter Shortcuts
// @version       2.7
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
// @require       https://update.greasyfork.org/scripts/552743/1757286/AO3%3A%20Menu%20Helpers%20Library.js?v=2.1.7
// @grant         none
// @namespace https://greasyfork.org/users/1498004
// ==/UserScript==

(function () {
  "use strict";

  // Wait for library to load
  if (!window.AO3MenuHelpers) {
    console.error("[AO3: Chapter Shortcuts] Menu Helpers library not loaded!");
    return;
  }

  const helpers = window.AO3MenuHelpers;

  // --- SETTINGS STORAGE ---
  const CHAPTER_SHORTCUTS_CONFIG_KEY = "ao3_chapter_shortcuts_config";
  const DEFAULT_CHAPTER_SHORTCUTS_CONFIG = {
    lastChapterSymbol: "»",
    hideMenuOptions: false,
    enableBottomButtons: true,
    hideEntireWorkButton: false,
    hideShareButton: false,
    hideDownloadButton: false,
  };
  let CHAPTER_SHORTCUTS_CONFIG = { ...DEFAULT_CHAPTER_SHORTCUTS_CONFIG };

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

  function saveChapterShortcutsConfig() {
    try {
      localStorage.setItem(
        CHAPTER_SHORTCUTS_CONFIG_KEY,
        JSON.stringify(CHAPTER_SHORTCUTS_CONFIG)
      );
    } catch (e) {
      console.error("Error saving config:", e);
    }
  }

  // --- SETTINGS MENU ---
  function showChapterShortcutsMenu() {
    // Remove any existing dialogs
    helpers.removeAllDialogs();

    // Create dialog
    const dialog = helpers.createDialog("🏃🏻 Chapter Shortcuts 🏃🏻", {
      maxWidth: "500px",
    });

    // Add separator
    const separator = document.createElement("hr");
    separator.style.cssText =
      "margin: 10px 0; border: none; border-top: 1px solid inherit;";
    dialog.appendChild(separator);

    // Create preset buttons section
    const presetGroup = helpers.createSettingGroup();
    presetGroup.appendChild(
      helpers.createLabel("Choose a symbol for the Last Chapter button:")
    );

    const presetSymbols = ["»", "➼", "➺", "✦", "♥", "✿", "ɞɞ"];
    const presetButtons = presetSymbols.map((symbol) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-symbol";
      btn.dataset.symbol = symbol;
      btn.textContent = symbol;
      btn.style.cssText =
        "font-family: inherit; font-size: inherit; color: inherit;";
      return btn;
    });

    const buttonContainer = helpers.createHorizontalLayout(presetButtons, {
      gap: "10px",
    });
    buttonContainer.style.marginBottom = "10px";
    presetGroup.appendChild(buttonContainer);

    dialog.appendChild(presetGroup);

    // Create custom input
    const customInput = helpers.createTextInput({
      id: "custom-symbol",
      label: "Or enter your own:",
      value: CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol,
      placeholder: "",
    });
    customInput.querySelector("#custom-symbol").maxLength = 4;
    dialog.appendChild(customInput);

    // Add preset button click handlers
    presetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("custom-symbol").value = btn.dataset.symbol;
      });
    });

    // Create enable bottom buttons checkbox
    const enableBottomCheckbox = helpers.createCheckbox({
      id: "enable-bottom-buttons",
      label: "Enable bottom navigation buttons",
      checked: CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons,
    });
    dialog.appendChild(enableBottomCheckbox);

    // Create hide buttons subsettings
    const hideButtonsSubsettings = helpers.createSubsettings();

    const hideEntireWorkCheckbox = helpers.createCheckbox({
      id: "hide-entire-work-button",
      label: "Entire Work",
      checked: CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton,
    });
    hideButtonsSubsettings.appendChild(hideEntireWorkCheckbox);

    const hideShareCheckbox = helpers.createCheckbox({
      id: "hide-share-button",
      label: "Share",
      checked: CHAPTER_SHORTCUTS_CONFIG.hideShareButton,
    });
    hideButtonsSubsettings.appendChild(hideShareCheckbox);

    const hideDownloadCheckbox = helpers.createCheckbox({
      id: "hide-download-button",
      label: "Download",
      checked: CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton,
    });
    hideButtonsSubsettings.appendChild(hideDownloadCheckbox);

    // Create hide buttons conditional checkbox with nested options
    const hideButtonsCheckbox = helpers.createConditionalCheckbox({
      id: "hide-buttons-option",
      label: "Hide buttons on work pages",
      checked: CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton || CHAPTER_SHORTCUTS_CONFIG.hideShareButton || CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton,
      subsettings: hideButtonsSubsettings,
    });
    dialog.appendChild(hideButtonsCheckbox);

    // Create hide menu checkbox
    const hideMenuCheckbox = helpers.createHideMenuCheckbox({
      id: "hide-menu-option",
      checked: CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions,
    });
    dialog.appendChild(hideMenuCheckbox);

    // Create button group
    const buttons = helpers.createButtonGroup([
      {
        text: "Save",
        id: "chapter-shortcuts-save",
        primary: true,
        onClick: () => {
          CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol =
            helpers.getValue("custom-symbol") || "»";
          CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions = helpers.getValue("hide-menu-option");
          CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons = helpers.getValue("enable-bottom-buttons");
          CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton = helpers.getValue("hide-entire-work-button");
          CHAPTER_SHORTCUTS_CONFIG.hideShareButton = helpers.getValue("hide-share-button");
          CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton = helpers.getValue("hide-download-button");
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

    // Add to page
    document.body.appendChild(dialog);

    // Close on background click
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  // --- HIDE WORK PAGE BUTTONS ---
  function hideWorkPageButtons() {
    // Hide Entire Work button
    if (CHAPTER_SHORTCUTS_CONFIG.hideEntireWorkButton) {
      document.querySelectorAll("li.chapter.entire").forEach((el) => {
        el.style.display = "none";
      });
    }

    // Hide Share button
    if (CHAPTER_SHORTCUTS_CONFIG.hideShareButton) {
      document
        .querySelectorAll('a.modal[title="Share Work"]')
        .forEach((el) => {
          el.parentElement.style.display = "none";
        });
    }

    // Hide Download button
    if (CHAPTER_SHORTCUTS_CONFIG.hideDownloadButton) {
      document.querySelectorAll("li.download").forEach((el) => {
        el.style.display = "none";
      });
    }
  }

  // --- GET STORY ID ---
  function getStoryId() {
    const match = window.location.pathname.match(/works\/(\d+)/);
    if (match !== null) {
      return match[1];
    }
    const chapterForm = document.querySelector("#chapter_index li form");
    if (chapterForm && chapterForm.getAttribute("action")) {
      const actionMatch = chapterForm
        .getAttribute("action")
        .match(/works\/(\d+)/);
      if (actionMatch) {
        return actionMatch[1];
      }
    }
    return null;
  }

  // --- ADD CHAPTER BUTTONS & LINKS ---
  function addChapterButtons(forceRerender = false) {
    // Remove any previous custom links/buttons if rerendering
    if (forceRerender) {
      document
        .querySelectorAll("#go_to_last_chap, #go_to_first_chap, #go_to_last_chap_bottom, #go_to_first_chap_bottom")
        .forEach((el) => el.remove());
      document
        .querySelectorAll(".ao3-last-chapter-link")
        .forEach((el) => el.remove());
    }

    // Check if we're on a work page with chapter navigation
    const workNav = document.querySelector("ul.work");
    const navList = document.querySelector("ul.work.navigation.actions");
    const indexList = document.querySelector("ul.index");
    const hasNext = navList && navList.querySelector("li.next");
    const hasPrev = navList && navList.querySelector("li.previous");
    if (workNav && !indexList) {
      // Insert First Chapter button before Last Chapter button (top nav)
      let firstChapterBtn = null;
      let lastChapterBtn = null;
      if (hasPrev) {
        firstChapterBtn = document.createElement("li");
        firstChapterBtn.id = "go_to_first_chap";
        firstChapterBtn.innerHTML = "<a>First Chapter</a>";
        firstChapterBtn.addEventListener("click", function () {
          window.location.href = `/works/${getStoryId()}`;
        });
        workNav.prepend(firstChapterBtn);
      }
      if (hasNext) {
        lastChapterBtn = document.createElement("li");
        lastChapterBtn.id = "go_to_last_chap";
        lastChapterBtn.innerHTML = `<a>Last Chapter</a>`;
        lastChapterBtn.addEventListener("click", function () {
          const select = document.querySelector("#selected_id");
          if (select && select.options.length > 0) {
            const lastChapterId =
              select.options[select.options.length - 1].value;
            window.location.href = `/works/${getStoryId()}/chapters/${lastChapterId}`;
          }
        });
        if (firstChapterBtn && firstChapterBtn.nextSibling) {
          firstChapterBtn.insertAdjacentElement('afterend', lastChapterBtn);
        } else {
          workNav.prepend(lastChapterBtn);
        }
      }
    }

    // Insert bottom navigation buttons using the beta approach
    const actionsUl = document.querySelector('#feedback ul.actions');
    if (actionsUl && CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons && workNav && !indexList) {
      // Remove any previously added bottom buttons
      actionsUl.querySelectorAll('#go_to_first_chap_bottom, #go_to_last_chap_bottom').forEach(el => el.remove());
      const topLi = actionsUl.querySelector('li a[href="#main"]');
      if (topLi && topLi.parentElement) {
        let insertAfter = topLi.parentElement;
        // Always insert First Chapter before Last Chapter
        let firstChapterBtn = null;
        let lastChapterBtn = null;
        if (hasPrev) {
          firstChapterBtn = document.createElement("li");
          firstChapterBtn.id = "go_to_first_chap_bottom";
          firstChapterBtn.innerHTML = "<a>First Chapter</a>";
          firstChapterBtn.addEventListener("click", function () {
            window.location.href = `/works/${getStoryId()}`;
          });
          insertAfter.insertAdjacentElement('afterend', firstChapterBtn);
          insertAfter = firstChapterBtn;
        }
        if (hasNext) {
          lastChapterBtn = document.createElement("li");
          lastChapterBtn.id = "go_to_last_chap_bottom";
          lastChapterBtn.innerHTML = `<a>Last Chapter</a>`;
          lastChapterBtn.addEventListener("click", function () {
            const select = document.querySelector("#selected_id");
            if (select && select.options.length > 0) {
              const lastChapterId = select.options[select.options.length - 1].value;
              window.location.href = `/works/${getStoryId()}/chapters/${lastChapterId}`;
            }
          });
          insertAfter.insertAdjacentElement('afterend', lastChapterBtn);
          insertAfter = lastChapterBtn;
        }
      }
    }

    // Add last chapter links to work listings
    if (document.querySelector(".header h4.heading")) {
      const headings = document.querySelectorAll(".header h4.heading");
      headings.forEach((heading) => {
        const link = heading.querySelector("a");
        if (link) {
          const storyPath = link.getAttribute("href");
          const match = storyPath.match(/works\/(\d+)/);
          if (match) {
            const storyId = match[1];
            fetch(`/works/${storyId}/navigate`)
              .then((response) => response.text())
              .then((data) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data, "text/html");
                const lastChapterLink = doc.querySelector("ol li:last-child a");
                if (lastChapterLink) {
                  const lastChapterPath = lastChapterLink.getAttribute("href");
                  const lastChapterEl = document.createElement("a");
                  lastChapterEl.href = lastChapterPath;
                  lastChapterEl.title = "Jump to last chapter";
                  lastChapterEl.textContent = ` ${
                    CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol || "»"
                  }`;
                  lastChapterEl.className = "ao3-last-chapter-link";
                  heading.appendChild(lastChapterEl);
                }
              })
              .catch((error) =>
                console.error("Error fetching chapter data:", error)
              );
          }
        }
      });
    }
  }

  // --- INITIALIZATION ---
  loadChapterShortcutsConfig();

  // Show startup message
  console.log("[AO3: Chapter Shortcuts] loaded.");

  // Add to shared menu using library helper (conditionally)
  if (!CHAPTER_SHORTCUTS_CONFIG.hideMenuOptions || helpers.isAO3Homepage()) {
    helpers.addToSharedMenu({
      id: "opencfg_chapter_shortcuts",
      text: "Chapter Shortcuts",
      onClick: showChapterShortcutsMenu,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      addChapterButtons();
      hideWorkPageButtons();
      setupBottomNavObserver();
    });
  } else {
    addChapterButtons();
    hideWorkPageButtons();
    setupBottomNavObserver();
  }

  // Setup observer for bottom navigation
  function setupBottomNavObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if the added node is the bottom nav ul or contains it
            const bottomNav = node.querySelector && node.querySelector('ul.actions a[href="#main"]') ? node.querySelector('ul.actions') : 
                              node.matches && node.matches('ul.actions a[href="#main"]') ? node : null;
            if (bottomNav) {
              // Add bottom buttons if enabled and on work page
              const workNav = document.querySelector("ul.work");
              const indexList = document.querySelector("ul.index");
              if (workNav && !indexList && CHAPTER_SHORTCUTS_CONFIG.enableBottomButtons) {
                const topLink = bottomNav.querySelector('a[href="#main"]');
                if (topLink) {
                  const topLi = topLink.parentElement;
                  const navList = document.querySelector("ul.work.navigation.actions");
                  const hasNext = navList && navList.querySelector("li.next");
                  const hasPrev = navList && navList.querySelector("li.previous");

                  // Add First Chapter button if not on the first chapter
                  if (hasPrev) {
                    const firstChapterBtnBottom = document.createElement("li");
                    firstChapterBtnBottom.id = "go_to_first_chap_bottom";
                    firstChapterBtnBottom.innerHTML = "<a>First Chapter</a>";
                    firstChapterBtnBottom.addEventListener("click", function () {
                      window.location.href = `/works/${getStoryId()}`;
                    });
                    topLi.after(firstChapterBtnBottom);
                  }

                  // Add Last Chapter button if not on the last chapter
                  if (hasNext) {
                    const lastChapterBtnBottom = document.createElement("li");
                    lastChapterBtnBottom.id = "go_to_last_chap_bottom";
                    lastChapterBtnBottom.innerHTML = `<a>Last Chapter</a>`;
                    lastChapterBtnBottom.addEventListener("click", function () {
                      const select = document.querySelector("#selected_id");
                      if (select && select.options.length > 0) {
                        const lastChapterId =
                          select.options[select.options.length - 1].value;
                        window.location.href = `/works/${getStoryId()}/chapters/${lastChapterId}`;
                      }
                    });
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
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
