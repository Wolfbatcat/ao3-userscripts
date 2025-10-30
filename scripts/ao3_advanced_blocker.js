// ==UserScript==
// @name          AO3: Advanced Blocker
// @version       3.3
// @description   Block works by tags, authors, titles, word counts, and more. Filter by language, completion status, and primary pairings with customizable highlighting.
// @author        BlackBatCat
// @match         *://archiveofourown.org/tags/*/works*
// @match         *://archiveofourown.org/works
// @match         *://archiveofourown.org/works?*
// @match         *://archiveofourown.org/works/search*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/554170/1686204/AO3%3A%20Menu%20Helpers%20Library%20v2.js
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
  "use strict";

  let cachedUsername = null;
  function detectUsername(config) {
    if (cachedUsername) return cachedUsername;
    if (config.username) {
      cachedUsername = config.username;
      return config.username;
    }
    const userLink = document.querySelector(
      'li.user.logged-in a[href^="/users/"]'
    );
    if (userLink) {
      const username = userLink.textContent.trim();
      if (username && config.username !== username) {
        config.username = username;
        saveConfig(config);
      }
      cachedUsername = username;
      return username;
    }
    const urlMatch = window.location.href.match(/\/users\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      const username = urlMatch[1];
      if (config.username !== username) {
        config.username = username;
        saveConfig(config);
      }
      cachedUsername = username;
      return username;
    }
    return null;
  }

  window.ao3Blocker = {};
  try {
    console.log("[AO3: Advanced Blocker] loaded.");
  } catch (e) {}

  const CSS_NAMESPACE = "ao3-blocker";

  const DEFAULTS = {
    tagBlacklist: "",
    tagWhitelist: "",
    tagHighlights: "",
    highlightColor: "#eb6f92",
    minWords: "",
    maxWords: "",
    minChapters: "",
    maxChapters: "",
    maxMonthsSinceUpdate: "",
    blockComplete: false,
    blockOngoing: false,
    authorBlacklist: "",
    titleBlacklist: "",
    summaryBlacklist: "",
    workBlacklist: "",
    showReasons: true,
    showPlaceholders: true,
    allowedLanguages: "",
    maxCrossovers: "6",
    disableOnMyContent: true,
    enableHighlightingOnMyContent: false,
    username: null,
    primaryRelationships: "",
    primaryCharacters: "",
    primaryRelpad: "1",
    primaryCharpad: "5",
    pauseBlocking: false,
    hideCompletelyRules: {},
    _version: "3.3",
  };

  const STORAGE_KEY = "ao3_advanced_blocker_config";

  function sanitizeConfig(config) {
    const sanitized = {};
    const stringFields = [
      "tagBlacklist",
      "tagWhitelist",
      "tagHighlights",
      "authorBlacklist",
      "titleBlacklist",
      "summaryBlacklist",
      "workBlacklist",
      "allowedLanguages",
      "primaryRelationships",
      "primaryCharacters",
      "minWords",
      "maxWords",
      "minChapters",
      "maxChapters",
      "maxMonthsSinceUpdate",
      "maxCrossovers",
      "highlightColor",
      "primaryRelpad",
      "primaryCharpad",
      "username",
    ];
    stringFields.forEach((field) => {
      const value = config[field];
      sanitized[field] =
        typeof value === "string"
          ? value
          : value === null
          ? null
          : String(DEFAULTS[field]);
    });
    const boolFields = [
      "blockComplete",
      "blockOngoing",
      "showReasons",
      "showPlaceholders",
      "disableOnMyContent",
      "enableHighlightingOnMyContent",
      "pauseBlocking",
    ];
    boolFields.forEach((field) => {
      sanitized[field] =
        typeof config[field] === "boolean" ? config[field] : DEFAULTS[field];
    });
    sanitized.hideCompletelyRules = {};
    if (
      config.hideCompletelyRules &&
      typeof config.hideCompletelyRules === "object"
    ) {
      const validKeys = [
        "minWords",
        "maxWords",
        "minChapters",
        "maxChapters",
        "blockComplete",
        "blockOngoing",
        "maxMonthsSinceUpdate",
        "maxCrossovers",
        "language",
        "tagBlacklist",
        "tagWhitelist",
        "authorBlacklist",
        "titleBlacklist",
        "summaryBlacklist",
        "workBlacklist",
        "primaryRelationships",
        "primaryCharacters",
      ];
      validKeys.forEach((key) => {
        if (typeof config.hideCompletelyRules[key] === "boolean") {
          sanitized.hideCompletelyRules[key] = config.hideCompletelyRules[key];
        }
      });
    }
    sanitized._version = "3.3";
    return sanitized;
  }

  const STYLE = `
  html body .ao3-blocker-hidden { display: none; }
  .ao3-blocker-cut { display: none; }
  .ao3-blocker-cut::after { clear: both; content: ''; display: block; }
  .ao3-blocker-reason { margin-left: 5px; }
  .ao3-blocker-hide-reasons .ao3-blocker-reason { display: none; }
  .ao3-blocker-unhide .ao3-blocker-cut { display: block; }
  .ao3-blocker-fold {
    align-items: center; display: flex; justify-content: space-between !important;
    gap: 10px !important; width: 100% !important;
  }
  .ao3-blocker-unhide .ao3-blocker-fold {
    border-bottom: 1px dashed; border-bottom-color: inherit;
    margin-bottom: 15px; padding-bottom: inherit;
  }
  button.ao3-blocker-toggle {
    margin-left: auto; min-width: inherit; min-height: inherit; display: flex;
    align-items: center; justify-content: center; gap: 0.2em; min-width: 80px !important;
    margin-left: 10px !important; flex-shrink: 0 !important; white-space: nowrap !important;
    padding: 4px 8px !important;
  }
  .ao3-blocker-note {
    flex: 1 !important; min-width: 0 !important; word-wrap: break-word !important;
    overflow-wrap: break-word !important; margin-left: 2.5em !important;
    position: relative !important; display: block !important;
  }
  .ao3-blocker-fold .ao3-blocker-note .ao3-blocker-icon {
    position: absolute !important; left: -2.0em !important; top: 50% !important; transform: translateY(-50%) !important; margin-right: 0 !important;
    display: block !important; float: none !important; vertical-align: top !important;
    width: 1.2em !important; height: 1.2em !important;
  }
  .ao3-blocker-toggle span {
    width: 1em !important; height: 1em !important; display: inline-block;
    vertical-align: -0.15em; margin-right: 0.2em; background-color: currentColor;
  }
  .ao3-blocker-eye-toggle {
    display: inline-block; width: 1.2em; height: 1.2em; margin-left: 0.3em; margin-right: 0.3em;
    vertical-align: -0.15em; color: inherit; opacity: 0.75; transition: opacity 0.2s ease;
    border: none; padding: 0; cursor: pointer; background: none;
  }
  .ao3-blocker-eye-toggle:hover { opacity: 1.0; }
  .ao3-blocker-eye-toggle:focus { outline: 2px solid currentColor; outline-offset: 2px; }
  .ao3-blocker-highlight { position: relative !important; }
  .ao3-blocker-highlight::before {
    content: '' !important; position: absolute !important; left: 0 !important;
    top: 0 !important; right: 0 !important; bottom: 0 !important;
    box-shadow: inset 4px 0 0 0 var(--ao3-blocker-highlight-color, #eb6f92) !important;
    pointer-events: none !important; border-radius: inherit !important;
  }
  .reading .ao3-blocker-highlight h4.viewed {
    border-left: 4px solid var(--ao3-blocker-highlight-color, #eb6f92) !important;
  }
  @keyframes ao3-blocker-slideInRight {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes ao3-blocker-slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
  `;

  function createEyeToggle(filterId, initialState) {
    const button = document.createElement("button");
    button.className = "ao3-blocker-eye-toggle";
    button.setAttribute("data-filter-id", filterId);
    button.setAttribute("aria-label", `Toggle hide completely for ${filterId}`);
    button.setAttribute("aria-pressed", initialState ? "true" : "false");
    button.setAttribute("title", "Hide works completely");
    button.innerHTML = `<span style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;background-color:currentColor;mask:url('${
      initialState ? ICON_HIDE : ICON_EYE
    }') no-repeat center/contain;-webkit-mask:url('${
      initialState ? ICON_HIDE : ICON_EYE
    }') no-repeat center/contain;"></span>`;
    button.addEventListener("click", () => {
      const currentPressed = button.getAttribute("aria-pressed") === "true";
      const newPressed = !currentPressed;
      button.setAttribute("aria-pressed", newPressed ? "true" : "false");
      const span = button.querySelector("span");
      span.style.mask = `url('${
        newPressed ? ICON_HIDE : ICON_EYE
      }') no-repeat center/contain`;
      span.style.webkitMask = `url('${
        newPressed ? ICON_HIDE : ICON_EYE
      }') no-repeat center/contain`;
    });
    return button;
  }

  function createInputWithEyeToggle(element, filterId, config) {
    const label = element.querySelector("label");
    if (label) {
      const eyeToggle = createEyeToggle(
        filterId,
        config.hideCompletelyRules[filterId] || false
      );
      // Insert after label text but before tooltip
      const tooltip = label.querySelector(".ao3mh-tooltip");
      if (tooltip) {
        label.insertBefore(eyeToggle, tooltip);
      } else {
        label.appendChild(eyeToggle);
      }
    }
    return element;
  }

  const ICON_HIDE =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cg%20data-name%3D%22Eye%20Hidden%22%20id%3D%22Eye_Hidden%22%3E%3Cpath%20d%3D%22M21.67%2C25.2a1%2C1%2C0%2C0%2C0-.86-.28A4.28%2C4.28%2C0%2C0%2C1%2C20%2C25a5%2C5%2C0%2C0%2C1-5-5%2C4.28%2C4.28%2C0%2C0%2C1%2C.08-.81%2C1%2C1%2C0%2C0%2C0-.28-.86l-3.27-3.26a1%2C1%2C0%2C0%2C0-1.38%2C0%2C22.4%2C22.4%2C0%2C0%2C0-3.82%2C4.43%2C1%2C1%2C0%2C0%2C0%2C0%2C1.08C7.59%2C22.49%2C12.35%2C29%2C20%2C29A13.33%2C13.33%2C0%2C0%2C0%2C23%2C28.67%2C1%2C1%2C0%2C0%2C0%2C23.44%2C27Z%22%2F%3E%3Cpath%20d%3D%22M33.67%2C19.46C32.41%2C17.51%2C27.65%2C11%2C20%2C11a13.58%2C13.58%2C0%2C0%2C0-6.11%2C1.48l-1.18-1.19a1%2C1%2C0%2C0%2C0-1.42%2C1.42l16%2C16a1%2C1%2C0%2C0%2C0%2C1.42%2C0%2C1%2C1%2C0%2C0%2C0%2C0-1.42l-.82-.81a21.53%2C21.53%2C0%2C0%2C0%2C5.78-5.94A1%2C1%2C0%2C0%2C0%2C33.67%2C19.46Zm-9.5%2C3.29-6.92-6.92a5%2C5%2C0%2C0%2C1%2C3.93-.69%2C4.93%2C4.93%2C0%2C0%2C1%2C3.68%2C3.68A5%2C5%2C0%2C0%2C1%2C24.17%2C22.75Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";
  const ICON_EYE =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cg%20data-name%3D%22Eye%20Visible%22%20id%3D%22Eye_Visible%22%3E%3Cpath%20d%3D%22M33.67%2C19.46C32.42%2C17.51%2C27.66%2C11%2C20%2C11S7.58%2C17.51%2C6.33%2C19.46a1%2C1%2C0%2C0%2C0%2C0%2C1.08C7.58%2C22.49%2C12.34%2C29%2C20%2C29s12.42-6.51%2C13.67-8.46A1%2C1%2C0%2C0%2C0%2C33.67%2C19.46ZM20%2C25a5%2C5%2C0%2C1%2C1%2C5-5A5%2C5%2C0%2C0%2C1%2C20%2C25Z%22%2F%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

  function compilePattern(pattern) {
    const hasWildcard = pattern.includes("*");
    if (hasWildcard) {
      const parts = pattern.split("*").map((part) => {
        const normalized = normalizeText(part);
        return normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      });
      const regexPattern = parts.join(".*");
      const normalized = normalizeText(pattern.replace(/\*/g, ""));
      return {
        originalText: pattern,
        text: normalized,
        regex: new RegExp(regexPattern, "i"),
        hasWildcard: true,
      };
    }
    const normalized = normalizeText(pattern);
    return { originalText: pattern, text: normalized, hasWildcard: false };
  }

  function loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...DEFAULTS };
      const parsedConfig = JSON.parse(stored);
      const needsSanitization =
        !parsedConfig._version || parsedConfig._version !== DEFAULTS._version;
      if (needsSanitization) {
        const sanitized = sanitizeConfig({ ...DEFAULTS, ...parsedConfig });
        saveConfig(sanitized);
        return sanitized;
      }
      return { ...DEFAULTS, ...parsedConfig };
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to load config:", e);
      return { ...DEFAULTS };
    }
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to save config:", e);
      return false;
    }
  }

  function isMyContentPage(username) {
    if (!username || !username.trim()) return false;
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const path = window.location.pathname;
    const myContentRegex = new RegExp(
      `^/users/${escapedUsername}(?:/pseuds/[^/]+)?(?:/(?:bookmarks|works|readings))?/?(?:$|[?#])`,
      "i"
    );
    if (myContentRegex.test(path)) return true;
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");
    if (userId && userId.toLowerCase() === username.toLowerCase()) return true;
    // Check for individual bookmark pages
    if (path.match(/^\/bookmarks\/\d+$/)) {
      const userLink = document.querySelector(`a[href="/users/${username}"]`);
      if (userLink) return true;
    }
    return false;
  }

  function parseChaptersStatus(chaptersText) {
    if (!chaptersText) return null;
    const cleaned = chaptersText.replace(/&nbsp;/gi, " ").trim();
    const match = cleaned.match(/^(\d+)\s*\/\s*([\d\?]+)/);
    if (match) {
      let chaptersDenom = match[2].trim();
      if (chaptersDenom === "?") return "ongoing";
      const current = parseInt(match[1].replace(/\D/g, ""), 10);
      const total = parseInt(chaptersDenom.replace(/\D/g, ""), 10);
      if (!isNaN(current) && !isNaN(total)) {
        if (current < total) return "ongoing";
        if (current === total) return "complete";
        return "ongoing";
      }
      return "ongoing";
    }
    return "ongoing";
  }

  function getCategorizedAndFlatTags(container) {
    const tags = {
      ratings: [],
      warnings: [],
      categories: [],
      fandoms: [],
      relationships: [],
      characters: [],
      freeforms: [],
    };
    tags.ratings = selectTextsIn(
      container,
      ".rating.tags a.tag, .rating.tags .text"
    );
    tags.warnings = selectTextsIn(
      container,
      ".warning.tags a.tag, .warning.tags .text"
    );
    tags.categories = selectTextsIn(
      container,
      ".category.tags a.tag, .category.tags .text"
    );
    tags.fandoms = selectTextsIn(container, ".fandom.tags a.tag");
    tags.relationships = selectTextsIn(container, ".relationship.tags a.tag");
    tags.characters = selectTextsIn(container, ".character.tags a.tag");
    tags.freeforms = selectTextsIn(container, ".freeform.tags a.tag");
    const hasAnyTags =
      tags.ratings.length > 0 ||
      tags.warnings.length > 0 ||
      tags.relationships.length > 0;
    if (!hasAnyTags) {
      tags.relationships = selectTextsIn(container, "li.relationships a.tag");
      tags.characters = selectTextsIn(container, "li.characters a.tag");
      tags.freeforms = selectTextsIn(container, "li.freeforms a.tag");
      tags.ratings = selectTextsIn(container, ".rating .text");
      tags.warnings = selectTextsIn(container, ".warnings .text");
      tags.categories = selectTextsIn(container, ".category .text");
      tags.fandoms = selectTextsIn(container, ".fandoms a.tag");
    }
    const flat = [
      ...tags.ratings,
      ...tags.warnings,
      ...tags.categories,
      ...tags.fandoms,
      ...tags.relationships,
      ...tags.characters,
      ...tags.freeforms,
    ];
    return { categorized: tags, flat: flat };
  }

  function normalizeText(text) {
    if (typeof text !== "string") return "";
    return text.toLowerCase();
    // ...existing code...
    return text.toLowerCase();
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getMatchedSubstring(text, pattern) {
    let regex;
    if (typeof pattern === "string") {
      regex = new RegExp(escapeRegex(pattern), "i");
    } else {
      if (pattern.hasWildcard) {
        regex = new RegExp(pattern.regex.source, "i");
      } else {
        regex = new RegExp(escapeRegex(pattern.text), "i");
      }
    }
    const match = text.match(regex);
    return match ? match[0] : null;
  }

  function showQuickAddNotification(message) {
    const existing = document.getElementById(
      "ao3-blocker-quickadd-notification"
    );
    if (existing) existing.remove();
    const testElement = document.createElement("input");
    testElement.type = "text";
    testElement.style.cssText =
      "position: absolute; visibility: hidden; pointer-events: none;";
    document.body.appendChild(testElement);
    const computedStyles = window.getComputedStyle(testElement);
    const pageBg = computedStyles.backgroundColor;
    const pageColor = computedStyles.color;
    const pageBorderRadius = computedStyles.borderRadius || "0.25em";
    testElement.remove();
    const notification = document.createElement("div");
    notification.id = "ao3-blocker-quickadd-notification";
    notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${pageBg}; color: ${pageColor}; padding: 12px 20px; border-radius: ${pageBorderRadius}; font-size: 0.95em; font-weight: 500; z-index: 10001; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: inherit; max-width: 350px; word-wrap: break-word; animation: ao3-blocker-slideInRight 0.3s ease-out; border: 1px solid currentColor; opacity: 0.95;`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = "ao3-blocker-slideOutRight 0.3s ease-in";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  function checkWorks() {
    const config = window.ao3Blocker.config;
    let blocked = 0;
    let total = 0;
    if (config.pauseBlocking) {
      return;
    }
    if (!config) {
      return;
    }
    let isOnMyContent = false;
    let username = config.username || detectUsername(config);
    if (config.disableOnMyContent && username) {
      isOnMyContent = isMyContentPage(username);
      if (isOnMyContent && !config.enableHighlightingOnMyContent) return;
    }
    const blurbs = document.querySelectorAll("li.blurb");
    blurbs.forEach((blurbEl) => {
      const isWorkOrBookmark =
        (blurbEl.classList.contains("work") ||
          blurbEl.classList.contains("bookmark")) &&
        !blurbEl.classList.contains("picture");
      if (!isWorkOrBookmark) return;
      if (
        blurbEl.classList.contains(`${CSS_NAMESPACE}-hidden`) ||
        blurbEl.classList.contains(`${CSS_NAMESPACE}-work`)
      )
        return;
      const blockables = selectFromBlurb(blurbEl);
      const allTags = blockables.tags;
      total++;
      let shouldHighlight = false;
      if (config.tagHighlights.length > 0) {
        for (let i = 0; i < allTags.length; i++) {
          for (let j = 0; j < config.tagHighlights.length; j++) {
            if (matchPattern(allTags[i], config.tagHighlights[j], true)) {
              shouldHighlight = true;
              break;
            }
          }
          if (shouldHighlight) break;
        }
      }
      if (shouldHighlight) {
        blurbEl.classList.add("ao3-blocker-highlight");
      }
      let reason = null;
      if (!isOnMyContent) reason = getBlockReason(blockables, config, blurbEl);
      if (reason) {
        blockWork(blurbEl, reason, config);
        blocked++;
      }
    });
  }

  function handleQuickAdd(event) {
    if (!event.altKey) return;
    const target = event.target;
    const config = loadConfig();
    if (target.classList.contains("tag")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.target.closest("a")) {
        event.target.closest("a").style.pointerEvents = "none";
        setTimeout(() => {
          if (event.target.closest("a"))
            event.target.closest("a").style.pointerEvents = "";
        }, 100);
      }
      const tagText = target.textContent.trim();
      const currentTags = config.tagBlacklist
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const normalizedTag = normalizeText(tagText);
      const alreadyExists = currentTags.some(
        (t) => normalizeText(t) === normalizedTag
      );
      if (alreadyExists) {
        showQuickAddNotification(`"${tagText}" is already blacklisted`);
        return;
      }
      const updatedTags =
        currentTags.length > 0 ? config.tagBlacklist + ", " + tagText : tagText;
      config.tagBlacklist = updatedTags;
      saveConfig(config);
      window.ao3Blocker.config.tagBlacklist = updatedTags
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern);
      checkWorks();
      showQuickAddNotification(`✓ Added "${tagText}" to tag blacklist`);
      return;
    }
    if (target.getAttribute("rel") === "author") {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.target.closest("a")) {
        event.target.closest("a").style.pointerEvents = "none";
        setTimeout(() => {
          if (event.target.closest("a"))
            event.target.closest("a").style.pointerEvents = "";
        }, 100);
      }
      const authorText = target.textContent.trim();
      if (authorText.toLowerCase() === "anonymous") {
        showQuickAddNotification(
          'Cannot blacklist "Anonymous" (would block all anonymous works)'
        );
        return;
      }
      const currentAuthors = config.authorBlacklist
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
      const alreadyExists = currentAuthors.some(
        (a) => a.toLowerCase() === authorText.toLowerCase()
      );
      if (alreadyExists) {
        showQuickAddNotification(`"${authorText}" is already blacklisted`);
        return;
      }
      const updatedAuthors =
        currentAuthors.length > 0
          ? config.authorBlacklist + ", " + authorText
          : authorText;
      config.authorBlacklist = updatedAuthors;
      saveConfig(config);
      window.ao3Blocker.config.authorBlacklist = updatedAuthors
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean);
      checkWorks();
      showQuickAddNotification(`✓ Added "${authorText}" to author blacklist`);
      return;
    }
    if (
      target.tagName === "A" &&
      target.href &&
      target.href.match(/\/works\/\d+/)
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.target.closest("a")) {
        event.target.closest("a").style.pointerEvents = "none";
        setTimeout(() => {
          if (event.target.closest("a"))
            event.target.closest("a").style.pointerEvents = "";
        }, 100);
      }
      const workIdMatch = target.href.match(/\/works\/(\d+)/);
      if (!workIdMatch) return;
      const workId = workIdMatch[1];
      const currentWorks = config.workBlacklist
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
      const alreadyExists = currentWorks.some((w) => w === workId);
      if (alreadyExists) {
        showQuickAddNotification(`"${workId}" is already blacklisted`);
        return;
      }
      const updatedWorks =
        currentWorks.length > 0 ? config.workBlacklist + ", " + workId : workId;
      config.workBlacklist = updatedWorks;
      saveConfig(config);
      window.ao3Blocker.config.workBlacklist = updatedWorks
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean);
      checkWorks();
      showQuickAddNotification(`✓ Added "${workId}" to work blacklist`);
      return;
    }
  }

  function initConfig() {
    const config = loadConfig();
    window.ao3Blocker.config = {
      showReasons: config.showReasons,
      showPlaceholders: config.showPlaceholders ?? true,
      authorBlacklist: config.authorBlacklist
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean),
      titleBlacklist: config.titleBlacklist
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern),
      tagBlacklist: config.tagBlacklist
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern),
      tagWhitelist: config.tagWhitelist
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern),
      tagHighlights: config.tagHighlights
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern),
      summaryBlacklist: config.summaryBlacklist
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean)
        .map(compilePattern),
      workBlacklist: config.workBlacklist
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((i) => i.trim())
        .filter(Boolean),
      highlightColor: config.highlightColor,
      allowedLanguages: config.allowedLanguages
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((s) => s.trim())
        .filter(Boolean),
      maxCrossovers: (() => {
        const val = config.maxCrossovers;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? null
          : parsed;
      })(),
      minWords: (() => {
        const v = config.minWords;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      })(),
      maxWords: (() => {
        const v = config.maxWords;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      })(),
      minChapters: (() => {
        const v = config.minChapters;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      maxChapters: (() => {
        const v = config.maxChapters;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      maxMonthsSinceUpdate: (() => {
        const v = config.maxMonthsSinceUpdate;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      blockComplete: config.blockComplete,
      blockOngoing: config.blockOngoing,
      primaryRelationships: config.primaryRelationships
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => normalizeText(s)),
      primaryCharacters: config.primaryCharacters
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => normalizeText(s)),
      primaryRelpad: (() => {
        const val = config.primaryRelpad;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? 1
          : Math.max(1, parsed);
      })(),
      primaryCharpad: (() => {
        const val = config.primaryCharpad;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? 5
          : Math.max(1, parsed);
      })(),
      disableOnMyContent: !!config.disableOnMyContent,
      enableHighlightingOnMyContent: !!config.enableHighlightingOnMyContent,
      pauseBlocking: !!config.pauseBlocking,
      hideCompletelyRules: config.hideCompletelyRules || {},
      username: config.username || null,
    };
    addStyle();
    document.documentElement.style.setProperty(
      "--ao3-blocker-highlight-color",
      window.ao3Blocker.config.highlightColor || "#eb6f92"
    );
    checkWorks();
    document.addEventListener("click", handleQuickAdd, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initConfig);
  } else {
    initConfig();
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
      menuContainer.innerHTML = `
        <a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a>
        <ul class="menu dropdown-menu"></ul>
      `;
      headerMenu.insertBefore(menuContainer, searchItem);
    }

    const menu = menuContainer.querySelector(".dropdown-menu");
    if (menu) {
      const config = loadConfig();
      const username = config.username || detectUsername(config);
      const isOnMyContent =
        config.disableOnMyContent && username && isMyContentPage(username);

      if (!menu.querySelector("#opencfg_advanced_blocker")) {
        const settingsItem = document.createElement("li");
        settingsItem.innerHTML =
          '<a href="javascript:void(0);" id="opencfg_advanced_blocker">Advanced Blocker</a>';
        settingsItem
          .querySelector("a")
          .addEventListener("click", showBlockerMenu);
        menu.appendChild(settingsItem);
      }

      if (!isOnMyContent && !menu.querySelector("#toggle-blocker-pause")) {
        const pauseItem = document.createElement("li");
        const pauseLink = document.createElement("a");
        pauseLink.href = "javascript:void(0);";
        pauseLink.id = "toggle-blocker-pause";
        if (config.pauseBlocking) {
          pauseLink.innerHTML = `Advanced Blocker: Resume ▶`;
        } else {
          pauseLink.innerHTML = `Advanced Blocker: Pause ⏸`;
        }
        pauseLink.addEventListener("click", function () {
          const currentConfig = loadConfig();
          currentConfig.pauseBlocking = !currentConfig.pauseBlocking;
          saveConfig(currentConfig);
          location.reload();
        });
        pauseItem.appendChild(pauseLink);
        menu.appendChild(pauseItem);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSharedMenu);
  } else {
    initSharedMenu();
  }

  function addStyle() {
    const style = document.createElement("style");
    style.className = CSS_NAMESPACE;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function showBlockerMenu() {
    if (!window.AO3MenuHelpers) {
      alert(
        "AO3 Menu Helpers Library is required for this script to function properly."
      );
      return;
    }
    window.AO3MenuHelpers.removeAllDialogs();
    const config = loadConfig();
    const dialog = window.AO3MenuHelpers.createDialog(
      "🛡️ Advanced Blocker 🛡️",
      { maxWidth: "800px" }
    );

    const tagSection = window.AO3MenuHelpers.createSection("Tag Filtering 📖");
    const tagBlacklist = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "tag-blacklist-input",
        label: "Blacklist Tags",
        value: config.tagBlacklist,
        placeholder:
          "Explicit, Major Character Death, Multi, Abandoned*, Dead Dove: Do Not Eat",
        description:
          "Matches any AO3 tag: ratings, warnings, fandoms, ships, characters, freeforms. * for wildcards.",
      }),
      "tagBlacklist",
      config
    );
    tagSection.appendChild(tagBlacklist);
    const tagWhitelist = window.AO3MenuHelpers.createTextarea({
      id: "tag-whitelist-input",
      label: "Whitelist Tags",
      value: config.tagWhitelist,
      placeholder: "*Happy Ending*, Temporary Character Death, Fluff",
      description:
        "Always shows the work even if it matches the blacklist. * for wildcards.",
    });
    tagSection.appendChild(tagWhitelist);
    const tagHighlightsInput = window.AO3MenuHelpers.createTextarea({
      id: "tag-highlights-input",
      label: "Highlight Tags",
      value: config.tagHighlights,
      placeholder: "*Fix-It*, Enemies to Lovers",
      tooltip: "Make these works stand out. * for wildcards.",
    });
    const highlightColorInput = window.AO3MenuHelpers.createColorPicker({
      id: "highlight-color-input",
      label: "Highlight Color",
      value: config.highlightColor || "#eb6f92",
    });
    const highlightRow = window.AO3MenuHelpers.createTwoColumnLayout(
      tagHighlightsInput,
      highlightColorInput
    );
    tagSection.appendChild(highlightRow);
    dialog.appendChild(tagSection);

    const pairingSection = window.AO3MenuHelpers.createSection(
      "Primary Pairing Filtering 💕"
    );
    const primaryRel = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "primary-relationships-input",
        label: "Primary Relationships",
        value: config.primaryRelationships,
        placeholder:
          "Hua Cheng/Xie Lian (Tian Guan Ci Fu), Kim Dokja/Yoo Joonghyuk",
        tooltip:
          "Only show works where these relationships are in the first few relationship tags.",
      }),
      "primaryRelationships",
      config
    );
    pairingSection.appendChild(primaryRel);
    const primaryChar = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "primary-characters-input",
        label: "Primary Characters",
        value: config.primaryCharacters,
        placeholder: "Hua Cheng (Tian Guan Ci Fu), Kim Dokja",
        tooltip:
          "Only show works where these characters are in the first few character tags.",
      }),
      "primaryCharacters",
      config
    );
    pairingSection.appendChild(primaryChar);
    const relPad = window.AO3MenuHelpers.createNumberInput({
      id: "primary-relpad-input",
      label: "Relationship Tag Window",
      value: config.primaryRelpad || 1,
      min: 1,
      max: 10,
      tooltip: "Check only the first X relationship tags.",
    });
    const charPad = window.AO3MenuHelpers.createNumberInput({
      id: "primary-charpad-input",
      label: "Character Tag Window",
      value: config.primaryCharpad || 5,
      min: 1,
      max: 10,
      tooltip: "Check only the first X character tags.",
    });
    const pairingRow = window.AO3MenuHelpers.createTwoColumnLayout(
      relPad,
      charPad
    );
    pairingSection.appendChild(pairingRow);
    dialog.appendChild(pairingSection);

    const workSection =
      window.AO3MenuHelpers.createSection("Work Filtering 🔍");
    const languages = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextInput({
        id: "allowed-languages-input",
        label: "Allowed Languages",
        value: config.allowedLanguages || "",
        placeholder: "English, Русский, 中文-普通话国语",
        tooltip: "Only show these languages. Leave empty for all.",
      }),
      "language",
      config
    );
    workSection.appendChild(languages);
    const maxFandoms = createInputWithEyeToggle(
      window.AO3MenuHelpers.createNumberInput({
        id: "max-crossovers-input",
        label: "Max Fandoms",
        value: config.maxCrossovers || "",
        min: 1,
        tooltip: "Hide works with more than this many fandoms.",
      }),
      "maxCrossovers",
      config
    );
    const maxMonths = createInputWithEyeToggle(
      window.AO3MenuHelpers.createNumberInput({
        id: "max-months-since-update-input",
        label: "Max Months Since Update",
        value: config.maxMonthsSinceUpdate || "",
        min: 1,
        placeholder: "6",
        tooltip:
          "Hide ongoing works not updated in X months. Only applies to ongoing works.",
      }),
      "maxMonthsSinceUpdate",
      config
    );
    const row1 = window.AO3MenuHelpers.createTwoColumnLayout(
      maxFandoms,
      maxMonths
    );
    workSection.appendChild(row1);
    const minWords = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextInput({
        id: "min-words-input",
        label: "Min Words",
        value: config.minWords || "",
        placeholder: "1000",
        tooltip: "Hide works under this many words.",
      }),
      "minWords",
      config
    );
    const maxWords = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextInput({
        id: "max-words-input",
        label: "Max Words",
        value: config.maxWords || "",
        placeholder: "100000",
        tooltip: "Hide works over this many words.",
      }),
      "maxWords",
      config
    );
    const row2 = window.AO3MenuHelpers.createTwoColumnLayout(
      minWords,
      maxWords
    );
    workSection.appendChild(row2);
    const minChapters = createInputWithEyeToggle(
      window.AO3MenuHelpers.createNumberInput({
        id: "min-chapters-input",
        label: "Min Chapters",
        value: config.minChapters || "",
        min: 1,
        placeholder: "2",
        tooltip: "Hide works with fewer chapters. Set to 2 to skip oneshots.",
      }),
      "minChapters",
      config
    );
    const maxChapters = createInputWithEyeToggle(
      window.AO3MenuHelpers.createNumberInput({
        id: "max-chapters-input",
        label: "Max Chapters",
        value: config.maxChapters || "",
        min: 1,
        placeholder: "200",
        tooltip:
          "Hide works with more chapters. Useful for avoiding epic-length works or drabble collections.",
      }),
      "maxChapters",
      config
    );
    const row3 = window.AO3MenuHelpers.createTwoColumnLayout(
      minChapters,
      maxChapters
    );
    workSection.appendChild(row3);
    const blockOngoing = window.AO3MenuHelpers.createCheckbox({
      id: "block-ongoing-checkbox",
      label: "Block Ongoing Works",
      checked: config.blockOngoing,
      tooltip: "Hide works that are ongoing.",
      inGroup: false,
    });
    const blockComplete = window.AO3MenuHelpers.createCheckbox({
      id: "block-complete-checkbox",
      label: "Block Complete Works",
      checked: config.blockComplete,
      tooltip: "Hide works that are marked as complete.",
      inGroup: false,
    });
    const blockOngoingGroup = createInputWithEyeToggle(
      window.AO3MenuHelpers.createSettingGroup(blockOngoing),
      "blockOngoing",
      config
    );
    const blockCompleteGroup = createInputWithEyeToggle(
      window.AO3MenuHelpers.createSettingGroup(blockComplete),
      "blockComplete",
      config
    );
    const row4 = window.AO3MenuHelpers.createTwoColumnLayout(
      blockOngoingGroup,
      blockCompleteGroup
    );
    workSection.appendChild(row4);
    dialog.appendChild(workSection);

    const authorSection = window.AO3MenuHelpers.createSection(
      "Author & Content Filtering ✏️"
    );
    const titleBlacklist = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "title-blacklist-input",
        label: "Blacklist Titles",
        value: config.titleBlacklist,
        placeholder: "oneshot, prompt, 2025",
        tooltip: "Blocks if the title contains your text.",
      }),
      "titleBlacklist",
      config
    );
    const authorBlacklist = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "author-blacklist-input",
        label: "Blacklist Authors",
        value: config.authorBlacklist,
        placeholder: "DetectiveMittens, BlackBatCat",
        tooltip: "Match the author name exactly.",
      }),
      "authorBlacklist",
      config
    );
    const summaryBlacklist = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "summary-blacklist-input",
        label: "Blacklist Summary",
        value: config.summaryBlacklist,
        placeholder: "oneshot, prompt, 2025",
        tooltip: "Blocks if the summary has these words/phrases.",
      }),
      "summaryBlacklist",
      config
    );
    const workBlacklist = createInputWithEyeToggle(
      window.AO3MenuHelpers.createTextarea({
        id: "work-blacklist-input",
        label: "Blacklist Works",
        value: config.workBlacklist,
        placeholder: "73294031, 12345678",
        tooltip:
          "To get the work ID, `Alt + Click` the title of the work or copy the 8-digit number from the work URL.",
      }),
      "workBlacklist",
      config
    );
    const authorRow1 = window.AO3MenuHelpers.createTwoColumnLayout(
      titleBlacklist,
      authorBlacklist
    );
    authorSection.appendChild(authorRow1);
    const authorRow2 = window.AO3MenuHelpers.createTwoColumnLayout(
      summaryBlacklist,
      workBlacklist
    );
    authorSection.appendChild(authorRow2);
    dialog.appendChild(authorSection);

    const displaySection =
      window.AO3MenuHelpers.createSection("Display Options ⚙️");
    const showReasonsCheckbox = window.AO3MenuHelpers.createCheckbox({
      id: "show-reasons-checkbox",
      label: "Show Block Reason",
      checked: config.showReasons,
      tooltip:
        "Show detailed reasons in placeholders, or just show 'Hidden by filters'.",
      inGroup: false,
    });
    const showPlaceholdersCheckbox =
      window.AO3MenuHelpers.createConditionalCheckbox({
        id: "show-placeholders-checkbox",
        label: "Show Placeholders",
        checked: config.showPlaceholders,
        tooltip:
          "When ON: show placeholders for blocked works (use eye icons below to hide specific filters completely). When OFF: hide ALL blocked works completely.",
        subsettings: showReasonsCheckbox,
      });
    const enableHighlighting = window.AO3MenuHelpers.createCheckbox({
      id: "enable-highlighting-on-my-content-checkbox",
      label: "Enable Highlighting",
      checked: config.enableHighlightingOnMyContent,
      tooltip: "Re-enable tag highlighting on your own pages.",
      inGroup: false,
    });
    const disableOnMyContent = window.AO3MenuHelpers.createConditionalCheckbox({
      id: "disable-on-my-content-checkbox",
      label: "Disable on My Content",
      checked: config.disableOnMyContent,
      tooltip:
        "Don't block or highlight works on your dashboard, bookmarks, history, and works pages. Automatically includes all your pseuds.",
      subsettings: enableHighlighting,
    });
    const displayRow1 = window.AO3MenuHelpers.createTwoColumnLayout(
      showPlaceholdersCheckbox,
      disableOnMyContent
    );
    displaySection.appendChild(displayRow1);

    dialog.appendChild(displaySection);

    const eyeToggleTipContent = document.createElement("span");
    eyeToggleTipContent.innerHTML =
      "<strong>Hide Works:</strong> Click the eye icon next to any filter above to hide matching works completely. ";
    const eyeToggleTipSpan = document.createElement("span");
    eyeToggleTipSpan.style.opacity = "0.8";
    eyeToggleTipSpan.textContent =
      'Works hidden this way won\'t show placeholders even when "Show Placeholders" is enabled.';
    eyeToggleTipContent.appendChild(eyeToggleTipSpan);
    const eyeToggleTipBox = window.AO3MenuHelpers.createInfoBox(
      eyeToggleTipContent,
      { icon: "👁️" }
    );
    eyeToggleTipBox.id = "eye-toggle-info";
    dialog.appendChild(eyeToggleTipBox);

    const tipContent = document.createElement("span");
    tipContent.innerHTML = "<strong> Quick-Add:</strong> Hold ";
    tipContent.appendChild(window.AO3MenuHelpers.createKeyboardKey("Alt"));
    tipContent.appendChild(
      document.createTextNode(
        " and click any tag, author name, or work title to instantly add them to your blacklist."
      )
    );
    const tipBox = window.AO3MenuHelpers.createInfoBox(tipContent);
    dialog.appendChild(tipBox);

    const buttons = window.AO3MenuHelpers.createButtonGroup([
      { text: "Save", id: "blocker-save" },
      { text: "Cancel", id: "blocker-cancel" },
    ]);
    dialog.appendChild(buttons);

    const resetLink = window.AO3MenuHelpers.createResetLink(
      "Reset to Default Settings",
      () => {
        if (
          confirm("Are you sure you want to reset all settings to default?")
        ) {
          const config = loadConfig();
          const username = config.username || null;
          const newDefaults = { ...DEFAULTS, username };
          if (saveConfig(newDefaults)) {
            alert("Settings reset! Reloading...");
            location.reload();
          }
        }
      }
    );
    dialog.appendChild(resetLink);

    const exportBtn = document.createElement("button");
    exportBtn.id = "ao3-export";
    exportBtn.textContent = "Export Settings";
    exportBtn.style.marginRight = "8px";
    const fileInput = window.AO3MenuHelpers.createFileInput({
      id: "ao3-import",
      buttonText: "Import Settings",
      accept: "application/json",
      onChange: (file) => {
        const reader = new FileReader();
        reader.onload = function (evt) {
          try {
            const importedConfig = JSON.parse(evt.target.result);
            if (typeof importedConfig !== "object" || !importedConfig)
              throw new Error("Invalid JSON");
            const validConfig = { ...DEFAULTS };
            Object.keys(validConfig).forEach((key) => {
              if (importedConfig.hasOwnProperty(key))
                validConfig[key] = importedConfig[key];
            });
            if (saveConfig(validConfig)) {
              alert("Settings imported! Reloading...");
              location.reload();
            } else {
              throw new Error("Failed to save imported settings");
            }
          } catch (err) {
            alert("Import failed: " + (err && err.message ? err.message : err));
          }
        };
        reader.readAsText(file);
      },
    });
    const importExportContainer = document.createElement("div");
    importExportContainer.className = "reset-link";
    importExportContainer.style.marginTop = "18px";
    importExportContainer.appendChild(exportBtn);
    importExportContainer.appendChild(fileInput.button);
    importExportContainer.appendChild(fileInput.input);
    dialog.appendChild(importExportContainer);

    exportBtn.addEventListener("click", function () {
      try {
        const config = loadConfig();
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, "0");
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const filename = `ao3_advanced_blocker_config_${dateStr}.json`;
        const blob = new Blob([JSON.stringify(config, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (e) {
        alert("Export failed: " + (e && e.message ? e.message : e));
      }
    });

    dialog.querySelector("#blocker-save").addEventListener("click", () => {
      const updatedConfig = {
        tagBlacklist:
          window.AO3MenuHelpers.getValue("tag-blacklist-input") || "",
        tagWhitelist:
          window.AO3MenuHelpers.getValue("tag-whitelist-input") || "",
        tagHighlights:
          window.AO3MenuHelpers.getValue("tag-highlights-input") || "",
        authorBlacklist:
          window.AO3MenuHelpers.getValue("author-blacklist-input") || "",
        titleBlacklist:
          window.AO3MenuHelpers.getValue("title-blacklist-input") || "",
        summaryBlacklist:
          window.AO3MenuHelpers.getValue("summary-blacklist-input") || "",
        workBlacklist:
          window.AO3MenuHelpers.getValue("work-blacklist-input") || "",
        showReasons: window.AO3MenuHelpers.getValue("show-reasons-checkbox"),
        showPlaceholders: window.AO3MenuHelpers.getValue(
          "show-placeholders-checkbox"
        ),
        highlightColor:
          window.AO3MenuHelpers.getValue("highlight-color-input") ||
          DEFAULTS.highlightColor,
        allowedLanguages:
          window.AO3MenuHelpers.getValue("allowed-languages-input") || "",
        maxCrossovers:
          window.AO3MenuHelpers.getValue("max-crossovers-input") || "",
        minWords: window.AO3MenuHelpers.getValue("min-words-input") || "",
        maxWords: window.AO3MenuHelpers.getValue("max-words-input") || "",
        minChapters: window.AO3MenuHelpers.getValue("min-chapters-input") || "",
        maxChapters: window.AO3MenuHelpers.getValue("max-chapters-input") || "",
        maxMonthsSinceUpdate:
          window.AO3MenuHelpers.getValue("max-months-since-update-input") || "",
        blockComplete: window.AO3MenuHelpers.getValue(
          "block-complete-checkbox"
        ),
        blockOngoing: window.AO3MenuHelpers.getValue("block-ongoing-checkbox"),
        disableOnMyContent: window.AO3MenuHelpers.getValue(
          "disable-on-my-content-checkbox"
        ),
        enableHighlightingOnMyContent: window.AO3MenuHelpers.getValue(
          "enable-highlighting-on-my-content-checkbox"
        ),
        username: config.username || null,
        primaryRelationships:
          window.AO3MenuHelpers.getValue("primary-relationships-input") || "",
        primaryCharacters:
          window.AO3MenuHelpers.getValue("primary-characters-input") || "",
        primaryRelpad:
          window.AO3MenuHelpers.getValue("primary-relpad-input") ||
          DEFAULTS.primaryRelpad,
        primaryCharpad:
          window.AO3MenuHelpers.getValue("primary-charpad-input") ||
          DEFAULTS.primaryCharpad,
        hideCompletelyRules: (() => {
          const rules = {};
          document
            .querySelectorAll(".ao3-blocker-eye-toggle")
            .forEach((toggle) => {
              const filterId = toggle.getAttribute("data-filter-id");
              const pressed = toggle.getAttribute("aria-pressed") === "true";
              rules[filterId] = pressed;
            });
          return rules;
        })(),
        _version: "3.3",
      };
      if (saveConfig(updatedConfig)) {
        location.href =
          location.href + (location.search ? "&" : "?") + "t=" + Date.now();
      } else {
        alert("Error saving settings.");
      }
      dialog.remove();
    });

    dialog.querySelector("#blocker-cancel").addEventListener("click", () => {
      dialog.remove();
    });
    document.body.appendChild(dialog);

    // Function to toggle eye icon visibility
    function updateEyeToggleVisibility() {
      const showPlaceholders = window.AO3MenuHelpers.getValue(
        "show-placeholders-checkbox"
      );
      const eyeToggles = dialog.querySelectorAll(".ao3-blocker-eye-toggle");
      const eyeToggleTip = dialog.querySelector("#eye-toggle-info");

      eyeToggles.forEach((toggle) => {
        toggle.style.display = showPlaceholders ? "inline-block" : "none";
      });

      if (eyeToggleTip) {
        eyeToggleTip.style.display = showPlaceholders ? "block" : "none";
      }
    }

    // Initial state and event listener setup after dialog is in DOM
    updateEyeToggleVisibility();

    // Listen for changes to Show Placeholders checkbox
    const showPlaceholdersElement = dialog.querySelector(
      "#show-placeholders-checkbox"
    );
    if (showPlaceholdersElement) {
      showPlaceholdersElement.addEventListener(
        "change",
        updateEyeToggleVisibility
      );
    }
  }

  function getWordCount(workElement) {
    const wordsElement = workElement.querySelector("dd.words");
    if (!wordsElement) return null;
    let txt = wordsElement.textContent.trim();
    txt = txt.replace(/(?<=\d)[ ,](?=\d{3}(\D|$))/g, "");
    txt = txt.replace(/[^\d]/g, "");
    const n = parseInt(txt, 10);
    return Number.isFinite(n) ? n : null;
  }

  function getCut(workElement) {
    const cut = document.createElement("div");
    cut.className = `${CSS_NAMESPACE}-cut`;
    const children = Array.from(workElement.children);
    children.forEach((child) => {
      if (
        !child.classList.contains(`${CSS_NAMESPACE}-fold`) &&
        !child.classList.contains(`${CSS_NAMESPACE}-cut`)
      ) {
        cut.appendChild(child);
      }
    });
    return cut;
  }

  function getFold(reasons) {
    const fold = document.createElement("div");
    fold.className = `${CSS_NAMESPACE}-fold`;
    const note = document.createElement("span");
    note.className = `${CSS_NAMESPACE}-note`;
    let message = "";
    const config = window.ao3Blocker && window.ao3Blocker.config;
    const showReasons = config && config.showReasons !== false;
    let iconHtml = "";
    if (showReasons && reasons && reasons.length > 0) {
      const parts = [];
      reasons.forEach((reason) => {
        if (reason.completionStatus)
          parts.push(`<em>${reason.completionStatus}</em>`);
        if (reason.wordCount) parts.push(`<em>${reason.wordCount}</em>`);
        if (reason.chapterCount) parts.push(`<em>${reason.chapterCount}</em>`);
        if (reason.staleUpdate) parts.push(`<em>${reason.staleUpdate}</em>`);
        if (reason.tags && reason.tags.length > 0) {
          const categoryTags = new Set([
            "M/M",
            "Gen",
            "Multi",
            "F/F",
            "F/M",
            "Other",
          ]);
          const ratingTags = new Set([
            "Teen And Up Audiences",
            "Explicit",
            "General Audiences",
            "Mature",
            "Not Rated",
          ]);
          const warningTags = new Set([
            "No Archive Warnings Apply",
            "Creator Chose Not To Use Archive Warnings",
            "Graphic Depictions Of Violence",
            "Major Character Death",
            "Rape/Non-Con",
            "Underage Sex",
          ]);
          const categories = reason.tags.filter((tag) => categoryTags.has(tag));
          const ratings = reason.tags.filter((tag) => ratingTags.has(tag));
          const warnings = reason.tags.filter((tag) => warningTags.has(tag));
          const otherTags = reason.tags.filter(
            (tag) =>
              !categoryTags.has(tag) &&
              !ratingTags.has(tag) &&
              !warningTags.has(tag)
          );
          if (categories.length > 0) {
            const label = categories.length === 1 ? "Category:" : "Categories:";
            parts.push(`<em>${label} ${categories.join(", ")}</em>`);
          }
          if (ratings.length > 0) {
            const label = ratings.length === 1 ? "Rating:" : "Ratings:";
            parts.push(`<em>${label} ${ratings.join(", ")}</em>`);
          }
          if (warnings.length > 0) {
            const label = warnings.length === 1 ? "Warning:" : "Warnings:";
            parts.push(`<em>${label} ${warnings.join(", ")}</em>`);
          }
          if (otherTags.length > 0) {
            const label = otherTags.length === 1 ? "Tag:" : "Tags:";
            parts.push(`<em>${label} ${otherTags.join(", ")}</em>`);
          }
        }
        if (reason.authors && reason.authors.length > 0) {
          const label = reason.authors.length === 1 ? "Author:" : "Authors:";
          parts.push(`<em>${label} ${reason.authors.join(", ")}</em>`);
        }
        if (reason.works && reason.works.length > 0) {
          const label = reason.works.length === 1 ? "Work:" : "Works:";
          parts.push(`<em>${label} ${reason.works.join(", ")}</em>`);
        }
        if (reason.titles && reason.titles.length > 0)
          parts.push(`<em>Title: ${reason.titles[0]}</em>`);
        if (reason.summaryTerms && reason.summaryTerms.length > 0)
          parts.push(`<em>Summary: ${reason.summaryTerms[0]}</em>`);
        if (reason.language)
          parts.push(`<em>Language: ${reason.language}</em>`);
        if (reason.crossovers !== undefined)
          parts.push(`<em>Fandoms: ${reason.crossovers}</em>`);
        if (reason.primaryPairing)
          parts.push(`<em>${reason.primaryPairing}</em>`);
      });
      message = parts.join("; ");
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${ICON_HIDE}') no-repeat center/contain;-webkit-mask:url('${ICON_HIDE}') no-repeat center/contain;"></span>`;
    } else if (reasons && reasons.length > 0) {
      message = "<em>Hidden by filters.</em>";
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${ICON_HIDE}') no-repeat center/contain;-webkit-mask:url('${ICON_HIDE}') no-repeat center/contain;"></span>`;
    }
    note.innerHTML = `${iconHtml}${message}`;
    fold.appendChild(note);
    fold.appendChild(getToggleButton());
    return fold;
  }

  function getToggleButton() {
    const showIcon = `<span style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.2em;background-color:currentColor;mask:url('${ICON_EYE}') no-repeat center/contain;-webkit-mask:url('${ICON_EYE}') no-repeat center/contain;"></span>`;
    const hideIcon = `<span style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.2em;background-color:currentColor;mask:url('${ICON_HIDE}') no-repeat center/contain;-webkit-mask:url('${ICON_HIDE}') no-repeat center/contain;"></span>`;
    const button = document.createElement("button");
    button.className = `${CSS_NAMESPACE}-toggle`;
    button.innerHTML = showIcon + "Show";
    const unhideClassFragment = `${CSS_NAMESPACE}-unhide`;
    button.addEventListener("click", (event) => {
      const work = event.target.closest(`.${CSS_NAMESPACE}-work`);
      const note = work.querySelector(`.${CSS_NAMESPACE}-note`);
      let message = note.innerHTML;
      const iconRegex = new RegExp(
        "<span[^>]*class=[\"']" +
          CSS_NAMESPACE +
          "-icon[\"'][^>]*><\\/span>\\s*",
        "i"
      );
      message = message.replace(iconRegex, "");
      if (work.classList.contains(unhideClassFragment)) {
        work.classList.remove(unhideClassFragment);
        note.innerHTML = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${ICON_HIDE}') no-repeat center/contain;-webkit-mask:url('${ICON_HIDE}') no-repeat center/contain;"></span>${message}`;
        event.target.innerHTML = showIcon + "Show";
      } else {
        work.classList.add(unhideClassFragment);
        note.innerHTML = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${ICON_EYE}') no-repeat center/contain;-webkit-mask:url('${ICON_EYE}') no-repeat center/contain;"></span>${message}`;
        event.target.innerHTML = hideIcon + "Hide";
      }
    });
    return button;
  }

  function blockWork(workElement, reasons, config) {
    if (!reasons) return;

    // Master override: if Show Placeholders is off, hide everything
    if (!config.showPlaceholders) {
      workElement.classList.add(`${CSS_NAMESPACE}-hidden`);
      return;
    }

    // Otherwise, check individual eye toggle rules
    const hideCompletely = reasons.some(
      (reason) =>
        config.hideCompletelyRules &&
        config.hideCompletelyRules[reason._filterType]
    );

    if (hideCompletely) {
      workElement.classList.add(`${CSS_NAMESPACE}-hidden`);
    } else {
      // Show placeholder with fold/toggle
      const fold = getFold(reasons);
      const cut = getCut(workElement);
      workElement.classList.add(`${CSS_NAMESPACE}-work`);
      workElement.innerHTML = "";
      workElement.appendChild(fold);
      workElement.appendChild(cut);
      if (!config.showReasons)
        workElement.classList.add(`${CSS_NAMESPACE}-hide-reasons`);
    }
  }

  function matchPattern(text, pattern, exactMatch) {
    const normalizedText = normalizeText(text);
    if (typeof pattern === "string") {
      return exactMatch
        ? normalizedText === pattern
        : normalizedText.includes(pattern);
    }
    if (!pattern.hasWildcard) {
      return exactMatch
        ? normalizedText === pattern.text
        : normalizedText.includes(pattern.text);
    }
    if (exactMatch) {
      const exactRegex = new RegExp("^" + pattern.regex.source + "$", "i");
      return exactRegex.test(normalizedText);
    }
    return pattern.regex.test(normalizedText);
  }

  function isTagWhitelisted(tags, whitelist) {
    return tags.some((tag) => {
      return whitelist.some((pattern) => {
        if (
          (typeof pattern === "string" && !pattern.trim()) ||
          (pattern && pattern.text && !pattern.text.trim())
        )
          return false;
        return matchPattern(tag, pattern, true);
      });
    });
  }

  function checkPrimaryPairing(categorizedTags, config) {
    const primaryRelationships = config.primaryRelationships || [];
    const primaryCharacters = config.primaryCharacters || [];
    const relpad = config.primaryRelpad || 1;
    const charpad = config.primaryCharpad || 5;
    if (primaryRelationships.length === 0 && primaryCharacters.length === 0)
      return null;
    const relationshipTags = categorizedTags.relationships
      .slice(0, relpad)
      .map((tag) => normalizeText(tag));
    const characterTags = categorizedTags.characters
      .slice(0, charpad)
      .map((tag) => normalizeText(tag));
    let missingRelationships = [];
    let missingCharacters = [];
    if (primaryRelationships.length > 0) {
      const hasPrimaryRelationship = primaryRelationships.some((rel) =>
        relationshipTags.includes(rel)
      );
      if (!hasPrimaryRelationship) missingRelationships = primaryRelationships;
    }
    if (primaryCharacters.length > 0) {
      const hasPrimaryCharacter = primaryCharacters.some((char) =>
        characterTags.includes(char)
      );
      if (!hasPrimaryCharacter) missingCharacters = primaryCharacters;
    }
    if (missingRelationships.length > 0 && missingCharacters.length > 0) {
      return { primaryPairing: `Missing relationship(s) and character(s)` };
    } else if (missingRelationships.length > 0) {
      return { primaryPairing: `Missing relationship(s)` };
    } else if (missingCharacters.length > 0) {
      return { primaryPairing: `Missing character(s)` };
    }
    return null;
  }

  function getChapterInfo(workElement) {
    const chaptersElement = workElement.querySelector("dd.chapters");
    if (!chaptersElement) return null;
    const text = chaptersElement.textContent.trim();
    const match = text.match(/^(\d+)\s*\/\s*([\d\?]+)/);
    if (!match) return null;
    const current = parseInt(match[1], 10);
    const totalStr = match[2];
    const total = totalStr === "?" ? null : parseInt(totalStr, 10);
    return {
      current: current,
      total: total,
      isComplete: totalStr !== "?" && current === total,
      isOngoing: totalStr === "?" || current < total,
    };
  }

  function getMonthsSinceUpdate(workElement) {
    const dateElement = workElement.querySelector(
      "dd.updated .datetime, .datetime"
    );
    if (!dateElement) return null;
    const dateText = dateElement.textContent.trim();
    const updated = new Date(dateText);
    if (isNaN(updated.getTime())) return null;
    const now = Date.now();
    const months = (now - updated.getTime()) / (30.4 * 24 * 60 * 60 * 1000);
    return months;
  }

  function getBlockReason(blockables, config, blurbElement) {
    const {
      completionStatus,
      authors,
      title,
      categorizedTags,
      tags,
      summary,
      language,
      fandomCount,
      wordCount,
      workId,
    } = blockables;
    const {
      authorBlacklist,
      titleBlacklist,
      tagBlacklist,
      tagWhitelist,
      summaryBlacklist,
      workBlacklist,
      allowedLanguages,
      maxCrossovers,
      minWords,
      maxWords,
      blockComplete,
      blockOngoing,
    } = config;
    const allTags = tags;
    if (isTagWhitelisted(allTags, tagWhitelist)) return null;
    const reasons = [];
    const primaryPairingReason = checkPrimaryPairing(categorizedTags, config);
    if (primaryPairingReason)
      reasons.push({
        ...primaryPairingReason,
        _filterType: "primaryRelationships",
      }); // or primaryCharacters, but since it's combined, maybe choose one
    if (blockComplete && completionStatus === "complete")
      reasons.push({
        completionStatus: "Status: Complete",
        _filterType: "blockComplete",
      });
    if (blockOngoing && completionStatus === "ongoing")
      reasons.push({
        completionStatus: "Status: Ongoing",
        _filterType: "blockOngoing",
      });
    if (allowedLanguages.length > 0) {
      const lang = (language || "").toLowerCase().trim();
      if (lang && lang !== "unknown") {
        const allowed = allowedLanguages.includes(lang);
        if (!allowed)
          reasons.push({
            language: language || "unknown",
            _filterType: "language",
          });
      }
    }
    if (
      typeof maxCrossovers === "number" &&
      maxCrossovers > 0 &&
      fandomCount > maxCrossovers
    ) {
      reasons.push({ crossovers: fandomCount, _filterType: "maxCrossovers" });
    }
    if (minWords != null || maxWords != null) {
      const wc = wordCount;
      const wcHit = (() => {
        if (wc == null) return null;
        if (minWords != null && wc < minWords)
          return { over: false, limit: minWords };
        if (maxWords != null && wc > maxWords)
          return { over: true, limit: maxWords };
        return null;
      })();
      if (wcHit) {
        const wcStr = wc?.toLocaleString?.() ?? wc;
        const filterType = wcHit.over ? "maxWords" : "minWords";
        reasons.push({ wordCount: `Words: ${wcStr}`, _filterType: filterType });
      }
    }
    if (config.minChapters != null || config.maxChapters != null) {
      const chapterInfo = getChapterInfo(blurbElement);
      if (chapterInfo && chapterInfo.current != null) {
        const chapters = chapterInfo.current;
        let blocked = false;
        if (config.minChapters != null && chapters < config.minChapters)
          blocked = true;
        if (config.maxChapters != null && chapters > config.maxChapters)
          blocked = true;
        if (blocked)
          reasons.push({
            chapterCount: `Chapters: ${chapters}`,
            _filterType:
              config.minChapters != null && chapters < config.minChapters
                ? "minChapters"
                : "maxChapters",
          });
      }
    }
    if (config.maxMonthsSinceUpdate != null && completionStatus === "ongoing") {
      const monthsSinceUpdate = getMonthsSinceUpdate(blurbElement);
      if (
        monthsSinceUpdate != null &&
        monthsSinceUpdate > config.maxMonthsSinceUpdate
      ) {
        const monthsDisplay = Math.floor(monthsSinceUpdate);
        reasons.push({
          staleUpdate: `Updated ${monthsDisplay} month${
            monthsDisplay !== 1 ? "s" : ""
          } ago`,
          _filterType: "maxMonthsSinceUpdate",
        });
      }
    }
    const blockedTags = [];
    allTags.forEach((tag) => {
      tagBlacklist.forEach((pattern) => {
        if (
          (typeof pattern === "string" && pattern.trim()) ||
          (pattern && pattern.text && pattern.text.trim())
        ) {
          if (matchPattern(tag, pattern, true)) blockedTags.push(tag);
        }
      });
    });
    if (blockedTags.length > 0)
      reasons.push({ tags: blockedTags, _filterType: "tagBlacklist" });
    const blockedAuthors = [];
    authors.forEach((author) => {
      authorBlacklist.forEach((blacklistedAuthor) => {
        if (
          blacklistedAuthor.trim() &&
          author.toLowerCase() === blacklistedAuthor
        ) {
          blockedAuthors.push(author);
        }
      });
    });
    if (blockedAuthors.length > 0)
      reasons.push({ authors: blockedAuthors, _filterType: "authorBlacklist" });
    const blockedWorks = [];
    if (workId) {
      workBlacklist.forEach((blacklistedWork) => {
        if (blacklistedWork.trim() && workId === blacklistedWork) {
          blockedWorks.push(workId);
        }
      });
    }
    if (blockedWorks.length > 0)
      reasons.push({ works: blockedWorks, _filterType: "workBlacklist" });
    const blockedTitles = new Set();
    titleBlacklist.forEach((pattern) => {
      if (
        (typeof pattern === "string" && pattern.trim()) ||
        (pattern && pattern.text && pattern.text.trim())
      ) {
        if (matchPattern(title, pattern, false)) {
          const matched = getMatchedSubstring(title, pattern);
          if (matched) blockedTitles.add(matched);
        }
      }
    });
    if (blockedTitles.size > 0)
      reasons.push({
        titles: Array.from(blockedTitles),
        _filterType: "titleBlacklist",
      });
    const blockedSummaryTerms = [];
    summaryBlacklist.forEach((pattern) => {
      if (
        (typeof pattern === "string" && pattern.trim()) ||
        (pattern && pattern.text && pattern.text.trim())
      ) {
        if (matchPattern(summary, pattern, false)) {
          const matched = getMatchedSubstring(summary, pattern);
          if (matched) blockedSummaryTerms.push(matched);
        }
      }
    });
    if (blockedSummaryTerms.length > 0)
      reasons.push({
        summaryTerms: blockedSummaryTerms,
        _filterType: "summaryBlacklist",
      });
    return reasons.length > 0 ? reasons : null;
  }

  function getText(element) {
    return (element.textContent || element.innerText || "").trim();
  }

  function selectTextsIn(root, selector) {
    const elements = root.querySelectorAll(selector);
    return Array.from(elements).map(getText);
  }

  function selectFromBlurb(blurbElement) {
    const fandoms = blurbElement.querySelectorAll("h5.fandoms.heading a.tag");
    let completionStatus = null;
    const chaptersNode = blurbElement.querySelector("dd.chapters");
    if (chaptersNode) {
      let chaptersText = "";
      const a = chaptersNode.querySelector("a");
      if (a) {
        chaptersText = a.textContent.trim();
        let raw = chaptersNode.innerHTML;
        raw = raw.replace(/<a[^>]*>.*?<\/a>/, "");
        raw = raw.replace(/&nbsp;/gi, " ");
        const match = raw.match(/\/\s*([\d\?]+)/);
        if (match) chaptersText += "/" + match[1].trim();
      } else {
        chaptersText = chaptersNode.textContent.replace(/&nbsp;/gi, " ").trim();
      }
      completionStatus = parseChaptersStatus(chaptersText);
    }
    const tagData = getCategorizedAndFlatTags(blurbElement);
    const titleLink = blurbElement.querySelector(
      ".header .heading a:first-child"
    );
    const workId = titleLink
      ? titleLink.href.match(/\/works\/(\d+)/)?.[1]
      : null;
    return {
      authors: selectTextsIn(blurbElement, "a[rel=author]"),
      categorizedTags: tagData.categorized,
      tags: tagData.flat,
      title: selectTextsIn(blurbElement, ".header .heading a:first-child")[0],
      summary: selectTextsIn(blurbElement, "blockquote.summary")[0],
      language: selectTextsIn(blurbElement, "dd.language")[0],
      fandomCount: fandoms.length,
      wordCount: getWordCount(blurbElement),
      completionStatus: completionStatus,
      workId: workId,
    };
  }
})();
