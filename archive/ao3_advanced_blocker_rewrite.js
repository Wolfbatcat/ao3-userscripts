// ==UserScript==
// @name          AO3: Advanced Blocker
// @description   Fork of ao3 savior; blocks works based on certain conditions
// @author        BlackBatCat
// @namespace     
// @license       MIT
// @match         http*://archiveofourown.org/*
// @version       1.2
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_registerMenuCommand
// @run-at        document-end
// @downloadURL https://update.greasyfork.org/scripts/549942/AO3%3A%20Advanced%20Blocker.user.js
// @updateURL https://update.greasyfork.org/scripts/549942/AO3%3A%20Advanced%20Blocker.meta.js
// ==/UserScript==

/* globals GM_getValue, GM_setValue, GM_registerMenuCommand */

(function() {
    "use strict";
    
    // Startup message
    console.log("[AO3: Advanced Blocker] loaded.");
    
    // Define the CSS namespace
    const CSS_NAMESPACE = "ao3-blocker";
    
    // Default configuration
    const DEFAULT_CONFIG = {
        tagBlacklist: "",
        tagWhitelist: "",
        tagHighlights: "",
        highlightColor: "#fff9b1",
        minWords: "",
        maxWords: "",
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
        disableOnBookmarks: false,
        disableOnCollections: false
    };
    
    // Current configuration
    let config = {};
    
    // Initialize the script
    function init() {
        loadConfig();
        addStyles();
        registerMenuCommand();
        setupMutationObserver();
        processWorks();
    }
    
    // Load configuration from storage
    function loadConfig() {
        config = { ...DEFAULT_CONFIG };
        
        for (const key in DEFAULT_CONFIG) {
            const stored = GM_getValue(key);
            if (stored !== undefined) {
                config[key] = stored;
            }
        }
        
        // Parse complex values
        config.authorBlacklist = parseList(config.authorBlacklist);
        config.titleBlacklist = parseList(config.titleBlacklist);
        config.tagBlacklist = parseList(config.tagBlacklist);
        config.tagWhitelist = parseList(config.tagWhitelist);
        config.tagHighlights = parseList(config.tagHighlights);
        config.summaryBlacklist = parseList(config.summaryBlacklist);
        config.allowedLanguages = parseList(config.allowedLanguages);
        config.minWords = parseNumber(config.minWords);
        config.maxWords = parseNumber(config.maxWords);
        config.maxCrossovers = parseNumber(config.maxCrossovers) || 3;
        
        // Set CSS variable for highlight color
        document.documentElement.style.setProperty('--ao3-blocker-highlight-color', config.highlightColor || '#fff9b1');
    }
    
    // Parse comma-separated list
    function parseList(str) {
        return str.toLowerCase().split(/[,\n]/).map(item => item.trim()).filter(item => item);
    }
    
    // Parse number from string
    function parseNumber(str) {
        if (!str) return null;
        const num = parseInt(str.toString().replace(/[,_\s]/g, ""), 10);
        return isNaN(num) ? null : num;
    }
    
    // Save configuration to storage
    function saveConfig(newConfig) {
        for (const key in newConfig) {
            if (DEFAULT_CONFIG.hasOwnProperty(key)) {
                GM_setValue(key, newConfig[key]);
            }
        }
        loadConfig(); // Reload config
    }
    
    // Add styles to the page
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
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
                justify-content: flex-start;
                font-family: inherit;
                font-size: inherit;
                color: inherit;
                background: inherit;
            }
            .ao3-blocker-unhide .ao3-blocker-fold {
                border-bottom: 1px dashed;
                border-bottom-color: inherit;
                margin-bottom: 15px;
                padding-bottom: 5px;
            }
            button.ao3-blocker-toggle {
                margin-left: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.2em;
            }
            .ao3-blocker-toggle span {
                width: 1.2em !important;
                height: 1.2em !important;
                display: inline-block;
                vertical-align: -0.15em;
                margin-right: 0.2em;
                background-color: currentColor;
                mask-size: contain;
                mask-repeat: no-repeat;
                mask-position: center;
                -webkit-mask-size: contain;
                -webkit-mask-repeat: no-repeat;
                -webkit-mask-position: center;
                font-family: inherit;
            }
            /* Settings menu minimal layout overrides */
                /* Settings menu modal styles (match original) */
                .ao3-blocker-menu-dialog {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #fffaf5;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.2);
                    z-index: 10000;
                    width: 90%;
                    max-width: 900px;
                    max-height: 80vh;
                    overflow-y: auto;
                    font-family: var(--ao3-font-family, 'Georgia, Times, Times New Roman, serif');
                    font-size: 1em;
                    color: #2c2c2c;
                    box-sizing: border-box;
                }
                .ao3-blocker-menu-dialog h3 {
                    font-size: 1.5em;
                    font-weight: bold;
                    margin-bottom: 0.7em;
                    color: inherit;
                    font-family: inherit;
                }
                .ao3-blocker-menu-dialog h4,
                .ao3-blocker-menu-dialog .section-title {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 0.7em;
                    color: inherit;
                    font-family: inherit;
                }
                .ao3-blocker-menu-dialog .setting-label,
                .ao3-blocker-menu-dialog label {
                    font-size: 1em;
                    font-family: inherit;
                    color: inherit;
                }
                .ao3-blocker-menu-dialog input,
                .ao3-blocker-menu-dialog textarea,
                .ao3-blocker-menu-dialog select {
                    font-size: 1em;
                    font-family: inherit;
                    color: inherit;
                    background: #fffaf5;
                }
                .ao3-blocker-menu-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 9999;
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
            .ao3-blocker-menu-dialog .reset-link {
                text-align: center;
                margin-top: 10px;
            }
            .ao3-blocker-menu-dialog .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .ao3-blocker-highlight {
                background-color: var(--ao3-blocker-highlight-color, rgba(255,255,0,0.1)) !important;
            }
            .symbol.question {
                font-size: 0.5em;
                vertical-align: middle;
                cursor: help;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Register menu command
    function registerMenuCommand() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand("Advanced Blocker Settings", showSettingsDialog);
        }
        
        // Also try to register with shared menu system
        registerWithSharedMenu();
    }
    
    // Register with shared userscript menu
    function registerWithSharedMenu() {
        if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === "function") {
            window.AO3UserScriptMenu.register({
                label: "Advanced Blocker",
                onClick: showSettingsDialog
            });
            return;
        }
        
        // Fallback: add to AO3 navigation
        const headerMenu = document.querySelector("ul.primary.navigation.actions");
        if (!headerMenu) return;
        
        const menuItem = document.createElement("li");
        menuItem.className = "dropdown";
        menuItem.innerHTML = `
            <a href="#">Advanced Blocker</a>
            <ul class="menu dropdown-menu" style="display: none;">
                <li><a href="#" class="ao3-blocker-settings">Settings</a></li>
            </ul>
        `;
        
        headerMenu.insertBefore(menuItem, headerMenu.querySelector("li.search"));
        
        // Add click handlers
        menuItem.querySelector("a").addEventListener("click", function(e) {
            e.preventDefault();
            const menu = this.nextElementSibling;
            menu.style.display = menu.style.display === "none" ? "block" : "none";
        });
        
        menuItem.querySelector(".ao3-blocker-settings").addEventListener("click", function(e) {
            e.preventDefault();
            showSettingsDialog();
        });
    }
    
    // Show settings dialog
    function showSettingsDialog() {
        // Remove any existing menu
        document.querySelectorAll('.ao3-blocker-menu-dialog, .ao3-blocker-menu-dialog-overlay').forEach(el => el.remove());

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'ao3-blocker-menu-dialog-overlay';
        overlay.addEventListener('click', closeModal);

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'ao3-blocker-menu-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('tabindex', '-1');
        dialog.innerHTML = generateSettingsHTML();

        document.body.appendChild(overlay);
        document.body.appendChild(dialog);

        // Prevent background scrolling
        document.body.style.overflow = 'hidden';

        // Focus dialog for accessibility
        setTimeout(() => dialog.focus(), 0);

        // Trap focus inside modal
        function trapFocus(e) {
            if (e.key === 'Tab') {
                const focusable = dialog.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                } else if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
            }
        }

        // Add event listeners
        setupDialogEvents(dialog);

        // Add Escape key handler to close modal and trap Tab
        function keyHandler(e) {
            if (e.key === 'Escape') closeModal();
            trapFocus(e);
        }
        document.addEventListener('keydown', keyHandler);

        // Modal close function
        function closeModal() {
            dialog.remove();
            overlay.remove();
            document.body.style.overflow = '';
            document.removeEventListener('keydown', keyHandler);
        }
    }
    
    // Generate settings dialog HTML
    function generateSettingsHTML() {
        return `
            <h3 style="text-align: center; margin-top: 0; color: inherit;">🛡️ Advanced Blocker Settings 🛡️</h3>

            <!-- Tag Filtering -->
            <div class="settings-section">
                <h4 class="section-title">Tag Filtering 🔖</h4>
                <div class="setting-group">
                    <label class="setting-label" for="tag-blacklist-input">Blacklist Tags</label>
                    <span class="setting-description ao3-blocker-inline-help" style="display:block;">
                        Matches any AO3 tag: ratings, warnings, fandoms, ships, characters, freeforms.
                    </span>
                    <textarea id="tag-blacklist-input" placeholder="Explicit, Major Character Death, Abandoned, Time Travel" title="Blocks if any tag matches. * is a wildcard.">${escapeHtml(config.tagBlacklist.join(', '))}</textarea>
                </div>
                <div class="setting-group">
                    <label class="setting-label" for="tag-whitelist-input">Whitelist Tags</label>
                    <span class="setting-description ao3-blocker-inline-help" style="display:block;">
                        Always shows the work even if it matches the blacklist.
                    </span>
                    <textarea id="tag-whitelist-input" placeholder="Happy Ending, Angst with a Happy Ending, Comedy" title="Always shows the work, even if blacklisted.">${escapeHtml(config.tagWhitelist.join(', '))}</textarea>
                </div>
                <div class="two-column">
                    <div class="setting-group">
                        <label class="setting-label" for="tag-highlights-input">Highlight Tags
                            <span class="symbol question" title="Make these works stand out.">?</span>
                        </label>
                        <textarea id="tag-highlights-input" placeholder="Hurt/Comfort, Found Family, Slow Burn" title="Keep and mark works with these tags.">${escapeHtml(config.tagHighlights.join(', '))}</textarea>
                    </div>
                    <div class="setting-group">
                        <label class="setting-label" for="highlight-color-input">Highlight Color
                            <span class="symbol question" title="Pick a background color for these works.">?</span>
                        </label>
                        <input type="color" id="highlight-color-input" value="${escapeHtml(config.highlightColor)}" title="Pick the highlight color.">
                    </div>
                </div>
            </div>

            <!-- Work Filtering -->
            <div class="settings-section">
                <h4 class="section-title">Work Filtering 📝</h4>
                <div class="two-column">
                    <div>
                        <div class="setting-group">
                            <label class="setting-label" for="allowed-languages-input">Allowed Languages
                                <span class="symbol question" title="Only show these languages. Leave empty for all.">?</span>
                            </label>
                            <input id="allowed-languages-input" type="text"
                                   placeholder="english, Русский, 中文-普通话 國語"
                                   value="${escapeHtml(config.allowedLanguages.join(', '))}"
                                   title="Only show these languages. Leave empty for all.">
                        </div>
                        <div class="setting-group">
                            <label class="setting-label" for="min-words-input">Min Words
                                <span class="symbol question" title="Hide works under this many words.">?</span>
                            </label>
                            <input id="min-words-input" type="text" style="width:100%;" placeholder="e.g. 1000" value="${escapeHtml(config.minWords || '')}" title="Hide works under this many words.">
                        </div>
                        <div class="setting-group">
                            <label class="checkbox-label" for="block-ongoing-checkbox">
                                <input type="checkbox" id="block-ongoing-checkbox" ${config.blockOngoing ? "checked" : ""}>
                                Block Ongoing Works
                                <span class="symbol question" title="Hide works that are ongoing.">?</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <div class="setting-group">
                            <label class="setting-label" for="max-crossovers-input">Max Fandoms
                                <span class="symbol question" title="Hide works with more than this many fandoms.">?</span>
                            </label>
                            <input id="max-crossovers-input" type="number" min="1" step="1" 
                                   value="${escapeHtml(config.maxCrossovers)}" 
                                   title="Hide works with more than this many fandoms.">
                        </div>
                        <div class="setting-group">
                            <label class="setting-label" for="max-words-input">Max Words
                                <span class="symbol question" title="Hide works over this many words.">?</span>
                            </label>
                            <input id="max-words-input" type="text" style="width:100%;" placeholder="e.g. 100000" value="${escapeHtml(config.maxWords || '')}" title="Hide works over this many words.">
                        </div>
                        <div class="setting-group">
                            <label class="checkbox-label" for="block-complete-checkbox">
                                <input type="checkbox" id="block-complete-checkbox" ${config.blockComplete ? "checked" : ""}>
                                Block Complete Works
                                <span class="symbol question" title="Hide works that are marked as complete.">?</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Author & Content Filtering -->
            <div class="settings-section">
                <h4 class="section-title">Author & Content Filtering ✍️</h4>
                <div class="two-column">
                    <div class="setting-group">
                        <label class="setting-label" for="author-blacklist-input">Blacklist Authors
                            <span class="symbol question" title="Match the author name exactly. Commas or semicolons.">?</span>
                        </label>
                        <textarea id="author-blacklist-input" placeholder="DetectiveMittens, BlackBatCat" title="Match the author name exactly. Commas or semicolons.">${escapeHtml(config.authorBlacklist.join(', '))}</textarea>
                    </div>
                    <div class="setting-group">
                        <label class="setting-label" for="title-blacklist-input">Blacklist Titles
                            <span class="symbol question" title="Blocks if the title contains your text. * works.">?</span>
                        </label>
                        <textarea id="title-blacklist-input" placeholder="Week 2025" title="Blocks if the title contains your text. * works.">${escapeHtml(config.titleBlacklist.join(', '))}</textarea>
                    </div>
                </div>
                <div class="setting-group">
                    <label class="setting-label" for="summary-blacklist-input">Blacklist Summary
                        <span class="symbol question" title="Blocks if the summary has these words/phrases.">?</span>
                    </label>
                    <textarea id="summary-blacklist-input" placeholder="phrase with spaces" title="Blocks if the summary has these words/phrases.">${escapeHtml(config.summaryBlacklist.join(', '))}</textarea>
                </div>
            </div>

            <!-- Display Options -->
            <div class="settings-section">
                <h4 class="section-title">Display Options ⚙️</h4>
                <div class="two-column">
                    <div>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="show-reasons-checkbox" ${config.showReasons ? "checked" : ""}>
                                Show Block Reason
                                <span class="symbol question" title="List what triggered the block.">?</span>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="show-placeholders-checkbox" ${config.showPlaceholders ? "checked" : ""}>
                                Show Work Placeholder
                                <span class="symbol question" title="Leave a stub you can click to reveal.">?</span>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="debug-mode-checkbox" ${config.debugMode ? "checked" : ""}>
                                Debug Mode
                                <span class="symbol question" title="Log details to the console.">?</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="disable-on-bookmarks-checkbox" ${config.disableOnBookmarks ? "checked" : ""}>
                                Disable Blocking on Bookmarks
                                <span class="symbol question" title="If checked, works will not be blocked on bookmarks pages. Highlighting still works.">?</span>
                            </label>
                        </div>
                        <div class="setting-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="disable-on-collections-checkbox" ${config.disableOnCollections ? "checked" : ""}>
                                Disable Blocking on Collections
                                <span class="symbol question" title="If checked, works will not be blocked on collections pages. Highlighting still works.">?</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Buttons -->
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
    }
    
    // Setup dialog event handlers
    function setupDialogEvents(dialog) {
        // Save button
        dialog.querySelector('#blocker-save').addEventListener('click', () => {
            const newConfig = getConfigFromDialog(dialog);
            saveConfig(newConfig);
            closeDialog();
            alert("Your changes have been saved.");
            location.reload();
        });
        
        // Cancel button
        dialog.querySelector('#blocker-cancel').addEventListener('click', closeDialog);
        
        // Reset link
        dialog.querySelector('#resetBlockerSettingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to reset all settings to default?")) {
                saveConfig(DEFAULT_CONFIG);
                closeDialog();
                alert("Settings reset to default.");
                location.reload();
            }
        });
        
        // Export button
        dialog.querySelector('#ao3-export').addEventListener('click', exportSettings);
        
        // Import button
        dialog.querySelector('#ao3-import-btn').addEventListener('click', () => {
            dialog.querySelector('#ao3-import').click();
        });
        
        dialog.querySelector('#ao3-import').addEventListener('change', importSettings);
        
        function closeDialog() {
            dialog.remove();
            document.querySelector('.ao3-blocker-menu-dialog-overlay').remove();
        }
    }
    
    // Get config values from dialog
    function getConfigFromDialog(dialog) {
        return {
            tagBlacklist: dialog.querySelector('#tag-blacklist-input').value,
            tagWhitelist: dialog.querySelector('#tag-whitelist-input').value,
            tagHighlights: dialog.querySelector('#tag-highlights-input').value,
            highlightColor: dialog.querySelector('#highlight-color-input').value,
            minWords: dialog.querySelector('#min-words-input').value,
            maxWords: dialog.querySelector('#max-words-input').value,
            blockComplete: dialog.querySelector('#block-complete-checkbox').checked,
            blockOngoing: dialog.querySelector('#block-ongoing-checkbox').checked,
            authorBlacklist: dialog.querySelector('#author-blacklist-input').value,
            titleBlacklist: dialog.querySelector('#title-blacklist-input').value,
            summaryBlacklist: dialog.querySelector('#summary-blacklist-input').value,
            showReasons: dialog.querySelector('#show-reasons-checkbox').checked,
            showPlaceholders: dialog.querySelector('#show-placeholders-checkbox').checked,
            debugMode: dialog.querySelector('#debug-mode-checkbox').checked,
            allowedLanguages: dialog.querySelector('#allowed-languages-input').value,
            maxCrossovers: dialog.querySelector('#max-crossovers-input').value,
            disableOnBookmarks: dialog.querySelector('#disable-on-bookmarks-checkbox').checked,
            disableOnCollections: dialog.querySelector('#disable-on-collections-checkbox').checked
        };
    }
    
    // Export settings
    function exportSettings() {
        try {
            const data = { ...config };
            // Convert arrays back to strings for export
            data.authorBlacklist = data.authorBlacklist.join(', ');
            data.titleBlacklist = data.titleBlacklist.join(', ');
            data.tagBlacklist = data.tagBlacklist.join(', ');
            data.tagWhitelist = data.tagWhitelist.join(', ');
            data.tagHighlights = data.tagHighlights.join(', ');
            data.summaryBlacklist = data.summaryBlacklist.join(', ');
            data.allowedLanguages = data.allowedLanguages.join(', ');
            
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const filename = `ao3_advanced_blocker_config_${dateStr}.json`;
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
            alert("Export failed: " + (e.message || e));
        }
    }
    
    // Import settings
    function importSettings(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                if (typeof imported !== "object") throw new Error("Invalid file format");
                
                // Validate and import only known fields
                const validConfig = {};
                for (const key in DEFAULT_CONFIG) {
                    if (imported.hasOwnProperty(key)) {
                        validConfig[key] = imported[key];
                    }
                }
                
                if (Object.keys(validConfig).length === 0) {
                    throw new Error("No valid settings found");
                }
                
                saveConfig(validConfig);
                alert("Settings imported successfully!");
                location.reload();
            } catch (err) {
                alert("Import failed: " + (err.message || err));
            }
        };
        reader.readAsText(file);
    }
    
    // Escape HTML for safe insertion
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Setup mutation observer to handle dynamic content
    function setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && (
                            node.classList.contains('blurb') || 
                            node.querySelector('.blurb')
                        )) {
                            shouldProcess = true;
                            break;
                        }
                    }
                }
                if (shouldProcess) break;
            }
            if (shouldProcess) {
                setTimeout(processWorks, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Process all works on the page
    function processWorks() {
        const blurbs = document.querySelectorAll('li.blurb');
        let blockedCount = 0;
        let totalCount = 0;
        
        // Skip user dashboard and works pages
        const path = window.location.pathname;
        if (/^\/users\/[^\/]+\/?$/.test(path) || 
            /^\/users\/[^\/]+\/works\/?$/.test(path) ||
            /^\/users\/[^\/]+\/works\/drafts\/?$/.test(path) ||
            /^\/users\/[^\/]+\/pseuds\/[^\/]+\/?$/.test(path)) {
            if (config.debugMode) {
                console.log("[AO3 Blocker] Skipping user page");
            }
            return;
        }
        
        // Check if blocking should be disabled
        const isBookmarksPage = /\/users\/[^\/]+\/bookmarks(\/|$)/.test(path);
        const isCollectionsPage = /\/collections\/[^\/]+(\/|$)/.test(path);
        const disableBlocking = (isBookmarksPage && config.disableOnBookmarks) || 
                               (isCollectionsPage && config.disableOnCollections);
        
        for (const blurb of blurbs) {
            const isWorkOrBookmark = blurb.classList.contains('work') || blurb.classList.contains('bookmark');
            let workData = null;
            if (isWorkOrBookmark) {
                totalCount++;
                workData = extractWorkData(blurb);
                // --- Highlighting: always apply if highlight tags present ---
                highlightWork(blurb, workData.tags);
                // --- BLOCKING LOGIC (legacy order) ---
                // 1. Whitelist tags: never block if any tag matches
                if (isTagWhitelisted(workData.tags, config.tagWhitelist)) {
                    continue;
                }
                // 2. Completion status
                if (config.blockComplete && workData.completionStatus === 'complete') {
                    blockWork(blurb, [{ completionStatus: 'Status: Complete' }]);
                    blockedCount++;
                    continue;
                }
                if (config.blockOngoing && workData.completionStatus === 'ongoing') {
                    blockWork(blurb, [{ completionStatus: 'Status: Ongoing' }]);
                    blockedCount++;
                    continue;
                }
                // 3. Word count
                if (config.minWords !== null && workData.wordCount !== null && workData.wordCount < config.minWords) {
                    blockWork(blurb, [{ wordCount: `Words: ${workData.wordCount} < ${config.minWords}` }]);
                    blockedCount++;
                    continue;
                }
                if (config.maxWords !== null && workData.wordCount !== null && workData.wordCount > config.maxWords) {
                    blockWork(blurb, [{ wordCount: `Words: ${workData.wordCount} > ${config.maxWords}` }]);
                    blockedCount++;
                    continue;
                }
                // 4. Language
                if (config.allowedLanguages.length > 0) {
                    const lang = (workData.language || '').toLowerCase().trim();
                    if (!config.allowedLanguages.includes(lang)) {
                        blockWork(blurb, [{ language: lang || 'unknown' }]);
                        blockedCount++;
                        continue;
                    }
                }
                // 5. Max crossovers
                if (typeof config.maxCrossovers === 'number' && config.maxCrossovers > 0 && workData.fandomCount > config.maxCrossovers) {
                    blockWork(blurb, [{ crossovers: workData.fandomCount }]);
                    blockedCount++;
                    continue;
                }
                // 6. Tag blacklist (wildcard)
                const blockedTags = findBlockedItems(workData.tags, config.tagBlacklist);
                if (blockedTags.length > 0) {
                    blockWork(blurb, [{ tags: blockedTags }]);
                    blockedCount++;
                    continue;
                }
                // 7. Author blacklist (exact match only)
                const blockedAuthors = workData.authors.filter(author => config.authorBlacklist.includes(author.toLowerCase()));
                if (blockedAuthors.length > 0) {
                    blockWork(blurb, [{ authors: blockedAuthors }]);
                    blockedCount++;
                    continue;
                }
                // 8. Title blacklist (wildcard)
                const blockedTitles = findBlockedItems([workData.title], config.titleBlacklist);
                if (blockedTitles.length > 0) {
                    blockWork(blurb, [{ titles: blockedTitles }]);
                    blockedCount++;
                    continue;
                }
                // 9. Summary blacklist (contains)
                const blockedSummaryTerms = config.summaryBlacklist.filter(term => workData.summary.toLowerCase().includes(term));
                if (blockedSummaryTerms.length > 0) {
                    blockWork(blurb, [{ summaryTerms: blockedSummaryTerms }]);
                    blockedCount++;
                    continue;
                }
            } else {
                // Highlight non-work blurbs if they have matching tags
                const tags = Array.from(blurb.querySelectorAll('a.tag')).map(tag => tag.textContent.trim().toLowerCase());
                highlightWork(blurb, tags);
            }
        }
        if (config.debugMode) {
            console.log(`[AO3 Blocker] Blocked ${blockedCount} out of ${totalCount} works`);
        }
    }
    
    // Extract work data from blurb
    function extractWorkData(blurb) {
        const getText = (selector) => {
            const el = blurb.querySelector(selector);
            return el ? el.textContent.trim() : '';
        };
        
        const getMultipleText = (selector) => {
            return Array.from(blurb.querySelectorAll(selector)).map(el => el.textContent.trim());
        };
        
        // Parse completion status
        let completionStatus = null;
        const chaptersEl = blurb.querySelector('dd.chapters');
        if (chaptersEl) {
            const text = chaptersEl.textContent.trim();
            const match = text.match(/(\d+)\s*\/\s*(\d+|\?)/);
            if (match) {
                const current = parseInt(match[1]);
                const total = match[2] === '?' ? null : parseInt(match[2]);
                if (total === null) {
                    completionStatus = 'ongoing';
                } else if (current >= total) {
                    completionStatus = 'complete';
                } else {
                    completionStatus = 'ongoing';
                }
            }
        }
        
        // Parse word count
        let wordCount = null;
        const wordsEl = blurb.querySelector('dd.words');
        if (wordsEl) {
            const text = wordsEl.textContent.replace(/[,\s]/g, '');
            wordCount = parseInt(text);
            if (isNaN(wordCount)) wordCount = null;
        }
        
        return {
            authors: getMultipleText('a[rel="author"]'),
            title: getText('.heading a:first-child'),
            tags: [...getMultipleText('a.tag'), ...getMultipleText('.required-tags .text')],
            summary: getText('blockquote.summary'),
            language: getText('dd.language'),
            fandomCount: blurb.querySelectorAll('h5.fandoms a.tag').length,
            wordCount: wordCount,
            completionStatus: completionStatus
        };
    }
    
    // Get block reasons for a work
    function getBlockReasons(work) {
        const reasons = [];
        
        // Check completion status
        if (config.blockComplete && work.completionStatus === 'complete') {
            reasons.push({ completionStatus: 'Status: Complete' });
        }
        if (config.blockOngoing && work.completionStatus === 'ongoing') {
            reasons.push({ completionStatus: 'Status: Ongoing' });
        }
        
        // Check word count
        if (work.wordCount !== null) {
            if (config.minWords !== null && work.wordCount < config.minWords) {
                reasons.push({ wordCount: `Words: ${work.wordCount.toLocaleString()} < ${config.minWords.toLocaleString()}` });
            }
            if (config.maxWords !== null && work.wordCount > config.maxWords) {
                reasons.push({ wordCount: `Words: ${work.wordCount.toLocaleString()} > ${config.maxWords.toLocaleString()}` });
            }
        }
        
        // Check if whitelisted
        if (isTagWhitelisted(work.tags, config.tagWhitelist)) {
            return null;
        }
        
        // Check language
        if (config.allowedLanguages.length > 0) {
            const lang = work.language.toLowerCase();
            if (!config.allowedLanguages.includes(lang)) {
                reasons.push({ language: work.language });
            }
        }
        
        // Check crossovers
        if (config.maxCrossovers > 0 && work.fandomCount > config.maxCrossovers) {
            reasons.push({ crossovers: work.fandomCount });
        }
        
        // Check tags
        const blockedTags = findBlockedItems(work.tags, config.tagBlacklist);
        if (blockedTags.length > 0) {
            reasons.push({ tags: blockedTags });
        }
        
        // Check authors
        const blockedAuthors = findBlockedItems(work.authors, config.authorBlacklist);
        if (blockedAuthors.length > 0) {
            reasons.push({ authors: blockedAuthors });
        }
        
        // Check title
        const blockedTitles = findBlockedItems([work.title], config.titleBlacklist);
        if (blockedTitles.length > 0) {
            reasons.push({ titles: blockedTitles });
        }
        
        // Check summary
        const blockedSummaryTerms = [];
        for (const term of config.summaryBlacklist) {
            if (work.summary.toLowerCase().includes(term)) {
                blockedSummaryTerms.push(term);
            }
        }
        if (blockedSummaryTerms.length > 0) {
            reasons.push({ summaryTerms: blockedSummaryTerms });
        }
        
        return reasons.length > 0 ? reasons : null;
    }
    
    // Check if tags are whitelisted
    function isTagWhitelisted(tags, whitelist) {
        return tags.some(tag => 
            whitelist.some(whitelistTag => 
                matchWithWildcard(tag.toLowerCase(), whitelistTag.toLowerCase())
            )
        );
    }
    
    // Find blocked items using wildcard matching
    function findBlockedItems(items, blacklist) {
        const blocked = [];
        for (const item of items) {
            for (const pattern of blacklist) {
                // Author blacklist: exact match only
                if (items === undefined || items.length === 0) continue;
                if (typeof pattern === 'string' && typeof item === 'string') {
                    if (blacklist === config.authorBlacklist) {
                        if (item.toLowerCase() === pattern.toLowerCase()) {
                            blocked.push(pattern);
                        }
                    } else {
                        if (matchWithWildcard(item.toLowerCase(), pattern.toLowerCase())) {
                            blocked.push(pattern);
                        }
                    }
                }
            }
        }
        return blocked;
    }
    
    // Wildcard matching function
    function matchWithWildcard(text, pattern) {
        if (pattern === text) return true;
        if (!pattern.includes('*')) return false;
        
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }
    
    // Block a work
    function blockWork(blurb, reasons) {
        if (config.showPlaceholders) {
            const fold = createFold(reasons);
            const cut = createCut(blurb);
            
            blurb.classList.add(`${CSS_NAMESPACE}-work`);
            blurb.innerHTML = '';
            blurb.appendChild(fold);
            blurb.appendChild(cut);
            
            if (!config.showReasons) {
                blurb.classList.add(`${CSS_NAMESPACE}-hide-reasons`);
            }
        } else {
            blurb.classList.add(`${CSS_NAMESPACE}-hidden`);
        }
    }
    
    // Create fold (placeholder)
    function createFold(reasons) {
        const fold = document.createElement('div');
        fold.className = `${CSS_NAMESPACE}-fold`;
        const note = document.createElement('span');
        note.className = `${CSS_NAMESPACE}-note`;
        let message = "";
        if (config.showReasons && reasons && reasons.length > 0) {
            message = reasons.map(r => {
                if (typeof r === 'string') return `<span class='${CSS_NAMESPACE}-reason'>${escapeHtml(r)}</span>`;
                if (r.completionStatus) return `<span class='${CSS_NAMESPACE}-reason'>${escapeHtml(r.completionStatus)}</span>`;
                if (r.wordCount) return `<span class='${CSS_NAMESPACE}-reason'>${escapeHtml(r.wordCount)}</span>`;
                if (r.tags) return `<span class='${CSS_NAMESPACE}-reason'>Tags: ${escapeHtml(r.tags.join(', '))}</span>`;
                if (r.authors) return `<span class='${CSS_NAMESPACE}-reason'>Author: ${escapeHtml(r.authors.join(', '))}</span>`;
                if (r.titles) return `<span class='${CSS_NAMESPACE}-reason'>Title: ${escapeHtml(r.titles.join(', '))}</span>`;
                if (r.summaryTerms) return `<span class='${CSS_NAMESPACE}-reason'>Summary: ${escapeHtml(r.summaryTerms.join(', '))}</span>`;
                if (r.language) return `<span class='${CSS_NAMESPACE}-reason'>Language: ${escapeHtml(r.language)}</span>`;
                if (r.crossovers) return `<span class='${CSS_NAMESPACE}-reason'>Too many fandoms: ${escapeHtml(r.crossovers.toString())} &gt; ${escapeHtml(config.maxCrossovers.toString())}</span>`;
                return "";
            }).join(' ');
        }
        // Use the same icon markup as the original for the note
        const iconHide = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-hidden.svg";
        const iconHtml = `<span class=\"${CSS_NAMESPACE}-icon\" style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconHide}') no-repeat center/contain;-webkit-mask:url('${iconHide}') no-repeat center/contain;\"></span>`;
        note.innerHTML = iconHtml + message;
        fold.appendChild(note);
        fold.appendChild(createToggleButton(note));
        return fold;
    }
    
    // Create cut (hidden content)
    function createCut(blurb) {
        const cut = document.createElement('div');
        cut.className = `${CSS_NAMESPACE}-cut`;
        
        while (blurb.firstChild) {
            cut.appendChild(blurb.firstChild);
        }
        
        return cut;
    }
    
    // Create toggle button
    function createToggleButton() {
        const iconHide = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-hidden.svg";
        const iconEye = "https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/1de22a3e33d769774a828c9c0a03b667dcfd4999/assets/icon_show-hide-visible.svg";
        const showIcon = `<span class=\"${CSS_NAMESPACE}-icon\" style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconHide}') no-repeat center/contain;-webkit-mask:url('${iconHide}') no-repeat center/contain;\"></span>`;
        const hideIcon = `<span class=\"${CSS_NAMESPACE}-icon\" style=\"display:inline-block;width:1.2em;height:1.2em;vertical-align:-0.15em;margin-right:0.3em;background-color:currentColor;mask:url('${iconEye}') no-repeat center/contain;-webkit-mask:url('${iconEye}') no-repeat center/contain;\"></span>`;
        const button = document.createElement('button');
        button.className = `${CSS_NAMESPACE}-toggle`;
        button.innerHTML = showIcon + "Show";
        // Accept note span as argument for updating icon
        let noteSpan = arguments[0];
        button.addEventListener('click', function(event) {
            event.stopPropagation();
            const fold = button.closest(`.${CSS_NAMESPACE}-fold`);
            const parent = fold && fold.parentElement;
            // Find the note span
            const note = noteSpan || (fold ? fold.querySelector(`.${CSS_NAMESPACE}-note`) : null);
            // Extract message (after icon)
            let message = note ? note.innerHTML.replace(new RegExp(`<span[^>]*class=["']${CSS_NAMESPACE}-icon["'][^>]*><\\/span>\\s*`, 'i'), "") : "";
            if (parent && parent.classList.contains(`${CSS_NAMESPACE}-unhide`)) {
                parent.classList.remove(`${CSS_NAMESPACE}-unhide`);
                if (note) note.innerHTML = showIcon + message;
                button.innerHTML = showIcon + "Show";
            } else if (parent) {
                parent.classList.add(`${CSS_NAMESPACE}-unhide`);
                if (note) note.innerHTML = hideIcon + message;
                button.innerHTML = hideIcon + "Hide";
            }
        });
        return button;
    }
    
    // Highlight work
    function highlightWork(blurb, tags) {
        for (const tag of tags) {
            if (config.tagHighlights.includes(tag.toLowerCase())) {
                blurb.classList.add('ao3-blocker-highlight');
                blurb.style.backgroundColor = config.highlightColor;
                break;
            }
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();