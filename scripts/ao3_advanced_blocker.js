// ==UserScript==
// @name          AO3: Advanced Blocker
// @description   [In Development] Block works based off of tags, authors, word counts, languages, completion status and more. Now with primary pairing filtering!
// @author        BlackBatCat
// @version       2.9
// @license       MIT
// @match         *://archiveofourown.org/tags/*/works*
// @match         *://archiveofourown.org/works
// @match         *://archiveofourown.org/works?*
// @match         *://archiveofourown.org/works/search*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @run-at        document-end
// ==/UserScript==

// CRITICAL: Update every version number Ctrl+H

(function () {
  "use strict";

  // Username detection
  let cachedUsername = null;
  function detectUsername(config) {
    if (cachedUsername) return cachedUsername;
    if (config.username) {
      cachedUsername = config.username;
      return config.username;
    }
    // Try user menu first
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
    // Fallback: try to parse from URL
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
  // Startup message
  try {
    console.log("[AO3: Advanced Blocker] loaded.");
  } catch (e) {}

  // CSS namespace for all classes
  const CSS_NAMESPACE = "ao3-blocker";

  // Default configuration values and option definitions
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
    showReasons: true,
    showPlaceholders: true,
    debugMode: false,
    allowedLanguages: "",
    maxCrossovers: "3",
    disableOnMyContent: true,
    enableHighlightingOnMyContent: false,
    username: null,
    primaryRelationships: "",
    primaryCharacters: "",
    primaryRelpad: "1",
    primaryCharpad: "5",
    pauseBlocking: false,
    _version: "2.9",
  };

  // Storage key for single config object
  const STORAGE_KEY = "ao3_advanced_blocker_config";

  // Sanitize and validate config to prevent corruption
  function sanitizeConfig(config) {
    const sanitized = {};

    // String fields - ensure they're strings
    const stringFields = [
      "tagBlacklist",
      "tagWhitelist",
      "tagHighlights",
      "authorBlacklist",
      "titleBlacklist",
      "summaryBlacklist",
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

    // Boolean fields - ensure they're booleans
    const boolFields = [
      "blockComplete",
      "blockOngoing",
      "showReasons",
      "showPlaceholders",
      "debugMode",
      "disableOnMyContent",
      "enableHighlightingOnMyContent",
      "pauseBlocking",
    ];

    boolFields.forEach((field) => {
      sanitized[field] =
        typeof config[field] === "boolean" ? config[field] : DEFAULTS[field];
    });

    // Add version
    sanitized._version = "2.9";

    return sanitized;
  }

  // Custom styles for the script
  const STYLE = `
  html body .ao3-blocker-hidden {
    display: none;
  }

  .ao3-blocker-cut {
    display: none;
  }

  .ao3-blocker-cut::after {
    clear: both;
    content: '';
    display: block;
  }

  .ao3-blocker-reason {
    margin-left: 5px;
  }

  .ao3-blocker-hide-reasons .ao3-blocker-reason {
    display: none;
  }

  .ao3-blocker-unhide .ao3-blocker-cut {
    display: block;
  }

  .ao3-blocker-fold {
    align-items: center;
    display: flex;
    justify-content: space-between !important;
    gap: 10px !important;
    width: 100% !important;
  }

  .ao3-blocker-unhide .ao3-blocker-fold {
      border-bottom: 1px dashed;
      border-bottom-color: inherit;
      margin-bottom: 15px;
      padding-bottom: 5px;
  }

  button.ao3-blocker-toggle {
    margin-left: auto;
    min-width: inherit;
    min-height: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.2em;
    min-width: 80px !important;
    margin-left: 10px !important;
    flex-shrink: 0 !important;
    white-space: nowrap !important;
    padding: 4px 8px !important;
  }

  .ao3-blocker-note {
    flex: 1 !important;
    min-width: 0 !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    /* Create space for the icon on the left */
    margin-left: 2em !important;
    position: relative !important;
    display: block !important;
  }

  .ao3-blocker-fold .ao3-blocker-note .ao3-blocker-icon {
    position: absolute !important;
    left: -1.5em !important;
    margin-right: 0 !important;
    display: block !important;
    float: none !important;
    vertical-align: top !important;
    width: 1.2em !important;
    height: 1.2em !important;
  }

  .ao3-blocker-toggle span {
    width: 1em !important;
    height: 1em !important;
    display: inline-block;
    vertical-align: -0.15em;
    margin-right: 0.2em;
    background-color: currentColor;
  }

  /* Settings menu styles */
  .ao3-blocker-menu-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0,0,0,0.2);
    z-index: 10000;
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    box-sizing: border-box;
  }

  .ao3-blocker-menu-dialog .settings-section {
    background: rgba(0,0,0,0.03);
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 20px;
    border-left: 4px solid currentColor;
  }

  .ao3-blocker-menu-dialog .section-title {
    margin-top: 0;
    margin-bottom: 15px;
    font-size: 1.2em;
    font-weight: bold;
    font-family: inherit;
    color: inherit;
    opacity: 0.85;
  }

  .ao3-blocker-menu-dialog .setting-group {
    margin-bottom: 15px;
  }

  .ao3-blocker-menu-dialog .setting-label {
    display: block;
    margin-bottom: 6px;
    font-weight: bold;
    color: inherit;
    opacity: 0.9;
  }

  .ao3-blocker-menu-dialog .setting-description {
    display: block;
    margin-bottom: 8px;
    font-size: 0.9em;
    color: inherit;
    opacity: 0.6;
    line-height: 1.4;
  }

  .ao3-blocker-menu-dialog .two-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .ao3-blocker-menu-dialog .button-group {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 20px;
  }

  .ao3-blocker-menu-dialog .button-group button {
    flex: 1;
    padding: 10px;
    color: inherit;
    opacity: 0.9;
  }

  .ao3-blocker-menu-dialog .reset-link {
    text-align: center;
    margin-top: 10px;
    color: inherit;
    opacity: 0.7;
  }

  .ao3-blocker-menu-dialog textarea {
    width: 100%;
    min-height: 100px;
    resize: vertical;
    box-sizing: border-box;
  }

  /* Highlighted works (left border using pseudo-element) */
  .ao3-blocker-highlight {
    position: relative !important;
  }

  .ao3-blocker-highlight::before {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    box-shadow: inset 4px 0 0 0 var(--ao3-blocker-highlight-color, #eb6f92) !important;
    pointer-events: none !important;
    border-radius: inherit !important;
  }
  /* Tooltip icon style for settings menu (scoped) */
  .ao3-blocker-menu-dialog .symbol.question {
    font-size: 0.5em;
    vertical-align: middle;
  }
  /* Lighter placeholder text for menu input fields */
  .ao3-blocker-menu-dialog input::placeholder,
  .ao3-blocker-menu-dialog textarea::placeholder {
    opacity: 0.6 !important;
  }

  /* Form elements use page background color when focused */
  .ao3-blocker-menu-dialog input[type="text"],
  .ao3-blocker-menu-dialog input[type="number"],
  .ao3-blocker-menu-dialog input[type="color"],
  .ao3-blocker-menu-dialog select,
  .ao3-blocker-menu-dialog textarea {
    width: 100%;
    box-sizing: border-box;
  }

  /* Add visual separation between full-width row and two-column rows */
  .ao3-blocker-menu-dialog .setting-group + .two-column {
    margin-top: 15px;
  }

  /* Quick-add notification animations */
  @keyframes ao3-blocker-slideInRight {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes ao3-blocker-slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;

  // Icon data URIs
  const ICON_HIDE =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cg%20data-name%3D%22Eye%20Hidden%22%20id%3D%22Eye_Hidden%22%3E%3Cpath%20d%3D%22M21.67%2C25.2a1%2C1%2C0%2C0%2C0-.86-.28A4.28%2C4.28%2C0%2C0%2C1%2C20%2C25a5%2C5%2C0%2C0%2C1-5-5%2C4.28%2C4.28%2C0%2C0%2C1%2C.08-.81%2C1%2C1%2C0%2C0%2C0-.28-.86l-3.27-3.26a1%2C1%2C0%2C0%2C0-1.38%2C0%2C22.4%2C22.4%2C0%2C0%2C0-3.82%2C4.43%2C1%2C1%2C0%2C0%2C0%2C0%2C1.08C7.59%2C22.49%2C12.35%2C29%2C20%2C29A13.33%2C13.33%2C0%2C0%2C0%2C23%2C28.67%2C1%2C1%2C0%2C0%2C0%2C23.44%2C27Z%22%2F%3E%3Cpath%20d%3D%22M33.67%2C19.46C32.41%2C17.51%2C27.65%2C11%2C20%2C11a13.58%2C13.58%2C0%2C0%2C0-6.11%2C1.48l-1.18-1.19a1%2C1%2C0%2C0%2C0-1.42%2C1.42l16%2C16a1%2C1%2C0%2C0%2C0%2C1.42%2C0%2C1%2C1%2C0%2C0%2C0%2C0-1.42l-.82-.81a21.53%2C21.53%2C0%2C0%2C0%2C5.78-5.94A1%2C1%2C0%2C0%2C0%2C33.67%2C19.46Zm-9.5%2C3.29-6.92-6.92a5%2C5%2C0%2C0%2C1%2C3.93-.69%2C4.93%2C4.93%2C0%2C0%2C1%2C3.68%2C3.68A5%2C5%2C0%2C0%2C1%2C24.17%2C22.75Z%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

  const ICON_EYE =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2040%2040%22%3E%3Cg%20data-name%3D%22Eye%20Visible%22%20id%3D%22Eye_Visible%22%3E%3Cpath%20d%3D%22M33.67%2C19.46C32.42%2C17.51%2C27.66%2C11%2C20%2C11S7.58%2C17.51%2C6.33%2C19.46a1%2C1%2C0%2C0%2C0%2C0%2C1.08C7.58%2C22.49%2C12.34%2C29%2C20%2C29s12.42-6.51%2C13.67-8.46A1%2C1%2C0%2C0%2C0%2C33.67%2C19.46ZM20%2C25a5%2C5%2C0%2C1%2C1%2C5-5A5%2C5%2C0%2C0%2C1%2C20%2C25Z%22%2F%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E";

  // Load configuration from single object storage
  function loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        // No stored config, return defaults
        return { ...DEFAULTS };
      }

      const parsedConfig = JSON.parse(stored);

      // Check if config needs sanitization (missing version or old version)
      const needsSanitization =
        !parsedConfig._version || parsedConfig._version !== "2.9";

      if (needsSanitization) {
        console.log("[AO3 Advanced Blocker] Updating config to v2.9");
        const sanitized = sanitizeConfig({ ...DEFAULTS, ...parsedConfig });
        saveConfig(sanitized);
        return sanitized;
      }

      // Config is already v2.9, merge with defaults for any new fields
      return { ...DEFAULTS, ...parsedConfig };
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to load config:", e);
      console.warn("[AO3 Advanced Blocker] Using default config");
      // If parsing fails, return defaults
      return { ...DEFAULTS };
    }
  }

  // Save configuration to single object storage
  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return true;
    } catch (e) {
      console.error("[AO3 Advanced Blocker] Failed to save config:", e);
      return false;
    }
  }

  // Robust detection for "my content" pages (dashboard, bookmarks, works, readings/history)
  function isMyContentPage(username) {
    if (!username || !username.trim()) return false;
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const path = window.location.pathname;
    // Consolidated regex: dashboard, bookmarks, works, readings (history)
    const myContentRegex = new RegExp(
      `^/users/${escapedUsername}(?:/pseuds/[^/]+)?(?:/(?:bookmarks|works|readings))?/?(?:$|[?#])`,
      "i"
    );
    if (myContentRegex.test(path)) return true;
    // Also check for user_id in query string (case-insensitive)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");
    if (userId && userId.toLowerCase() === username.toLowerCase()) return true;
    return false;
  }

  // Parse chapter status from text content
  function parseChaptersStatus(chaptersText) {
    if (!chaptersText) return null;

    // Clean the text and look for the pattern
    const cleaned = chaptersText.replace(/&nbsp;/gi, " ").trim();

    // Pattern for "current / total" or "current / ?"
    const match = cleaned.match(/^(\d+)\s*\/\s*([\d\?]+)/);
    if (match) {
      let chaptersNum = match[1].trim();
      let chaptersDenom = match[2].trim();

      if (chaptersDenom === "?") {
        return "ongoing";
      } else {
        const current = parseInt(chaptersNum.replace(/\D/g, ""), 10);
        const total = parseInt(chaptersDenom.replace(/\D/g, ""), 10);
        if (!isNaN(current) && !isNaN(total)) {
          if (current < total) {
            return "ongoing";
          } else if (current === total) {
            return "complete";
          } else if (current > total) {
            return "ongoing";
          }
        } else {
          return "ongoing";
        }
      }
    }

    // If no match found, assume ongoing
    return "ongoing";
  }

  // Extract tags by category using CSS class selectors
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

    // Work page structure - ALWAYS try these first
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

    // Only use blurb structure as fallback if NO tags found at all
    const hasAnyTags =
      tags.ratings.length > 0 ||
      tags.warnings.length > 0 ||
      tags.relationships.length > 0;
    if (!hasAnyTags) {
      tags.relationships = selectTextsIn(container, "li.relationships a.tag");
      tags.characters = selectTextsIn(container, "li.characters a.tag");
      tags.freeforms = selectTextsIn(container, "li.freeforms a.tag");

      // Required tags in blurbs
      tags.ratings = selectTextsIn(container, ".rating .text");
      tags.warnings = selectTextsIn(container, ".warnings .text");
      tags.categories = selectTextsIn(container, ".category .text");
      tags.fandoms = selectTextsIn(container, ".fandoms a.tag");
    }

    // Flatten in the same pass (no extra loop needed)
    const flat = [
      ...tags.ratings,
      ...tags.warnings,
      ...tags.categories,
      ...tags.fandoms,
      ...tags.relationships,
      ...tags.characters,
      ...tags.freeforms,
    ];

    return {
      categorized: tags,
      flat: flat
    };
  }

  // Normalize text by removing punctuation and standardizing whitespace
  function normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
      .replace(/\s+/g, " ") // Normalize multiple spaces
      .trim();
  }

  // Escape special regex characters
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Get the matched substring from text using the pattern
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

  // Show temporary notification for quick-add actions with inherited styling
  function showQuickAddNotification(message, type = "success") {
    // Remove any existing notification
    const existing = document.getElementById(
      "ao3-blocker-quickadd-notification"
    );
    if (existing) existing.remove();

    // Create temporary element to detect page styles
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

    // Create notification
    const notification = document.createElement("div");
    notification.id = "ao3-blocker-quickadd-notification";

    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${pageBg};
      color: ${pageColor};
      padding: 12px 20px;
      border-radius: ${pageBorderRadius};
      font-size: 0.95em;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: inherit;
      max-width: 350px;
      word-wrap: break-word;
      animation: ao3-blocker-slideInRight 0.3s ease-out;
      border: 1px solid currentColor;
      opacity: 0.95;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto-remove after delay
    setTimeout(() => {
      notification.style.animation = "ao3-blocker-slideOutRight 0.3s ease-in";
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Handle Alt+Click quick-add for tags and authors
  function handleQuickAdd(event) {
    // Only proceed if Alt key is held
    if (!event.altKey) return;

    const target = event.target;
    const config = loadConfig();

    // Check if clicking on a tag
    if (target.classList.contains("tag")) {
      // More aggressive event prevention for tags
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Also prevent any default actions on parent elements
      if (event.target.closest("a")) {
        event.target.closest("a").style.pointerEvents = "none";
        setTimeout(() => {
          if (event.target.closest("a")) {
            event.target.closest("a").style.pointerEvents = "";
          }
        }, 100);
      }

      const tagText = target.textContent.trim();

      // Check if already in blacklist
      const currentTags = config.tagBlacklist
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const normalizedTag = normalizeText(tagText);
      const alreadyExists = currentTags.some(
        (t) => normalizeText(t) === normalizedTag
      );

      if (alreadyExists) {
        showQuickAddNotification(`"${tagText}" is already blacklisted`, "info");
        return;
      }

      // Add to blacklist
      const updatedTags =
        currentTags.length > 0 ? config.tagBlacklist + ", " + tagText : tagText;

      config.tagBlacklist = updatedTags;
      saveConfig(config);

      showQuickAddNotification(
        `✓ Added "${tagText}" to tag blacklist`,
        "success"
      );

      // Batch additions: collect for 3 seconds before reloading
      if (!window.ao3BlockerQuickAddQueue) {
        window.ao3BlockerQuickAddQueue = [];
      }
      window.ao3BlockerQuickAddQueue.push({ type: "tag", value: tagText });

      // Debounce reloads - wait for more additions or reload after delay
      if (window.ao3BlockerQuickAddTimeout) {
        clearTimeout(window.ao3BlockerQuickAddTimeout);
      }

      window.ao3BlockerQuickAddTimeout = setTimeout(() => {
        const queueLength = window.ao3BlockerQuickAddQueue?.length || 0;
        if (queueLength > 0) {
          showQuickAddNotification(
            `✓ Added ${queueLength} item(s) to blacklist`,
            "success"
          );
          window.ao3BlockerQuickAddQueue = [];
          location.reload();
        }
      }, 3000); // Wait 3 seconds for batching

      return;
    }

    // Check if clicking on an author
    if (target.getAttribute("rel") === "author") {
      // More aggressive event prevention for authors
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Also prevent any default actions on parent elements
      if (event.target.closest("a")) {
        event.target.closest("a").style.pointerEvents = "none";
        setTimeout(() => {
          if (event.target.closest("a")) {
            event.target.closest("a").style.pointerEvents = "";
          }
        }, 100);
      }

      const authorText = target.textContent.trim();

      // Don't allow blacklisting Anonymous (would block all anonymous works)
      if (authorText.toLowerCase() === "anonymous") {
        showQuickAddNotification(
          'Cannot blacklist "Anonymous" (would block all anonymous works)',
          "info"
        );
        return;
      }

      // Check if already in blacklist
      const currentAuthors = config.authorBlacklist
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const alreadyExists = currentAuthors.some(
        (a) => a.toLowerCase() === authorText.toLowerCase()
      );

      if (alreadyExists) {
        showQuickAddNotification(
          `"${authorText}" is already blacklisted`,
          "info"
        );
        return;
      }

      // Add to blacklist
      const updatedAuthors =
        currentAuthors.length > 0
          ? config.authorBlacklist + ", " + authorText
          : authorText;

      config.authorBlacklist = updatedAuthors;
      saveConfig(config);

      showQuickAddNotification(
        `✓ Added "${authorText}" to author blacklist`,
        "success"
      );

      // Batch additions: collect for 2 seconds before reloading
      if (!window.ao3BlockerQuickAddQueue) {
        window.ao3BlockerQuickAddQueue = [];
      }
      window.ao3BlockerQuickAddQueue.push({
        type: "author",
        value: authorText,
      });

      // Debounce reloads - wait for more additions or reload after delay
      if (window.ao3BlockerQuickAddTimeout) {
        clearTimeout(window.ao3BlockerQuickAddTimeout);
      }

      window.ao3BlockerQuickAddTimeout = setTimeout(() => {
        const queueLength = window.ao3BlockerQuickAddQueue?.length || 0;
        if (queueLength > 0) {
          showQuickAddNotification(
            `✓ Added ${queueLength} item(s) to blacklist`,
            "success"
          );
          window.ao3BlockerQuickAddQueue = [];
          location.reload();
        }
      }, 5000); // Wait 5 seconds for batching

      return;
    }
  }

  // Initialize configuration processing directly
  function initConfig() {
    // Config is now available
    const config = loadConfig();

    // Process configuration for runtime use with simple regex pre-compilation
    const compilePattern = (pattern) => {
      // Check for wildcards BEFORE normalization (since * gets removed by normalizeText)
      const hasWildcard = pattern.includes("*");

      if (hasWildcard) {
        // Split on *, normalize each part, then reconstruct regex
        const parts = pattern.split("*").map((part) => {
          const normalized = normalizeText(part);
          // Escape regex special characters in the normalized part
          return normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        });
        // Join parts with .* for wildcard matching
        const regexPattern = parts.join(".*");
        // Store original pattern for display and normalized for matching
        const normalized = normalizeText(pattern.replace(/\*/g, ""));
        return {
          originalText: pattern,
          text: normalized,
          regex: new RegExp(regexPattern, "i"),
          hasWildcard: true,
        };
      }

      // No wildcard - store both original and normalized
      const normalized = normalizeText(pattern);
      return { originalText: pattern, text: normalized, hasWildcard: false };
    };

    window.ao3Blocker.config = {
      showReasons: config.showReasons,
      showPlaceholders: config.showPlaceholders,
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

      highlightColor: config.highlightColor,
      debugMode: config.debugMode,
      allowedLanguages: config.allowedLanguages
        .toLowerCase()
        .split(/,(?:\s)?/g)
        .map((s) => s.trim())
        .filter(Boolean),
      maxCrossovers: (function () {
        const val = config.maxCrossovers;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? null
          : parsed;
      })(),
      minWords: (function () {
        const v = config.minWords;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      })(),
      maxWords: (function () {
        const v = config.maxWords;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      })(),
      minChapters: (function () {
        const v = config.minChapters;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      maxChapters: (function () {
        const v = config.maxChapters;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      maxMonthsSinceUpdate: (function () {
        const v = config.maxMonthsSinceUpdate;
        const n = parseInt((v || "").toString().replace(/[,_\s]/g, ""), 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      blockComplete: config.blockComplete,
      blockOngoing: config.blockOngoing,
      // Primary Pairing Config - normalize for case/punctuation insensitive matching
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
      primaryRelpad: (function () {
        const val = config.primaryRelpad;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? 1
          : Math.max(1, parsed);
      })(),
      primaryCharpad: (function () {
        const val = config.primaryCharpad;
        const parsed = parseInt(val, 10);
        return val === undefined || val === null || val === "" || isNaN(parsed)
          ? 5
          : Math.max(1, parsed);
      })(),
      disableOnMyContent: !!config.disableOnMyContent,
      enableHighlightingOnMyContent: !!config.enableHighlightingOnMyContent,
      pauseBlocking: !!config.pauseBlocking,
      username: config.username || null,
    };

    addStyle();
    // Set the highlight color CSS variable globally
    document.documentElement.style.setProperty(
      "--ao3-blocker-highlight-color",
      window.ao3Blocker.config.highlightColor || "#eb6f92"
    );
    checkWorks();

    // Set up Alt+Click quick-add for tags and authors
    document.addEventListener("click", handleQuickAdd, true); // Use capture phase
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initConfig);
  } else {
    initConfig();
  }

  // --- SHARED INITIALIZATION ---
  function initBlockerMenu() {
    const menuContainer = document.getElementById("scriptconfig");
    if (!menuContainer) {
      const headerMenu = document.querySelector(
        "ul.primary.navigation.actions"
      );
      const searchItem = headerMenu
        ? headerMenu.querySelector("li.search")
        : null;
      if (!headerMenu || !searchItem) return;

      // Create menu container
      const newMenuContainer = document.createElement("li");
      newMenuContainer.className = "dropdown";
      newMenuContainer.id = "scriptconfig";

      const title = document.createElement("a");
      title.className = "dropdown-toggle";
      title.href = "/";
      title.setAttribute("data-toggle", "dropdown");
      title.setAttribute("data-target", "#");
      title.textContent = "Userscripts";
      newMenuContainer.appendChild(title);

      const menu = document.createElement("ul");
      menu.className = "menu dropdown-menu";
      newMenuContainer.appendChild(menu);

      // Insert before search item
      headerMenu.insertBefore(newMenuContainer, searchItem);
    }

    // Get menu and current config
    const menu = document.querySelector("#scriptconfig .dropdown-menu");
    if (menu) {
      const config = loadConfig();

      // Check if we should show pause toggle on this page
      const username = config.username || detectUsername(config);
      const isOnMyContent =
        config.disableOnMyContent && username && isMyContentPage(username);

      // Add settings menu item first
      const settingsItem = document.createElement("li");
      const settingsLink = document.createElement("a");
      settingsLink.href = "javascript:void(0);";
      settingsLink.id = "opencfg_advanced_blocker";
      settingsLink.textContent = "Advanced Blocker";
      settingsLink.addEventListener("click", showBlockerMenu);
      settingsItem.appendChild(settingsLink);
      menu.appendChild(settingsItem);

      // Add pause toggle last, if NOT on "my content" pages
      if (!isOnMyContent) {
        // Add pause toggle as the last item
        const pauseItem = document.createElement("li");
        const pauseLink = document.createElement("a");
        pauseLink.href = "javascript:void(0);";
        pauseLink.id = "toggle-blocker-pause";

        // Set text and icon based on state
        if (config.pauseBlocking) {
          pauseLink.innerHTML = `Advanced Blocker: Resume ▶`;
        } else {
          pauseLink.innerHTML = `Advanced Blocker: Pause ⏸`;
        }

        // Add click handler
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

  // Initialize menu when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBlockerMenu);
  } else {
    initBlockerMenu();
  }

  // addStyle() - Apply the custom stylesheet to AO3
  function addStyle() {
    const style = document.createElement("style");
    style.className = CSS_NAMESPACE;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  // showBlockerMenu() - Show the settings menu
  function showBlockerMenu() {
    // Remove any existing menu dialogs
    const existingMenus = document.querySelectorAll(
      `.${CSS_NAMESPACE}-menu-dialog`
    );
    existingMenus.forEach((menu) => menu.remove());

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

    // Load current config for the menu
    const config = loadConfig();

    // Create the settings dialog
    const dialog = document.createElement("div");
    dialog.className = `${CSS_NAMESPACE}-menu-dialog`;
    Object.assign(dialog.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: inputBg,
      padding: "20px",
      borderRadius: "8px",
      boxShadow: "0 0 20px rgba(0,0,0,0.2)",
      zIndex: "10000",
      width: "90%",
      maxWidth: "800px",
      maxHeight: "80vh",
      overflowY: "auto",
      fontFamily: "inherit",
      fontSize: "inherit",
      color: "inherit",
      boxSizing: "border-box",
    });

    // --- Build the menu content ---
    dialog.innerHTML = `
      <h3 style="text-align: center; margin-top: 0; color: inherit;">🛡️ Advanced Blocker 🛡️</h3>

      <!-- 1. Tag Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Tag Filtering 📖</h4>
        <div class="setting-group">
          <label class="setting-label" for="tag-blacklist-input">Blacklist Tags</label>
          <span class="setting-description ao3-blocker-inline-help" style="display:block;">
            Matches any AO3 tag: ratings, warnings, fandoms, ships, characters, freeforms. * for wildcards.
          </span>
          <textarea id="tag-blacklist-input" placeholder="Abandoned*, Reader, Podfic, Genderswap" title="Blocks if any tag matches. * for wildcards.">${
            config.tagBlacklist
          }</textarea>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="tag-whitelist-input">Whitelist Tags</label>
          <span class="setting-description ao3-blocker-inline-help" style="display:block;">
            Always shows the work even if it matches the blacklist. * for wildcards.
          </span>
          <textarea id="tag-whitelist-input" placeholder="*Happy Ending*, Fluff" title="Always shows the work, even if blacklisted. * for wildcards.">${
            config.tagWhitelist
          }</textarea>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="tag-highlights-input">Highlight Tags
              <span class="symbol question" title="Make these works stand out. * for wildcards."><span>?</span></span>
            </label>
            <textarea id="tag-highlights-input" placeholder="*Fix-It*, Enemies to Lovers" title="Makes these works standout. * for wildcards.">${
              config.tagHighlights
            }</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="highlight-color-input">Highlight Color
            </label>
            <input type="color" id="highlight-color-input" value="${
              config.highlightColor || "#eb6f92"
            }" title="Pick the highlight color.">
          </div>
        </div>
      </div>

      <!-- 2. Primary Pairing Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Primary Pairing Filtering 💕</h4>
        <div class="setting-group">
          <label class="setting-label" for="primary-relationships-input">Primary Relationships
            <span class="symbol question" title="Only show works where these relationships are in the first few relationship tags."><span>?</span></span>
          </label>
          <textarea id="primary-relationships-input" placeholder="Luo Binghe/Shen Yuan | Shen Qingqiu, Lan Zhan | Lan Wangji/Wei Ying | Wei Wuxian" title="Case/punctuation insensitive.">${
            config.primaryRelationships
          }</textarea>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="primary-characters-input">Primary Characters
            <span class="symbol question" title="Only show works where these characters are in the first few character tags."><span>?</span></span>
          </label>
          <textarea id="primary-characters-input" placeholder="Shen Yuan | Shen Qingqiu, Luo Binghe" title="Case/punctuation insensitive.">${
            config.primaryCharacters
          }</textarea>
        </div>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="primary-relpad-input">Relationship Tag Window
              <span class="symbol question" title="Check only the first X relationship tags."><span>?</span></span>
            </label>
            <input type="number" id="primary-relpad-input" min="1" max="10" value="${
              config.primaryRelpad || 1
            }" title="Check only the first X relationship tags.">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="primary-charpad-input">Character Tag Window
              <span class="symbol question" title="Check only the first X character tags."><span>?</span></span>
            </label>
            <input type="number" id="primary-charpad-input" min="1" max="10" value="${
              config.primaryCharpad || 5
            }" title="Check only the first X character tags.">
          </div>
        </div>
      </div>

      <!-- 3. Work Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Work Filtering 📝</h4>
        
        <!-- Full-width row for Languages -->
        <div class="setting-group">
          <label class="setting-label" for="allowed-languages-input">Allowed Languages
            <span class="symbol question" title="Only show these languages. Leave empty for all."><span>?</span></span>
          </label>
          <input id="allowed-languages-input" type="text"
                 placeholder="English, Русский, 中文-普通话国语"
                 value="${config.allowedLanguages || ""}"
                 title="Only show these languages. Leave empty for all."
                 style="width: 100%;">
        </div>

        <!-- Row 1: Max Fandoms and Max Months Since Update -->
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="max-crossovers-input">Max Fandoms
              <span class="symbol question" title="Hide works with more than this many fandoms."><span>?</span></span>
            </label>
            <input id="max-crossovers-input" type="number" min="1" step="1"
                   value="${config.maxCrossovers || ""}"
                   title="Hide works with more than this many fandoms.">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="max-months-since-update-input">Max Months Since Update
              <span class="symbol question" title="Hide ongoing works not updated in X months. Only applies to ongoing works."><span>?</span></span>
            </label>
            <input id="max-months-since-update-input" type="number" min="1" step="1" 
                   placeholder="6" value="${config.maxMonthsSinceUpdate || ""}" 
                   title="Hide ongoing works not updated in this many months.">
          </div>
        </div>

        <!-- Row 2: Word Count -->
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="min-words-input">Min Words
              <span class="symbol question" title="Hide works under this many words."><span>?</span></span>
            </label>
            <input id="min-words-input" type="text" style="width:100%;" placeholder="1000" value="${
              config.minWords || ""
            }" title="Hide works under this many words.">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="max-words-input">Max Words
              <span class="symbol question" title="Hide works over this many words."><span>?</span></span>
            </label>
            <input id="max-words-input" type="text" style="width:100%;" placeholder="100000" value="${
              config.maxWords || ""
            }" title="Hide works over this many words.">
          </div>
        </div>

        <!-- Row 3: Chapter Count -->
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="min-chapters-input">Min Chapters
              <span class="symbol question" title="Hide works with fewer chapters. Set to 2 to skip oneshots."><span>?</span></span>
            </label>
            <input id="min-chapters-input" type="number" min="1" step="1" 
                   placeholder="2" value="${config.minChapters || ""}" 
                   title="Hide works with fewer chapters. Set to 2 to skip oneshots.">
          </div>
          <div class="setting-group">
            <label class="setting-label" for="max-chapters-input">Max Chapters
              <span class="symbol question" title="Hide works with more chapters. Useful for avoiding epic-length works or drabble collections."><span>?</span></span>
            </label>
            <input id="max-chapters-input" type="number" min="1" step="1" 
                   placeholder="200" value="${config.maxChapters || ""}" 
                   title="Hide works with more chapters. Useful for avoiding epic-length works.">
          </div>
        </div>

        <!-- Row 4: Completion Status Checkboxes -->
        <div class="two-column">
          <div class="setting-group">
            <label class="checkbox-label" for="block-ongoing-checkbox">
              <input type="checkbox" id="block-ongoing-checkbox" ${
                config.blockOngoing ? "checked" : ""
              }>
              Block Ongoing Works
              <span class="symbol question" title="Hide works that are ongoing."><span>?</span></span>
            </label>
          </div>
          <div class="setting-group">
            <label class="checkbox-label" for="block-complete-checkbox">
              <input type="checkbox" id="block-complete-checkbox" ${
                config.blockComplete ? "checked" : ""
              }>
              Block Complete Works
              <span class="symbol question" title="Hide works that are marked as complete."><span>?</span></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 4. Author & Content Filtering -->
      <div class="settings-section">
        <h4 class="section-title">Author & Content Filtering ✍️</h4>
        <div class="two-column">
          <div class="setting-group">
            <label class="setting-label" for="author-blacklist-input">Blacklist Authors
              <span class="symbol question" title="Match the author name exactly."><span>?</span></span>
            </label>
            <textarea id="author-blacklist-input" placeholder="DetectiveMittens, BlackBatCat" title="Match the author name exactly.">${
              config.authorBlacklist
            }</textarea>
          </div>
          <div class="setting-group">
            <label class="setting-label" for="title-blacklist-input">Blacklist Titles
              <span class="symbol question" title="Blocks if the title contains your text. * works."><span>?</span></span>
            </label>
            <textarea id="title-blacklist-input" placeholder="oneshot, prompt, 2025" title="Blocks if the title contains your text. * works.">${
              config.titleBlacklist
            }</textarea>
          </div>
        </div>
        <div class="setting-group">
          <label class="setting-label" for="summary-blacklist-input">Blacklist Summary
            <span class="symbol question" title="Blocks if the summary has these words/phrases. * for wildcards."><span>?</span></span>
          </label>
          <textarea id="summary-blacklist-input" placeholder="oneshot, prompt, 2025" title="Blocks if the summary has these words/phrases. * for wildcards">${
            config.summaryBlacklist
          }</textarea>
        </div>
      </div>

      <!-- 5. Display Options -->
      <div class="settings-section">
        <h4 class="section-title">Display Options ⚙️</h4>
        <div class="two-column">
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="show-placeholders-checkbox" ${
                  config.showPlaceholders ? "checked" : ""
                }>
                Show Work Placeholder
                <span class="symbol question" title="Leave a stub you can click to reveal. If disabled, hides the work completely."><span>?</span></span>
              </label>
            </div>
            <div class="setting-group" id="show-reasons-group" style="display: ${
              config.showPlaceholders ? "block" : "none"
            }; margin-left: 1.5em;">
              <label class="checkbox-label">
                <input type="checkbox" id="show-reasons-checkbox" ${
                  config.showReasons ? "checked" : ""
                }>
                Show Block Reason
                <span class="symbol question" title="List what triggered the block."><span>?</span></span>
              </label>
            </div>
          </div>
          <div>
            <div class="setting-group">
              <label class="checkbox-label">
                <input type="checkbox" id="disable-on-my-content-checkbox" ${
                  config.disableOnMyContent ? "checked" : ""
                }>
                Disable on My Content
                <span class="symbol question" title="Don't block or highlight works on your dashboard, bookmarks, history, and works pages. Automatically includes all your pseuds."><span>?</span></span>
              </label>
            </div>
            <!-- Username input removed: now auto-detected -->
            <div class="setting-group" id="enable-highlighting-group" style="display: ${
              config.disableOnMyContent ? "block" : "none"
            }; margin-left: 1.5em;">
              <label class="checkbox-label">
                <input type="checkbox" id="enable-highlighting-on-my-content-checkbox" ${
                  config.enableHighlightingOnMyContent ? "checked" : ""
                }>
                Enable Highlighting
                <span class="symbol question" title="Re-enable tag highlighting on your own pages."><span>?</span></span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick-Add Tip -->
      <div style="padding: 12px; margin: 15px 0; background: rgba(0,0,0,0.03); border-radius: 6px; border-left: 4px solid currentColor;">
        <p style="margin: 0; font-size: 0.9em; opacity: 0.8;">
          <strong>💡 Quick-Add Tip:</strong> Hold <kbd style="padding: 2px 6px; background: rgba(0,0,0,0.1); border-radius: 3px; font-family: monospace;">Alt</kbd> and click any tag or author name to instantly add them to your blacklist.
        </p>
      </div>

      <!-- 6. Import/Export & Reset -->
      <div class="button-group">
        <button id="blocker-save">Save Settings</button>
        <button id="blocker-cancel">Cancel</button>
      </div>

      <div class="reset-link">
        <a href="#" id="resetBlockerSettingsLink">Reset to Default Settings</a>
      </div>

      <div class="reset-link" style="margin-top:18px;">
        <button id="ao3-export" style="margin-right:8px;">Export Settings</button>
        <input type="file" id="ao3-import" accept="application/json" style="display:none;">
        <button id="ao3-import-btn">Import Settings</button>
      </div>
    `;

    // --- Export Settings ---
    const exportButton = dialog.querySelector("#ao3-export");
    exportButton.addEventListener("click", function () {
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

    // --- Import Settings ---
    const importButton = dialog.querySelector("#ao3-import-btn");
    const importInput = dialog.querySelector("#ao3-import");
    importButton.addEventListener("click", function () {
      importInput.value = "";
      importInput.click();
    });
    importInput.addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (evt) {
        try {
          const importedConfig = JSON.parse(evt.target.result);
          if (typeof importedConfig !== "object" || !importedConfig)
            throw new Error("Invalid JSON");

          // Validate and merge with defaults
          const validConfig = { ...DEFAULTS };
          Object.keys(validConfig).forEach((key) => {
            if (importedConfig.hasOwnProperty(key)) {
              validConfig[key] = importedConfig[key];
            }
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
    });

    document.body.appendChild(dialog);

    // Add focused input styling using detected page background
    const focusStyle = document.createElement("style");
    focusStyle.textContent = `
      .ao3-blocker-menu-dialog input[type="text"]:focus,
      .ao3-blocker-menu-dialog input[type="number"]:focus,
      .ao3-blocker-menu-dialog input[type="color"]:focus,
      .ao3-blocker-menu-dialog select:focus,
      .ao3-blocker-menu-dialog textarea:focus {
        background: ${inputBg} !important;
      }
    `;
    document.head.appendChild(focusStyle);

    // Toggle username input and highlighting checkbox visibility based on checkbox
    const disableOnMyContentCheckbox = dialog.querySelector(
      "#disable-on-my-content-checkbox"
    );
    const enableHighlightingGroup = dialog.querySelector(
      "#enable-highlighting-group"
    );
    disableOnMyContentCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      enableHighlightingGroup.style.display = isChecked ? "block" : "none";
    });

    // Toggle show reasons visibility based on show placeholders checkbox
    const showPlaceholdersCheckbox = dialog.querySelector(
      "#show-placeholders-checkbox"
    );
    const showReasonsGroup = dialog.querySelector("#show-reasons-group");
    showPlaceholdersCheckbox.addEventListener("change", (e) => {
      showReasonsGroup.style.display = e.target.checked ? "block" : "none";
    });

    // Save button handler
    const saveButton = dialog.querySelector("#blocker-save");
    saveButton.addEventListener("click", () => {
      // Collect values from form inputs
      const updatedConfig = {
        tagBlacklist: dialog.querySelector("#tag-blacklist-input").value || "",
        tagWhitelist: dialog.querySelector("#tag-whitelist-input").value || "",
        tagHighlights:
          dialog.querySelector("#tag-highlights-input").value || "",
        authorBlacklist:
          dialog.querySelector("#author-blacklist-input").value || "",
        titleBlacklist:
          dialog.querySelector("#title-blacklist-input").value || "",
        summaryBlacklist:
          dialog.querySelector("#summary-blacklist-input").value || "",
        showReasons: dialog.querySelector("#show-reasons-checkbox").checked,
        showPlaceholders: dialog.querySelector("#show-placeholders-checkbox")
          .checked,
        debugMode: config.debugMode, // Preserve existing debug mode setting (not in UI)
        highlightColor:
          dialog.querySelector("#highlight-color-input").value ||
          DEFAULTS.highlightColor,
        allowedLanguages:
          dialog.querySelector("#allowed-languages-input").value || "",
        maxCrossovers:
          dialog.querySelector("#max-crossovers-input").value || "",
        minWords: dialog.querySelector("#min-words-input").value || "",
        maxWords: dialog.querySelector("#max-words-input").value || "",
        minChapters: dialog.querySelector("#min-chapters-input").value || "",
        maxChapters: dialog.querySelector("#max-chapters-input").value || "",
        maxMonthsSinceUpdate:
          dialog.querySelector("#max-months-since-update-input").value || "",
        blockComplete: dialog.querySelector("#block-complete-checkbox").checked,
        blockOngoing: dialog.querySelector("#block-ongoing-checkbox").checked,
        disableOnMyContent: dialog.querySelector(
          "#disable-on-my-content-checkbox"
        ).checked,
        enableHighlightingOnMyContent: dialog.querySelector(
          "#enable-highlighting-on-my-content-checkbox"
        ).checked,
        // username is auto-detected and preserved
        username: config.username || null,
        primaryRelationships:
          dialog.querySelector("#primary-relationships-input").value || "",
        primaryCharacters:
          dialog.querySelector("#primary-characters-input").value || "",
        primaryRelpad:
          dialog.querySelector("#primary-relpad-input").value ||
          DEFAULTS.primaryRelpad,
        primaryCharpad:
          dialog.querySelector("#primary-charpad-input").value ||
          DEFAULTS.primaryCharpad,
        _version: "2.9",
      };

      // Save using our custom storage system
      if (saveConfig(updatedConfig)) {
        // Force hard reload with cache busting
        location.href =
          location.href + (location.search ? "&" : "?") + "t=" + Date.now();
      } else {
        alert("Error saving settings.");
      }

      dialog.remove();
    });

    // Cancel button handler
    const cancelButton = dialog.querySelector("#blocker-cancel");
    cancelButton.addEventListener("click", () => {
      dialog.remove();
    });

    // Reset link handler
    const resetLink = dialog.querySelector("#resetBlockerSettingsLink");
    resetLink.addEventListener("click", function (e) {
      e.preventDefault();
      if (confirm("Are you sure you want to reset all settings to default?")) {
        // preserve detected username
        const config = loadConfig();
        const username = config.username || null;
        const newDefaults = { ...DEFAULTS, username };
        if (saveConfig(newDefaults)) {
          alert("Settings reset! Reloading...");
          location.reload();
        }
      }
    });
  }

  // Blocking logic using CSS classes

  function getWordCount(workElement) {
    // Extract word count from the work element
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

    // Move all children that aren't fold or cut elements
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
        if (reason.completionStatus) {
          parts.push(`<em>${reason.completionStatus}</em>`);
        }
        if (reason.wordCount) {
          parts.push(`<em>${reason.wordCount}</em>`);
        }
        if (reason.chapterCount) {
          parts.push(`<em>${reason.chapterCount}</em>`);
        }
        if (reason.staleUpdate) {
          parts.push(`<em>${reason.staleUpdate}</em>`);
        }
        if (reason.tags && reason.tags.length > 0) {
          parts.push(`<em>Tags: ${reason.tags.join(", ")}</em>`);
        }
        if (reason.authors && reason.authors.length > 0) {
          parts.push(`<em>Author: ${reason.authors.join(", ")}</em>`);
        }
        if (reason.titles && reason.titles.length > 0) {
          parts.push(`<em>Title: ${reason.titles.join(", ")}</em>`);
        }
        if (reason.summaryTerms && reason.summaryTerms.length > 0) {
          parts.push(`<em>Summary: ${reason.summaryTerms.join(", ")}</em>`);
        }
        if (reason.language) {
          parts.push(`<em>Language: ${reason.language}</em>`);
        }
        if (reason.crossovers !== undefined) {
          parts.push(`<em>Fandoms: ${reason.crossovers}</em>`);
        }
        if (reason.primaryPairing) {
          parts.push(`<em>${reason.primaryPairing}</em>`);
        }
      });
      message = parts.join("; ");
      const iconUrl = ICON_HIDE;
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconUrl}') no-repeat center/contain;-webkit-mask:url('${iconUrl}') no-repeat center/contain;"></span>`;
    } else if (reasons && reasons.length > 0) {
      // Fallback message when showReasons is false but work is blocked
      message = "<em>Hidden by filters.</em>";
      const iconUrl = ICON_HIDE;
      iconHtml = `<span class="${CSS_NAMESPACE}-icon" style="display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconUrl}') no-repeat center/contain;-webkit-mask:url('${iconUrl}') no-repeat center/contain;"></span>`;
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

    if (config.showPlaceholders) {
      const fold = getFold(reasons);
      const cut = getCut(workElement);

      workElement.classList.add(`${CSS_NAMESPACE}-work`);
      workElement.innerHTML = "";
      workElement.appendChild(fold);
      workElement.appendChild(cut);

      if (!config.showReasons) {
        workElement.classList.add(`${CSS_NAMESPACE}-hide-reasons`);
      }
    } else {
      workElement.classList.add(`${CSS_NAMESPACE}-hidden`);
    }
  }

  // Fast pattern matching with pre-compiled regex for wildcards
  // Note: patterns are already normalized during config initialization
  function matchPattern(text, pattern, exactMatch = false) {
    const normalizedText = normalizeText(text);

    // If it's a simple string pattern (already normalized)
    if (typeof pattern === "string") {
      return exactMatch
        ? normalizedText === pattern
        : normalizedText.includes(pattern);
    }

    // If it's a compiled pattern object (text already normalized)
    if (!pattern.hasWildcard) {
      return exactMatch
        ? normalizedText === pattern.text
        : normalizedText.includes(pattern.text);
    }

    // Use pre-compiled regex for wildcards (pattern already normalized)
    if (exactMatch) {
      // For exact matching with wildcards, the regex should match the entire string
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

        return matchPattern(tag, pattern, true); // Use exact matching for tags
      });
    });
  }

  // Check if work matches primary relationship/character requirements
  function checkPrimaryPairing(categorizedTags, config) {
    const primaryRelationships = config.primaryRelationships || [];
    const primaryCharacters = config.primaryCharacters || [];
    const relpad = config.primaryRelpad || 1;
    const charpad = config.primaryCharpad || 5;

    // If no primary pairing settings, skip check
    if (primaryRelationships.length === 0 && primaryCharacters.length === 0) {
      return null;
    }

    // Get relationship and character tags from categorized data and normalize them
    const relationshipTags = categorizedTags.relationships
      .slice(0, relpad)
      .map((tag) => normalizeText(tag));
    const characterTags = categorizedTags.characters
      .slice(0, charpad)
      .map((tag) => normalizeText(tag));

    let missingRelationships = [];
    let missingCharacters = [];

    // Check relationships - OR logic: any match passes
    // Note: both primaryRelationships and relationshipTags are now normalized
    if (primaryRelationships.length > 0) {
      const hasPrimaryRelationship = primaryRelationships.some((rel) =>
        relationshipTags.includes(rel)
      );
      if (!hasPrimaryRelationship) {
        missingRelationships = primaryRelationships;
      }
    }

    // Check characters - OR logic: any match passes
    // Note: both primaryCharacters and characterTags are now normalized
    if (primaryCharacters.length > 0) {
      const hasPrimaryCharacter = primaryCharacters.some((char) =>
        characterTags.includes(char)
      );
      if (!hasPrimaryCharacter) {
        missingCharacters = primaryCharacters;
      }
    }

    // If both are missing, create combined reason
    if (missingRelationships.length > 0 && missingCharacters.length > 0) {
      return {
        primaryPairing: `Missing relationship(s) and character(s)`,
      };
    } else if (missingRelationships.length > 0) {
      return {
        primaryPairing: `Missing relationship(s)`,
      };
    } else if (missingCharacters.length > 0) {
      return {
        primaryPairing: `Missing character(s)`,
      };
    }

    return null;
  }

  // Parse chapter information from work element
  function getChapterInfo(workElement) {
    const chaptersElement = workElement.querySelector("dd.chapters");
    if (!chaptersElement) return null;

    const text = chaptersElement.textContent.trim();
    // Match patterns like "5/10", "12/12", "3/?"
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

  // Calculate months since work was last updated
  function getMonthsSinceUpdate(workElement) {
    const dateElement = workElement.querySelector(
      "dd.updated .datetime, .datetime"
    );
    if (!dateElement) return null;

    const dateText = dateElement.textContent.trim();
    const updated = new Date(dateText);

    // Validate date
    if (isNaN(updated.getTime())) return null;

    const now = Date.now();
    // Average month = 30.4 days
    const months = (now - updated.getTime()) / (30.4 * 24 * 60 * 60 * 1000);

    return months;
  }

  // Determine blocking reasons for a work based on all criteria
  function getBlockReason(_ref, _ref2, blurbElement) {
    const completionStatus = _ref.completionStatus;

    const authors = _ref.authors === undefined ? [] : _ref.authors,
      title = _ref.title === undefined ? "" : _ref.title,
      categorizedTags =
        _ref.categorizedTags === undefined
          ? {
              relationships: [],
              characters: [],
              freeforms: [],
              ratings: [],
              warnings: [],
              categories: [],
              fandoms: [],
            }
          : _ref.categorizedTags,
      tags = _ref.tags === undefined ? [] : _ref.tags,
      summary = _ref.summary === undefined ? "" : _ref.summary,
      language = _ref.language === undefined ? "" : _ref.language,
      fandomCount = _ref.fandomCount === undefined ? 0 : _ref.fandomCount,
      wordCount = _ref.wordCount === undefined ? null : _ref.wordCount;
    const authorBlacklist =
        _ref2.authorBlacklist === undefined ? [] : _ref2.authorBlacklist,
      titleBlacklist =
        _ref2.titleBlacklist === undefined ? [] : _ref2.titleBlacklist,
      tagBlacklist = _ref2.tagBlacklist === undefined ? [] : _ref2.tagBlacklist,
      tagWhitelist = _ref2.tagWhitelist === undefined ? [] : _ref2.tagWhitelist,
      summaryBlacklist =
        _ref2.summaryBlacklist === undefined ? [] : _ref2.summaryBlacklist,
      allowedLanguages =
        _ref2.allowedLanguages === undefined ? [] : _ref2.allowedLanguages,
      maxCrossovers =
        _ref2.maxCrossovers === undefined ? 0 : _ref2.maxCrossovers,
      minWords = _ref2.minWords === undefined ? null : _ref2.minWords,
      maxWords = _ref2.maxWords === undefined ? null : _ref2.maxWords;
    const blockComplete =
      _ref2.blockComplete === undefined ? false : _ref2.blockComplete;
    const blockOngoing =
      _ref2.blockOngoing === undefined ? false : _ref2.blockOngoing;

    // Use flat array of all tags for blacklist/whitelist (same behavior as before)
    const allTags = tags;

    // If whitelisted, don't block regardless of other conditions
    if (isTagWhitelisted(allTags, tagWhitelist)) {
      return null;
    }

    const reasons = [];

    // Primary Pairing Check (uses categorized tags) - OR logic
    const primaryPairingReason = checkPrimaryPairing(categorizedTags, _ref2);
    if (primaryPairingReason) {
      reasons.push(primaryPairingReason);
    }

    // Completion status filter
    if (blockComplete && completionStatus === "complete") {
      reasons.push({ completionStatus: "Status: Complete" });
    }
    if (blockOngoing && completionStatus === "ongoing") {
      reasons.push({ completionStatus: "Status: Ongoing" });
    }

    // Language allowlist: if set and work language not included, block
    if (allowedLanguages.length > 0) {
      const lang = (language || "").toLowerCase().trim();
      // Skip language check if language is unknown (typically a series)
      if (lang && lang !== "unknown") {
        const allowed = allowedLanguages.includes(lang);
        if (!allowed) {
          reasons.push({ language: language || "unknown" }); // Use the original text for display
        }
      }
    }

    // Max crossovers: if set and fandomCount exceeds, block
    if (
      typeof maxCrossovers === "number" &&
      maxCrossovers > 0 &&
      fandomCount > maxCrossovers
    ) {
      reasons.push({ crossovers: fandomCount });
    }

    // Word count filter (after whitelist check, before other reasons)
    if (minWords != null || maxWords != null) {
      const wc = wordCount;
      const wcHit = (function () {
        if (wc == null) return null;
        if (minWords != null && wc < minWords)
          return { over: false, limit: minWords };
        if (maxWords != null && wc > maxWords)
          return { over: true, limit: maxWords };
        return null;
      })();
      if (wcHit) {
        const wcStr = wc?.toLocaleString?.() ?? wc;
        reasons.push({
          wordCount: `Words: ${wcStr}`,
        });
      }
    }

    // Chapter count filter
    if (_ref2.minChapters != null || _ref2.maxChapters != null) {
      const chapterInfo = getChapterInfo(blurbElement);

      if (chapterInfo && chapterInfo.current != null) {
        const chapters = chapterInfo.current;
        let blocked = false;

        if (_ref2.minChapters != null && chapters < _ref2.minChapters) {
          blocked = true;
        }

        if (_ref2.maxChapters != null && chapters > _ref2.maxChapters) {
          blocked = true;
        }

        if (blocked) {
          reasons.push({
            chapterCount: `Chapters: ${chapters}`,
          });
        }
      }
    }

    // Update recency filter (only for ongoing works)
    if (_ref2.maxMonthsSinceUpdate != null && completionStatus === "ongoing") {
      const monthsSinceUpdate = getMonthsSinceUpdate(blurbElement);

      if (
        monthsSinceUpdate != null &&
        monthsSinceUpdate > _ref2.maxMonthsSinceUpdate
      ) {
        const monthsDisplay = Math.floor(monthsSinceUpdate);
        reasons.push({
          staleUpdate: `Updated ${monthsDisplay} month${
            monthsDisplay !== 1 ? "s" : ""
          } ago`,
        });
      }
    }

    // Check for blocked tags (collect all matching tags) - uses flat array
    const blockedTags = [];
    allTags.forEach((tag) => {
      tagBlacklist.forEach((pattern) => {
        if (
          (typeof pattern === "string" && pattern.trim()) ||
          (pattern && pattern.text && pattern.text.trim())
        ) {
          if (matchPattern(tag, pattern, true)) {
            // Use exact matching for tags
            blockedTags.push(tag);
          }
        }
      });
    });
    if (blockedTags.length > 0) {
      reasons.push({ tags: blockedTags });
    }

    // Check for blocked authors (collect all matching authors)
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
    if (blockedAuthors.length > 0) {
      reasons.push({ authors: blockedAuthors });
    }

    // Check for blocked title
    const blockedTitles = new Set();
    titleBlacklist.forEach((pattern) => {
      if (
        (typeof pattern === "string" && pattern.trim()) ||
        (pattern && pattern.text && pattern.text.trim())
      ) {
        if (matchPattern(title, pattern, false)) {
          // Use substring matching for titles
          // Get the actual matched substring from the title
          const matched = getMatchedSubstring(title, pattern);
          if (matched) blockedTitles.add(matched);
        }
      }
    });
    if (blockedTitles.size > 0) {
      reasons.push({ titles: Array.from(blockedTitles) });
    }

    // Check for blocked summary terms
    const blockedSummaryTerms = [];
    summaryBlacklist.forEach((pattern) => {
      if (
        (typeof pattern === "string" && pattern.trim()) ||
        (pattern && pattern.text && pattern.text.trim())
      ) {
        if (matchPattern(summary, pattern, false)) {
          // Use substring matching for summaries
          // Get the actual matched substring from the summary
          const matched = getMatchedSubstring(summary, pattern);
          if (matched) blockedSummaryTerms.push(matched);
        }
      }
    });
    if (blockedSummaryTerms.length > 0) {
      reasons.push({ summaryTerms: blockedSummaryTerms });
    }

    return reasons.length > 0 ? reasons : null;
  }

  function getText(element) {
    return (element.textContent || element.innerText || "").trim();
  }
  function selectTextsIn(root, selector) {
    const elements = root.querySelectorAll(selector);
    return Array.from(elements).map(getText);
  }

  // Extract work data from blurb elements
  function selectFromBlurb(blurbElement) {
    const fandoms = blurbElement.querySelectorAll("h5.fandoms.heading a.tag");

    // Get completion status using the same unified parsing
    let completionStatus = null;
    const chaptersNode = blurbElement.querySelector("dd.chapters");
    if (chaptersNode) {
      let chaptersText = "";
      const a = chaptersNode.querySelector("a");
      if (a) {
        // Blurb with link format
        chaptersText = a.textContent.trim();
        let raw = chaptersNode.innerHTML;
        raw = raw.replace(/<a[^>]*>.*?<\/a>/, "");
        raw = raw.replace(/&nbsp;/gi, " ");
        const match = raw.match(/\/\s*([\d\?]+)/);
        if (match) {
          chaptersText += "/" + match[1].trim();
        }
      } else {
        // Simple blurb format
        chaptersText = chaptersNode.textContent.replace(/&nbsp;/gi, " ").trim();
      }
      completionStatus = parseChaptersStatus(chaptersText);
    }

    // Single call gets both structures
    const tagData = getCategorizedAndFlatTags(blurbElement);

    return {
      authors: selectTextsIn(blurbElement, "a[rel=author]"),
      categorizedTags: tagData.categorized,
      tags: tagData.flat,  // No need for getAllTagsFlat anymore
      title: selectTextsIn(blurbElement, ".header .heading a:first-child")[0],
      summary: selectTextsIn(blurbElement, "blockquote.summary")[0],
      language: selectTextsIn(blurbElement, "dd.language")[0],
      fandomCount: fandoms.length,
      wordCount: getWordCount(blurbElement),
      completionStatus: completionStatus,
    };
  }

  function checkWorks() {
    const debugMode = window.ao3Blocker.config.debugMode;
    const config = window.ao3Blocker.config;
    let blocked = 0;
    let total = 0;

    // Early exit if blocking is paused
    if (config.pauseBlocking) {
      if (debugMode) {
        console.log("[Advanced Blocker] Paused - skipping all blocking");
      }
      return;
    }

    if (debugMode) {
      console.groupCollapsed("Advanced Blocker");
      if (!config) {
        console.warn("Exiting due to missing config.");
        return;
      }
    }

    // Check if we're on user's own content pages
    let isOnMyContent = false;
    let username = config.username || detectUsername(config);
    if (config.disableOnMyContent && username) {
      isOnMyContent = isMyContentPage(username);
      if (isOnMyContent) {
        if (debugMode) {
          console.info("Advanced Blocker: On user's own content page.");
          console.log("Path:", window.location.pathname);
          console.log("Blocking disabled. Highlighting:", config.enableHighlightingOnMyContent ? "enabled" : "disabled");
        }
        if (!config.enableHighlightingOnMyContent) {
          return;
        }
      }
    }

    const blurbs = document.querySelectorAll("li.blurb");
    
    blurbs.forEach((blurbEl) => {
      const isWorkOrBookmark = (blurbEl.classList.contains("work") || blurbEl.classList.contains("bookmark")) && !blurbEl.classList.contains("picture");
      
      if (!isWorkOrBookmark) return;
      
      // --- SINGLE PASS: Extract all data once ---
      const blockables = selectFromBlurb(blurbEl);
      const allTags = blockables.tags;
      
      total++;
      
      // --- Check highlighting first (no DOM queries needed) ---
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
      
      // Apply highlighting
      if (shouldHighlight) {
        blurbEl.classList.add("ao3-blocker-highlight");
        if (debugMode) {
          console.groupCollapsed(`✨ highlighted ${blurbEl.id}`);
          console.log(blurbEl.innerHTML);
          console.groupEnd();
        }
      }
      
      // --- Check blocking (skip if on user content) ---
      let reason = null;
      if (!isOnMyContent) {
        reason = getBlockReason(blockables, config, blurbEl);
      }
      
      // Apply blocking
      if (reason) {
        blockWork(blurbEl, reason, config);
        blocked++;
        if (debugMode) {
          console.groupCollapsed(`🚫 blocked ${blurbEl.id}`);
          console.log(blurbEl.innerHTML, reason);
          console.groupEnd();
        }
      } else if (debugMode) {
        console.groupCollapsed(`  skipped ${blurbEl.id}`);
        console.log(blurbEl.innerHTML);
        console.groupEnd();
      }
    });

    if (debugMode) {
      console.log(`Blocked ${blocked} out of ${total} works`);
      console.groupEnd();
    }
  }
})();
