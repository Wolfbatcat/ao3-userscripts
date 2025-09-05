// ==UserScript==
// @name        AO3: Quality Score & Reading Time (qscore)
// @description Combined script with qscore algorithm and estimated reading time features
// @namespace   https://github.com/ao3-enhancements
// @author      Wolfbatcat & lomky (qscore by C89sd)
// @version     3.9
// @match       *://archiveofourown.org/*
// @match       *://*.archiveofourown.org/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_registerMenuCommand
// @require     https://ajax.googleapis.com/ajax/libs/jquery/1.9.0/jquery.min.js
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // qscore configuration
    const QSCORE_CONFIG = {
        "mean":    [8.78763670537219, 5.756818885989689],
        "pc_axes": [[0.7652187732654738, 0.6437703232070295], [-0.6437703232070295, 0.7652187732654738]],
        "sigma_up":   0.49154274821813837,
        "sigma_down": 0.6763725627627314
    };
    
    const m0  = QSCORE_CONFIG.mean[0],        m1 = QSCORE_CONFIG.mean[1];
    const a11 = QSCORE_CONFIG.pc_axes[0][0], a12 = QSCORE_CONFIG.pc_axes[0][1];
    const a21 = QSCORE_CONFIG.pc_axes[1][0], a22 = QSCORE_CONFIG.pc_axes[1][1];
    const sUp = QSCORE_CONFIG.sigma_up,      sDn = QSCORE_CONFIG.sigma_down;

    // Normal CDF function for qscore calculation
    function ncdf(z) {
        let t = 1 / (1 + 0.2315419 * Math.abs(z));
        let d = 0.3989423 * Math.exp(-z * z / 2);
        let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        if (z > 0) prob = 1 - prob;
        return prob;
    }

    // qscore calculation function
    function computeQScore(hits, kudos) {
        if (!hits || !kudos || hits === 0 || kudos === 0) return [0, 0];
        
        const xlog = Math.log(hits);
        const ylog = Math.log(kudos);
        
        // translate
        const dx = xlog - m0;
        const dy = ylog - m1;
        
        // rotate, we only need the 2nd PCA axis, dot(dx,dy)
        const p1 = dx * a11 + dy * a12;
        const p2 = dx * a21 + dy * a22;
        
        // top half: ncdf(z) ∈ [0.5…1] for z>=0
        if (p2 >= 0) { 
            return [ncdf(p2 / sUp) * 100, p1];
        }
        // bottom half: we want [0…0.5] so we reflect
        else {         
            return [(1 - ncdf((-p2) / sDn)) * 100, p1];
        }
    }

    // Default configuration
    const DEFAULT_CONFIG = {
        // Quality Score settings
        qualityScoreEnabled: true,
        qualityScoreAlwaysCount: true,
        qualityScoreAlwaysSort: false,
        qualityScoreHideHitcount: true,
        qualityScoreThresholds: { low: 40, high: 70 },

        // Reading Time settings
        readingTimeEnabled: true,
        readingTimeAlwaysCount: true,
        readingTimeWpm: 200,
        readingTimeThresholds: { yellow: 60, red: 160 },

        sharedColors: {
            red: '#eb6f92',
            yellow: '#f6c177',
            green: '#3e8fb0',
            text: 'white',
            dimmedBg: '#9893a5',
            dimmedText: '#dfdad9'
        },

        // Common style settings
        scoreStyle: {
            borderRadius: '4px',
            padding: '0px 6px',
            textAlign: 'center',
            minWidth: '30px',
            display: 'inline-block'
        }
    };

    // Load configuration from storage
    let CONFIG = { ...DEFAULT_CONFIG };
    function loadConfig() {
        try {
            const savedConfig = GM_getValue('ao3_enhancements_config');
            if (savedConfig) {
                CONFIG = { ...DEFAULT_CONFIG, ...savedConfig };
            }
        } catch (e) {
            console.error('Error loading configuration:', e);
            // Fallback to localStorage if GM functions not available
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

    // Save configuration to storage
    function saveConfig() {
        try {
            GM_setValue('ao3_enhancements_config', CONFIG);
        } catch (e) {
            console.error('Error saving configuration:', e);
            // Fallback to localStorage if GM functions not available
            if (typeof Storage !== 'undefined') {
                try {
                    localStorage.setItem('ao3_enhancements_config', JSON.stringify(CONFIG));
                } catch (e2) {
                    console.error('Error saving to localStorage:', e2);
                }
            }
        }
    }

    // Parse int and ignore the thousands marker 1,000
    const commaRegex = /,/g;
    function parse(str) {
        return str ? parseInt(str.replace(commaRegex, ''), 10) : 0;
    }

    // Quality Score Functions
    function countRatio() {
        if (!CONFIG.qualityScoreEnabled) return;

        const statsElements = document.querySelectorAll('dl.stats');

        statsElements.forEach(stats => {
            try {
                const hitsEl = stats.querySelector('dd.hits');
                const kudosEl = stats.querySelector('dd.kudos');
                const chaptersEl = stats.querySelector('dd.chapters');

                if (!hitsEl || !kudosEl) return;

                const hits = parse(hitsEl.textContent);
                const kudos = parse(kudosEl.textContent);

                if (isNaN(hits) || isNaN(kudos) || hits === 0 || kudos === 0) return;

                const [score, pc1] = computeQScore(hits, kudos);
                const scoreFormatted = Math.round(score);

                // Remove existing elements if they exist
                const existingLabel = stats.querySelector('dt.kudoshits');
                const existingValue = stats.querySelector('dd.kudoshits');
                if (existingLabel) existingLabel.remove();
                if (existingValue) existingValue.remove();

                // Create and insert new elements
                const label = document.createElement('dt');
                label.className = 'kudoshits';
                label.textContent = 'Score:';
                label.style.marginRight = '5px';

                const value = document.createElement('dd');
                value.className = 'kudoshits';
                value.textContent = scoreFormatted;

                // Apply the style
                Object.assign(value.style, CONFIG.scoreStyle);

                // Dim low-confidence scores (less than 5 kudos and not above the diagonal)
                const shouldDim = kudos < 5 && !(pc1 > -6.132);
                if (shouldDim) {
                    value.style.backgroundColor = "#9893a5";
                    value.style.color = "#dfdad9";
                    value.style.setProperty("background-color", "#9893a5", "important");
                    value.style.setProperty("color", "#dfdad9", "important");
                } else {
                    value.style.color = CONFIG.sharedColors.text;
                    // Apply coloring for non-dimmed scores
                    if (score >= CONFIG.qualityScoreThresholds.high) {
                        value.style.backgroundColor = CONFIG.sharedColors.green;
                    } else if (score >= CONFIG.qualityScoreThresholds.low) {
                        value.style.backgroundColor = CONFIG.sharedColors.yellow;
                    } else {
                        value.style.backgroundColor = CONFIG.sharedColors.red;
                    }
                }

                // Insert after hits element
                hitsEl.after(label, value);

                // Store score on parent element for sorting
                const workItem = stats.closest('li.work, li.bookmark');
                if (workItem) {
                    workItem.dataset.qualityScore = score;
                    if (shouldDim) {
                        workItem.dataset.qualityScoreDimmed = 'true';
                    }
                }

                // Hide hits if configured
                if (CONFIG.qualityScoreHideHitcount && !stats.closest('.statistics')) {
                    hitsEl.style.display = 'none';
                }

            } catch (error) {
                console.error('Error processing work stats:', error);
            }
        });
    }

    function sortByRatio(ascending = false) {
        const statsElements = document.querySelectorAll('dl.stats');

        statsElements.forEach(stats => {
            const list = stats.closest('li').parentNode;
            if (!list) return;

            const works = Array.from(list.children);

            works.sort((a, b) => {
                const aScore = parseFloat(a.dataset.qualityScore) || 0;
                const bScore = parseFloat(b.dataset.qualityScore) || 0;
                const aDimmed = a.dataset.qualityScoreDimmed === 'true';
                const bDimmed = b.dataset.qualityScoreDimmed === 'true';
                
                // Sort dimmed scores lower than non-dimmed scores with the same value
                if (aDimmed !== bDimmed) {
                    return aDimmed ? 1 : -1;
                }
                
                return ascending ? aScore - bScore : bScore - aScore;
            });

            works.forEach(work => list.appendChild(work));
        });
    }

    // Reading Time Functions
    function checkCountable() {
        const found_stats = $('dl.stats');
        if (!found_stats.length) return false;

        let countable = false;

        if (found_stats.closest('li').is('.work, .bookmark')) {
            countable = true;
        }
        else if (found_stats.parents('.statistics').length) {
            countable = true;
        }
        else if (found_stats.parents('dl.work').length) {
            countable = true;
        }

        return countable;
    }

    function calculateReadtime() {
        if (!CONFIG.readingTimeEnabled) return;
        if (!checkCountable()) return;

        $('dl.stats').each(function() {
            const words_value = $(this).find('dd.words');
            if (!words_value.length) return;

            // Calculate read time
            const words_count = parseInt(words_value.text().replace(/,/g, ''));
            const minutes = words_count / CONFIG.readingTimeWpm;
            const hrs = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            const minutes_print = hrs > 0 ? `${hrs}h${mins}m` : `${mins}m`;

            // Remove existing elements if they exist
            $(this).find('dt.readtime, dd.readtime').remove();

            // Create readtime elements
            const readtime_label = $('<dt class="readtime">').text('Readtime:');
            const readtime_value = $('<dd class="readtime">').text(minutes_print);

            // Add to DOM
            words_value.after('\n', readtime_label, '\n', readtime_value);

            // Apply styling
            readtime_value.css(CONFIG.scoreStyle);
            readtime_value.css('color', CONFIG.sharedColors.text);

            // Apply coloring
            if (minutes <= CONFIG.readingTimeThresholds.yellow) {
                readtime_value.css('background-color', CONFIG.sharedColors.green);
            }
            else if (minutes <= CONFIG.readingTimeThresholds.red) {
                readtime_value.css('background-color', CONFIG.sharedColors.yellow);
            }
            else {
                readtime_value.css('background-color', CONFIG.sharedColors.red);
            }
        });
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
            max-width: 400px;
            max-height: 80vh;
            overflow-y: auto;
            color: #333;
            font-family: inherit;
            font-size: 16px;
            box-sizing: border-box;
        `;

        dialog.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; font-size: 1.2em;">AO3 Enhancement Settings</h3>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em;">Quality Score Settings</h4>
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
                    <label>Low threshold (red to yellow):</label>
                    <input type="number" id="qs-low-threshold" value="${CONFIG.qualityScoreThresholds.low}" min="0" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>High threshold (yellow to green):</label>
                    <input type="number" id="qs-high-threshold" value="${CONFIG.qualityScoreThresholds.high}" min="0" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em;">Reading Time Settings</h4>
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
                        <label style="display: block; margin-bottom: 5px;">Red color:</label>
                        <input type="color" id="shared-red-color" value="${CONFIG.sharedColors.red}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Yellow color:</label>
                        <input type="color" id="shared-yellow-color" value="${CONFIG.sharedColors.yellow}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Green color:</label>
                        <input type="color" id="shared-green-color" value="${CONFIG.sharedColors.green}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Dimmed color:</label>
                        <input type="color" id="shared-dimmed-color" value="${CONFIG.sharedColors.dimmed}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Text color:</label>
                        <input type="color" id="shared-text-color" value="${CONFIG.sharedColors.text}" style="width: 100%;">
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 10px;">
                <button id="ao3e-save" style="flex: 1; padding: 10px; font-size: 1em;">Save</button>
                <button id="ao3e-cancel" style="flex: 1; padding: 10px; font-size: 1em;">Cancel</button>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('#ao3e-save').addEventListener('click', () => {
            // Quality Score settings
            CONFIG.qualityScoreEnabled = document.getElementById('qs-enabled').checked;
            CONFIG.qualityScoreAlwaysCount = document.getElementById('qs-auto-count').checked;
            CONFIG.qualityScoreAlwaysSort = document.getElementById('qs-auto-sort').checked;
            CONFIG.qualityScoreHideHitcount = document.getElementById('qs-hide-hits').checked;
            CONFIG.qualityScoreThresholds.low = parseFloat(document.getElementById('qs-low-threshold').value);
            CONFIG.qualityScoreThresholds.high = parseFloat(document.getElementById('qs-high-threshold').value);

            // Reading Time settings
            CONFIG.readingTimeEnabled = document.getElementById('rt-enabled').checked;
            CONFIG.readingTimeAlwaysCount = document.getElementById('rt-auto-count').checked;
            CONFIG.readingTimeWpm = parseInt(document.getElementById('rt-wpm').value);
            CONFIG.readingTimeThresholds.yellow = parseInt(document.getElementById('rt-yellow-threshold').value);
            CONFIG.readingTimeThresholds.red = parseInt(document.getElementById('rt-red-threshold').value);

            // Shared color settings
            CONFIG.sharedColors.red = document.getElementById('shared-red-color').value;
            CONFIG.sharedColors.yellow = document.getElementById('shared-yellow-color').value;
            CONFIG.sharedColors.green = document.getElementById('shared-green-color').value;
            CONFIG.sharedColors.dimmed = document.getElementById('shared-dimmed-color').value;
            CONFIG.sharedColors.text = document.getElementById('shared-text-color').value;

            saveConfig();
            dialog.remove();

            // Refresh the display
            if (CONFIG.qualityScoreEnabled && CONFIG.qualityScoreAlwaysCount) {
                countRatio();
                if (CONFIG.qualityScoreAlwaysSort) {
                    sortByRatio();
                }
            }

            if (CONFIG.readingTimeEnabled && CONFIG.readingTimeAlwaysCount) {
                calculateReadtime();
            }
        });

        dialog.querySelector('#ao3e-cancel').addEventListener('click', () => {
            dialog.remove();
        });
    }

    // Register with AO3 Master Menu with retry mechanism
    function registerWithMasterMenu() {
        if (typeof window.AO3UserScripts !== 'undefined') {
            window.AO3UserScripts.register({
                label: 'Quality Score & Reading Time',
                onClick: showSettings
            });
            console.log('Registered with AO3 Master Menu');
            return true;
        }
        return false;
    }

    // Create standalone menu if Master Menu is not available
    function createStandaloneMenu() {
        // Find navigation - multiple possible locations
        const nav = document.querySelector('ul.primary') ||
                   document.querySelector('nav.primary') ||
                   document.querySelector('#dashboard ul.actions');

        if (!nav) {
            console.warn('Could not find navigation for standalone menu');
            return false;
        }

        // Check if a Userscripts menu already exists
        let container = nav.querySelector('li.dropdown:has(a[href="#"])');
        
        // If no existing menu, create one
        if (!container) {
            container = document.createElement('li');
            container.className = 'dropdown';

            const title = document.createElement('a');
            title.href = '#';
            title.textContent = 'Userscripts';
            container.appendChild(title);

            const menu = document.createElement('ul');
            menu.className = 'menu dropdown-menu';
            container.appendChild(menu);

            // Insert into navigation
            const searchItem = nav.querySelector('li.search');
            if (searchItem) {
                nav.insertBefore(container, searchItem);
            } else {
                nav.appendChild(container);
            }
        }

        // Get the menu element
        const menu = container.querySelector('ul.menu') || container.querySelector('ul.dropdown-menu');
        
        // Add settings item
        const settingsItem = document.createElement('li');
        const settingsLink = document.createElement('a');
        settingsLink.href = '#';
        settingsLink.textContent = 'Quality Score & Reading Time';
        settingsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSettings();
        });
        settingsItem.appendChild(settingsLink);
        menu.appendChild(settingsItem);

        console.log('Created standalone menu item');
        return true;
    }

    // Initialize
    loadConfig();

    // Main execution
    function main() {
        if (CONFIG.qualityScoreEnabled && CONFIG.qualityScoreAlwaysCount) {
            countRatio();
            if (CONFIG.qualityScoreAlwaysSort) {
                sortByRatio();
            }
        }

        if (CONFIG.readingTimeEnabled && CONFIG.readingTimeAlwaysCount) {
            calculateReadtime();
        }

        // Try to register with master menu, fallback to standalone
        if (!registerWithMasterMenu()) {
            // Wait a bit for master menu to potentially load, then create standalone
            setTimeout(() => {
                if (!registerWithMasterMenu()) {
                    createStandaloneMenu();
                }
            }, 2000);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
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