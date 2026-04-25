// ==UserScript==
// @name         AO3: Script Sync
// @namespace    https://github.com/Wolfbatcat/ao3-script-sync
// @version      1.0.2
// @description  Sync AO3 userscript settings across devices via Google Sheets. Select which localStorage keys to sync and configure automatic sync intervals.
// @author       BlackBatCat
// @license      MIT
// @match        *://*.archiveofourown.org/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @supportURL   https://github.com/Wolfbatcat/ao3-script-sync/issues
// @downloadURL  https://github.com/Wolfbatcat/ao3-script-sync/raw/main/ao3_universal_sync.user.js
// @updateURL    https://github.com/Wolfbatcat/ao3-script-sync/raw/main/ao3_universal_sync.user.js
// ==/UserScript==

(function () {
  "use strict";

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  // DOM helper functions
  const q = (selector, node = document) => node.querySelector(selector);
  const qa = (selector, node = document) => node.querySelectorAll(selector);
  const ins = (n, l, html) => n.insertAdjacentHTML(l, html);

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================================
  // STYLE MANAGER
  // ============================================================================

  class StyleManager {
    static inject() {
      const styles = `
                <style type="text/css">
                    /* Minimal custom styles - inherit AO3's native CSS */
                    #ss-container {
                        margin: 0 auto;
                    }
                    
                    /* Sync widget styles */
                    @keyframes ss-spin {
                        to { transform: rotate(360deg); }
                    }
                    
                    /* Status display with loading states */

                    #ss-connection-status {
                        margin: 5px 0;
                        font-weight: normal;
                    }
                    #ss-connection-status:empty {
                        display: none;
                    }
                    #ss-connection-status.ss-status-loading {
                        color: #0066cc;
                    }
                    #ss-connection-status.ss-status-success {
                        color: green;
                    }
                    #ss-connection-status.ss-status-error {
                        color: red;
                    }
                    
                    /* FicTracker warning styles */
                    .ss-ft-warning-row {
                        opacity: 0.5;
                    }
                    /* Script Sync internal data styles */
                    .ss-internal-row {
                        opacity: 0.5;
                    }
                    .ss-ft-notice-close {
                        float: right;
                        cursor: pointer;
                        font-size: 1.2em;
                        line-height: 1;
                        padding: 0 5px;
                        margin: -5px -5px 0 0;
                    }
                    .ss-ft-notice-close:hover {
                        opacity: 0.7;
                    }
                    
                    /* Hide un-synced rows */
                    .ss-row-hidden {
                        display: none;
                    }
                    
                    /* Toggle switch styling */
                    .ss-sync-toggle {
                        position: relative;
                        display: inline-block;
                        width: 2em;
                        height: 1em;
                        vertical-align: middle;
                    }
                    .ss-sync-toggle input {
                        opacity: 0;
                        width: 0;
                        height: 0;
                    }
                    .ss-toggle-slider {
                        position: absolute;
                        cursor: pointer;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: #ccc;
                        transition: 0.3s;
                        border-radius: 1em;
                    }
                    .ss-toggle-slider:before {
                        position: absolute;
                        content: "";
                        height: 0.8em;
                        width: 0.8em;
                        left: 0.1em;
                        bottom: 0.1em;
                        background-color: white;
                        transition: 0.3s;
                        border-radius: 50%;
                    }
                    .ss-sync-toggle input:checked + .ss-toggle-slider {
                        background-color: #2e7d32;
                    }
                    .ss-sync-toggle input:checked + .ss-toggle-slider:before {
                        transform: translateX(1em);
                    }
                </style>
            `;
      ins(q("head"), "beforeend", styles);
    }
  }

  // ============================================================================
  // STORAGE MANAGER
  // ============================================================================

  class StorageManager {
    constructor(prefix = "SS_") {
      this.prefix = prefix;
      this.settingsKey = "settings";
    }

    setItem(key, value) {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    }

    getItem(key, defaultValue = null) {
      const item = localStorage.getItem(this.prefix + key);
      if (item === null) return defaultValue;
      try {
        return JSON.parse(item);
      } catch (e) {
        console.error(
          "[AO3: Script Sync] Error parsing stored value for key:",
          key,
          e,
        );
        return defaultValue;
      }
    }

    removeItem(key) {
      localStorage.removeItem(this.prefix + key);
    }

    // Get settings object - all settings stored in single SS_settings key
    getSettings() {
      const settings = this.getItem(this.settingsKey, null);
      if (settings) {
        // Merge with defaults in case new settings were added
        return {
          sheetUrl: "",
          syncEnabled: false,
          syncInterval: 60,
          syncWidgetEnabled: true,
          syncWidgetOpacity: 0.8,
          selectedKeys: [],
          syncInitialized: false,
          lastSync: 0,
          hideUnsynced: false,
          ftWarningDismissed: false,
          ...settings,
        };
      }
      // Return defaults
      return {
        sheetUrl: "",
        syncEnabled: false,
        syncInterval: 60,
        syncWidgetEnabled: true,
        syncWidgetOpacity: 0.8,
        selectedKeys: [],
        syncInitialized: false,
        lastSync: 0,
        hideUnsynced: false,
        ftWarningDismissed: false,
      };
    }

    // Save individual setting
    saveSetting(key, value) {
      const settings = this.getSettings();
      settings[key] = value;
      this.setItem(this.settingsKey, settings);
    }

    // Reset all sync settings
    resetSettings() {
      this.removeItem(this.settingsKey);
      this.removeItem("pendingChanges");
      this.removeItem("writeTimestamps");
      this.removeItem("lastSyncSnapshot");
    }
  }

  // ============================================================================
  // REMOTE SYNC MANAGER
  // ============================================================================

  class RemoteSyncManager {
    constructor(storageManager) {
      this.storage = storageManager;
      this.isOnline = navigator.onLine;
      this.isSyncing = false;
      this.syncTimer = null;
      this.countdownTimer = null;
      this.widget = null;
      this.syncBadge = null;
      this.timeUntilNextSync = 0;
      this.settings = this.storage.getSettings();
    }

    init() {
      // Initialize pending changes if not exists
      if (!this.storage.getItem("pendingChanges")) {
        this.storage.setItem("pendingChanges", { operations: [] });
      }

      // Register event listeners
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
      document.addEventListener("visibilitychange", () =>
        this.handleVisibilityChange(),
      );

      // Detect cross-tab/cross-script localStorage changes in real time
      // This catches userscripts (e.g. ao3_advanced_blocker) writing to localStorage
      // on other tabs without going through addPendingChange
      window.addEventListener("storage", (e) => {
        if (!this.settings.syncInitialized) return;
        if (!e.key || e.key.startsWith("SS_")) return;
        if (!(this.settings.selectedKeys || []).includes(e.key)) return;
        if (e.newValue === null) return; // deletion, not an update
        this.addPendingChange(e.key, e.newValue);
        console.log(
          "[AO3: Script Sync] Detected cross-tab storage change for key:",
          e.key,
        );
      });

      // Queue any local changes made since the last sync
      // (catches changes from previous page loads, e.g. config saved by ao3_advanced_blocker)
      if (this.settings.syncInitialized) {
        const snapshot = this.storage.getItem("lastSyncSnapshot", {});
        const writeTimestamps = this.storage.getItem("writeTimestamps", {});
        let timestampsCleared = false;
        (this.settings.selectedKeys || []).forEach((key) => {
          if (key.startsWith("SS_")) return;
          const current = localStorage.getItem(key);
          if (current === null) return;
          // Detect and repair corrupted values written by old client when new backend was first deployed
          if (current === "[object Object]") {
            console.warn(
              "[AO3: Script Sync] Detected corrupted localStorage value for key:",
              key,
              "— will restore from server on next sync",
            );
            localStorage.removeItem(key);
            delete writeTimestamps[key];
            timestampsCleared = true;
            return;
          }
          if (current !== snapshot[key]) {
            this.addPendingChange(key, current);
            console.log(
              "[AO3: Script Sync] Queued startup local change for key:",
              key,
            );
          }
        });
        if (timestampsCleared) {
          this.storage.setItem("writeTimestamps", writeTimestamps);
        }
      }

      // Start sync timer if enabled
      if (this.settings.syncEnabled) {
        this.startSyncTimer();
      }

      // Render widget if enabled
      if (this.settings.syncWidgetEnabled) {
        this.renderWidget();
      }
    }

    renderWidget() {
      // Widget creation is handled by updateWidget
      this.updateWidget("normal");
    }

    removeWidget() {
      if (this.widget) {
        this.widget.remove();
        this.widget = null;
        this.syncBadge = null;
      }
    }

    updateWidget(state = "normal") {
      if (!this.settings.syncWidgetEnabled || !this.settings.syncInitialized)
        return;

      // Create widget if it doesn't exist
      if (!this.widget) {
        const mobile = window.innerWidth <= 768;

        document.body.insertAdjacentHTML(
          "beforeend",
          `
                    <div id="ss-sync-widget" style="position:fixed;bottom:15px;left:10px;z-index:10000;display:flex;align-items:center;opacity:${this.settings.syncWidgetOpacity};gap:${mobile ? "2px" : "4px"};padding:${mobile ? "2px 3px" : "3px 5px"};background:#fff;border:1px solid #ddd;border-radius:${mobile ? "10px" : "16px"};cursor:pointer;font:${mobile ? "11px" : "12px"} -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#666;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:all 0.2s;user-select:none">
                        <svg width="${mobile ? "12" : "14"}" height="${mobile ? "12" : "14"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.3s">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        <span style="font-weight:500;">Sync</span>
                        <span id="ss-sync-badge" style="display:none;background:#ff9800;color:white;border-radius:6px;padding:1px ${mobile ? "3px" : "5px"};font-size:${mobile ? "9px" : "10px"};font-weight:bold;margin-left:2px">0</span>
                    </div>
                `,
        );

        this.widget = document.getElementById("ss-sync-widget");
        this.syncBadge = document.getElementById("ss-sync-badge");

        // Add spin animation if not exists
        if (!document.getElementById("ss-spin")) {
          document.head.insertAdjacentHTML(
            "beforeend",
            '<style id="ss-spin">@keyframes ss-spin{to{transform:rotate(360deg)}}</style>',
          );
        }

        // Click handler
        this.widget.onclick = () =>
          this.isOnline && !this.isSyncing && this.performSync();

        // Hover effects
        this.widget.onmouseenter = () =>
          !this.isSyncing &&
          Object.assign(this.widget.style, {
            opacity: "1",
            background: "#f8f9fa",
            borderColor: "#0066cc",
            transform: "translateY(-1px)",
          });
        this.widget.onmouseleave = () => {
          this.widget.style.opacity = this.settings.syncWidgetOpacity;
          this.updateWidget(this.isSyncing ? "syncing" : "normal");
        };
      }

      // Update badge based on pending count
      const pendingCount = this.getPendingChanges().operations.length;
      if (pendingCount > 0) {
        this.syncBadge.style.display = "inline-block";
        this.syncBadge.textContent = pendingCount;
      } else {
        this.syncBadge.style.display = "none";
      }

      // Update widget based on state
      const states = {
        normal: [
          "#fff",
          "#ddd",
          "#666",
          "none",
          "pointer",
          this.timeUntilNextSync <= 0
            ? "Sync now"
            : this.timeUntilNextSync > 60
              ? `${Math.floor(this.timeUntilNextSync / 60)}m ${this.timeUntilNextSync % 60}s`
              : `${this.timeUntilNextSync}s`,
        ],
        syncing: [
          "#e3f2fd",
          "#2196f3",
          "#1976d2",
          "ss-spin 1s linear infinite",
          "default",
          "Syncing...",
        ],
        success: [
          "#e8f5e8",
          "#4caf50",
          "#2e7d32",
          "none",
          "pointer",
          "Synced!",
        ],
        error: ["#ffebee", "#f44336", "#c62828", "none", "pointer", "Failed"],
        offline: ["#f5f5f5", "#ccc", "#999", "none", "default", "Offline"],
      };

      const [bg, border, color, animation, cursor, text] =
        states[state] || states.normal;
      const [icon, textEl, badge] = this.widget.children;

      Object.assign(this.widget.style, {
        background: bg,
        borderColor: border,
        cursor,
      });
      Object.assign(icon.style, {
        animation,
        color,
      });
      textEl.textContent = text;
      textEl.style.color = color;

      // Auto-revert success to normal
      if (state === "success") {
        setTimeout(() => this.updateWidget("normal"), 2000);
      }
    }

    updateCountdown() {
      // Decrement timeUntilNextSync and update widget
      if (this.timeUntilNextSync > 0) {
        this.timeUntilNextSync--;
      }
      this.updateWidget("normal");
    }

    startSyncTimer() {
      this.stopSyncTimer();

      const now = Date.now();
      const lastSync = this.settings.lastSync;
      const syncInterval = this.settings.syncInterval * 1000;
      const timeSinceLastSync = now - lastSync;

      if (timeSinceLastSync >= syncInterval) {
        // Sync immediately, then start interval
        this.timeUntilNextSync = 0;
        this.performSync();
        this.syncTimer = setInterval(() => this.performSync(), syncInterval);
      } else {
        // Wait for remaining time, then start interval
        const timeUntilNextSync = syncInterval - timeSinceLastSync;
        this.timeUntilNextSync = Math.ceil(timeUntilNextSync / 1000);
        setTimeout(() => {
          this.performSync();
          this.syncTimer = setInterval(() => this.performSync(), syncInterval);
        }, timeUntilNextSync);
      }

      // Start countdown update timer (every second)
      if (this.settings.syncWidgetEnabled) {
        this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);
      }
    }

    stopSyncTimer() {
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }

    handleVisibilityChange() {
      if (document.visibilityState === "visible" && this.settings.syncEnabled) {
        this.startSyncTimer();
      } else {
        this.stopSyncTimer();
      }
    }

    handleOnline() {
      this.isOnline = true;
      if (this.settings.syncEnabled) {
        this.performSync();
      }
    }

    handleOffline() {
      this.isOnline = false;
      this.updateWidget("offline");
    }

    addPendingChange(key, value) {
      const timestamp = Date.now();

      // Record local write timestamp for conflict resolution
      const writeTimestamps = this.storage.getItem("writeTimestamps", {});
      writeTimestamps[key] = timestamp;
      this.storage.setItem("writeTimestamps", writeTimestamps);

      // Deduplicate: replace existing pending entry for this key rather than appending
      const pendingChanges = this.getPendingChanges();
      const existingIndex = pendingChanges.operations.findIndex(
        (op) => op.key === key,
      );
      const operation = { key, value, timestamp };
      if (existingIndex >= 0) {
        pendingChanges.operations[existingIndex] = operation;
      } else {
        pendingChanges.operations.push(operation);
      }
      this.storage.setItem("pendingChanges", pendingChanges);

      if (this.widget) {
        this.updateWidget("normal");
      }
    }

    getPendingChanges() {
      return this.storage.getItem("pendingChanges", { operations: [] });
    }

    clearPendingChanges() {
      this.storage.setItem("pendingChanges", { operations: [] });
    }

    async performSync() {
      if (!this.isOnline) {
        console.log("[AO3: Script Sync] Offline, skipping sync");
        return;
      }

      if (this.isSyncing) {
        console.log("[AO3: Script Sync] Already syncing, skipping");
        return;
      }

      if (!this.settings.sheetUrl || !this.settings.syncInitialized) {
        console.log("[AO3: Script Sync] Not initialized, skipping sync");
        return;
      }

      this.isSyncing = true;
      this.updateWidget("syncing");

      try {
        // Flush any pending enabled-keys update that previously failed
        const pendingEnabledKeys = this.storage.getItem(
          "pendingEnabledKeysUpdate",
        );
        if (pendingEnabledKeys !== null) {
          try {
            await this.sendSyncRequest({
              action: "update_enabled_keys",
              enabledKeys: pendingEnabledKeys,
            });
            this.storage.removeItem("pendingEnabledKeysUpdate");
            console.log("[AO3: Script Sync] Flushed pending enabled keys update");
          } catch (keysError) {
            console.error(
              "[AO3: Script Sync] Failed to flush pending enabled keys, will retry next sync:",
              keysError,
            );
          }
        }

        // Detect local changes that weren't explicitly queued
        // (e.g. a userscript updated localStorage directly since last sync)
        const snapshot = this.storage.getItem("lastSyncSnapshot", {});
        const pendingChanges = this.getPendingChanges();
        const alreadyQueued = new Set(
          pendingChanges.operations.map((op) => op.key),
        );
        const writeTimestamps = this.storage.getItem("writeTimestamps", {});
        let writeTimestampsChanged = false;
        const enabledKeys = this.settings.selectedKeys || [];
        enabledKeys.forEach((key) => {
          if (key.startsWith("SS_")) return;
          if (alreadyQueued.has(key)) return;
          const current = localStorage.getItem(key);
          if (current !== null && current !== snapshot[key]) {
            const timestamp = Date.now();
            writeTimestamps[key] = timestamp;
            writeTimestampsChanged = true;
            pendingChanges.operations.push({ key, value: current, timestamp });
            console.log(
              "[AO3: Script Sync] Detected unqueued local change for key:",
              key,
            );
          }
        });
        if (writeTimestampsChanged) {
          this.storage.setItem("writeTimestamps", writeTimestamps);
        }

        // Send sync request
        const response = await this.sendSyncRequest({
          action: "sync",
          queue: pendingChanges,
        });

        if (response.data && response.data.success) {
          // Update local storage with server data
          this.updateLocalStorage(response.data.storage_data);

          // Save snapshot of all enabled key values after sync
          const newSnapshot = {};
          (this.settings.selectedKeys || []).forEach((key) => {
            const val = localStorage.getItem(key);
            if (val !== null) newSnapshot[key] = val;
          });
          this.storage.setItem("lastSyncSnapshot", newSnapshot);

          // Reconcile enabled keys: server is source of truth
          if (Array.isArray(response.data.enabled_keys)) {
            const serverKeys = response.data.enabled_keys;
            const localKeys = this.settings.selectedKeys || [];
            const isDifferent =
              serverKeys.length !== localKeys.length ||
              serverKeys.some((k) => !localKeys.includes(k)) ||
              localKeys.some((k) => !serverKeys.includes(k));
            if (isDifferent) {
              this.settings.selectedKeys = serverKeys;
              this.storage.saveSetting("selectedKeys", serverKeys);
              console.log(
                "[AO3: Script Sync] Reconciled selectedKeys from server:",
                serverKeys,
              );
            }
          }

          // Clear pending changes
          this.clearPendingChanges();

          // Update last sync timestamp
          this.settings.lastSync = Date.now();
          this.storage.saveSetting("lastSync", this.settings.lastSync);

          // Reset countdown
          this.timeUntilNextSync = this.settings.syncInterval;

          this.updateWidget("success");
          console.log("[AO3: Script Sync] Sync successful");
        } else {
          throw new Error("Sync response indicates failure");
        }
      } catch (error) {
        console.error("[AO3: Script Sync] Sync error:", error);
        this.updateWidget("error");
      } finally {
        this.isSyncing = false;
      }
    }

    sendSyncRequest(data) {
      return new Promise((resolve, reject) => {
        console.log(
          "[AO3: Script Sync] Sending request:",
          data.action,
          "to",
          this.settings.sheetUrl,
        );

        GM_xmlhttpRequest({
          method: "POST",
          url: this.settings.sheetUrl,
          headers: { "Content-Type": "application/json" },
          anonymous: true,
          data: JSON.stringify(data),
          timeout: 30000, // Increased to 30 seconds for initialization
          onload: (response) => {
            console.log(
              "[AO3: Script Sync] Response status:",
              response.status,
              "Response text:",
              response.responseText.substring(0, 200),
            );
            try {
              const jsonResponse = JSON.parse(response.responseText);
              if (jsonResponse.status === "success") {
                resolve(jsonResponse);
              } else {
                reject(
                  new Error(jsonResponse.error?.message || "Unknown error"),
                );
              }
            } catch (e) {
              console.error("[AO3: Script Sync] Failed to parse response:", e);
              reject(
                new Error(
                  "Invalid JSON response: " +
                    response.responseText.substring(0, 100),
                ),
              );
            }
          },
          onerror: (error) => {
            console.error("[AO3: Script Sync] Request error:", error);
            reject(new Error("Network error: " + (error.error || error)));
          },
          ontimeout: () => {
            console.error("[AO3: Script Sync] Request timeout after 30 seconds");
            reject(new Error("Request timeout (30s)"));
          },
        });
      });
    }

    updateLocalStorage(serverData) {
      if (!serverData || typeof serverData !== "object") return;

      const writeTimestamps = this.storage.getItem("writeTimestamps", {});
      let timestampsChanged = false;

      for (const key in serverData) {
        if (!serverData.hasOwnProperty(key)) continue;
        // Never overwrite Script Sync internal keys from server data
        if (key.startsWith("SS_")) continue;

        const entry = serverData[key];
        const serverValue =
          typeof entry === "object" && entry !== null ? entry.value : entry;
        const serverTimestamp =
          typeof entry === "object" && entry !== null
            ? entry.timestamp || 0
            : 0;
        const localTimestamp = writeTimestamps[key] || 0;

        // Skip corrupted values (written by old client when backend was first updated)
        if (
          serverValue === null ||
          serverValue === undefined ||
          serverValue === "[object Object]"
        ) {
          console.warn(
            "[AO3: Script Sync] Skipping corrupted server value for key:",
            key,
          );
          continue;
        }

        // Only apply server value if it is newer than the last local write
        if (serverTimestamp >= localTimestamp) {
          localStorage.setItem(key, serverValue);
          writeTimestamps[key] = serverTimestamp;
          timestampsChanged = true;
        } else {
          console.log(
            "[AO3: Script Sync] Keeping local value for key (local is newer):",
            key,
          );
        }
      }

      if (timestampsChanged) {
        this.storage.setItem("writeTimestamps", writeTimestamps);
      }

      console.log("[AO3: Script Sync] Local storage updated with server data");
    }

    destroy() {
      this.stopSyncTimer();
      this.removeWidget();
    }
  }

  // ============================================================================
  // UI MANAGER
  // ============================================================================

  class UIManager {
    constructor(storageManager, remoteSyncManager) {
      this.storage = storageManager;
      this.syncManager = remoteSyncManager;
      this.menuInjected = false;
      this.countdownInterval = null;
    }

    injectMenu() {
      // Only show on the AO3 homepage
      if (window.location.pathname !== "/") return;

      if (this.menuInjected) return;
      // Guard against duplicate injection when multiple instances run (e.g. script installed twice)
      if (q("#ss-open-storage")) return;

      // Create or find userscripts menu
      if (qa("#scriptconfig").length === 0) {
        const searchLi = q('#header nav[aria-label="Site"] li.search');
        if (searchLi) {
          ins(
            searchLi,
            "beforebegin",
            `
                        <li class="dropdown" id="scriptconfig">
                            <a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a>
                            <ul class="menu dropdown-menu"></ul>
                        </li>
                    `,
          );
        }
      }

      // Add menu item
      const dropdown = q("#scriptconfig .dropdown-menu");
      if (dropdown) {
        ins(
          dropdown,
          "beforeend",
          `
                    <li>
                        <a href="#" id="ss-open-storage">Script Sync</a>
                    </li>
                `,
        );

        // Add click handlers
        q("#ss-open-storage").addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleStorageView();
        });
      }

      this.menuInjected = true;
    }

    toggleStorageView() {
      const container = q("#ss-container");

      if (container) {
        this.hideStorageView();
      } else {
        this.showStorageView();
      }
    }

    showStorageView() {
      const settings = this.storage.getSettings();
      const stdContent = q("div.splash");

      if (stdContent) {
        stdContent.style.display = "none";
      }

      // Get all localStorage items
      const storageList = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key === "accepted_tos") continue;
        storageList.push([
          key,
          localStorage.getItem(key),
          this.getScriptSource(key),
        ]);
      }

      // Sort by key name
      storageList.sort((a, b) => a[0].localeCompare(b[0]));

      let html = `<div id="ss-container">`;

      if (storageList.length > 0) {
        html += `
                    <h2>Script Sync 🔄</h2>
                    <p>Toggle sync for keys you want to sync across devices. Use checkboxes to select keys for export or deletion.</p>
                    <p>
                        <input type="submit" value="${settings.hideUnsynced ? "Show All" : "Hide Un-synced"}" id="ss-toggle-unsynced">
                        <input type="submit" value="Select All" id="ss-select-all">
                        <input type="submit" value="Select None" id="ss-select-none">
                        <input type="submit" value="Export" id="ss-export">
                        <input type="submit" value="Import" id="ss-import">
                        <input type="submit" value="Delete" id="ss-delete">
                        <input type="file" accept="application/json" id="ss-import-file" style="display:none">
                    </p>
                    <table id="ss-storagelist">
                        <thead>
                            <tr>
                                <th>Select</th>
                                <th>Sync</th>
                                <th>Key</th>
                                <th>Source</th>
                                <th>Content Preview</th>
                                <th>Length</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

        storageList.forEach(([key, value, source]) => {
          const isSelected = settings.selectedKeys.includes(key);
          const isFicTrackerKey = key.startsWith("FT_");
          const isScriptSyncKey = key.startsWith("SS_");
          const preview =
            value.length > 50 ? value.slice(0, 50) + "..." : value;
          const rowClasses = [];
          if (isFicTrackerKey) rowClasses.push("ss-ft-warning-row");
          if (isScriptSyncKey) rowClasses.push("ss-internal-row");
          if (!isSelected || isScriptSyncKey) {
            rowClasses.push("ss-unsynced-row");
            if (settings.hideUnsynced) rowClasses.push("ss-row-hidden");
          }
          const rowClass =
            rowClasses.length > 0 ? ` class="${rowClasses.join(" ")}"` : "";
          const warningIcon = isFicTrackerKey
            ? "⚠️ "
            : isScriptSyncKey
              ? "🔧 "
              : "";
          const toggleTitle = isFicTrackerKey
            ? ' title="FicTracker data should use FicTracker\'s built-in sync for best results"'
            : isScriptSyncKey
              ? ' title="Script Sync internal data - not syncable"'
              : "";
          const toggleDisabled = isScriptSyncKey ? " disabled" : "";

          html += `
                        <tr${rowClass}>
                            <td><input type="checkbox" class="ss-select-check" data-key="${escapeHTML(key)}"></td>
                            <td>
                                <label class="ss-sync-toggle"${toggleTitle}>
                                    <input type="checkbox" class="ss-sync-check" data-key="${escapeHTML(key)}" ${isSelected ? "checked" : ""}${toggleDisabled}>
                                    <span class="ss-toggle-slider"></span>
                                </label>
                            </td>
                            <td class="ss-storage-key">${warningIcon}${escapeHTML(key)}</td>
                            <td>${source}</td>
                            <td>${escapeHTML(preview)}</td>
                            <td style="text-align: right;">${value.length} char${value.length === 1 ? "" : "s"}</td>
                        </tr>
                    `;
        });

        html += `</tbody></table>`;
      } else {
        html += `<h2>Script Sync</h2><p>No localStorage data found for AO3 userscripts.</p>`;
      }

      // Add settings sections
      html += this.getSettingsSectionsHTML(settings);

      html += `</div>`;

      // Insert into page
      if (stdContent) {
        ins(stdContent, "beforebegin", html);
      } else {
        ins(q("body"), "beforeend", html);
      }

      // Setup event listeners
      this.setupEventListeners();
    }

    getSettingsSectionsHTML(settings) {
      const isInitialized = settings.syncInitialized;
      const urlDisabled = isInitialized ? "disabled" : "";
      const initDisabled =
        !settings.sheetUrl || isInitialized ? "disabled" : "";

      // Format last sync time
      const lastSyncTime = settings.lastSync
        ? new Date(settings.lastSync).toLocaleString()
        : "Never";

      // Calculate next sync countdown
      let nextSyncText = "";
      if (settings.syncEnabled && isInitialized) {
        const now = Date.now();
        const timeSinceLastSync = now - settings.lastSync;
        const syncInterval = settings.syncInterval * 1000;
        const timeUntilNextSync = Math.max(0, syncInterval - timeSinceLastSync);
        const secondsRemaining = Math.ceil(timeUntilNextSync / 1000);
        nextSyncText = `Next sync in ${secondsRemaining}s`;
      }

      let html = `
                <br>`;

      if (!settings.ftWarningDismissed) {
        html += `
                <div class="required notice" id="ss-ft-notice">
                    <span class="ss-ft-notice-close" id="ss-ft-notice-close">&times;</span>
                    <strong>⚠️ Important: FicTracker Users</strong><br>
                    FicTracker has its own optimized cloud sync built-in. For best results with FicTracker data (<code>FT_*</code> keys), 
                    use FicTracker's Google Sheets sync instead of Script Sync. FicTracker's sync includes conflict resolution and 
                    data-aware merging that Script Sync cannot provide.
                </div>`;
      }

      html += `
                <fieldset>
                    <legend>
                        Google Sheet Storage
                        <a href="https://github.com/Wolfbatcat/ao3-script-sync" target="_blank">[Setup Guide]</a>
                    </legend>
                    <ul>
            `;

      if (isInitialized) {
        html += `
                        <li>
                            <label>
                                <input type="checkbox" id="ss-sync-enabled" ${settings.syncEnabled ? "checked" : ""}>
                                Enable automatic sync
                            </label>
                        </li>
                        <li>
                            <label title="Show a floating sync status indicator with countdown timer and manual sync button">
                                <input type="checkbox" id="ss-widget-enabled" ${settings.syncWidgetEnabled ? "checked" : ""}>
                                Show sync status widget
                            </label>
                        </li>
                `;
      }

      html += `
                        <li>
                            <label for="ss-sheet-url">Google Script URL:</label>
                            <input type="text" id="ss-sheet-url" size="60" value="${escapeHTML(settings.sheetUrl)}" ${urlDisabled}
                                   placeholder="https://script.google.com/macros/s/.../exec">
                        </li>
            `;

      if (isInitialized) {
        html += `
                        <li>
                            <label for="ss-sync-interval">Sync interval:</label>
                            <input type="range" id="ss-sync-interval" min="60" max="3600" step="60" value="${settings.syncInterval}" style="width: 200px; margin-right: 10px;">
                            <strong><span id="ss-interval-value">${settings.syncInterval} seconds</span></strong>
                        </li>
                        <li>
                            <strong><label>Last sync:</label>
                            <span id="ss-last-sync-time">${lastSyncTime}</span>
                            <br>
                            <span id="ss-next-sync-countdown">${nextSyncText}</span></strong>
                        </li>
                `;

        // Only show widget opacity if widget is enabled
        if (settings.syncWidgetEnabled) {
          html += `
                        <li>
                            <label for="ss-widget-opacity">Widget Opacity: </label>
                            <input type="range" id="ss-widget-opacity" min="0.3" max="1" step="0.1" value="${settings.syncWidgetOpacity}" style="width: 200px; margin-right: 10px;">
                            <strong><span id="ss-opacity-value">${settings.syncWidgetOpacity}</span></strong>
                        </li>
                    `;
        }

        html += `
                `;
      }

      html += `
                        <li id="ss-connection-status"></li>
                        <li>
            `;

      if (!isInitialized) {
        html += `
                            <input type="submit" value="Test Connection" id="ss-test-connection" ${urlDisabled}>
                            <input type="submit" value="Initialize" id="ss-initialize" ${initDisabled}>
                            ${settings.sheetUrl ? '<input type="submit" value="Clear Server Data" id="ss-clear-server">' : ""}
                `;
      } else {
        html += `
                            <input type="submit" value="Test Connection" id="ss-test-connection">
                            <input type="submit" value="Sync Now" id="ss-sync-now">
                            <input type="submit" value="Change URL" id="ss-change-url">
                            <input type="submit" value="Reset Sync Settings" id="ss-reset">
                `;
      }

      html += `
                        </li>
                    </ul>
                </fieldset>
            `;

      return html;
    }

    setupEventListeners() {
      // Toggle un-synced rows visibility
      const toggleUnsyncedBtn = q("#ss-toggle-unsynced");
      if (toggleUnsyncedBtn) {
        toggleUnsyncedBtn.addEventListener("click", () => {
          const unsyncedRows = qa(".ss-unsynced-row");
          const isHiding =
            !unsyncedRows[0]?.classList.contains("ss-row-hidden");

          unsyncedRows.forEach((row) => {
            if (isHiding) {
              row.classList.add("ss-row-hidden");
            } else {
              row.classList.remove("ss-row-hidden");
            }
          });

          toggleUnsyncedBtn.value = isHiding ? "Show All" : "Hide Unused";

          // Save preference
          this.storage.saveSetting("hideUnsynced", isHiding);
        });
      }

      // FicTracker warning close button
      const ftNoticeClose = q("#ss-ft-notice-close");
      if (ftNoticeClose) {
        ftNoticeClose.addEventListener("click", () => {
          const notice = q("#ss-ft-notice");
          if (notice) {
            notice.remove();
            this.storage.saveSetting("ftWarningDismissed", true);
          }
        });
      }

      // Select all/none buttons (for selection checkboxes)
      const selectAll = q("#ss-select-all");
      if (selectAll) {
        selectAll.addEventListener("click", () => {
          qa(".ss-select-check").forEach((cb) => (cb.checked = true));
        });
      }

      const selectNone = q("#ss-select-none");
      if (selectNone) {
        selectNone.addEventListener("click", () => {
          qa(".ss-select-check").forEach((cb) => (cb.checked = false));
        });
      }

      // Sync toggle auto-save
      qa(".ss-sync-check").forEach((toggle) => {
        toggle.addEventListener("change", (e) => this.handleSyncToggle(e));
      });

      // Export/Import
      const exportBtn = q("#ss-export");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => this.exportData());
      }

      const importBtn = q("#ss-import");
      if (importBtn) {
        importBtn.addEventListener("click", () => q("#ss-import-file").click());
      }

      const importFile = q("#ss-import-file");
      if (importFile) {
        importFile.addEventListener("change", (e) => this.importData(e));
      }

      // Delete
      const deleteBtn = q("#ss-delete");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", () => this.deleteData());
      }

      // Connection test
      const testBtn = q("#ss-test-connection");
      if (testBtn) {
        testBtn.addEventListener("click", () => this.testConnection());
      }

      // Initialize
      const initBtn = q("#ss-initialize");
      if (initBtn) {
        initBtn.addEventListener("click", () => this.initializeSync());
      }

      // Reset
      const resetBtn = q("#ss-reset");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => this.resetSync());
      }

      // Clear server data
      const clearServerBtn = q("#ss-clear-server");
      if (clearServerBtn) {
        clearServerBtn.addEventListener("click", () => this.clearServerData());
      }

      // Sync enabled toggle
      const syncEnabled = q("#ss-sync-enabled");
      if (syncEnabled) {
        syncEnabled.addEventListener("change", (e) => {
          this.storage.saveSetting("syncEnabled", e.target.checked);
          if (e.target.checked) {
            this.syncManager.settings.syncEnabled = true;
            this.syncManager.startSyncTimer();
            this.startCountdownUpdater();
          } else {
            this.syncManager.settings.syncEnabled = false;
            this.syncManager.stopSyncTimer();
            this.stopCountdownUpdater();
          }
        });
      }

      // Widget enabled toggle
      const widgetEnabled = q("#ss-widget-enabled");
      if (widgetEnabled) {
        widgetEnabled.addEventListener("change", (e) => {
          this.storage.saveSetting("syncWidgetEnabled", e.target.checked);
          this.syncManager.settings.syncWidgetEnabled = e.target.checked;
          if (e.target.checked) {
            this.syncManager.renderWidget();
          } else {
            this.syncManager.removeWidget();
          }
          // Refresh the view to show/hide opacity slider
          this.hideStorageView();
          this.showStorageView();
        });
      }

      // Widget opacity slider
      const opacitySlider = q("#ss-widget-opacity");
      if (opacitySlider) {
        opacitySlider.addEventListener("input", (e) => {
          q("#ss-opacity-value").textContent = e.target.value;
          if (this.syncManager.widget) {
            this.syncManager.widget.style.opacity = e.target.value;
          }
        });
        opacitySlider.addEventListener("change", (e) => {
          const opacity = parseFloat(e.target.value);
          this.storage.saveSetting("syncWidgetOpacity", opacity);
          this.syncManager.settings.syncWidgetOpacity = opacity;
        });
      }

      // Sync interval slider
      const intervalSlider = q("#ss-sync-interval");
      if (intervalSlider) {
        intervalSlider.addEventListener("input", (e) => {
          q("#ss-interval-value").textContent = e.target.value + " seconds";
        });
        intervalSlider.addEventListener("change", (e) => {
          const interval = parseInt(e.target.value);
          this.storage.saveSetting("syncInterval", interval);
          this.syncManager.settings.syncInterval = interval;
          if (this.syncManager.settings.syncEnabled) {
            this.syncManager.startSyncTimer();
          }
        });
      }

      // Start countdown updater if initialized and enabled
      const settings = this.storage.getSettings();
      if (settings.syncInitialized && settings.syncEnabled) {
        this.startCountdownUpdater();
      }

      // Change URL
      const changeUrlBtn = q("#ss-change-url");
      if (changeUrlBtn) {
        changeUrlBtn.addEventListener("click", () => this.changeUrl());
      }

      // Sync now
      const syncNow = q("#ss-sync-now");
      if (syncNow) {
        syncNow.addEventListener("click", () => this.performManualSync());
      }
    }

    async performManualSync() {
      const syncBtn = q("#ss-sync-now");
      const originalText = syncBtn ? syncBtn.value : "";

      if (syncBtn) {
        syncBtn.value = "Syncing...";
        syncBtn.disabled = true;
      }

      try {
        await this.syncManager.performSync();

        // Show success on button
        if (syncBtn) {
          syncBtn.value = "✓ Synced";
          setTimeout(() => {
            syncBtn.value = originalText;
            syncBtn.disabled = false;
          }, 2000);
        }
      } catch (error) {
        if (syncBtn) {
          syncBtn.value = "✗ Failed";
          setTimeout(() => {
            syncBtn.value = originalText;
            syncBtn.disabled = false;
          }, 2000);
        }
      }
    }

    handleSyncToggle(event) {
      // Auto-save when sync toggle changes
      const oldSelectedKeys = this.storage.getSettings().selectedKeys;
      const selectedKeys = [];
      qa(".ss-sync-check:checked").forEach((cb) => {
        selectedKeys.push(cb.dataset.key);
      });

      this.storage.saveSetting("selectedKeys", selectedKeys);
      this.syncManager.settings.selectedKeys = selectedKeys;

      // Update row classes for un-synced visibility
      const toggledCheckbox = event.target;
      const row = toggledCheckbox.closest("tr");
      if (row) {
        if (toggledCheckbox.checked) {
          row.classList.remove("ss-unsynced-row");
        } else {
          row.classList.add("ss-unsynced-row");
          // If currently hiding un-synced rows, hide this one too
          const settings = this.storage.getSettings();
          if (settings.hideUnsynced) {
            row.classList.add("ss-row-hidden");
          }
        }
      }

      // If already initialized, update server
      if (this.storage.getSettings().syncInitialized) {
        // Find newly enabled keys
        const newlyEnabledKeys = selectedKeys.filter(
          (key) => !oldSelectedKeys.includes(key),
        );

        // Add data for newly enabled keys to pending changes
        if (newlyEnabledKeys.length > 0) {
          newlyEnabledKeys.forEach((key) => {
            const value = localStorage.getItem(key);
            if (value !== null) {
              this.syncManager.addPendingChange(key, value);
              console.log(
                "[AO3: Script Sync] Added pending change for newly enabled key:",
                key,
              );
            }
          });
        }

        this.updateServerEnabledKeys(selectedKeys);
      }
    }

    async updateServerEnabledKeys(keys) {
      try {
        const response = await this.syncManager.sendSyncRequest({
          action: "update_enabled_keys",
          enabledKeys: keys,
        });
        // Clear any previously queued retry
        this.storage.removeItem("pendingEnabledKeysUpdate");
        this.showStatus("Sync keys updated on server", "success");
        console.log("[AO3: Script Sync] Server enabled keys updated");
      } catch (error) {
        // Queue for retry on next sync
        this.storage.setItem("pendingEnabledKeysUpdate", keys);
        this.showStatus(
          "Failed to update sync keys on server — click sync to retry",
          "error",
        );
        console.error(
          "[AO3: Script Sync] Failed to update server enabled keys:",
          error,
        );
      }
    }

    exportData() {
      const selectedKeys = [];
      qa(".ss-select-check:checked").forEach((cb) => {
        selectedKeys.push(cb.dataset.key);
      });

      if (selectedKeys.length === 0) {
        alert("Please select at least one key to export.");
        return;
      }

      const exportData = [];
      selectedKeys.forEach((key) => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          exportData.push([key, value]);
        }
      });

      const blob = new Blob([JSON.stringify(exportData)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ao3-script-storage-${new Date().toISOString().replace(/[^\d\w]/g, "")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    importData(event) {
      const file = event.target.files[0];
      if (!file) return;

      if (file.type !== "application/json") {
        alert("Invalid file type. Please select a JSON file.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (
            !Array.isArray(data) ||
            data.length < 1 ||
            !data.every((item) => Array.isArray(item) && item.length === 2)
          ) {
            alert("Invalid file format. Please select a valid export file.");
            return;
          }

          const settings = this.storage.getSettings();
          let syncedKeysCount = 0;

          data.forEach(([key, value]) => {
            localStorage.setItem(key, value);

            // If this key is being synced and sync is initialized, queue it for upload
            if (
              settings.syncInitialized &&
              settings.selectedKeys.includes(key)
            ) {
              this.syncManager.addPendingChange(key, value);
              syncedKeysCount++;
              console.log("[AO3: Script Sync] Queued imported key for sync:", key);
            }
          });

          let message = `Successfully imported ${data.length} item${data.length === 1 ? "" : "s"}!`;

          // If any synced keys were imported, trigger upload
          if (syncedKeysCount > 0) {
            message += `\n\n${syncedKeysCount} synced key${syncedKeysCount === 1 ? "" : "s"} will be uploaded to the server.`;

            // Auto-trigger sync to upload changes
            setTimeout(() => {
              console.log("[AO3: Script Sync] Auto-triggering sync after import");
              this.syncManager.performSync();
            }, 1000);
          }

          alert(message);
          this.hideStorageView();
          this.showStorageView(); // Refresh
        } catch (error) {
          alert("Error parsing file: " + error.message);
        }
      };
      reader.readAsText(file);
    }

    deleteData() {
      const selectedKeys = [];
      qa(".ss-select-check:checked").forEach((cb) => {
        selectedKeys.push(cb.dataset.key);
      });

      if (selectedKeys.length === 0) {
        alert("Please select at least one key to delete.");
        return;
      }

      const confirmMsg = `Are you sure you want to delete ${selectedKeys.length} selected item${selectedKeys.length === 1 ? "" : "s"} from localStorage?\n\nThis action cannot be undone.`;
      if (!confirm(confirmMsg)) {
        return;
      }

      selectedKeys.forEach((key) => {
        localStorage.removeItem(key);
      });

      this.hideStorageView();
      this.showStorageView(); // Refresh
    }

    async testConnection() {
      const urlInput = q("#ss-sheet-url");
      const url = urlInput.value.trim();
      const testBtn = q("#ss-test-connection");

      if (!url) {
        this.showStatus("Please enter a Google Apps Script URL.", "error");
        return;
      }

      if (!url.startsWith("https://script.google.com/macros/s/")) {
        this.showStatus(
          "Invalid URL format. Must start with https://script.google.com/macros/s/",
          "error",
        );
        return;
      }

      // Update button state
      const originalText = testBtn ? testBtn.value : "";
      if (testBtn) {
        testBtn.value = "Testing...";
        testBtn.disabled = true;
      }
      this.showStatus("Testing connection...", "loading");

      try {
        const response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: url + "?action=ping",
            anonymous: true,
            timeout: 10000,
            onload: (resp) => {
              try {
                const json = JSON.parse(resp.responseText);
                resolve(json);
              } catch (e) {
                reject(
                  new Error(
                    "Invalid JSON response: " +
                      resp.responseText.substring(0, 100),
                  ),
                );
              }
            },
            onerror: () => reject(new Error("Network error")),
            ontimeout: () => reject(new Error("Connection timeout")),
          });
        });

        if (response.status === "success") {
          this.showStatus(
            "Connection successful! You can now initialize the sync.",
            "success",
          );
          this.storage.saveSetting("sheetUrl", url);
          this.syncManager.settings.sheetUrl = url;
          const initBtn = q("#ss-initialize");
          if (initBtn) {
            initBtn.disabled = false;
          }
          // Show success on button
          if (testBtn) {
            testBtn.value = "✓ Connected";
            setTimeout(() => {
              testBtn.value = originalText;
              testBtn.disabled = false;
            }, 2000);
          }
        } else {
          this.showStatus(
            "Connection test failed: " +
              (response.error?.message || "Unknown error"),
            "error",
          );
          if (testBtn) {
            testBtn.value = "✗ Failed";
            setTimeout(() => {
              testBtn.value = originalText;
              testBtn.disabled = false;
            }, 2000);
          }
        }
      } catch (error) {
        this.showStatus("Connection test failed: " + error.message, "error");
        if (testBtn) {
          testBtn.value = "✗ Failed";
          setTimeout(() => {
            testBtn.value = originalText;
            testBtn.disabled = false;
          }, 2000);
        }
      }
    }

    async initializeSync() {
      const settings = this.storage.getSettings();
      let selectedKeys = settings.selectedKeys;
      const initBtn = q("#ss-initialize");

      // Update button state
      const originalText = initBtn ? initBtn.value : "";
      if (initBtn) {
        initBtn.value = "Initializing...";
        initBtn.disabled = true;
      }
      this.showStatus("Connecting to Google Sheet...", "loading");
      console.log("[AO3: Script Sync] Starting initialization");

      try {
        // Step 1: Probe server for existing enabled_keys (non-destructive check)
        this.showStatus("Checking for existing configuration...", "loading");
        let serverProbeResponse;
        let serverEnabledKeys = [];

        try {
          // Send probe with empty requestedKeys to get metadata
          serverProbeResponse = await this.syncManager.sendSyncRequest({
            action: "get_storage",
            requestedKeys: [],
          });

          const serverInitialized =
            serverProbeResponse.data?.initialized || false;
          serverEnabledKeys = serverProbeResponse.data?.enabled_keys || [];
          console.log(
            "[AO3: Script Sync] Server probe: initialized=" +
              serverInitialized +
              ", keys=" +
              serverEnabledKeys.length,
            serverEnabledKeys,
          );

          // If server has enabled keys, adopt them (server is source of truth)
          if (serverInitialized && serverEnabledKeys.length > 0) {
            const serverData = serverProbeResponse.data?.storage_data || {};

            console.log(
              "[AO3: Script Sync] Server already configured with",
              serverEnabledKeys.length,
              "keys. Adopting server configuration.",
            );
            this.showStatus(
              `Found existing configuration with ${serverEnabledKeys.length} key(s). Downloading...`,
              "loading",
            );

            // Download all server data
            const initWriteTimestamps = this.storage.getItem(
              "writeTimestamps",
              {},
            );
            Object.keys(serverData).forEach((key) => {
              const entry = serverData[key];
              const value =
                typeof entry === "object" && entry !== null
                  ? entry.value
                  : entry;
              const ts =
                typeof entry === "object" && entry !== null
                  ? entry.timestamp || 0
                  : 0;
              localStorage.setItem(key, value);
              if (ts) initWriteTimestamps[key] = ts;
              console.log("[AO3: Script Sync] Downloaded key:", key);
            });
            this.storage.setItem("writeTimestamps", initWriteTimestamps);

            // Adopt server's enabled keys list
            selectedKeys = serverEnabledKeys;
            this.storage.saveSetting("selectedKeys", selectedKeys);
            this.syncManager.settings.selectedKeys = selectedKeys;

            // Mark as initialized and enable auto-sync by default
            this.storage.saveSetting("syncInitialized", true);
            this.storage.saveSetting("lastSync", Date.now());
            this.storage.saveSetting("syncEnabled", true);
            this.syncManager.settings.syncInitialized = true;
            this.syncManager.settings.lastSync = Date.now();
            this.syncManager.settings.syncEnabled = true;

            // Start sync timer
            this.syncManager.init();

            this.showStatus(
              `Initialized! Downloaded ${serverEnabledKeys.length} key(s) from server. Auto-sync enabled.`,
              "success",
            );
            console.log(
              "[AO3: Script Sync] Initialization successful (adopted server configuration)",
            );

            // Show success on button
            if (initBtn) {
              initBtn.value = "✓ Initialized";
            }

            // Refresh the view to show sync options
            setTimeout(() => {
              this.hideStorageView();
              this.showStorageView();
            }, 1500);

            // Early exit - server had data, we're done
            return;
          }
        } catch (error) {
          // Server probe failed - likely network error or very first setup
          console.log("[AO3: Script Sync] Server probe failed:", error.message);
        }

        // Step 2: Safety guard - prevent empty initialization
        // Only block if user has no local keys selected (can't upload anything)
        if (selectedKeys.length === 0) {
          const errorMsg =
            serverEnabledKeys.length > 0
              ? "Server connection failed but has data. Please try again or check console for errors."
              : "Cannot initialize: No keys selected. Please enable sync for at least one localStorage key before initializing.";
          console.error("[AO3: Script Sync]", errorMsg);
          this.showStatus(errorMsg, "error");
          if (initBtn) {
            initBtn.value = "✗ No keys selected";
            setTimeout(() => {
              initBtn.value = originalText;
              initBtn.disabled = false;
            }, 3000);
          }
          return;
        }

        // Step 3: Server is empty, upload local data (first-time initialization)
        console.log(
          "[AO3: Script Sync] Server is empty, initializing with",
          selectedKeys.length,
          "local keys",
        );
        this.showStatus("Uploading local data...", "loading");
        const localData = {};
        selectedKeys.forEach((key) => {
          const value = localStorage.getItem(key);
          if (value !== null) {
            localData[key] = value;
          }
        });

        console.log(
          "[AO3: Script Sync] Sending initialize request with",
          Object.keys(localData).length,
          "keys",
        );

        // Step 4: Initialize server with current local state
        const initResponse = await this.syncManager.sendSyncRequest({
          action: "initialize",
          initData: localData,
          selectedKeys: selectedKeys,
        });

        console.log("[AO3: Script Sync] Initialize response:", initResponse);

        if (initResponse.status === "success") {
          // Mark as initialized and enable auto-sync by default
          this.storage.saveSetting("syncInitialized", true);
          this.storage.saveSetting("lastSync", Date.now());
          this.storage.saveSetting("syncEnabled", true);
          this.syncManager.settings.syncInitialized = true;
          this.syncManager.settings.lastSync = Date.now();
          this.syncManager.settings.syncEnabled = true;

          // Start sync timer
          this.syncManager.init();

          this.showStatus(
            "Initialized! Your local data is now syncing. Auto-sync enabled.",
            "success",
          );
          console.log("[AO3: Script Sync] Initialization successful");

          // Show success on button
          if (initBtn) {
            initBtn.value = "✓ Initialized";
          }

          // Refresh the view to show sync options
          setTimeout(() => {
            this.hideStorageView();
            this.showStorageView();
          }, 1500);
        } else {
          const errorMsg =
            "Initialization failed: " +
            (initResponse.error?.message || "Unknown error");
          console.error("[AO3: Script Sync]", errorMsg);
          this.showStatus(errorMsg, "error");
          if (initBtn) {
            initBtn.value = "✗ Failed";
            setTimeout(() => {
              initBtn.value = originalText;
              initBtn.disabled = false;
            }, 2000);
          }
        }
      } catch (error) {
        const errorMsg = "Initialization failed: " + error.message;
        console.error("[AO3: Script Sync]", errorMsg, error);
        this.showStatus(errorMsg, "error");
        if (initBtn) {
          initBtn.value = "✗ Failed";
          setTimeout(() => {
            initBtn.value = originalText;
            initBtn.disabled = false;
          }, 2000);
        }
      }
    }

    resetSync() {
      if (
        !confirm(
          "This will reset all sync settings. You will need to re-initialize. Continue?",
        )
      ) {
        return;
      }

      this.stopCountdownUpdater();
      this.syncManager.destroy();
      this.storage.resetSettings();
      this.hideStorageView();
      this.showStorageView();
      alert("Sync settings have been reset.");
    }

    async clearServerData() {
      if (
        !confirm(
          "This will clear all sync data from the Google Sheet, allowing you to re-initialize.\n\nYour local localStorage will not be affected.\n\nContinue?",
        )
      ) {
        return;
      }

      const clearBtn = q("#ss-clear-server");
      const originalText = clearBtn ? clearBtn.value : "";

      if (clearBtn) {
        clearBtn.value = "Clearing...";
        clearBtn.disabled = true;
      }
      this.showStatus("Clearing server data...", "loading");

      try {
        const response = await this.syncManager.sendSyncRequest({
          action: "initialize",
          initData: {},
          selectedKeys: [],
          force: true,
        });

        if (response.status === "success") {
          this.showStatus(
            "Server data cleared. You can now initialize with your selected keys.",
            "success",
          );
          const initBtn = q("#ss-initialize");
          if (initBtn) {
            initBtn.disabled = false;
          }
          if (clearBtn) {
            clearBtn.value = "✓ Cleared";
            setTimeout(() => {
              clearBtn.value = originalText;
              clearBtn.disabled = false;
            }, 2000);
          }
        } else {
          this.showStatus(
            "Failed to clear server data: " +
              (response.error?.message || "Unknown error"),
            "error",
          );
          if (clearBtn) {
            clearBtn.value = "✗ Failed";
            setTimeout(() => {
              clearBtn.value = originalText;
              clearBtn.disabled = false;
            }, 2000);
          }
        }
      } catch (error) {
        this.showStatus(
          "Failed to clear server data: " + error.message,
          "error",
        );
        if (clearBtn) {
          clearBtn.value = "✗ Failed";
          setTimeout(() => {
            clearBtn.value = originalText;
            clearBtn.disabled = false;
          }, 2000);
        }
      }
    }

    changeUrl() {
      if (
        !confirm(
          "This will let you enter a new Google Script URL. Your selected keys and other settings will be kept, but you will need to re-initialize against the new URL. Continue?",
        )
      ) {
        return;
      }

      this.stopCountdownUpdater();
      this.syncManager.stopSyncTimer();
      this.storage.saveSetting("sheetUrl", "");
      this.storage.saveSetting("syncInitialized", false);
      this.storage.saveSetting("syncEnabled", false);
      this.syncManager.settings.sheetUrl = "";
      this.syncManager.settings.syncInitialized = false;
      this.syncManager.settings.syncEnabled = false;

      this.hideStorageView();
      this.showStorageView();
    }

    startCountdownUpdater() {
      // Stop any existing updater
      this.stopCountdownUpdater();

      // Update countdown every second
      this.countdownInterval = setInterval(() => {
        const settings = this.storage.getSettings();
        const lastSyncSpan = q("#ss-last-sync-time");
        const countdownSpan = q("#ss-next-sync-countdown");

        if (lastSyncSpan && settings.lastSync) {
          lastSyncSpan.textContent = new Date(
            settings.lastSync,
          ).toLocaleString();
        }

        if (countdownSpan && settings.syncEnabled) {
          const now = Date.now();
          const timeSinceLastSync = now - settings.lastSync;
          const syncInterval = settings.syncInterval * 1000;
          const timeUntilNextSync = Math.max(
            0,
            syncInterval - timeSinceLastSync,
          );
          const secondsRemaining = Math.ceil(timeUntilNextSync / 1000);
          countdownSpan.textContent = `Next sync in ${secondsRemaining}s`;
        }
      }, 1000);
    }

    stopCountdownUpdater() {
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
    }

    showStatus(message, type) {
      const statusDiv = q("#ss-connection-status");
      if (statusDiv) {
        statusDiv.className = `ss-status-${type}`;

        // Add emoji prefix based on type
        let emoji = "";
        if (type === "loading") {
          emoji = "🔄 ";
        } else if (type === "success") {
          emoji = "✅ ";
        } else if (type === "error") {
          emoji = "❌ ";
        }

        statusDiv.textContent = emoji + message;
      }
    }

    hideStorageView() {
      // Stop countdown updater
      this.stopCountdownUpdater();

      const container = q("#ss-container");
      if (container) {
        container.remove();
      }

      const stdContent = q("div.splash");
      if (stdContent) {
        stdContent.style.display = "block";
      }
    }

    getScriptSource(key) {
      // Map keys to known scripts (copied from ao3_import_export_script_storage.js)
      const scriptMap = {
        ao3jail: "various scripts (rate limit tracker)",
        aia_refdate:
          '<a href="https://greasyfork.org/en/scripts/475525">AO3: Mark Co- and Solo-Wrangled Fandoms</a>',
        aia_ref:
          '<a href="https://greasyfork.org/en/scripts/475525">AO3: Mark Co- and Solo-Wrangled Fandoms</a>',
        floatcmt:
          '<a href="https://greasyfork.org/en/scripts/489335">AO3: Sticky Comment Box</a>',
        glossary:
          '<a href="https://greasyfork.org/en/scripts/450347">AO3: Glossary Definition Previews</a>',
        agecheck_new:
          '<a href="https://greasyfork.org/en/scripts/444335">AO3: [Wrangling] Highlight Bins with Overdue Tags</a>',
        agecheck_old:
          '<a href="https://greasyfork.org/en/scripts/444335">AO3: [Wrangling] Highlight Bins with Overdue Tags</a>',
        "commentFormat-custom":
          '<a href="https://greasyfork.org/en/scripts/484002">AO3: Comment Formatting and Preview</a>',
        "commentFormat-order":
          '<a href="https://greasyfork.org/en/scripts/484002">AO3: Comment Formatting and Preview</a>',
        iconify0: "Iconify (icon library)",
        "iconify-count": "Iconify (icon library)",
        "iconify-version": "Iconify (icon library)",
        kbdpages:
          '<a href="https://greasyfork.org/en/scripts/451524">AO3: [Wrangling] Keyboard Shortcuts</a>',
        kbdshortcuts:
          '<a href="https://greasyfork.org/en/scripts/451524">AO3: [Wrangling] Keyboard Shortcuts</a>',
        smallertagsearch:
          '<a href="https://greasyfork.org/en/scripts/443886">AO3: [Wrangling] Smaller Tag Search</a>',
        unread_inbox_count:
          '<a href="https://greasyfork.org/en/scripts/474892">AO3: Badge for Unread Inbox Messages</a>',
        unread_inbox_date:
          '<a href="https://greasyfork.org/en/scripts/474892">AO3: Badge for Unread Inbox Messages</a>',
        unread_inbox_conf:
          '<a href="https://greasyfork.org/en/scripts/474892">AO3: Badge for Unread Inbox Messages</a>',
        "script-replaceYN":
          '<a href="https://greasyfork.org/en/scripts/477499">AO3: Replace Y/N in works with your name</a>',
        "script-replaceYN-on":
          '<a href="https://greasyfork.org/en/scripts/477499">AO3: Replace Y/N in works with your name</a>',
        tags_saved_date_map:
          '<a href="https://greasyfork.org/en/scripts/438063">AO3: [Wrangling] UW Tag Snooze Buttons</a>',
        kudoshistory_kudosed:
          '<a href="https://greasyfork.org/en/scripts/5835">AO3: Kudosed and seen history</a>',
        kudoshistory_checked:
          '<a href="https://greasyfork.org/en/scripts/5835">AO3: Kudosed and seen history</a>',
        kudoshistory_seen:
          '<a href="https://greasyfork.org/en/scripts/5835">AO3: Kudosed and seen history</a>',
        kudoshistory_bookmarked:
          '<a href="https://greasyfork.org/en/scripts/5835">AO3: Kudosed and seen history</a>',
        kudoshistory_skipped:
          '<a href="https://greasyfork.org/en/scripts/5835">AO3: Kudosed and seen history</a>',
        ao3tracking_list:
          '<a href="https://greasyfork.org/en/scripts/8382">AO3: Tracking</a>',
        ao3tracking_lastcheck:
          '<a href="https://greasyfork.org/en/scripts/8382">AO3: Tracking</a>',
        wrangleActionButtons:
          '<a href="https://greasyfork.org/en/scripts/501991">AO3: [Wrangling] Action Buttons Everywhere</a>',
        wrangleShortcuts_act:
          '<a href="https://greasyfork.org/en/scripts/507705">AO3: [Wrangling] Keyboard Shortcuts</a>',
        wrangleShortcuts_tag:
          '<a href="https://greasyfork.org/en/scripts/507705">AO3: [Wrangling] Keyboard Shortcuts</a>',
        rainbowTables:
          '<a href="https://greasyfork.org/en/scripts/445805">AO3: [Wrangling] Rainbow Tables</a>',
        wrangleResources:
          '<a href="https://greasyfork.org/en/scripts/511102">AO3: [Wrangling] Fandom Resources Quicklinks</a>',
        ao3_chapter_shortcuts_config:
          '<a href="https://greasyfork.org/en/scripts/549571">AO3: Chapter Shortcuts</a>',
        ao3_wizard_config:
          '<a href="https://greasyfork.org/en/scripts/550537">AO3: Site Wizard</a>',
        ao3_reading_quality_config:
          '<a href="https://greasyfork.org/en/scripts/549777">AO3: Reading Time & Quality Score</a>',
        ao3_advanced_blocker_config:
          '<a href="https://greasyfork.org/en/scripts/549942">AO3: Advanced Blocker</a>',
        ao3_auto_pseud_config:
          '<a href="https://greasyfork.org/en/scripts/556232">AO3: Auto Pseud</a>',
        ao3_menu_helpers:
          '<a href="https://greasyfork.org/en/scripts/552743">AO3: Menu Helpers Library</a>',
        ao3_quick_hide_config:
          '<a href="https://greasyfork.org/en/scripts/564383">AO3: Quick Hide</a>',
        ao3_quick_hide_settings:
          '<a href="https://greasyfork.org/en/scripts/564383">AO3: Quick Hide</a>',
        ao3_skin_switcher_config:
          '<a href="https://greasyfork.org/en/scripts/551820">AO3: Skin Switcher</a>',
        ao3_no_rekudos_config:
          '<a href="https://greasyfork.org/en/scripts/551623">AO3: No Re-Kudos</a>',
        FT_finished:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_favorites:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_toread:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_disliked:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_userNotes:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_settings:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_lastSync:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_pendingChanges:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_statusesConfig:
          '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>',
        FT_lastSyncedStatusesConfig:
          '<a href="https://greasyfork.org/en/scripts/566605">AO3 FicTracker - BlackBatCats Version</a>',
        FT_kudosGiven:
          '<a href="https://greasyfork.org/en/scripts/566605">AO3 FicTracker - BlackBatCats Version</a>',
        FT_subscribed:
          '<a href="https://greasyfork.org/en/scripts/566605">AO3 FicTracker - BlackBatCats Version</a>',
      };

      // Check for Script Sync keys
      if (key.startsWith("SS_")) {
        return '<a href="https://greasyfork.org/en/scripts/568443">AO3: Script Sync</a>';
      }

      // Check for FicTracker custom list keys (e.g. FT_custom_1768174268304)
      if (key.startsWith("FT_custom")) {
        return '<a href="https://greasyfork.org/en/scripts/513435">AO3 FicTracker</a>';
      }

      return scriptMap[key] || "<i>unknown</i>";
    }
  }

  // ============================================================================
  // MAIN INITIALIZATION
  // ============================================================================

  function init() {
    // Inject styles
    StyleManager.inject();

    // Initialize managers
    const storageManager = new StorageManager();
    const remoteSyncManager = new RemoteSyncManager(storageManager);
    const uiManager = new UIManager(storageManager, remoteSyncManager);

    // Initialize sync if enabled
    const settings = storageManager.getSettings();
    if (settings.syncEnabled && settings.syncInitialized) {
      remoteSyncManager.init();
    }

    // Inject menu
    uiManager.injectMenu();

    // Make managers globally accessible for debugging
    window.ScriptSync = {
      storageManager,
      remoteSyncManager,
      uiManager,
    };

    console.log("[AO3: Script Sync] loaded.");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
