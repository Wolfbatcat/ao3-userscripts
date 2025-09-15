// ==UserScript==
// @name         AO3: Chapter Shortcuts
// @version      1.1
// @description  Adds shortcuts for first and last chapters on AO3 works. Customizable!
// @author       BlackBatCat
// @match        http://archiveofourown.org/*
// @match        https://archiveofourown.org/*
// @grant        none
// @downloadURL  
// @updateURL    
// ==/UserScript==

(function () {
  "use strict";

  // --- SETTINGS STORAGE ---
  const CHAPTER_SHORTCUTS_CONFIG_KEY = "ao3_chapter_shortcuts_config";
  const DEFAULT_CHAPTER_SHORTCUTS_CONFIG = {
    lastChapterSymbol: "»",
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
    document
      .querySelectorAll(".ao3-chapter-shortcuts-menu-dialog")
      .forEach((d) => d.remove());
    // Get AO3 input field background color for seamless skin integration
    let inputBg = "#fffaf5"; // fallback
    const testInput = document.createElement("input");
    document.body.appendChild(testInput);
    try {
      const computedBg = window.getComputedStyle(testInput).backgroundColor;
      if (
        computedBg &&
        computedBg !== "rgba(0, 0, 0, 0)" &&
        computedBg !== "transparent"
      ) {
        inputBg = computedBg;
      }
    } catch (e) {}
    testInput.remove();

    const dialog = document.createElement("div");
    dialog.className = "ao3-chapter-shortcuts-menu-dialog";
    dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${inputBg};
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
            z-index: 10000;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            font-family: inherit;
            font-size: inherit;
            color: inherit;
            box-sizing: border-box;
        `;
    dialog.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; font-size: 1.2em; font-family: inherit; color: inherit;">⚙️ Chapter Shortcuts Settings ⚙️</h3>
            <hr style='margin: 16px 0; border: none; border-top: 1px solid #ccc;'>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-family: inherit; color: inherit;">Choose a symbol for the Last Chapter button:</label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button type="button" class="preset-symbol" data-symbol="»" style="font-family: inherit; font-size: inherit; color: inherit;">»</button>
                    <button type="button" class="preset-symbol" data-symbol="➼" style="font-family: inherit; font-size: inherit; color: inherit;">➼</button>
                    <button type="button" class="preset-symbol" data-symbol="➺" style="font-family: inherit; font-size: inherit; color: inherit;">➺</button>
                    <button type="button" class="preset-symbol" data-symbol="✦" style="font-family: inherit; font-size: inherit; color: inherit;">✦</button>
                    <button type="button" class="preset-symbol" data-symbol="❥" style="font-family: inherit; font-size: inherit; color: inherit;">❥</button>
                    <button type="button" class="preset-symbol" data-symbol="♥︎" style="font-family: inherit; font-size: inherit; color: inherit;">♥︎</button>
                    <button type="button" class="preset-symbol" data-symbol="✿" style="font-family: inherit; font-size: inherit; color: inherit;">✿</button>
                    <button type="button" class="preset-symbol" data-symbol="ɞɞ" style="font-family: inherit; font-size: inherit; color: inherit;">ɞɞ</button>
                </div>
                <label style="display: block; margin-bottom: 5px; font-family: inherit; color: inherit;">Or enter your own:</label>
                <input type="text" id="custom-symbol" value="${CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol}" maxlength="4" style="width: 100%; padding: 5px; font-size: inherit; font-family: inherit; color: inherit; background: ${inputBg}; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
            <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px;">
                <button id="chapter-shortcuts-save" style="flex: 1; padding: 10px; font-size: 1em; font-family: inherit; color: inherit;">Save</button>
                <button id="chapter-shortcuts-cancel" style="flex: 1; padding: 10px; font-size: 1em; font-family: inherit; color: inherit;">Cancel</button>
            </div>
            <div style="text-align: center; margin-top: 5px;">
                <a href="#" id="resetShortcutsSettingsLink" style="font-size: 0.9em; color: #666; text-decoration: none; font-family: inherit;">Reset to Default</a>
            </div>
        `;
    document.body.appendChild(dialog);
    dialog.querySelectorAll(".preset-symbol").forEach((btn) => {
      btn.addEventListener("click", () => {
        dialog.querySelector("#custom-symbol").value = btn.dataset.symbol;
      });
    });
    dialog
      .querySelector("#chapter-shortcuts-save")
      .addEventListener("click", () => {
        CHAPTER_SHORTCUTS_CONFIG.lastChapterSymbol =
          dialog.querySelector("#custom-symbol").value || "»";
        saveChapterShortcutsConfig();
        dialog.remove();
        // Re-render chapter buttons/links
        addChapterButtons(true);
      });
    dialog
      .querySelector("#chapter-shortcuts-cancel")
      .addEventListener("click", () => {
        dialog.remove();
      });
    dialog
      .querySelector("#resetShortcutsSettingsLink")
      .addEventListener("click", function (e) {
        e.preventDefault();
        CHAPTER_SHORTCUTS_CONFIG = { ...DEFAULT_CHAPTER_SHORTCUTS_CONFIG };
        saveChapterShortcutsConfig();
        dialog.remove();
        addChapterButtons(true);
      });
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
        .querySelectorAll("#go_to_last_chap, #go_to_first_chap")
        .forEach((el) => el.remove());
      document
        .querySelectorAll(".ao3-last-chapter-link")
        .forEach((el) => el.remove());
    }
    // Check if we're on a work page with chapter navigation
    const workNav = document.querySelector("ul.work");
    const indexList = document.querySelector("ul.index");
    if (workNav && !indexList) {
      // Add Last Chapter button if not on the last chapter
      if (document.querySelector(".next")) {
        const lastChapterBtn = document.createElement("li");
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
        workNav.prepend(lastChapterBtn);
      }
      // Add First Chapter button if not on the first chapter
      if (document.querySelector(".previous")) {
        const firstChapterBtn = document.createElement("li");
        firstChapterBtn.id = "go_to_first_chap";
        firstChapterBtn.innerHTML = "<a>First Chapter</a>";
        firstChapterBtn.addEventListener("click", function () {
          window.location.href = `/works/${getStoryId()}`;
        });
        workNav.prepend(firstChapterBtn);
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

  // --- SHARED MENU MANAGEMENT ---
  function initSharedMenu() {
    // Create shared menu object if it doesn't exist
    if (!window.AO3UserScriptMenu) {
      window.AO3UserScriptMenu = {
        items: [],
        register: function(item) {
          this.items.push(item);
          this.renderMenu();
        },
        renderMenu: function() {
          // Find or create menu container
          let menuContainer = document.getElementById('ao3-userscript-menu');
          if (!menuContainer) {
            const headerMenu = document.querySelector("ul.primary.navigation.actions");
            const searchItem = headerMenu ? headerMenu.querySelector("li.search") : null;
            if (!headerMenu || !searchItem) return;
            
            menuContainer = document.createElement("li");
            menuContainer.className = "dropdown";
            menuContainer.id = "ao3-userscript-menu";
            const title = document.createElement("a");
            title.href = "#";
            title.textContent = "Userscripts";
            menuContainer.appendChild(title);
            const menu = document.createElement("ul");
            menu.className = "menu dropdown-menu";
            menuContainer.appendChild(menu);
            headerMenu.insertBefore(menuContainer, searchItem);
          }
          
          // Render menu items
          const menu = menuContainer.querySelector("ul.menu");
          if (menu) {
            menu.innerHTML = "";
            this.items.forEach(item => {
              const li = document.createElement("li");
              const a = document.createElement("a");
              a.href = "#";
              a.textContent = item.label;
              a.addEventListener("click", (e) => {
                e.preventDefault();
                item.onClick();
              });
              li.appendChild(a);
              menu.appendChild(li);
            });
          }
        }
      };
    }
    
    // Register this script's menu item
    window.AO3UserScriptMenu.register({
      label: "Chapter Shortcuts Settings",
      onClick: showChapterShortcutsMenu
    });
  }

  // --- INITIALIZATION ---
  loadChapterShortcutsConfig();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      addChapterButtons();
      initSharedMenu();
    });
  } else {
    addChapterButtons();
    initSharedMenu();
  }
})();