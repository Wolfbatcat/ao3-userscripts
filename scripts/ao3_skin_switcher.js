// ==UserScript==
// @name         AO3: Skin Switcher
// @version      1.8
// @description  Change site skins from anywhere without leaving the page.
// @author       Blackbatcat
// @match        *://archiveofourown.org/*
// @license      MIT
// @grant        none
// @run-at       document-end
// @namespace    https://greasyfork.org/users/1498004
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG_KEY = "ao3_skin_switcher_config";
  let cachedUsername = null;
  let config = loadConfig();

  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { username: null };
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {}
  }

  function detectUsername() {
    if (cachedUsername) return cachedUsername;
    if (config.username) {
      cachedUsername = config.username;
      return config.username;
    }

    // Try to get username from user menu
    const userMenu = document.querySelector(
      "li.user.logged-in > a, #greeting .dropdown-toggle, #greeting .user"
    );
    if (userMenu) {
      // AO3 user menu: <a href="/users/USERNAME" ...>USERNAME</a>
      const href = userMenu.getAttribute("href");
      const text = userMenu.textContent.trim();
      if (href && href.match(/\/users\//)) {
        const match = href.match(/\/users\/([^\/]+)/);
        if (match && match[1]) {
          cachedUsername = match[1];
          config.username = cachedUsername;
          saveConfig(config);
          return cachedUsername;
        }
      }
      // Fallback: sometimes the username is the text
      if (text && !text.match(/\s/)) {
        cachedUsername = text;
        config.username = cachedUsername;
        saveConfig(config);
        return cachedUsername;
      }
    }

    // Fallback: try to get username from current URL
    const urlMatch = window.location.href.match(/\/users\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      cachedUsername = urlMatch[1];
      config.username = cachedUsername;
      saveConfig(config);
      return cachedUsername;
    }

    return null;
  }

  async function fetchSkins(username) {
    const response = await fetch(
      `https://archiveofourown.org/users/${username}/skins?skin_type=Skin`
    );
    if (!response.ok) throw new Error("Failed to fetch skins");

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const prefForm = doc.querySelector('form[id^="edit_preference_"]');
    const formAction = prefForm ? prefForm.action : null;

    const skins = [];
    doc.querySelectorAll("li.skins.own").forEach((item) => {
      const link = item.querySelector(".heading a");
      const skinName = link ? link.textContent.trim() : null;
      const skinIdMatch = link ? link.href.match(/\/skins\/(\d+)/) : null;
      const skinId = skinIdMatch ? skinIdMatch[1] : null;

      const hasStopUsing = item.querySelector(
        'input[type="submit"][value="Stop Using"]'
      );
      const hasUseButton = item.querySelector(
        'input[type="submit"][value="Use"]'
      );
      const hasEditButton = item.querySelector('a[href*="/edit"]');

      const isUsable = !!(hasUseButton || hasStopUsing);
      const isParentOnly = !isUsable && hasEditButton;

      // Get last modified date
      const dateText =
        item.querySelector(".datetime")?.textContent.trim() || "";
      let lastModified = null;
      if (dateText) {
        lastModified = new Date(dateText);
      }

      if (skinName && skinId && (isUsable || isParentOnly)) {
        skins.push({
          name: skinName,
          id: skinId,
          isActive: !!hasStopUsing,
          isParentOnly: isParentOnly,
          lastModified: lastModified,
        });
      }
    });

    return { skins, formAction };
  }

  function getFreshToken() {
    const tokenInput = document.querySelector(
      'input[name="authenticity_token"]'
    );
    if (tokenInput) return tokenInput.value;

    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) return metaToken.content;

    return null;
  }

  function applySkin(skinId, formAction) {
    const token = getFreshToken();
    if (!token) {
      alert(
        "Could not find authentication token. Please try refreshing the page."
      );
      return;
    }

    const formData = new FormData();
    formData.append("_method", "put");
    formData.append("authenticity_token", token);
    formData.append("preference[skin_id]", skinId);
    formData.append("commit", "Use");

    fetch(formAction, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      redirect: "manual",
    })
      .then(() => {
        location.reload();
      })
      .catch(() => {
        alert("Failed to apply skin. Please try again.");
      });
  }

  function revertToDefault(formAction) {
    const token = getFreshToken();
    if (!token) {
      alert(
        "Could not find authentication token. Please try refreshing the page."
      );
      return;
    }

    const formData = new FormData();
    formData.append("_method", "patch");
    formData.append("authenticity_token", token);
    formData.append("preference[skin_id]", "1");
    formData.append("commit", "Revert to Default Skin");

    fetch(formAction, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      redirect: "manual",
    })
      .then(() => {
        location.reload();
      })
      .catch(() => {
        alert("Failed to revert to default skin. Please try again.");
      });
  }

  async function showSkinMenu() {
    document
      .querySelectorAll(".ao3-skin-changer-dialog")
      .forEach((d) => d.remove());

    const username = detectUsername();
    if (!username) {
      alert(
        "Could not detect your AO3 username. Please visit your Dashboard, Preferences, or Skins page to initialize Skin Switcher."
      );
      return;
    }

    let inputBg = "#fffaf5";
    let borderRadius = "8px";
    let borderColor = "rgba(0,0,0,0.2)";
    let textColor = "inherit";

    const testInput = document.createElement("input");
    document.body.appendChild(testInput);
    const computedBg = window.getComputedStyle(testInput).backgroundColor;
    if (
      computedBg &&
      computedBg !== "rgba(0, 0, 0, 0)" &&
      computedBg !== "transparent"
    ) {
      inputBg = computedBg;
    }
    testInput.remove();

    const elementsToCheck = [
      document.querySelector("input"),
      document.querySelector("button"),
      document.querySelector(".actions a"),
    ];

    for (const elem of elementsToCheck) {
      if (elem) {
        const computed = window.getComputedStyle(elem);
        if (computed.borderRadius && computed.borderRadius !== "0px") {
          borderRadius = computed.borderRadius;
        }
        if (
          computed.borderColor &&
          computed.borderColor !== "rgba(0, 0, 0, 0)"
        ) {
          borderColor = computed.borderColor;
        }
        break;
      }
    }

    const bodyComputed = window.getComputedStyle(document.body);
    if (bodyComputed.color) textColor = bodyComputed.color;

    // Sample .unread styling if it exists
    let unreadStyles = {
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#bbb",
      borderRadius: "3px",
      padding: "2px 4px",
      fontSize: "0.8em",
      backgroundColor: "",
      color: "",
    };
    const unreadElement = document.querySelector(".unread");
    if (unreadElement) {
      const computed = window.getComputedStyle(unreadElement);
      if (computed.borderWidth && computed.borderWidth !== "0px")
        unreadStyles.borderWidth = computed.borderWidth;
      if (computed.borderStyle && computed.borderStyle !== "none")
        unreadStyles.borderStyle = computed.borderStyle;
      if (computed.borderColor) unreadStyles.borderColor = computed.borderColor;
      if (computed.borderRadius && computed.borderRadius !== "0px")
        unreadStyles.borderRadius = computed.borderRadius;
      if (computed.padding) unreadStyles.padding = computed.padding;
      if (computed.fontSize) unreadStyles.fontSize = computed.fontSize;
      if (
        computed.backgroundColor &&
        computed.backgroundColor !== "rgba(0, 0, 0, 0)" &&
        computed.backgroundColor !== "transparent"
      ) {
        unreadStyles.backgroundColor = computed.backgroundColor;
      }
      if (computed.color) unreadStyles.color = computed.color;
    }

    const dialog = document.createElement("div");
    dialog.className = "ao3-skin-changer-dialog";
    dialog.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: ${inputBg}; padding: 20px; border-radius: ${borderRadius}; box-shadow: 0 0 20px rgba(0,0,0,0.2); z-index: 10000; width: 90%; max-width: 500px; height: 450px; display: flex; flex-direction: column; overflow: hidden; font-family: inherit; font-size: inherit; color: inherit;`;

    dialog.innerHTML = `<h3 style="text-align: center; margin-top: 0; color: inherit;">Loading skins...</h3>`;
    document.body.appendChild(dialog);

    try {
      const data = await fetchSkins(username);
      if (!data) {
        dialog.remove();
        return;
      }

      const { skins, formAction } = data;
      const sortedSkins = [...skins].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const sortedByDate = [...skins].sort((a, b) => {
        if (!a.lastModified && !b.lastModified) return 0;
        if (!a.lastModified) return 1;
        if (!b.lastModified) return -1;
        return b.lastModified - a.lastModified; // Most recent first
      });
      console.log(
        `[AO3: Skin Switcher] Successfully loaded ${skins.length} skin(s).`
      );

      let editMode = false;

      function render() {
        let skinListHTML = "";

        // Use AO3's replied checkmark style for active skin

        if (!editMode) {
          skinListHTML += `<div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid ${borderColor}; border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" data-action="revert"><span style="font-weight: bold;">↺ Revert to Default Skin</span></div>`;
        }

        const skinsToShow = editMode ? sortedByDate : sortedSkins;

        skinsToShow.forEach((skin) => {
          if (!editMode && skin.isParentOnly) return;

          const checkmark = skin.isActive
            ? `<span class="replied" title="active skin" style="border: none !important; background: none !important; font-size: 1em; vertical-align: middle; padding: 0;">✔</span>`
            : "";
          const parentBadge = skin.isParentOnly
            ? `<span class="unread ao3-parent-badge">Parent-only</span>`
            : "";
          // ...existing code...

          skinListHTML += `<div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid ${borderColor}; border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" ${
            editMode ? `data-edit-id="${skin.id}"` : `data-skin-id="${skin.id}"`
          }><div style="display: flex; align-items: center; flex: 1;"><span>${
            skin.name
          }</span>${parentBadge}</div><div style="display: flex; align-items: center; gap: 8px;">${checkmark}</div></div>`;
        });

        dialog.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0;"><h3 style="margin: 0; color: inherit;">🔄 Skin Switcher</h3><div style="display: flex; align-items: center; gap: 10px;"><button id="edit-toggle" title="${
          editMode ? "Exit Edit Mode" : "Edit Mode"
        }" style="background: none; border: none; cursor: pointer; color: ${textColor}; display: flex; align-items: center; padding: 0; opacity: ${
          editMode ? "1" : "0.7"
        }; transition: opacity 0.2s;" class="icon-button"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button id="home-btn" title="Go to Skins Page" style="background: none; border: none; cursor: pointer; color: ${textColor}; display: flex; align-items: center; padding: 0; opacity: 0.7; transition: opacity 0.2s;" class="icon-button"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></button><button id="close-btn" style="background: none; border: none; font-size: 1.5em; cursor: pointer; padding: 0; line-height: 1; color: inherit;">&times;</button></div></div><div style="overflow-y: auto; flex: 1 1 0%; box-sizing: border-box;">${skinListHTML}</div>`;

        const style = document.createElement("style");
        style.textContent = `
          .skin-item:hover { background: rgba(0,0,0,0.08) !important; }
          .ao3-skin-changer-dialog a:hover { border-bottom: none !important; text-decoration: none !important; transform: none !important; }
          .ao3-skin-changer-dialog .icon-button { transform: none !important; }
          .icon-button:hover { opacity: 1 !important; transform: none !important; }
          .ao3-parent-badge { margin-left: 8px; white-space: nowrap; display: inline-block; padding: 2px 6px !important; font-size: 0.75em !important; }
        `;
        document.head.appendChild(style);

        // ...existing code...

        if (!editMode) {
          dialog
            .querySelectorAll(
              ".skin-item[data-skin-id], .skin-item[data-action]"
            )
            .forEach((item) => {
              item.addEventListener("click", () => {
                if (item.dataset.action === "revert")
                  revertToDefault(formAction);
                else if (item.dataset.skinId)
                  applySkin(item.dataset.skinId, formAction);
              });
            });
        } else {
          dialog
            .querySelectorAll(".skin-item[data-edit-id]")
            .forEach((item) => {
              item.addEventListener("click", () => {
                const skinId = item.dataset.editId;
                window.location.href = `https://archiveofourown.org/skins/${skinId}/edit`;
              });
            });
        }

        document.getElementById("edit-toggle").addEventListener("click", () => {
          editMode = !editMode;
          render();
        });

        document.getElementById("home-btn").addEventListener("click", () => {
          window.location.href = `https://archiveofourown.org/users/${username}/skins`;
        });

        document
          .getElementById("close-btn")
          .addEventListener("click", () => dialog.remove());
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) dialog.remove();
        });
      }

      render();
    } catch (e) {
      console.error("[AO3: Skin Switcher] Error:", e);
      dialog.remove();
      alert("Failed to load skins. Please try again.");
    }
  }

  function initSharedMenu() {
    let menuContainer = document.getElementById("scriptconfig");

    if (!menuContainer) {
      const headerMenu = document.querySelector(
        "ul.primary.navigation.actions"
      );
      const searchItem = headerMenu?.querySelector("li.search");
      if (!headerMenu || !searchItem) return;

      menuContainer = document.createElement("li");
      menuContainer.className = "dropdown";
      menuContainer.id = "scriptconfig";
      menuContainer.innerHTML = `<a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a><ul class="menu dropdown-menu"></ul>`;
      headerMenu.insertBefore(menuContainer, searchItem);
    }

    const menu = menuContainer.querySelector(".dropdown-menu");
    if (menu && !menu.querySelector("#opencfg_skin_changer")) {
      const menuItem = document.createElement("li");
      menuItem.innerHTML =
        '<a href="javascript:void(0);" id="opencfg_skin_changer">Skin Switcher</a>';
      menuItem.querySelector("a").addEventListener("click", showSkinMenu);
      menu.appendChild(menuItem);
    }
  }

  const hidePreferenceFlash = () => {
    const url = window.location.href;
    if (url.includes("/preferences") || url.match(/\/users\/[^\/]+\/?$/))
      return;

    const flash = document.querySelector(".flash.notice");
    if (
      flash &&
      flash.textContent.includes("Your preferences were successfully updated")
    ) {
      flash.style.display = "none";
    }
  };

  console.log("[AO3: Skin Switcher] loaded.");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initSharedMenu();
      hidePreferenceFlash();
    });
  } else {
    initSharedMenu();
    hidePreferenceFlash();
  }
})();
