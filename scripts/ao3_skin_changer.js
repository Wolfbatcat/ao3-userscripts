// ==UserScript==
// @name         AO3: Skin Changer
// @version      1.7
// @description  Change AO3 site skins from anywhere on the site with a convenient dropdown menu
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
  const USERNAME_KEY = "ao3_skin_changer_username";
  let cachedUsername = null;
  let cachedSkins = null;
  let isLoading = false;

  // --- USERNAME DETECTION ---
  function detectUsername() {
    // Try cached first
    if (cachedUsername) return cachedUsername;

    // Try localStorage
    const stored = localStorage.getItem(USERNAME_KEY);
    if (stored) {
      cachedUsername = stored;
      return stored;
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
            localStorage.setItem(USERNAME_KEY, cachedUsername);
            console.log(`[AO3: Skin Changer] Username detected: ${cachedUsername}`);
            return cachedUsername;
          }
        }
      }
    }

    // Try to get from page URL if we're on a user page
    const urlMatch = window.location.href.match(/\/users\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      cachedUsername = urlMatch[1];
      localStorage.setItem(USERNAME_KEY, cachedUsername);
      console.log(`[AO3: Skin Changer] Username detected from URL: ${cachedUsername}`);
      return cachedUsername;
    }

    return null;
  }

  // --- PROMPT FOR USERNAME ---
  function promptForUsername() {
    const username = prompt(
      "Enter your AO3 username to enable the Skin Changer:"
    );
    if (username && username.trim()) {
      const trimmed = username.trim();
      localStorage.setItem(USERNAME_KEY, trimmed);
      cachedUsername = trimmed;
      return trimmed;
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

      cachedSkins = { skins, formAction };
      return cachedSkins;
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

    console.error("[AO3: Skin Changer] Could not find authenticity token on page");
    return null;
  }

  // --- APPLY SKIN ---
  async function applySkin(skinId, formAction) {
    const token = getFreshToken();
    if (!token) {
      alert("Could not find authentication token. Please try refreshing the page.");
      return;
    }

    console.log(`[AO3: Skin Changer] Attempting to apply skin ID: ${skinId}`);
    console.log(`[AO3: Skin Changer] Form action: ${formAction}`);
    console.log(`[AO3: Skin Changer] Using fresh token from current page`);

    try {
      // Submit form via fetch in background
      const formData = new FormData();
      formData.append("_method", "put");
      formData.append("authenticity_token", token);
      formData.append("preference[skin_id]", skinId);
      formData.append("commit", "Use");

      const response = await fetch(formAction, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        redirect: "manual" // Don't follow redirects
      });

      console.log(`[AO3: Skin Changer] Response status: ${response.status}`);

      // Reload current page to apply new skin
      console.log(`[AO3: Skin Changer] Skin changed successfully, reloading page...`);
      location.reload();
    } catch (e) {
      console.error("[AO3: Skin Changer] Error applying skin:", e);
      alert("Failed to apply skin. Please try again.");
    }
  }

  // --- REVERT TO DEFAULT ---
  async function revertToDefault(formAction) {
    const token = getFreshToken();
    if (!token) {
      alert("Could not find authentication token. Please try refreshing the page.");
      return;
    }

    console.log(`[AO3: Skin Changer] Attempting to revert to default skin`);
    console.log(`[AO3: Skin Changer] Using fresh token from current page`);

    try {
      // Submit form via fetch in background
      const formData = new FormData();
      formData.append("_method", "patch");
      formData.append("authenticity_token", token);
      formData.append("preference[skin_id]", "1");
      formData.append("commit", "Revert to Default Skin");

      const response = await fetch(formAction, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        redirect: "manual" // Don't follow redirects
      });

      console.log(`[AO3: Skin Changer] Response status: ${response.status}`);

      // Reload current page to apply default skin
      console.log(`[AO3: Skin Changer] Reverted to default, reloading page...`);
      location.reload();
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
      // Last resort: prompt user
      const inputUsername = promptForUsername();
      if (!inputUsername) {
        alert("Username is required to use Skin Changer.");
        return;
      }
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

    // Log success
    console.log(`[AO3: Skin Changer] Successfully loaded ${skins.length} skin(s).`);

    // Build skin list
    let skinListHTML = "";

    // Add revert to default option
    skinListHTML += `
      <div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" data-action="revert">
        <span style="font-weight: bold;">↺ Revert to Default Skin</span>
      </div>
    `;

    // Add skins
    skins.forEach((skin) => {
      const checkmark = skin.isActive
        ? '<span style="color: green; font-size: 1.2em;">✓</span>'
        : "";
      skinListHTML += `
        <div class="skin-item" style="padding: 12px; margin: 8px 0; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.1); border-radius: ${borderRadius}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; color: inherit;" data-skin-id="${skin.id}">
          <span>${skin.name}</span>
          ${checkmark}
        </div>
      `;
    });

    dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: inherit;">🎨 Skin Changer</h3>
        <button id="skin-changer-close" style="background: none; border: none; font-size: 1.5em; cursor: pointer; padding: 0; line-height: 1; color: inherit;">&times;</button>
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSharedMenu);
  } else {
    initSharedMenu();
  }
})();