// ==UserScript==
// @name          AO3: Skin Switcher
// @version       2.1
// @description   Change site skins from anywhere without leaving the page.
// @author        Blackbatcat
// @match         *://archiveofourown.org/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1680254/AO3%3A%20Menu%20Helpers%20Library.js
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG_KEY = "ao3_skin_switcher_config";
  const CACHE_KEY = "ao3_skin_switcher_cache";
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  let cachedUsername = null;
  let config = loadConfig();
  let isLoadingMenu = false;

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

  function getCachedSkins() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          // Restore Date objects from strings
          if (data && data.skins) {
            data.skins.forEach((skin) => {
              if (skin.lastModified) {
                skin.lastModified = new Date(skin.lastModified);
              }
            });
          }
          return data;
        }
      }
    } catch (e) {}
    return null;
  }

  function setCachedSkins(data) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (e) {}
  }

  function clearSkinsCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
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
        // Clear cache since skin changed
        clearSkinsCache();
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
        // Clear cache since skin changed
        clearSkinsCache();
        location.reload();
      })
      .catch(() => {
        alert("Failed to revert to default skin. Please try again.");
      });
  }

  async function showSkinMenu() {
    // Prevent multiple simultaneous menu opens
    if (isLoadingMenu) return;
    isLoadingMenu = true;

    try {
      // Remove any existing dialogs
      if (window.AO3MenuHelpers) {
        window.AO3MenuHelpers.removeAllDialogs();
      }

      const username = detectUsername();
      if (!username) {
        alert(
          "Could not detect your AO3 username. Please visit your Dashboard, Preferences, or Skins page to initialize Skin Switcher."
        );
        return;
      }

      // Inject list item styles
      if (window.AO3MenuHelpers) {
        window.AO3MenuHelpers.injectListItemStyles();
      }

      // Try to get cached data first
      let data = getCachedSkins();

      if (!data) {
        // No cache, fetch from server
        data = await fetchSkins(username);
        setCachedSkins(data);
      }

      if (!data) {
        return;
      }

      const { skins, formAction } = data;

      // Pre-sort both arrays
      const sortedSkins = [...skins].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      const sortedByDate = [...skins].sort((a, b) => {
        if (!a.lastModified && !b.lastModified) return 0;
        if (!a.lastModified) return 1;
        if (!b.lastModified) return -1;
        return b.lastModified - a.lastModified;
      });

      let editMode = false;

      function render() {
        // Create content container
        const contentContainer = document.createElement("div");

        // Add revert to default button (only in normal mode)
        if (!editMode) {
          const revertItem = window.AO3MenuHelpers.createListItem({
            text: "↺ Revert to Default Skin",
            onClick: () => revertToDefault(formAction),
            dataAttribute: "data-action",
            dataValue: "revert",
          });
          revertItem.style.fontWeight = "bold";
          contentContainer.appendChild(revertItem);
        }

        // Use pre-sorted arrays
        const skinsToShow = editMode ? sortedByDate : sortedSkins;

        skinsToShow.forEach((skin) => {
          if (!editMode && skin.isParentOnly) return;

          const checkmark = skin.isActive
            ? window.AO3MenuHelpers.createCheckmarkIcon({
                title: "active skin",
                useRepliedClass: true,
              }).outerHTML
            : "";

          const badge = skin.isParentOnly ? "Parent-only" : "";

          const skinItem = window.AO3MenuHelpers.createListItem({
            text: skin.name,
            onClick: editMode
              ? () => {
                  // Clear cache when navigating to edit page
                  clearSkinsCache();
                  window.location.href = `https://archiveofourown.org/skins/${skin.id}/edit`;
                }
              : () => applySkin(skin.id, formAction),
            dataAttribute: editMode ? "data-edit-id" : "data-skin-id",
            dataValue: skin.id,
            icon: checkmark,
            badge: badge,
            badgeStyles: {}, // Pass empty object - we'll add the class manually
          });

          // If there's a badge, add the .unread class to inherit skin styling
          if (badge) {
            const badgeElement = skinItem.querySelector(".item-badge");
            if (badgeElement) {
              badgeElement.classList.add("unread");
              // Remove inline styles that override the skin's CSS, but keep essential layout
              badgeElement.style.cssText =
                "margin-left: 8px; white-space: nowrap; display: inline-block; font-size: 0.7em;";
            }
          }

          contentContainer.appendChild(skinItem);
        });

        // Create dialog with header actions
        const dialog = window.AO3MenuHelpers.createFixedHeightDialog({
          title: "🔄 Skin Switcher",
          content: contentContainer,
          height: "450px",
          width: "90%",
          maxWidth: "500px",
          headerActions: [
            {
              id: "edit-toggle",
              icon: window.AO3MenuHelpers.getEditIconSVG(),
              title: editMode ? "Exit Edit Mode" : "Edit Mode",
              onClick: () => {
                editMode = !editMode;
                render();
              },
            },
            {
              id: "home-btn",
              icon: window.AO3MenuHelpers.getHomeIconSVG(),
              title: "Go to Skins Page",
              onClick: () => {
                // Clear cache when navigating to skins page
                clearSkinsCache();
                window.location.href = `https://archiveofourown.org/users/${username}/skins`;
              },
            },
          ],
        });

        // Update edit button opacity based on mode
        const editBtn = dialog.querySelector("#edit-toggle");
        if (editBtn) {
          editBtn.style.opacity = editMode ? "1" : "0.7";
        }

        document.body.appendChild(dialog);
      }

      render();
    } catch (e) {
      console.error("[AO3: Skin Switcher] Error:", e);
    } finally {
      isLoadingMenu = false;
    }
  }

  function initSharedMenu() {
    if (window.AO3MenuHelpers) {
      window.AO3MenuHelpers.addToSharedMenu({
        id: "opencfg_skin_changer",
        text: "Skin Switcher",
        onClick: showSkinMenu,
      });
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

  function injectMenuListItemHoverOverride() {
    const overrideStyle = document.createElement("style");
    overrideStyle.textContent = `.menu-list-item:hover { background: rgba(0,0,0,0.1) !important; }`;
    document.head.appendChild(overrideStyle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initSharedMenu();
      hidePreferenceFlash();
      injectMenuListItemHoverOverride();
    });
  } else {
    initSharedMenu();
    hidePreferenceFlash();
    injectMenuListItemHoverOverride();
  }
})();
