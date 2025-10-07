// ==UserScript==
// @name         AO3: Skin Changer
// @version      1.0
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

  // --- CONSTANTS ---
  const CONFIG_KEY = "ao3_skin_changer_config";
  let cachedUsername = null;
  let isLoading = false;

  // --- CONFIG MANAGEMENT ---
  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("[AO3: Skin Changer] Error loading config:", e);
    }
    return { username: null };
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error("[AO3: Skin Changer] Error saving config:", e);
    }
  }

  let config = loadConfig();

  // --- USERNAME DETECTION ---
  function detectUsername() {
    // Try cached first
    if (cachedUsername) return cachedUsername;

    // Try config
    if (config.username) {
      cachedUsername = config.username;
      return config.username;
    }

    // Try to parse from page links and forms - cast a wide net
    const patterns = [
      /\/users\/([^\/]+)\/preferences/,
      /\/users\/([^\/]+)\/pseuds/,
      /\/users\/([^\/]+)\/bookmarks/,
      /\/users\/([^\/]+)\/works/,
      /\/users\/([^\/]+)\/skins/,
      /\/users\/([^\/]+)\/inbox/,
      /\/users\/([^\/]+)\/collections/,
      /\/users\/([^\/]+)\/gifts/,
      /\/users\/([^\/]+)\/series/,
      /\/users\/([^\/]+)\//,  // Generic user link
    ];

    // Check all links and form actions on the page
    const elements = [
      ...document.querySelectorAll('a[href*="/users/"]'),
      ...document.querySelectorAll('form[action*="/users/"]'),
    ];

    for (const pattern of patterns) {
      for (const element of elements) {
        const url = element.href || element.action;
        if (url) {
          const match = url.match(pattern);
          if (match && match[1]) {
            cachedUsername = match[1];
            config.username = cachedUsername;
            saveConfig(config);
            return cachedUsername;
          }
        }
      }
    }

    // Try to get from page URL if we're on a user page
    const urlMatch = window.location.href.match(/\/users\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      cachedUsername = urlMatch[1];
      config.username = cachedUsername;
      saveConfig(config);
      return cachedUsername;
    }

    return null;
  }

  // --- FETCH SKINS ---
  async function fetchSkins(username) {
    if (isLoading) return null;
    isLoading = true;

    try {
      const response = await fetch(
        `https://archiveofourown.org/users/${username}/skins?skin_type=Skin`
      );
      if (!response.ok) throw new Error("Failed to fetch skins");

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract preference form action
      const prefForm = doc.querySelector('form[id^="edit_preference_"]');
      const formAction = prefForm ? prefForm.action : null;

      // Extract skins
      const skins = [];
      const skinItems = doc.querySelectorAll("li.skins.own");

      skinItems.forEach((item) => {
        const link = item.querySelector(".heading a");
        const skinName = link ? link.textContent.trim() : null;
        const skinIdMatch = link ? link.href.match(/\/skins\/(\d+)/) : null;
        const skinId = skinIdMatch ? skinIdMatch[1] : null;

        // Check if this is the active skin (has "Stop Using" button)
        const hasStopUsing = item.querySelector(
          'input[type="submit"][value="Stop Using"]'
        );
        const hasUseButton = item.querySelector(
          'input[type="submit"][value="Use"]'
        );

        // Only include skins with Use or Stop Using buttons (exclude parent skins)
        if (skinName && skinId && (hasUseButton || hasStopUsing)) {
          skins.push({
            name: skinName,
            id: skinId,
            isActive: !!hasStopUsing,
          });
        }
      });

      return { skins, formAction };
    } catch (e) {
      console.error("Error fetching skins:", e);
      alert("Failed to load skins. Please try again.");
      return null;
    } finally {
      isLoading = false;
    }
  }

  // --- GET FRESH TOKEN FROM CURRENT PAGE ---
  function getFreshToken() {
    // Try to find any authenticity token on the current page
    const tokenInput = document.querySelector('input[name="authenticity_token"]');
    if (tokenInput) {
      return tokenInput.value;
    }
    
    // Try meta tag (some pages have it here)
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken) {
      return metaToken.content;
    }
    
    return null;
  }

  // --- APPLY SKIN ---
  function applySkin(skinId, formAction) {
    const token = getFreshToken();
    if (!token) {
      alert("Could not find authentication token. Please try refreshing the page.");
      return;
    }
    
    try {
      // Submit form via fetch in background
      const formData = new FormData();
      formData.append("_method", "put");
      formData.append("authenticity_token", token);
      formData.append("preference[skin_id]", skinId);
      formData.append("commit", "Use");
      
      fetch(formAction, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        redirect: "manual"
      }).then(() => {
        location.reload();
      }).catch(e => {
        console.error("[AO3: Skin Changer] Error applying skin:", e);
        alert("Failed to apply skin. Please try again.");
      });
    } catch (e) {
      console.error("[AO3: Skin Changer] Error applying skin:", e);
      alert("Failed to apply skin. Please try again.");
    }
  }

  // --- REVERT TO DEFAULT ---
  function revertToDefault(formAction) {
    const token = getFreshToken();
    if (!token) {
      alert("Could not find authentication token. Please try refreshing the page.");
      return;
    }
    
    try {
      // Submit form via fetch in background
      const formData = new FormData();
      formData.append("_method", "patch");
      formData.append("authenticity_token", token);
      formData.append("preference[skin_id]", "1");
      formData.append("commit", "Revert to Default Skin");
      
      fetch(formAction, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        redirect: "manual"
      }).then(() => {
        location.reload();
      }).catch(e => {
        console.error("[AO3: Skin Changer] Error reverting to default:", e);
        alert("Failed to revert to default skin. Please try again.");
      });
    } catch (e) {
      console.error("[AO3: Skin Changer] Error reverting to default:", e);
      alert("Failed to revert to default skin. Please try again.");
    }
  }

  // --- SHOW SKIN MENU ---
  async function showSkinMenu() {
    // Remove existing dialogs
    document
      .querySelectorAll(".ao3-skin-changer-dialog")
      .forEach((d) => d.remove());

    const username = detectUsername();
    if (!username) {
      alert("Could not detect your AO3 username. Please visit your Profile, Preferences, or Skins page to use Skin Changer.");
      return;
    }

    // Get AO3 input field background color
    let inputBg = "#fffaf5";
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

    // Get border-radius from page elements
    let borderRadius = "8px";
    try {
      // Try to get border-radius from common AO3 elements
      const elementsToCheck = [
        document.querySelector("input"),
        document.querySelector("button"),
        document.querySelector(".actions a"),
        document.querySelector(".module"),
      ];
      
      for (const elem of elementsToCheck) {
        if (elem) {
          const computedRadius = window.getComputedStyle(elem).borderRadius;
          if (computedRadius && computedRadius !== "0px") {
            borderRadius = computedRadius;
            break;
          }
        }
      }
    } catch (e) {}

    // Get border color from page elements
    let borderColor = "rgba(0,0,0,0.2)";
    try {
      // Try to get border color from common AO3 elements
      const elementsToCheck = [
        document.querySelector("input"),
        document.querySelector("select"),
        document.querySelector("button"),
        document.querySelector(".actions a"),
      ];
      
      for (const elem of elementsToCheck) {
        if (elem) {
          const computedBorder = window.getComputedStyle(elem).borderColor;
          if (computedBorder && computedBorder !== "rgba(0, 0, 0, 0)") {
            borderColor = computedBorder;
            break;
          }
        }
      }
    } catch (e) {}

    // Get main text color (not link color)
    let textColor = "inherit";
    try {
      const bodyElement = document.body;
      if (bodyElement) {
        const computed = window.getComputedStyle(bodyElement);
        if (computed.color) {
          textColor = computed.color;
        }
      }
    } catch (e) {}

    // Create loading dialog
    const dialog = document.createElement("div");
    dialog.className = "ao3-skin-changer-dialog";
    dialog.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: ${inputBg}; padding: 20px; border-radius: ${borderRadius}; box-shadow: 0 0 20px rgba(0,0,0,0.2); z-index: 10000; width: 90%; max-width: 500px; max-height: 70vh; overflow-y: auto; font-family: inherit; font-size: inherit; color: inherit;`;

    dialog.innerHTML = `
      <h3 style="text-align: center; margin-top: 0; color: inherit;">🎨 Skin Changer</h3>
      <p style="text-align: center; color: inherit; opacity: 0.7;">Loading skins...</p>
    `;

    document.body.appendChild(dialog);

    // Fetch skins
    const data = await fetchSkins(username);
    if (!data) {
      dialog.remove();
      return;
    }

    const { skins, formAction } = data;

    // Sort skins alphabetically
    const sortedSkins = [...skins].sort((a, b) => a.name.localeCompare(b.name));

    // Log success
    console.log(`[AO3: Skin Changer] Successfully loaded ${skins.length} skin(s).`);

    // Build skin list
    let skinListHTML = "";

    // Add revert to default option
    skinListHTML += `
      <div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid ${borderColor}; border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" data-action="revert">
        <span style="font-weight: bold;">↺ Revert to Default Skin</span>
      </div>
    `;

    // Add skins
    sortedSkins.forEach((skin) => {
      const checkmark = skin.isActive
        ? '<span style="color: green; font-size: 1.2em;">✓</span>'
        : "";
      skinListHTML += `
        <div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid ${borderColor}; border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" data-skin-id="${skin.id}">
          <span>${skin.name}</span>
          ${checkmark}
        </div>
      `;
    });

    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: inherit;">🎨 Skin Changer</h3>
        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="https://archiveofourown.org/users/${username}/skins" title="Go to Skins Page" style="display: flex; align-items: center; text-decoration: none; color: ${textColor};">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </a>
          <button id="skin-changer-close" style="background: none; border: none; font-size: 1.5em; cursor: pointer; padding: 0; line-height: 1; color: inherit;">&times;</button>
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        ${skinListHTML}
      </div>
    `;

    // Add hover effects
    const style = document.createElement("style");
    style.textContent = `
      .skin-item:hover {
        background: rgba(0,0,0,0.08) !important;
      }
      .ao3-skin-changer-dialog a[title="Go to Skins Page"],
      .ao3-skin-changer-dialog a[title="Go to Skins Page"]:hover {
        border-bottom: none !important;
        text-decoration: none !important;
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    dialog.querySelectorAll(".skin-item").forEach((item) => {
      item.addEventListener("click", () => {
        const skinId = item.dataset.skinId;
        const action = item.dataset.action;

        if (action === "revert") {
          revertToDefault(formAction);
        } else if (skinId) {
          applySkin(skinId, formAction);
        }
      });
    });

    dialog.querySelector("#skin-changer-close").addEventListener("click", () => {
      dialog.remove();
    });

    // Close on outside click
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });
  }

  // --- SHARED MENU MANAGEMENT ---
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
      menuContainer.innerHTML = `
        <a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a>
        <ul class="menu dropdown-menu"></ul>
      `;
      headerMenu.insertBefore(menuContainer, searchItem);
    }

    const menu = menuContainer.querySelector(".dropdown-menu");
    if (menu && !menu.querySelector("#opencfg_skin_changer")) {
      const menuItem = document.createElement("li");
      menuItem.innerHTML =
        '<a href="javascript:void(0);" id="opencfg_skin_changer">Skin Changer</a>';
      menuItem.querySelector("a").addEventListener("click", showSkinMenu);
      menu.appendChild(menuItem);
    }
  }

  // --- INITIALIZATION ---
  console.log("[AO3: Skin Changer] loaded.");

  // Hide the "preferences successfully updated" flash message if it exists
  const hidePreferenceFlash = () => {
    const flash = document.querySelector('.flash.notice');
    if (flash && flash.textContent.includes('Your preferences were successfully updated')) {
      flash.style.display = 'none';
    }
  };

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