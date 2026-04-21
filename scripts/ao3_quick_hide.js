// ==UserScript==
// @name          AO3: Quick Hide
// @version       1.0.6
// @description   Quickly hide works, bookmarks, and comments while browsing AO3. Collapse state is saved so you can hide things you've read or aren't interested in.
// @author        BlackBatCat
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/chapters/*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/collections/*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1757286/AO3%3A%20Menu%20Helpers%20Library.js?v=2.1.7
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "ao3_quick_hide_config";
  const SETTINGS_KEY = "ao3_quick_hide_settings";

  // Timing constants
  const TIMING = {
    TOUCH_EXPAND_DELAY: 150,
    TOUCH_COLLAPSE_DELAY: 300,
    CONFIG_SAVE_DEBOUNCE: 100,
    MUTATION_OBSERVER_DEBOUNCE: 50,
  };

  const SELECTORS = {
    COMMENTS: 'li.comment[id^="comment_"]',
    WORK_BLURBS: 'li.work.blurb[id^="work_"]',
    BOOKMARKS: 'li.bookmark.blurb[id^="bookmark_"]',
  };

  const DEFAULTS = {
    enableComments: true,
    enableWorks: true,
    enableBookmarks: true,
    linkWorkBookmarkStates: true,
    collapseStyle: "default", // "default", "minimal", "fictracker"
    collapsedOpacity: 0.4,
    hoverExpand: true,
    overrideFicTrackerStyle: true,
    hideMenuOptions: false,
    username: null,
  };

  let SETTINGS = { ...DEFAULTS };

  // Cache config to reduce localStorage reads
  let configCache = null;
  let saveTimer = null;

  function loadConfig() {
    if (configCache) return configCache;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      configCache = saved
        ? JSON.parse(saved)
        : { comments: {}, works: {}, bookmarksUnlinked: {} };

      // Migrate old data format (v0.x compatibility)
      if (configCache.blurbs || configCache.bookmarks) {
        if (!configCache.works) configCache.works = {};
        if (configCache.blurbs) {
          Object.assign(configCache.works, configCache.blurbs);
          delete configCache.blurbs;
        }
        // Migrate old bookmarks to works (they were always linked before)
        if (configCache.bookmarks) {
          Object.assign(configCache.works, configCache.bookmarks);
          delete configCache.bookmarks;
        }
        // Save migrated config
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(configCache));
        } catch (e) {
          handleError("Failed to save migrated config", e);
        }
      }

      // Initialize bookmarksUnlinked if it doesn't exist
      if (!configCache.bookmarksUnlinked) {
        configCache.bookmarksUnlinked = {};
      }

      return configCache;
    } catch (e) {
      handleError("Failed to load config", e);
      // Return fresh config without setting cache on error
      return { comments: {}, works: {}, bookmarksUnlinked: {} };
    }
  }

  function saveConfig(config) {
    // Update cache immediately to prevent desyncs
    configCache = config;

    // Debounce localStorage writes to reduce I/O on rapid toggles
    if (saveTimer) clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        saveTimer = null;
      } catch (e) {
        handleError("Failed to save config", e);
      }
    }, TIMING.CONFIG_SAVE_DEBOUNCE);
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        SETTINGS = { ...DEFAULTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      handleError("Failed to load settings", e);
      SETTINGS = { ...DEFAULTS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS));
    } catch (e) {
      handleError("Failed to save settings", e);
    }
  }

  function updateStyleVariables() {
    document.documentElement.style.setProperty(
      "--ao3-collapse-opacity",
      SETTINGS.collapsedOpacity,
    );
  }

  function updateHoverClass() {
    if (SETTINGS.hoverExpand) {
      document.documentElement.classList.add("ao3-hover-expand-enabled");
    } else {
      document.documentElement.classList.remove("ao3-hover-expand-enabled");
    }
  }

  // Load settings on script start
  loadSettings();

  // Centralized error handling for consistent logging
  function handleError(context, error) {
    const message = `[AO3: Quick Hide] ${context}`;
    console.error(message, error);
  }

  // Cache username to avoid repeated DOM queries (like Advanced Blocker)
  let cachedUsername = null;

  function detectUsername() {
    if (cachedUsername) return cachedUsername;

    // Load from settings if available
    if (SETTINGS.username) {
      cachedUsername = SETTINGS.username;
      return SETTINGS.username;
    }

    // Try to get username from the logged-in user link (use textContent, not href!)
    const userLink = document.querySelector(
      'li.user.logged-in a[href^="/users/"]',
    );
    if (userLink) {
      const username = userLink.textContent.trim();
      if (username && SETTINGS.username !== username) {
        SETTINGS.username = username;
        saveSettings();
      }
      cachedUsername = username;
      return username;
    }

    // Fallback: Extract from URL if we're on a user's page
    // This is safe because once username is detected and saved, it won't be re-detected
    const urlMatch = window.location.href.match(/\/users\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      const username = urlMatch[1];
      if (SETTINGS.username !== username) {
        SETTINGS.username = username;
        saveSettings();
      }
      cachedUsername = username;
      return username;
    }

    return null;
  }

  function isMyBookmarksPage(username) {
    if (!username || !username.trim()) return false;

    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const path = window.location.pathname;

    // Check if on /users/{username}/bookmarks or /users/{username}/pseuds/{pseudo}/bookmarks
    const myBookmarksRegex = new RegExp(
      `^/users/${escapedUsername}(?:/pseuds/[^/]+)?/bookmarks/?(?:$|[?#])`,
      "i",
    );
    if (myBookmarksRegex.test(path)) return true;

    // Check for user_id parameter in query string (used in some bookmark views)
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");
    if (userId && userId.toLowerCase() === username.toLowerCase()) {
      if (path.includes("/bookmarks")) {
        return true;
      }
    }

    // Check for individual bookmark pages (/bookmarks/12345)
    if (path.match(/^\/bookmarks\/\d+$/)) {
      const userLink = document.querySelector(`a[href="/users/${username}"]`);
      if (userLink) return true;
    }

    return false;
  }

  function showSettingsPopup() {
    if (!window.AO3MenuHelpers) {
      alert("Menu Helpers library not loaded. Please refresh the page.");
      return;
    }

    const MH = window.AO3MenuHelpers;
    MH.removeAllDialogs();

    const dialog = MH.createDialog("👁️ Quick Hide 👁️", {
      maxWidth: "600px",
    });

    // General Section
    const generalSection = MH.createSection("⚙️ General Settings");

    generalSection.appendChild(
      MH.createCheckbox({
        id: "enableComments",
        label: "Enable comments",
        checked: SETTINGS.enableComments,
      }),
    );

    generalSection.appendChild(
      MH.createCheckbox({
        id: "enableWorks",
        label: "Enable work blurbs",
        checked: SETTINGS.enableWorks,
      }),
    );

    generalSection.appendChild(
      MH.createCheckbox({
        id: "enableBookmarks",
        label: "Enable bookmarks",
        checked: SETTINGS.enableBookmarks,
      }),
    );

    const linkBookmarksCheckbox = MH.createCheckbox({
      id: "linkWorkBookmarkStates",
      label: "Sync work and bookmark states ",
      checked: SETTINGS.linkWorkBookmarkStates,
    });
    linkBookmarksCheckbox.style.marginLeft = "20px";
    linkBookmarksCheckbox.style.fontSize = "0.95em";
    const linkTooltipSpan = MH.createTooltip(
      "Collapsing a work also collapses its bookmark, and vice versa",
    );
    linkBookmarksCheckbox.querySelector("label").appendChild(linkTooltipSpan);

    // Hide sync option when bookmarks are disabled
    if (!SETTINGS.enableBookmarks) {
      linkBookmarksCheckbox.style.display = "none";
    }

    generalSection.appendChild(linkBookmarksCheckbox);

    dialog.appendChild(generalSection);

    // Visual Settings Section
    const visualSection = MH.createSection("🎨 Visual Styling");

    // Collapse Style radio group
    const styleGroup = document.createElement("div");
    styleGroup.className = "setting-group";

    const styleLabel = document.createElement("label");
    styleLabel.className = "setting-label";
    styleLabel.textContent = "Collapse Style";
    styleGroup.appendChild(styleLabel);

    const defaultRadio = document.createElement("label");
    defaultRadio.className = "radio-label";
    const defaultInput = document.createElement("input");
    defaultInput.type = "radio";
    defaultInput.name = "collapseStyle";
    defaultInput.value = "default";
    defaultInput.id = "collapseStyle-default";
    defaultInput.checked = SETTINGS.collapseStyle === "default";
    defaultRadio.appendChild(defaultInput);
    defaultRadio.appendChild(document.createTextNode(" Default "));
    const defaultTooltip = MH.createTooltip(
      "Shows title, author, date, and ratings",
    );
    defaultRadio.appendChild(defaultTooltip);
    styleGroup.appendChild(defaultRadio);

    const minimalRadio = document.createElement("label");
    minimalRadio.className = "radio-label";
    const minimalInput = document.createElement("input");
    minimalInput.type = "radio";
    minimalInput.name = "collapseStyle";
    minimalInput.value = "minimal";
    minimalInput.id = "collapseStyle-minimal";
    minimalInput.checked = SETTINGS.collapseStyle === "minimal";
    minimalRadio.appendChild(minimalInput);
    minimalRadio.appendChild(document.createTextNode(" Minimal "));
    const minimalTooltip = MH.createTooltip(
      "Shows only title, author, and date",
    );
    minimalRadio.appendChild(minimalTooltip);
    styleGroup.appendChild(minimalRadio);

    const ficTrackerRadio = document.createElement("label");
    ficTrackerRadio.className = "radio-label";
    const ficTrackerInput = document.createElement("input");
    ficTrackerInput.type = "radio";
    ficTrackerInput.name = "collapseStyle";
    ficTrackerInput.value = "fictracker";
    ficTrackerInput.id = "collapseStyle-fictracker";
    ficTrackerInput.checked = SETTINGS.collapseStyle === "fictracker";
    ficTrackerRadio.appendChild(ficTrackerInput);
    ficTrackerRadio.appendChild(document.createTextNode(" FicTracker "));
    const ficTrackerTooltip = MH.createTooltip(
      "Shows title, author, date, ratings, stats, and FicTracker notes",
    );
    ficTrackerRadio.appendChild(ficTrackerTooltip);
    styleGroup.appendChild(ficTrackerRadio);

    visualSection.appendChild(styleGroup);

    visualSection.appendChild(
      MH.createSlider({
        id: "collapsedOpacity",
        label: "Collapsed opacity",
        min: 0.1,
        max: 1,
        step: 0.05,
        value: SETTINGS.collapsedOpacity,
      }),
    );

    dialog.appendChild(visualSection);

    // Behavior Section
    const behaviorSection = MH.createSection("🔧 Behavior");
    behaviorSection.appendChild(
      MH.createCheckbox({
        id: "hoverExpand",
        label: "Expand on hover",
        checked: SETTINGS.hoverExpand,
      }),
    );

    if (isFicTrackerDetected()) {
      const overrideFTCheckbox = MH.createCheckbox({
        id: "overrideFicTrackerStyle",
        label: "Apply Collapse Style to FicTracker ",
        checked: SETTINGS.overrideFicTrackerStyle,
      });
      const overrideFTTooltip = MH.createTooltip(
        "Makes FicTracker-collapsed works use Quick Hide's current collapse style and opacity",
      );
      overrideFTCheckbox.querySelector("label").appendChild(overrideFTTooltip);
      behaviorSection.appendChild(overrideFTCheckbox);
    }

    behaviorSection.appendChild(
      MH.createHideMenuCheckbox({
        id: "hideMenuOptions",
        checked: SETTINGS.hideMenuOptions,
      }),
    );

    dialog.appendChild(behaviorSection);

    dialog.appendChild(
      MH.createButtonGroup([
        { text: "Save", id: "saveButton" },
        { text: "Cancel", id: "closeButton" },
      ]),
    );

    dialog.appendChild(
      MH.createResetLink("Reset to Default Settings", () => {
        if (confirm("Reset all settings to defaults?")) {
          SETTINGS = { ...DEFAULTS };
          saveSettings();
          updateStyleVariables();

          // Update styles without removing/re-injecting
          updateStyles();

          dialog.remove();

          // Re-run setup to apply changes immediately
          const workId = getWorkId();
          if (workId) {
            setupComments();
          }
          setupBlurbs();
          setupBookmarks();
          addToggleAllButtons();
        }
      }),
    );

    // Export/Import Section
    const exportImportContainer = document.createElement("div");
    exportImportContainer.className = "reset-link";
    exportImportContainer.style.marginTop = "18px";

    const exportBtn = document.createElement("button");
    exportBtn.id = "quick-hide-export";
    exportBtn.textContent = "Export Settings";
    exportBtn.style.marginRight = "8px";

    const fileInput = MH.createFileInput({
      id: "quick-hide-import",
      buttonText: "Import Settings",
      accept: "application/json",
      onChange: (file) => {
        const reader = new FileReader();
        reader.onload = function (evt) {
          try {
            const importedData = JSON.parse(evt.target.result);

            // Validate data structure
            if (
              typeof importedData !== "object" ||
              !importedData ||
              !importedData.settings ||
              !importedData.config
            ) {
              throw new Error("Invalid file format");
            }

            // Merge settings (replace)
            SETTINGS = { ...DEFAULTS, ...importedData.settings };
            saveSettings();

            // Merge config (add new collapsed items, don't remove existing)
            const currentConfig = loadConfig();

            // Merge comments
            if (importedData.config.comments) {
              Object.keys(importedData.config.comments).forEach((workId) => {
                if (!currentConfig.comments[workId]) {
                  currentConfig.comments[workId] = {};
                }
                Object.assign(
                  currentConfig.comments[workId],
                  importedData.config.comments[workId],
                );
              });
            }

            // Merge works
            if (importedData.config.works) {
              Object.assign(currentConfig.works, importedData.config.works);
            }

            // Merge bookmarksUnlinked
            if (importedData.config.bookmarksUnlinked) {
              Object.assign(
                currentConfig.bookmarksUnlinked,
                importedData.config.bookmarksUnlinked,
              );
            }

            saveConfig(currentConfig);

            alert("Settings imported successfully! Reloading page...");
            location.reload();
          } catch (err) {
            alert("Import failed: " + (err?.message || err));
          }
        };
        reader.readAsText(file);
      },
    });

    exportImportContainer.appendChild(exportBtn);
    exportImportContainer.appendChild(fileInput.button);
    exportImportContainer.appendChild(fileInput.input);
    dialog.appendChild(exportImportContainer);

    // Add event listeners after dialog is created
    exportBtn.addEventListener("click", function () {
      try {
        const config = loadConfig();
        const exportData = {
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          settings: SETTINGS,
          config: config,
        };

        const now = new Date();
        const pad = (n) => n.toString().padStart(2, "0");
        const yyyy = now.getFullYear();
        const mm = pad(now.getMonth() + 1);
        const dd = pad(now.getDate());
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const filename = `ao3_quick_hide_config_${dateStr}.json`;

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
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
      } catch (err) {
        alert("Export failed: " + (err?.message || err));
      }
    });

    // Add event listeners after dialog is created
    dialog.querySelector("#enableComments").addEventListener("change", (e) => {
      SETTINGS.enableComments = e.target.checked;
    });

    dialog.querySelector("#enableWorks").addEventListener("change", (e) => {
      SETTINGS.enableWorks = e.target.checked;
    });

    dialog.querySelector("#enableBookmarks").addEventListener("change", (e) => {
      SETTINGS.enableBookmarks = e.target.checked;

      // Show/hide sync option based on bookmarks setting
      linkBookmarksCheckbox.style.display = e.target.checked ? "" : "none";
    });

    dialog
      .querySelector("#linkWorkBookmarkStates")
      .addEventListener("change", (e) => {
        SETTINGS.linkWorkBookmarkStates = e.target.checked;
      });

    dialog.querySelectorAll('input[name="collapseStyle"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          SETTINGS.collapseStyle = e.target.value;
        }
      });
    });

    dialog.querySelector("#collapsedOpacity").addEventListener("input", (e) => {
      SETTINGS.collapsedOpacity = parseFloat(e.target.value);
      updateStyleVariables();
    });

    dialog.querySelector("#hoverExpand").addEventListener("change", (e) => {
      SETTINGS.hoverExpand = e.target.checked;
    });

    dialog
      .querySelector("#overrideFicTrackerStyle")
      ?.addEventListener("change", (e) => {
        SETTINGS.overrideFicTrackerStyle = e.target.checked;
        updateStyles();
      });

    dialog.querySelector("#hideMenuOptions").addEventListener("change", (e) => {
      SETTINGS.hideMenuOptions = e.target.checked;
    });

    dialog.querySelector("#saveButton").addEventListener("click", () => {
      const oldLinkSetting = SETTINGS.linkWorkBookmarkStates;
      const oldEnableComments = SETTINGS.enableComments;
      const oldEnableWorks = SETTINGS.enableWorks;
      const oldEnableBookmarks = SETTINGS.enableBookmarks;

      saveSettings();
      updateStyleVariables();

      // Migrate bookmark states if link setting changed
      if (oldLinkSetting !== SETTINGS.linkWorkBookmarkStates) {
        const config = loadConfig();
        if (SETTINGS.linkWorkBookmarkStates) {
          // Moving to linked: merge bookmarksUnlinked into works
          Object.assign(config.works, config.bookmarksUnlinked);
          config.bookmarksUnlinked = {};
        } else {
          // Moving to unlinked: copy works to bookmarksUnlinked (don't delete works)
          Object.assign(config.bookmarksUnlinked, config.works);
        }
        saveConfig(config);
      }

      // Update styles without removing/re-injecting to prevent flicker
      updateStyles();
      if (SETTINGS.overrideFicTrackerStyle) {
        setupFicTrackerCollapses();
      }

      dialog.remove();

      // Only re-run setup if enable/disable settings changed
      const enableSettingsChanged =
        oldEnableComments !== SETTINGS.enableComments ||
        oldEnableWorks !== SETTINGS.enableWorks ||
        oldEnableBookmarks !== SETTINGS.enableBookmarks;

      if (enableSettingsChanged) {
        const workId = getWorkId();
        if (workId && SETTINGS.enableComments) {
          setupComments();
        }
        if (SETTINGS.enableWorks) {
          setupBlurbs();
        }
        if (SETTINGS.enableBookmarks) {
          setupBookmarks();
        }
        addToggleAllButtons();
      }
    });

    dialog.querySelector("#closeButton").addEventListener("click", () => {
      loadSettings();
      dialog.remove();
    });

    document.body.appendChild(dialog);
  }

  function initSharedMenu() {
    if (!window.AO3MenuHelpers) {
      console.warn("[AO3: Quick Hide] Menu Helpers library not available");
      return;
    }

    if (!SETTINGS.hideMenuOptions || window.AO3MenuHelpers.isAO3Homepage()) {
      window.AO3MenuHelpers.addToSharedMenu({
        id: "collapsible-comments-settings",
        text: "Quick Hide",
        onClick: showSettingsPopup,
      });
    }
  }

  function getWorkId() {
    // Try to get work ID from URL (works or chapters)
    let match = window.location.pathname.match(/\/works\/(\d+)/);
    if (match) return match[1];

    // If on a chapter page, get work ID from the page
    match = window.location.pathname.match(/\/chapters\/(\d+)/);
    if (match) {
      // Try work_id parameter in links (like Hide Comments link)
      const workIdLink = document.querySelector('a[href*="work_id="]');
      if (workIdLink) {
        const workIdMatch = workIdLink.href.match(/work_id=(\d+)/);
        if (workIdMatch) return workIdMatch[1];
      }

      // Try the full work link in breadcrumbs or header
      const workLink = document.querySelector(
        '.work.navigation a[href*="/works/"], #workskin .preface a[href*="/works/"]',
      );
      if (workLink) {
        const workMatch = workLink.href.match(/\/works\/(\d+)/);
        if (workMatch) return workMatch[1];
      }
    }

    return null;
  }

  function getCommentId(element) {
    const id = element.id;
    return id ? id.replace("comment_", "") : null;
  }

  function getBlurbWorkId(element) {
    const id = element.id;
    return id ? id.replace("work_", "") : null;
  }

  function getWorkIdFromBookmark(element) {
    // Try to get work ID from the work link within the bookmark
    const workLink = element.querySelector('a[href*="/works/"]');
    if (workLink) {
      const match = workLink.href.match(/\/works\/(\d+)/);
      if (match) return match[1];
    }
    return null;
  }

  function getStyleContent() {
    const isMinimal = SETTINGS.collapseStyle === "minimal";
    const isFicTracker = SETTINGS.collapseStyle === "fictracker";

    return `
      :root {
        --ao3-collapse-opacity: ${SETTINGS.collapsedOpacity};
      }
      
      /* Comment styles - hide content but keep heading and profile pic visible */
      .ao3-comment-collapsed > *:not(.heading.byline):not(.icon) {
        display: none !important;
      }
      
      /* Apply opacity fade to entire comment when collapsed */
      .ao3-comment-collapsed {
        opacity: var(--ao3-collapse-opacity);
      }
      
      .ao3-hover-expand-enabled .ao3-comment-collapsed:hover {
        opacity: 1;
      }
      
      /* Hide nested thread when parent is collapsed */
      .ao3-comment-collapsed + li > ol.thread {
        display: none !important;
      }
      
      li.comment {
        cursor: pointer;
      }
      
      /* Keep normal cursor for interactive elements */
      li.comment a,
      li.comment button,
      li.comment input,
      li.comment textarea,
      li.comment select {
        cursor: default;
      }
      
      /* Blurb styles - Hide specific elements when collapsed */
      .ao3-blurb-collapsed .landmark,
      .ao3-blurb-collapsed .tags,
      .ao3-blurb-collapsed .series,
      .ao3-blurb-collapsed h5.fandoms.heading,
      .ao3-blurb-collapsed .userstuff.summary,
      .ao3-blurb-collapsed ul.actions {
        display: none !important;
      }
      
      /* Remove extra spacing from header when collapsed */
      .ao3-blurb-collapsed .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }
      
      /* Minimal mode - hide required-tags, stats, and notes */
      ${
        isMinimal
          ? `
      .ao3-blurb-collapsed .required-tags,
      .ao3-blurb-collapsed .stats,
      .ao3-blurb-collapsed .user-note-preview {
        display: none !important;
      }
      `
          : ""
      }
      
      /* Default mode - hide stats and notes but keep required-tags visible */
      ${
        !isMinimal && !isFicTracker
          ? `
      .ao3-blurb-collapsed .stats,
      .ao3-blurb-collapsed .user-note-preview {
        display: none !important;
      }
      `
          : ""
      }
      
      .ao3-blurb-collapsed {
        opacity: var(--ao3-collapse-opacity) !important;
      }
      
      .ao3-hover-expand-enabled .ao3-blurb-collapsed:hover {
        opacity: 1 !important;
      }
      
      /* Prevent opacity transition during temporary hover/touch expansion */
      .ao3-blurb-collapsed.ao3-hover-expanded {
        transition: none !important;
        opacity: 1;
      }
      
      li.work.blurb:not(.ao3-blocker-work):not(.FT_collapsable) {
        cursor: pointer;
      }
      
      /* Keep normal cursor for interactive elements in blurbs */
      li.work.blurb a,
      li.work.blurb button,
      li.work.blurb input,
      li.work.blurb textarea,
      li.work.blurb select {
        cursor: default;
      }
      
      /* Bookmark styles - Hide specific elements when collapsed */
      .ao3-bookmark-collapsed .landmark,
      .ao3-bookmark-collapsed .tags,
      .ao3-bookmark-collapsed .series,
      .ao3-bookmark-collapsed h5.fandoms.heading,
      .ao3-bookmark-collapsed .userstuff.summary,
      .ao3-bookmark-collapsed ul.actions {
        display: none !important;
      }
      
      /* Remove extra spacing from header when collapsed */
      .ao3-bookmark-collapsed .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }
      
      /* Minimal mode - hide required-tags, stats, and notes */
      ${
        isMinimal
          ? `
      .ao3-bookmark-collapsed .required-tags,
      .ao3-bookmark-collapsed .stats,
      .ao3-bookmark-collapsed .user-note-preview {
        display: none !important;
      }
      `
          : ""
      }
      
      /* Default mode - hide stats and notes but keep required-tags visible */
      ${
        !isMinimal && !isFicTracker
          ? `
      .ao3-bookmark-collapsed .stats,
      .ao3-bookmark-collapsed .user-note-preview {
        display: none !important;
      }
      `
          : ""
      }
      
      .ao3-bookmark-collapsed {
        opacity: var(--ao3-collapse-opacity) !important;
      }
      
      .ao3-hover-expand-enabled .ao3-bookmark-collapsed:hover {
        opacity: 1 !important;
      }
      
      /* Prevent opacity transition during temporary hover/touch expansion */
      .ao3-bookmark-collapsed.ao3-hover-expanded {
        transition: none !important;
        opacity: 1;
      }
      
      li.bookmark.blurb:not(.ao3-blocker-work):not(.FT_collapsable) {
        cursor: pointer;
      }
      
      /* Keep normal cursor for interactive elements in bookmarks */
      li.bookmark.blurb a,
      li.bookmark.blurb button,
      li.bookmark.blurb input,
      li.bookmark.blurb textarea,
      li.bookmark.blurb select {
        cursor: default;
      }

      /* FicTracker collapse style override */
      ${
        SETTINGS.overrideFicTrackerStyle
          ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .landmark,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .tags,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .series,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) h5.fandoms.heading,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .userstuff,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) ul.actions {
        display: none !important;
      }

      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .header {
        padding-bottom: 0 !important;
        ${isMinimal ? "min-height: 0 !important;" : ""}
      }

      ${
        isMinimal
          ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .required-tags,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .stats,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .user-note-preview {
        display: none !important;
      }
      `
          : !isFicTracker
            ? `
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .stats,
      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) .user-note-preview {
        display: none !important;
      }
      `
            : ""
      }

      li.FT_collapsable:not(.ao3-ft-user-expanded):not(.ao3-blocker-work):not(.ao3-blocker-hidden) {
        opacity: var(--ao3-collapse-opacity) !important;
        cursor: pointer;
      }
      `
          : ""
      }
    `;
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.id = "ao3-collapsible-styles";
    style.textContent = getStyleContent();
    document.head.appendChild(style);
  }

  function updateStyles() {
    const existingStyles = document.getElementById("ao3-collapsible-styles");
    if (existingStyles) {
      existingStyles.textContent = getStyleContent();
    } else {
      injectStyles();
    }
    updateHoverClass();
  }

  function toggleComment(commentElement, workId, config = null) {
    const commentId = getCommentId(commentElement);
    if (!commentId) return;

    const isCollapsed = commentElement.classList.toggle(
      "ao3-comment-collapsed",
    );

    // Load config if not provided (for single toggle operations)
    const shouldSave = !config;
    if (!config) {
      config = loadConfig();
    }

    if (!config.comments[workId]) {
      config.comments[workId] = {};
    }

    if (isCollapsed) {
      config.comments[workId][commentId] = true;
    } else {
      delete config.comments[workId][commentId];
      if (Object.keys(config.comments[workId]).length === 0) {
        delete config.comments[workId];
      }
    }

    // Only save if config wasn't provided (single operation)
    if (shouldSave) {
      saveConfig(config);
    }

    return isCollapsed;
  }

  function toggleBlurb(blurbElement, config = null) {
    const blurbWorkId = getBlurbWorkId(blurbElement);
    if (!blurbWorkId) return;

    const isCollapsed = blurbElement.classList.toggle("ao3-blurb-collapsed");

    // Load config if not provided (for single toggle operations)
    const shouldSave = !config;
    if (!config) {
      config = loadConfig();
    }

    if (isCollapsed) {
      config.works[blurbWorkId] = true;
    } else {
      delete config.works[blurbWorkId];
    }

    // Only save if config wasn't provided (single operation)
    if (shouldSave) {
      saveConfig(config);
    }

    return isCollapsed;
  }

  function toggleBookmark(bookmarkElement, config = null) {
    const workId = getWorkIdFromBookmark(bookmarkElement);
    if (!workId) return;

    const isCollapsed = bookmarkElement.classList.toggle(
      "ao3-bookmark-collapsed",
    );

    // Load config if not provided (for single toggle operations)
    const shouldSave = !config;
    if (!config) {
      config = loadConfig();
    }

    const storageKey = SETTINGS.linkWorkBookmarkStates
      ? "works"
      : "bookmarksUnlinked";

    if (isCollapsed) {
      config[storageKey][workId] = true;
    } else {
      delete config[storageKey][workId];
    }

    // Only save if config wasn't provided (single operation)
    if (shouldSave) {
      saveConfig(config);
    }

    return isCollapsed;
  }

  function toggleAllComments(collapse) {
    const workId = getWorkId();
    if (!workId) return;

    const config = loadConfig();
    if (!config.comments[workId]) {
      config.comments[workId] = {};
    }

    const allComments = document.querySelectorAll(SELECTORS.COMMENTS);

    allComments.forEach((comment) => {
      // When collapsing, only target top-level comments
      // Nested replies automatically collapse with their parent via CSS
      // When expanding, target all comments to ensure nested ones expand too
      if (collapse) {
        const parentThread = comment.parentElement;
        const isTopLevel =
          parentThread &&
          parentThread.tagName === "OL" &&
          parentThread.classList.contains("thread") &&
          (!parentThread.parentElement ||
            parentThread.parentElement.tagName !== "LI");

        if (!isTopLevel) return;
      }

      const commentId = getCommentId(comment);
      if (!commentId) return;

      if (collapse) {
        comment.classList.add("ao3-comment-collapsed");
        config.comments[workId][commentId] = true;
      } else {
        comment.classList.remove("ao3-comment-collapsed");
        delete config.comments[workId][commentId];
      }
    });

    // Clean up empty work config to reduce storage size
    if (Object.keys(config.comments[workId]).length === 0) {
      delete config.comments[workId];
    }

    // Single save after all changes
    saveConfig(config);
  }

  function toggleAllBlurbs(collapse) {
    const config = loadConfig();
    const allBlurbs = document.querySelectorAll(SELECTORS.WORK_BLURBS);

    allBlurbs.forEach((blurb) => {
      const blurbWorkId = getBlurbWorkId(blurb);
      if (!blurbWorkId) return;

      if (shouldSkipElement(blurb)) return;

      if (collapse) {
        blurb.classList.add("ao3-blurb-collapsed");
        config.works[blurbWorkId] = true;
      } else {
        blurb.classList.remove("ao3-blurb-collapsed");
        delete config.works[blurbWorkId];
      }
    });

    saveConfig(config);
  }

  function toggleAllBookmarks(collapse) {
    const config = loadConfig();
    const storageKey = SETTINGS.linkWorkBookmarkStates
      ? "works"
      : "bookmarksUnlinked";
    const allBookmarks = document.querySelectorAll(SELECTORS.BOOKMARKS);

    allBookmarks.forEach((bookmark) => {
      const workId = getWorkIdFromBookmark(bookmark);
      if (!workId) return;

      if (shouldSkipElement(bookmark)) return;

      if (collapse) {
        bookmark.classList.add("ao3-bookmark-collapsed");
        config[storageKey][workId] = true;
      } else {
        bookmark.classList.remove("ao3-bookmark-collapsed");
        delete config[storageKey][workId];
      }
    });

    saveConfig(config);
  }

  function addToggleAllButtons() {
    // Don't add buttons on inbox page
    if (window.location.pathname.includes("/inbox")) return;

    // Toggle buttons for pagination areas (works for comments, blurbs, and bookmarks)
    const paginations = document.querySelectorAll(
      "ol.pagination.actions:not(.ao3-toggle-button-added)",
    );

    if (paginations.length === 0) return;

    // Cache content checks once for all paginations to avoid redundant DOM queries
    // Only count a content type if it's both present and enabled in settings
    const hasComments =
      SETTINGS.enableComments &&
      document.querySelector(SELECTORS.COMMENTS) !== null;
    const hasWorkBlurbs =
      SETTINGS.enableWorks &&
      document.querySelector(SELECTORS.WORK_BLURBS) !== null;
    const hasBookmarks =
      SETTINGS.enableBookmarks &&
      document.querySelector(SELECTORS.BOOKMARKS) !== null;

    // Don't add buttons if no enabled content types are present on this page
    if (!hasComments && !hasWorkBlurbs && !hasBookmarks) return;

    paginations.forEach((pagination) => {
      pagination.classList.add("ao3-toggle-button-added");

      const collapseAllLi = document.createElement("li");
      collapseAllLi.innerHTML = '<a href="#">Collapse All</a>';
      const collapseAllLink = collapseAllLi.querySelector("a");
      collapseAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (hasComments) {
          toggleAllComments(true);
        }
        if (hasWorkBlurbs) {
          toggleAllBlurbs(true);
        }
        if (hasBookmarks) {
          toggleAllBookmarks(true);
        }
      });

      const expandAllLi = document.createElement("li");
      expandAllLi.innerHTML = '<a href="#">Expand All</a>';
      const expandAllLink = expandAllLi.querySelector("a");
      expandAllLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (hasComments) {
          toggleAllComments(false);
        }
        if (hasWorkBlurbs) {
          toggleAllBlurbs(false);
        }
        if (hasBookmarks) {
          toggleAllBookmarks(false);
        }
      });

      pagination.appendChild(expandAllLi);
      pagination.appendChild(collapseAllLi);
    });
  }

  function setupComments() {
    if (!SETTINGS.enableComments) return;

    const workId = getWorkId();
    if (!workId) return;

    const config = loadConfig();
    const workConfig = config.comments[workId] || {};

    const comments = document.querySelectorAll(SELECTORS.COMMENTS);

    if (comments.length === 0) return;

    comments.forEach((comment) => {
      const commentId = getCommentId(comment);
      if (!commentId) return;

      // Skip if already setup
      if (comment.classList.contains("ao3-collapse-setup")) {
        return;
      }

      comment.classList.add("ao3-collapse-setup");

      if (workConfig[commentId]) {
        comment.classList.add("ao3-comment-collapsed");
      }

      comment.addEventListener("click", function (e) {
        const target = e.target;

        if (
          target.tagName === "A" ||
          target.tagName === "BUTTON" ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.closest("a, button, input, textarea, select, form")
        ) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        toggleComment(comment, workId);
      });

      // Add hover and touch expand behaviors
      addHoverExpandBehavior(comment, "ao3-comment-collapsed");
      addTouchExpandBehavior(comment, "ao3-comment-collapsed");
    });
  }

  function isFicTrackerDetected() {
    // Check for FicTracker UI elements on the current page.
    // localStorage is intentionally not checked — FT_ keys persist after the script is disabled.
    return !!document.querySelector(".FT_collapsable, .work_quicktag_btn");
  }

  function shouldSkipElement(element) {
    // Skip if processed by Advanced Blocker
    if (
      element.classList.contains("ao3-blocker-work") ||
      element.classList.contains("ao3-blocker-hidden") ||
      element.classList.contains("ao3-blocker-unhide") ||
      element.querySelector(
        ".ao3-blocker-cut, .ao3-blocker-fold, .ao3-blocker-toggle",
      )
    ) {
      return true;
    }

    // Do NOT skip if processed by FicTracker; allow Quick Hide to collapse and override opacity

    return false;
  }

  // Helper function for consistent element matching
  function elementMatchesOrContains(node, selector) {
    return (
      (node.matches && node.matches(selector)) ||
      (node.querySelector && node.querySelector(selector))
    );
  }

  // Store touch timers to allow cleanup
  const touchTimers = new WeakMap();

  // Helper function to add hover expand behavior
  function addHoverExpandBehavior(element, collapsedClass) {
    if (!SETTINGS.hoverExpand) return;

    element.addEventListener("mouseenter", function () {
      if (element.classList.contains(collapsedClass)) {
        element.classList.remove(collapsedClass);
        element.classList.add("ao3-hover-expanded");
      }
    });

    element.addEventListener("mouseleave", function () {
      if (element.classList.contains("ao3-hover-expanded")) {
        element.classList.remove("ao3-hover-expanded");
        element.classList.add(collapsedClass);
      }
    });
  }

  // Helper function to add touch expand behavior
  function addTouchExpandBehavior(element, collapsedClass) {
    if (!SETTINGS.hoverExpand) return;

    element.addEventListener("touchstart", function (e) {
      if (element.classList.contains(collapsedClass)) {
        const timer = setTimeout(() => {
          element.classList.remove(collapsedClass);
          element.classList.add("ao3-hover-expanded");
        }, TIMING.TOUCH_EXPAND_DELAY);
        touchTimers.set(element, timer);
      }
    });

    element.addEventListener("touchend", function (e) {
      const timer = touchTimers.get(element);
      if (timer) {
        clearTimeout(timer);
        touchTimers.delete(element);
      }
      if (element.classList.contains("ao3-hover-expanded")) {
        setTimeout(() => {
          if (element.classList.contains("ao3-hover-expanded")) {
            element.classList.remove("ao3-hover-expanded");
            element.classList.add(collapsedClass);
          }
        }, TIMING.TOUCH_COLLAPSE_DELAY);
      }
    });

    element.addEventListener("touchcancel", function (e) {
      const timer = touchTimers.get(element);
      if (timer) {
        clearTimeout(timer);
        touchTimers.delete(element);
      }
      // Immediately restore collapsed state on cancel
      if (element.classList.contains("ao3-hover-expanded")) {
        element.classList.remove("ao3-hover-expanded");
        element.classList.add(collapsedClass);
      }
    });
  }

  // Helper function to check if a click should be ignored (clicked on interactive element)
  function shouldIgnoreClick(target) {
    return (
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.closest("a, button, input, textarea, select, form") ||
      target.closest(".ao3-blocker-fold, .ao3-blocker-toggle") ||
      target.closest(
        ".actions, .user-note-preview, .navigation.actions, ul[role='menu']",
      )
    );
  }

  function setupBlurbs() {
    if (!SETTINGS.enableWorks) return;

    const config = loadConfig();

    const blurbs = document.querySelectorAll(SELECTORS.WORK_BLURBS);

    if (blurbs.length === 0) return;

    blurbs.forEach((blurb) => {
      const blurbWorkId = getBlurbWorkId(blurb);
      if (!blurbWorkId) return;

      // Skip if processed by other scripts (check first, before "already setup")
      if (shouldSkipElement(blurb)) {
        return;
      }

      // Skip elements FicTracker is already collapsing — handled by setupFicTrackerCollapses
      if (
        SETTINGS.overrideFicTrackerStyle &&
        blurb.classList.contains("FT_collapsable")
      ) {
        return;
      }

      // Skip if already setup
      if (blurb.classList.contains("ao3-blurb-collapse-setup")) {
        return;
      }

      blurb.classList.add("ao3-blurb-collapse-setup");

      if (config.works[blurbWorkId]) {
        blurb.classList.add("ao3-blurb-collapsed");
      }

      blurb.addEventListener("click", function (e) {
        // Check if element should be skipped (e.g., FicTracker marked it after our setup)
        if (shouldSkipElement(blurb)) {
          return;
        }

        // Defer to setupFicTrackerCollapses if FicTracker claimed this element after setup
        if (
          SETTINGS.overrideFicTrackerStyle &&
          blurb.classList.contains("FT_collapsable")
        ) {
          return;
        }

        const target = e.target;
        if (shouldIgnoreClick(target)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // If temporarily expanded by hover/touch, remove the class before toggling
        if (blurb.classList.contains("ao3-hover-expanded")) {
          blurb.classList.remove("ao3-hover-expanded");
        }

        toggleBlurb(blurb);
      });

      // Add hover and touch expand behaviors
      addHoverExpandBehavior(blurb, "ao3-blurb-collapsed");
      addTouchExpandBehavior(blurb, "ao3-blurb-collapsed");
    });
  }

  function setupBookmarks() {
    const bookmarks = document.querySelectorAll(SELECTORS.BOOKMARKS);
    if (bookmarks.length === 0) return;

    const config = loadConfig();
    const username = detectUsername();
    const onMyBookmarksPage = isMyBookmarksPage(username);

    // Determine if we should setup bookmarks on this page:
    // - My bookmarks page: controlled by enableBookmarks setting
    // - Other users' bookmarks pages: controlled by enableWorks setting (treat as works)
    const shouldSetupPage = onMyBookmarksPage
      ? SETTINGS.enableBookmarks
      : SETTINGS.enableWorks;
    if (!shouldSetupPage) return;

    // Determine storage key for this page:
    // - My bookmarks: use "bookmarksUnlinked" if not linked, otherwise "works"
    // - Other users' bookmarks: always use "works"
    const storageKey =
      onMyBookmarksPage && !SETTINGS.linkWorkBookmarkStates
        ? "bookmarksUnlinked"
        : "works";

    bookmarks.forEach((bookmark) => {
      const workId = getWorkIdFromBookmark(bookmark);
      if (!workId) return;

      // Skip if processed by other scripts
      if (shouldSkipElement(bookmark)) {
        return;
      }

      // Skip elements FicTracker is already collapsing — handled by setupFicTrackerCollapses
      if (
        SETTINGS.overrideFicTrackerStyle &&
        bookmark.classList.contains("FT_collapsable")
      ) {
        return;
      }

      // Skip if already setup
      if (bookmark.classList.contains("ao3-bookmark-collapse-setup")) {
        return;
      }

      bookmark.classList.add("ao3-bookmark-collapse-setup");

      // Apply saved collapse state
      if (config[storageKey][workId]) {
        bookmark.classList.add("ao3-bookmark-collapsed");
      }

      bookmark.addEventListener("click", function (e) {
        // Check if element should be skipped (e.g., FicTracker marked it after our setup)
        if (shouldSkipElement(bookmark)) {
          return;
        }

        // Defer to setupFicTrackerCollapses if FicTracker claimed this element after setup
        if (
          SETTINGS.overrideFicTrackerStyle &&
          bookmark.classList.contains("FT_collapsable")
        ) {
          return;
        }

        const target = e.target;
        if (shouldIgnoreClick(target)) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        // If temporarily expanded by hover/touch, remove the class before toggling
        if (bookmark.classList.contains("ao3-hover-expanded")) {
          bookmark.classList.remove("ao3-hover-expanded");
        }

        toggleBookmark(bookmark);
      });

      // Add hover and touch expand behaviors
      addHoverExpandBehavior(bookmark, "ao3-bookmark-collapsed");
      addTouchExpandBehavior(bookmark, "ao3-bookmark-collapsed");
    });
  }

  function setupFicTrackerCollapses() {
    if (!SETTINGS.overrideFicTrackerStyle) return;

    const ftWorks = document.querySelectorAll(
      "li.work.blurb.FT_collapsable:not(.ao3-ft-collapse-setup), li.bookmark.blurb.FT_collapsable:not(.ao3-ft-collapse-setup)",
    );
    if (ftWorks.length === 0) return;

    ftWorks.forEach((el) => {
      el.classList.add("ao3-ft-collapse-setup");

      if (shouldSkipElement(el)) return;

      if (SETTINGS.hoverExpand) {
        el.addEventListener("mouseenter", function () {
          el.classList.add("ao3-ft-user-expanded");
        });
        el.addEventListener("mouseleave", function () {
          el.classList.remove("ao3-ft-user-expanded");
        });
      } else {
        el.addEventListener("click", function (e) {
          if (shouldIgnoreClick(e.target)) return;
          e.preventDefault();
          e.stopPropagation();
          el.classList.toggle("ao3-ft-user-expanded");
          // When expanding, also clear any Quick Hide collapse state so QH CSS doesn't keep content hidden
          if (el.classList.contains("ao3-ft-user-expanded")) {
            if (el.classList.contains("ao3-blurb-collapsed")) {
              el.classList.remove("ao3-blurb-collapsed");
              const blurbWorkId = getBlurbWorkId(el);
              if (blurbWorkId) {
                const config = loadConfig();
                delete config.works[blurbWorkId];
                saveConfig(config);
              }
            }
            if (el.classList.contains("ao3-bookmark-collapsed")) {
              el.classList.remove("ao3-bookmark-collapsed");
              const workId = getWorkIdFromBookmark(el);
              if (workId) {
                const config = loadConfig();
                const storageKey = SETTINGS.linkWorkBookmarkStates
                  ? "works"
                  : "bookmarksUnlinked";
                delete config[storageKey][workId];
                saveConfig(config);
              }
            }
          }
        });
      }
    });
  }

  // Track if initial setup has completed to avoid redundant fallback processing
  let initialSetupComplete = false;

  function init() {
    console.log("[AO3: Quick Hide] Loaded.");
    injectStyles();
    updateStyleVariables();
    updateHoverClass();
    initSharedMenu();

    // Initial setup for static content
    const workId = getWorkId();
    if (workId) {
      setupComments();
    }
    setupBlurbs();
    setupBookmarks();
    setupFicTrackerCollapses();
    addToggleAllButtons();

    // Catch FicTracker class additions that may occur after Quick Hide initializes
    setTimeout(() => setupFicTrackerCollapses(), 300);

    // Watch for AJAX-loaded content (pagination, infinite scroll, etc.)
    const mainContent = document.querySelector("main, #main, body");
    if (mainContent) {
      let debounceTimer = null;

      const contentObserver = new MutationObserver((mutations) => {
        // Debounce to batch multiple DOM changes together (e.g., loading 20 works at once)
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
          let hasNewComments = false;
          let hasNewWorks = false;

          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                // Check for comments
                if (elementMatchesOrContains(node, SELECTORS.COMMENTS)) {
                  hasNewComments = true;
                }

                // Check for blurbs and bookmarks
                if (
                  elementMatchesOrContains(node, SELECTORS.WORK_BLURBS) ||
                  elementMatchesOrContains(node, SELECTORS.BOOKMARKS)
                ) {
                  hasNewWorks = true;
                }

                // Check if comments_placeholder was added
                if (
                  elementMatchesOrContains(
                    node,
                    "#comments_placeholder, #feedback",
                  )
                ) {
                  hasNewComments = true;
                }
              }

              if (hasNewComments && hasNewWorks) break;
            }
            if (hasNewComments && hasNewWorks) break;
          }

          if (hasNewComments) {
            setupComments();
            addToggleAllButtons();
          }
          if (hasNewWorks) {
            setupBlurbs();
            setupBookmarks();
            setupFicTrackerCollapses();
            addToggleAllButtons();
          }
        }, TIMING.MUTATION_OBSERVER_DEBOUNCE);
      });

      contentObserver.observe(mainContent, {
        childList: true,
        subtree: true,
      });

      // Mark setup as complete after observer is established
      initialSetupComplete = true;
    }

    // Fallback: Re-run setup after a short delay to catch late-loading AJAX content
    // Only runs if observer setup failed
    setTimeout(() => {
      if (!initialSetupComplete) {
        if (getWorkId()) {
          setupComments();
        }
        setupBlurbs();
        setupBookmarks();
        setupFicTrackerCollapses();
        addToggleAllButtons();
        initialSetupComplete = true;
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
