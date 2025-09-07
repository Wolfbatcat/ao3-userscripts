// ==UserScript==
// @name        AO3: Quality Score & Reading Time
// @description Combined script with quality score and reading time features
// @namespace   https://github.com/ao3-userscripts
// @author      Blackbatcat & lomky (qscore by C89sd)
// @version     1.1.1
// @match       *://archiveofourown.org/*
// @match       *://*.archiveofourown.org/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // Statistical functions
    const nullHyp = 0.04;

    function getPValue(hits, kudos, chapters) {
        const testProp = kudos / hits;
        const zValue = (testProp - nullHyp) / Math.sqrt((nullHyp * (1 - nullHyp)) / hits);
        return normalcdf(0, -1 * zValue, 1);
    }

    function normalcdf(mean, upperBound, standardDev) {
        const z = (standardDev - mean) / Math.sqrt(2 * upperBound * upperBound);
        const t = 1 / (1 + 0.3275911 * Math.abs(z));
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
        const sign = z < 0 ? -1 : 1;
        return (1 / 2) * (1 + sign * erf);
    }

    // qscore calculation function
    function computeQScore(hits, kudos, chapters) {
        if (!hits || !kudos || hits === 0 || kudos === 0) {
            return [0, 0];
        }

        const newHitsCount = hits / Math.sqrt(chapters || 1);
        let score = 100 * kudos / newHitsCount;

        if (kudos < 11) {
            score = 1;
        }

        const pValue = getPValue(newHitsCount, kudos, chapters || 1);
        if (pValue < 0.05) {
            score = 1;
        }

        // Convert score to percentage where 35 = 100%, round up to nearest integer
        let percentScore = Math.min(Math.ceil((score / 35) * 100), 100);
        return [percentScore, 0];
    }

    // Default configuration
    const DEFAULT_CONFIG = {
        qualityScoreEnabled: true,
        qualityScoreAlwaysCount: true,
        qualityScoreAlwaysSort: false,
        qualityScoreHideHitcount: false,
    // Adjust thresholds for percentage scale (e.g., 8/35*100 ≈ 23, 16/35*100 ≈ 46)
    qualityScoreThresholds: { low: 40, high: 70 },
        qualityScoreKudosThreshold: 100,

        readingTimeEnabled: true,
        readingTimeAlwaysCount: true,
        readingTimeWpm: 260,
        readingTimeThresholds: { yellow: 180, red: 500 },

        sharedColors: {
            low: '#eb6f92',
            medium: '#9ccfd8',
            high: '#3e8fb0',
            text: '#ffffff'
        },

        scoreStyle: {
            borderRadius: '4px',
            padding: '0px 6px',
            textAlign: 'center',
            minWidth: '30px',
            display: 'inline-block'
        }
    };

    // Current configuration
    let CONFIG = { ...DEFAULT_CONFIG };

    // Helper functions
    const $ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const $1 = (selector, root = document) => root.querySelector(selector);

    // Load configuration
    function loadConfig() {
        try {
            const savedConfig = GM_getValue('ao3_enhancements_config');
            if (savedConfig) {
                CONFIG = { ...DEFAULT_CONFIG, ...savedConfig };
            }
        } catch (e) {
            console.error('Error loading configuration:', e);
            if (typeof Storage !== 'undefined') {
                try {
                    const savedConfig = localStorage.getItem('ao3_enhancements_config');
                    if (savedConfig) {
                        CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
                    }
                } catch (e2) {
                    console.error('Error loading from localStorage:', e2);
                }
            }
        }
    }

    // Save configuration
    function saveConfig() {
        try {
            GM_setValue('ao3_enhancements_config', CONFIG);
        } catch (e) {
            console.error('Error saving configuration:', e);
            if (typeof Storage !== 'undefined') {
                try {
                    localStorage.setItem('ao3_enhancements_config', JSON.stringify(CONFIG));
                } catch (e2) {
                    console.error('Error saving to localStorage:', e2);
                }
            }
        }
    }

    // Robust number parsing function
    function getNumberFromElement(element) {
        if (!element) return NaN;

        // Prefer data-ao3e-original attribute, fall back to textContent
        let numberText = element.getAttribute('data-ao3e-original') || element.textContent;
        if (!numberText) return NaN;

        // Clean the string: remove commas, thin spaces, normal spaces
        const cleanText = numberText.replace(/[,\s  ]/g, '');

        // For chapters, split on '/' and take first part
        if (element.matches('dd.chapters')) {
            const parts = cleanText.split('/');
            numberText = parts[0];
        } else {
            numberText = cleanText;
        }

        const number = parseInt(numberText, 10);
        return isNaN(number) ? NaN : number;
    }

    // Quality Score Functions
    function countRatio() {
        if (!CONFIG.qualityScoreEnabled) return;

        const statsElements = $('dl.stats');

        statsElements.forEach(stats => {
            try {
                if (stats.dataset.qscoreProcessed === 'true') return;

                const hitsEl = $1('dd.hits', stats);
                const kudosEl = $1('dd.kudos', stats);
                const chaptersEl = $1('dd.chapters', stats);

                if (!hitsEl || !kudosEl) return;

                const hits = getNumberFromElement(hitsEl);
                const kudos = getNumberFromElement(kudosEl);
                const chapters = chaptersEl ? getNumberFromElement(chaptersEl) : 1;

                if (isNaN(hits) || isNaN(kudos) || hits === 0 || kudos === 0) return;

                if (kudos < CONFIG.qualityScoreKudosThreshold) {
                    removeElements(stats, 'dt.kudoshits, dd.kudoshits');
                    return;
                }

                const [percentScore] = computeQScore(hits, kudos, chapters);
                const scoreFormatted = String(percentScore);

                removeElements(stats, 'dt.kudoshits, dd.kudoshits');

                const label = document.createElement('dt');
                label.className = 'kudoshits';
                label.textContent = 'Score:';
                label.style.marginRight = '5px';

                const value = document.createElement('dd');
                value.className = 'kudoshits';
                value.textContent = scoreFormatted;

                Object.assign(value.style, CONFIG.scoreStyle);
                value.style.color = CONFIG.sharedColors.text;

                // Ensure color values are valid hex codes
                const lowColor = CONFIG.sharedColors.low || '#eb6f92';
                const mediumColor = CONFIG.sharedColors.medium || '#9ccfd8';
                const highColor = CONFIG.sharedColors.high || '#3e8fb0';

                if (percentScore >= CONFIG.qualityScoreThresholds.high) {
                    value.style.backgroundColor = highColor;
                } else if (percentScore >= CONFIG.qualityScoreThresholds.low) {
                    value.style.backgroundColor = mediumColor;
                } else {
                    value.style.backgroundColor = lowColor;
                }

                hitsEl.after(value, label);

                const workItem = stats.closest('li.work, li.bookmark');
                if (workItem) {
                    workItem.dataset.qualityScore = percentScore;
                    console.log('[QScore] Set dataset.qualityScore:', percentScore, workItem);
                }

                if (CONFIG.qualityScoreHideHitcount && !stats.closest('.statistics')) {
                    hitsEl.style.display = 'none';
                }

                stats.dataset.qscoreProcessed = 'true';

            } catch (error) {
                console.error('Error processing work stats:', error);
            }
        });
    }

    function sortByRatio(ascending = false) {
        const statsElements = $('dl.stats');

        statsElements.forEach(stats => {
            const listItem = stats.closest('li');
            const list = listItem?.parentElement;
            if (!list) return;

            const works = Array.from(list.children);

            works.sort((a, b) => {
                const aScore = parseFloat(a.dataset.qualityScore) || 0;
                const bScore = parseFloat(b.dataset.qualityScore) || 0;
                return ascending ? aScore - bScore : bScore - aScore;
            });

            works.forEach(work => list.appendChild(work));
        });
    }

    // Reading Time Functions
    function calculateReadtime() {
        if (!CONFIG.readingTimeEnabled) return;

        const statsElements = $('dl.stats');

        statsElements.forEach(stats => {
            if (stats.dataset.readtimeProcessed === 'true') return;

            const wordsEl = $1('dd.words', stats);
            if (!wordsEl) return;

            const wordsCount = getNumberFromElement(wordsEl);
            if (isNaN(wordsCount)) return;

            const minutes = wordsCount / CONFIG.readingTimeWpm;
            const hrs = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            const minutes_print = hrs > 0 ? `${hrs}h${mins}m` : `${mins}m`;

            removeElements(stats, 'dt.readtime, dd.readtime');

            const label = document.createElement('dt');
            label.className = 'readtime';
            label.textContent = 'Readtime:';

            const value = document.createElement('dd');
            value.className = 'readtime';
            value.textContent = minutes_print;

            Object.assign(value.style, CONFIG.scoreStyle);
            value.style.color = CONFIG.sharedColors.text;

            const lowColor = CONFIG.sharedColors.low || '#eb6f92';
            const mediumColor = CONFIG.sharedColors.medium || '#9ccfd8';
            const highColor = CONFIG.sharedColors.high || '#3e8fb0';

            if (minutes <= CONFIG.readingTimeThresholds.yellow) {
                value.style.backgroundColor = highColor;
            } else if (minutes <= CONFIG.readingTimeThresholds.red) {
                value.style.backgroundColor = mediumColor;
            } else {
                value.style.backgroundColor = lowColor;
            }

            wordsEl.after(value, label);
            stats.dataset.readtimeProcessed = 'true';
        });
    }

    // Helper to remove elements
    function removeElements(parent, selector) {
        $(selector, parent).forEach(el => el.remove());
    }

    // Check if page has stats elements
    function checkPrerequisites() {
        return $('dl.stats').length > 0;
    }

    // Settings Dialog
    function showSettings() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
            z-index: 10000;
            width: 90%;
            max-width: 450px;
            max-height: 80vh;
            overflow-y: auto;
            color: #333;
            font-family: inherit;
            font-size: 16px;
            box-sizing: border-box;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; font-size: 1.2em;">⚙️ Settings ⚙️</h3>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em;">Quality Score</h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="qs-enabled" ${CONFIG.qualityScoreEnabled ? 'checked' : ''}>
                    Enable Quality Score
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="qs-auto-count" ${CONFIG.qualityScoreAlwaysCount ? 'checked' : ''}>
                    Count automatically
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="qs-auto-sort" ${CONFIG.qualityScoreAlwaysSort ? 'checked' : ''}>
                    Sort automatically
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="qs-hide-hits" ${CONFIG.qualityScoreHideHitcount ? 'checked' : ''}>
                    Hide hit counts
                </label>

                <div style="margin: 10px 0;">
                    <label>Minimum kudos to show score:</label>
                    <input type="number" id="qs-kudos-threshold" value="${CONFIG.qualityScoreKudosThreshold}" min="0" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>Low threshold (low to medium):</label>
                    <input type="number" id="qs-low-threshold" value="${CONFIG.qualityScoreThresholds.low}" min="0" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>High threshold (medium to high):</label>
                    <input type="number" id="qs-high-threshold" value="${CONFIG.qualityScoreThresholds.high}" min="0" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em;">Reading Time</h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="rt-enabled" ${CONFIG.readingTimeEnabled ? 'checked' : ''}>
                    Enable Reading Time
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="rt-auto-count" ${CONFIG.readingTimeAlwaysCount ? 'checked' : ''}>
                    Count automatically
                </label>

                <div style="margin: 10px 0;">
                    <label>Words per minute:</label>
                    <input type="number" id="rt-wpm" value="${CONFIG.readingTimeWpm}" min="50" max="500" step="10" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>Yellow threshold (minutes):</label>
                    <input type="number" id="rt-yellow-threshold" value="${CONFIG.readingTimeThresholds.yellow}" min="1" max="1000" step="5" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>Red threshold (minutes):</label>
                    <input type="number" id="rt-red-threshold" value="${CONFIG.readingTimeThresholds.red}" min="1" max="1000" step="5" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

                <div style="margin-bottom: 15px;">
                    <h4 style="margin-bottom: 10px; font-size: 1.1em;">Shared Color Settings</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="margin: 5px 0;">
                            <label style="display: block; margin-bottom: 5px;">Low color:</label>
                            <input type="color" id="shared-low-color" value="${CONFIG.sharedColors.low || '#eb6f92'}" style="width: 100%;">
                        </div>
                        <div style="margin: 5px 0;">
                            <label style="display: block; margin-bottom: 5px;">Medium color:</label>
                            <input type="color" id="shared-medium-color" value="${CONFIG.sharedColors.medium || '#9ccfd8'}" style="width: 100%;">
                        </div>
                        <div style="margin: 5px 0;">
                            <label style="display: block; margin-bottom: 5px;">High color:</label>
                            <input type="color" id="shared-high-color" value="${CONFIG.sharedColors.high || '#3e8fb0'}" style="width: 100%;">
                        </div>
                        <div style="margin: 5px 0;">
                            <label style="display: block; margin-bottom: 5px;">Text color:</label>
                            <input type="color" id="shared-text-color" value="${CONFIG.sharedColors.text || '#ffffff'}" style="width: 100%;">
                        </div>
                    </div>
                </div>

            <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 15px;">
                <button id="ao3e-save" style="flex: 1; padding: 10px; font-size: 1em;">Save</button>
                <button id="ao3e-cancel" style="flex: 1; padding: 10px; font-size: 1em;">Cancel</button>
            </div>

            <div style="text-align: center; margin-top: 10px;">
                <a href="#" id="ao3e-reset" style="font-size: 0.9em; color: #666; text-decoration: none;">Reset to Default Settings</a>
            </div>
        `;

        document.body.appendChild(dialog);

        // Event handlers
        dialog.querySelector('#ao3e-save').addEventListener('click', saveSettings);
        dialog.querySelector('#ao3e-cancel').addEventListener('click', () => dialog.remove());
        dialog.querySelector('#ao3e-reset').addEventListener('click', resetSettings);

        function saveSettings() {
            CONFIG.qualityScoreEnabled = document.getElementById('qs-enabled').checked;
            CONFIG.qualityScoreAlwaysCount = document.getElementById('qs-auto-count').checked;
            CONFIG.qualityScoreAlwaysSort = document.getElementById('qs-auto-sort').checked;
            CONFIG.qualityScoreHideHitcount = document.getElementById('qs-hide-hits').checked;
            CONFIG.qualityScoreKudosThreshold = parseInt(document.getElementById('qs-kudos-threshold').value);
            CONFIG.qualityScoreThresholds.low = parseFloat(document.getElementById('qs-low-threshold').value);
            CONFIG.qualityScoreThresholds.high = parseFloat(document.getElementById('qs-high-threshold').value);

            CONFIG.readingTimeEnabled = document.getElementById('rt-enabled').checked;
            CONFIG.readingTimeAlwaysCount = document.getElementById('rt-auto-count').checked;
            CONFIG.readingTimeWpm = parseInt(document.getElementById('rt-wpm').value);
            CONFIG.readingTimeThresholds.yellow = parseInt(document.getElementById('rt-yellow-threshold').value);
            CONFIG.readingTimeThresholds.red = parseInt(document.getElementById('rt-red-threshold').value);

            CONFIG.sharedColors.low = document.getElementById('shared-low-color').value;
            CONFIG.sharedColors.medium = document.getElementById('shared-medium-color').value;
            CONFIG.sharedColors.high = document.getElementById('shared-high-color').value;
            CONFIG.sharedColors.text = document.getElementById('shared-text-color').value;

            saveConfig();
            dialog.remove();
            refreshDisplay();
        }

        function resetSettings(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to reset all settings to default values?')) {
                CONFIG = { ...DEFAULT_CONFIG };
                saveConfig();
                dialog.remove();
                refreshDisplay();
            }
        }
    }

    function refreshDisplay() {
        if (CONFIG.qualityScoreEnabled && CONFIG.qualityScoreAlwaysCount) {
            countRatio();
            if (CONFIG.qualityScoreAlwaysSort) {
                sortByRatio();
            }
        }

        if (CONFIG.readingTimeEnabled && CONFIG.readingTimeAlwaysCount) {
            calculateReadtime();
        }
    }

    // Menu registration function for page context
    function registerWithMenu() {
        if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function') {
            window.AO3UserScriptMenu.register({
                label: 'Quality Score & Reading Time',
                onClick: function() {
                    window.dispatchEvent(new CustomEvent('ao3-qscore-menu-click'));
                }
            });
        } else {
            // Fallback: add a Userscripts dropdown menu to the AO3 header navigation
            if (!document.getElementById('ao3-userscript-fallback-menu')) {
                let nav = document.querySelector('ul.primary') || document.querySelector('nav.primary ul') || document.querySelector('nav.primary');
                if (nav) {
                    // Create the Userscripts dropdown
                    const menuItem = document.createElement('li');
                    menuItem.className = 'dropdown';
                    menuItem.id = 'ao3-userscript-fallback-menu';
                    const title = document.createElement('a');
                    title.href = '#';
                    title.textContent = 'Userscripts';
                    menuItem.appendChild(title);
                    const menu = document.createElement('ul');
                    menu.className = 'menu dropdown-menu';
                    menuItem.appendChild(menu);
                    // Add our script's menu item
                    const scriptItem = document.createElement('li');
                    const scriptLink = document.createElement('a');
                    scriptLink.href = '#';
                    scriptLink.textContent = 'Quality Score & Reading Time';
                    scriptLink.addEventListener('click', function(e) {
                        e.preventDefault();
                        // Dispatch custom event so userscript context can handle it
                        window.dispatchEvent(new CustomEvent('ao3-qscore-menu-click'));
                    });
                    scriptItem.appendChild(scriptLink);
                    menu.appendChild(scriptItem);
                    // Insert after About if possible
                    const aboutItem = Array.from(nav.children).find(li => li.textContent && li.textContent.match(/About/i));
                    if (aboutItem && aboutItem.nextSibling) {
                        nav.insertBefore(menuItem, aboutItem.nextSibling);
                    } else {
                        nav.appendChild(menuItem);
                    }
                }
            }
        }
    }

    // Function to inject menu registration into page context
    function injectMenuRegistration() {
        const script = document.createElement('script');
        script.textContent = `(${registerWithMenu.toString()})();`;
        document.documentElement.appendChild(script);
        script.remove();
    }

    // Initialize script
    function initializeScript() {
        loadConfig();

        if (!checkPrerequisites()) {
            setTimeout(initializeScript, 500);
            return;
        }

        refreshDisplay();

        // Throttle function to prevent rapid repeated calls
        let refreshTimeout = null;
        function throttledRefreshDisplay() {
            if (refreshTimeout) return;
            refreshTimeout = setTimeout(() => {
                refreshDisplay();
                refreshTimeout = null;
            }, 300); // 300ms throttle
        }

        // Observe only the main works/bookmarks container if present
        const worksContainer = document.querySelector('ol.work.index.group, ol.bookmark.index.group');
        if (worksContainer) {
            const observer = new MutationObserver((mutations) => {
                const shouldProcess = mutations.some(mutation => mutation.addedNodes.length > 0);
                if (shouldProcess) {
                    throttledRefreshDisplay();
                }
            });
            observer.observe(worksContainer, {
                childList: true,
                subtree: true
            });
        }

        // Fallback: observe body if worksContainer not found, but throttle
        else {
            const observer = new MutationObserver((mutations) => {
                const shouldProcess = mutations.some(mutation => mutation.addedNodes.length > 0);
                if (shouldProcess) {
                    throttledRefreshDisplay();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // Only inject fallback menu if AO3UserScriptMenu is not present or not working
        if (!(window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function')) {
            injectMenuRegistration();
        }
    }

    // Listen for menu click events from the page context
    window.addEventListener('ao3-qscore-menu-click', showSettings);

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeScript);
    } else {
        initializeScript();
    }

    // Fallback initialization
    setTimeout(() => {
        if (CONFIG.qualityScoreEnabled && CONFIG.qualityScoreAlwaysCount && !document.querySelector('dt.kudoshits')) {
            countRatio();
        }
        if (CONFIG.readingTimeEnabled && CONFIG.readingTimeAlwaysCount && !document.querySelector('dt.readtime')) {
            calculateReadtime();
        }
    }, 3000);
})();