// ==UserScript==
// @name        AO3: Better Quality Score
// @description Uses a word-count-based kudos/hits ratio to score and sort AO3 works. Highly customizable.
// @namespace   
// @author      BlackBatCat (based on cupkax's original script)
// @version     1
// @include     http://archiveofourown.org/*
// @include     https://archiveofourown.org/*
// @license     MIT
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    // DEFAULT CONFIGURATION
    const DEFAULTS = {
    alwaysCount: true,
    alwaysSort: false,
    hideHitcount: false,
    useNormalization: false,
    userMaxScore: 36,
    minKudosToShowScore: 100,
    colorThresholdLow: 8,
    colorThresholdHigh: 14,
    colorLow: '#eb6f92',
    colorMed: '#9ccfd8',
    colorHigh: '#3e8fb0',
    colorText: '#ffffff'
    };

    // Current config, loaded from localStorage
    let CONFIG = { ...DEFAULTS };

    // Variables to track the state of the page
    let countable = false;
    let sortable = false;
    let statsPage = false;

    // --- HELPER FUNCTIONS ---
    const $ = (selector, root = document) => root.querySelectorAll(selector);
    const $1 = (selector, root = document) => root.querySelector(selector);

    // Load user settings from localStorage
    const loadUserSettings = () => {
        if (typeof Storage === 'undefined') return;
        for (const [key, defaultValue] of Object.entries(DEFAULTS)) {
            if (key === 'colourBackground') continue; // Remove color background option
            const saved = localStorage.getItem(key + 'Local');
            if (saved !== null) {
                if (typeof defaultValue === 'boolean') {
                    CONFIG[key] = saved === 'true';
                } else if (typeof defaultValue === 'number') {
                    CONFIG[key] = parseFloat(saved) || defaultValue;
                } else {
                    CONFIG[key] = saved;
                }
            }
        }
    };

    // Save a setting to localStorage
    const saveSetting = (key, value) => {
        CONFIG[key] = value;
        if (typeof Storage !== 'undefined') {
            localStorage.setItem(key + 'Local', value);
        }
    };

    // Reset all settings to defaults
    const resetAllSettings = () => {
        if (confirm('Reset all settings to defaults?')) {
            for (const key of Object.keys(DEFAULTS)) {
                if (key === 'colourBackground') continue;
                localStorage.removeItem(key + 'Local');
            }
            CONFIG = { ...DEFAULTS };
            countRatio();
        }
    };

    // Robust number extraction from element
    const getNumberFromElement = (element) => {
        if (!element) return NaN;
        let text = element.getAttribute('data-ao3e-original') || element.textContent;
        if (text === null) return NaN;
        let cleanText = text.replace(/[,\s  ]/g, '');
        if (element.matches('dd.chapters')) {
            cleanText = cleanText.split('/')[0];
        }
        const number = parseInt(cleanText, 10);
        return isNaN(number) ? NaN : number;
    };

    // --- CORE CALCULATION ---
    const calculateWordBasedScore = (kudos, hits, words) => {
        if (hits === 0 || words === 0 || kudos === 0) return 0;
        const effectiveChapters = words / 5000;
        const adjustedHits = hits / Math.sqrt(effectiveChapters);
        return 100 * kudos / adjustedHits;
    };

    // --- CORE LOGIC ---
    const checkCountable = () => {
        const foundStats = $('dl.stats');
        if (foundStats.length === 0) return;

        const firstStat = foundStats[0];
        if (firstStat.closest('li')?.matches('.work, .bookmark')) {
            countable = sortable = true;
        } else if (firstStat.closest('.statistics')) {
            countable = sortable = statsPage = true;
        } else if (firstStat.closest('dl.work')) {
            countable = true;
        }
        addRatioMenu();
    };

    const countRatio = () => {
        if (!countable) return;

        $('dl.stats').forEach((statsElement) => {
            // Check if score already exists to avoid duplicates
            if ($1('dt.kudoshits', statsElement)) return;

            const hitsElement = $1('dd.hits', statsElement);
            const kudosElement = $1('dd.kudos', statsElement);
            const wordsElement = $1('dd.words', statsElement);
            const parentLi = statsElement.closest('li');

            try {
                const hits = getNumberFromElement(hitsElement);
                const kudos = getNumberFromElement(kudosElement);
                const words = getNumberFromElement(wordsElement);

                if (isNaN(hits) || isNaN(kudos) || isNaN(words)) return;

                // Hide score if kudos below threshold
                if (kudos < CONFIG.minKudosToShowScore) {
                    // Remove any previous score elements
                    if (statsElement.querySelector('dt.kudoshits')) statsElement.querySelector('dt.kudoshits').remove();
                    if (statsElement.querySelector('dd.kudoshits')) statsElement.querySelector('dd.kudoshits').remove();
                    return;
                }

                let rawScore = calculateWordBasedScore(kudos, hits, words);
                if (kudos < 10) rawScore = 1;

                let displayScore = rawScore;

                if (CONFIG.useNormalization) {
                    displayScore = (rawScore / CONFIG.userMaxScore) * 100;
                    displayScore = Math.min(100, displayScore);
                    displayScore = Math.ceil(displayScore); // round up, no decimals
                } else {
                    displayScore = Math.round(displayScore * 10) / 10;
                }

                const ratioLabel = document.createElement('dt');
                ratioLabel.className = 'kudoshits';
                ratioLabel.textContent = 'Score:';

                const ratioValue = document.createElement('dd');
                ratioValue.className = 'kudoshits';
                ratioValue.textContent = displayScore;
                ratioValue.style.color = CONFIG.colorText;
                ratioValue.style.borderRadius = '4px';

                // Always apply color background
                if (displayScore >= CONFIG.colorThresholdHigh) {
                    ratioValue.style.backgroundColor = CONFIG.colorHigh;
                } else if (displayScore >= CONFIG.colorThresholdLow) {
                    ratioValue.style.backgroundColor = CONFIG.colorMed;
                } else {
                    ratioValue.style.backgroundColor = CONFIG.colorLow;
                }

                hitsElement.insertAdjacentElement('afterend', ratioValue);
                hitsElement.insertAdjacentElement('afterend', ratioLabel);

                if (CONFIG.hideHitcount && !statsPage && hitsElement) {
                    hitsElement.style.display = 'none';
                }

                if (parentLi) parentLi.setAttribute('kudospercent', displayScore);

            } catch (error) {
                console.error('Error calculating score:', error);
            }
        });
    };

    const sortByRatio = (ascending = false) => {
        if (!sortable) return;
        $('dl.stats').forEach((statsElement) => {
            const parentLi = statsElement.closest('li');
            const list = parentLi?.parentElement;
            if (!list) return;
            const listElements = Array.from(list.children);
            listElements.sort((a, b) => {
                const aPercent = parseFloat(a.getAttribute('kudospercent')) || 0;
                const bPercent = parseFloat(b.getAttribute('kudospercent')) || 0;
                return ascending ? aPercent - bPercent : bPercent - aPercent;
            });
            list.innerHTML = '';
            list.append(...listElements);
        });
    };

    // --- SETTINGS POPUP ---
    const showSettingsPopup = () => {
        // Helper to update threshold defaults based on normalization
        function updateThresholdDefaults(isNormalized) {
            const lowInput = form.querySelector('#colorThresholdLow');
            const highInput = form.querySelector('#colorThresholdHigh');
            const maxScore = parseFloat(form.querySelector('#userMaxScore').value) || DEFAULTS.userMaxScore;
            if (isNormalized) {
                // Always calculate normalized thresholds from current un-normalized values
                const prevLow = parseFloat(lowInput.value);
                const prevHigh = parseFloat(highInput.value);
                lowInput.value = Math.round(prevLow / maxScore * 100);
                highInput.value = Math.round(prevHigh / maxScore * 100);
            } else {
                // Always revert to un-normalized thresholds based on current normalized values
                const prevLow = parseFloat(lowInput.value);
                const prevHigh = parseFloat(highInput.value);
                lowInput.value = Math.round(prevLow * maxScore / 100);
                highInput.value = Math.round(prevHigh * maxScore / 100);
            }
        }
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fff;
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

        const form = document.createElement('form');
        form.innerHTML = `
            <h3 style="margin-top: 0; text-align: center; font-size: 1.2em;">Quality Score Settings</h3>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold;">General</h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="alwaysCount" ${CONFIG.alwaysCount ? 'checked' : ''}>
                    Calculate automatically
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="alwaysSort" ${CONFIG.alwaysSort ? 'checked' : ''}>
                    Sort automatically
                </label>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="hideHitcount" ${CONFIG.hideHitcount ? 'checked' : ''}>
                    Hide hit count
                </label>
                <div style="margin: 10px 0;">
                    <label>Minimum kudos to show score:</label>
                    <input type="number" id="minKudosToShowScore" value="${CONFIG.minKudosToShowScore}" min="0" max="10000" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold;">Score Normalization</h4>
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" id="useNormalization" ${CONFIG.useNormalization ? 'checked' : ''}>
                    Normalize scores to 100%
                </label>
                <div style="margin: 10px 0;">
                    <label>100% Value:</label>
                    <input type="number" id="userMaxScore" value="${CONFIG.userMaxScore}" min="1" max="100" step="1" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold;">Color Thresholds</h4>
                <div style="margin: 10px 0;">
                    <label>Low threshold (low to medium):</label>
                    <input type="number" id="colorThresholdLow" value="${CONFIG.colorThresholdLow}" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
                <div style="margin: 10px 0;">
                    <label>High threshold (medium to high):</label>
                    <input type="number" id="colorThresholdHigh" value="${CONFIG.colorThresholdHigh}" style="width: 100%; padding: 5px; box-sizing: border-box;">
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <h4 style="margin-bottom: 10px; font-size: 1.1em; font-weight: bold;">Colors</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%;">
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Low color:</label>
                        <input type="color" id="colorLow" value="${CONFIG.colorLow}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Medium color:</label>
                        <input type="color" id="colorMed" value="${CONFIG.colorMed}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">High color:</label>
                        <input type="color" id="colorHigh" value="${CONFIG.colorHigh}" style="width: 100%;">
                    </div>
                    <div style="margin: 5px 0;">
                        <label style="display: block; margin-bottom: 5px;">Text color:</label>
                        <input type="color" id="colorText" value="${CONFIG.colorText}" style="width: 100%;">
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px;">
                <button type="submit" style="flex: 1; padding: 10px; font-size: 1em;">Save</button>
                <button type="button" id="closePopup" style="flex: 1; padding: 10px; font-size: 1em;">Close</button>
            </div>

            <div style="text-align: center; margin-top: 5px;">
                <a href="#" id="resetSettingsLink" style="font-size: 0.9em; color: #666; text-decoration: none;">Reset to Default Settings</a>
            </div>
        `;

        // Remove legacy reset link if present
        const legacyReset = form.querySelector('#ao3e-reset');
        if (legacyReset) legacyReset.remove();

        // Add event listeners
        form.querySelector('#resetSettingsLink').addEventListener('click', function(e) {
            e.preventDefault();
            resetAllSettings();
            popup.remove();
        });
        form.querySelector('#closePopup').addEventListener('click', () => popup.remove());
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSetting('alwaysCount', form.querySelector('#alwaysCount').checked);
            saveSetting('alwaysSort', form.querySelector('#alwaysSort').checked);
            saveSetting('hideHitcount', form.querySelector('#hideHitcount').checked);
            saveSetting('minKudosToShowScore', parseInt(form.querySelector('#minKudosToShowScore').value));
            saveSetting('useNormalization', form.querySelector('#useNormalization').checked);
            saveSetting('userMaxScore', parseFloat(form.querySelector('#userMaxScore').value));
            saveSetting('colorThresholdLow', parseFloat(form.querySelector('#colorThresholdLow').value));
            saveSetting('colorThresholdHigh', parseFloat(form.querySelector('#colorThresholdHigh').value));
            saveSetting('colorLow', form.querySelector('#colorLow').value);
            saveSetting('colorMed', form.querySelector('#colorMed').value);
            saveSetting('colorHigh', form.querySelector('#colorHigh').value);
            saveSetting('colorText', form.querySelector('#colorText').value);
            popup.remove();
            countRatio();
        });

        // React to normalization toggle
        form.querySelector('#useNormalization').addEventListener('change', function(e) {
            updateThresholdDefaults(e.target.checked);
        });

        popup.appendChild(form);
        document.body.appendChild(popup);
    };

    // --- UI MENU ---
    const addRatioMenu = () => {
        // If AO3UserScriptMenu is present, register with shared menu
        if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function') {
            window.AO3UserScriptMenu.register({
                label: 'Quality Score: Calculate Scores',
                onClick: countRatio
            });
            window.AO3UserScriptMenu.register({
                label: 'Quality Score: Sort by Score',
                onClick: () => sortByRatio()
            });
            window.AO3UserScriptMenu.register({
                label: 'Quality Score: Settings',
                onClick: showSettingsPopup
            });
        } else {
            // Fallback: create own menu as before
            const headerMenu = $1('ul.primary.navigation.actions');
            const searchItem = $1('li.search', headerMenu);
            if (!headerMenu || !searchItem) return;

            const ratioMenu = document.createElement('li');
            ratioMenu.className = 'dropdown';
            ratioMenu.innerHTML = '<a>Quality Score</a>';
            headerMenu.insertBefore(ratioMenu, searchItem);

            const dropMenu = document.createElement('ul');
            dropMenu.className = 'menu dropdown-menu';
            ratioMenu.appendChild(dropMenu);

            const addMenuItem = (text, onClick) => {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.textContent = text;
                link.href = '#';
                link.addEventListener('click', (e) => { e.preventDefault(); onClick(); });
                item.appendChild(link);
                dropMenu.appendChild(item);
                return item;
            };

            addMenuItem('Calculate Scores', countRatio);
            addMenuItem('Sort by Score', () => sortByRatio());
            addMenuItem('Quality Score Settings', showSettingsPopup);
        }
    };

    // --- INITIALIZATION ---
    loadUserSettings();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            checkCountable();
            if (CONFIG.alwaysCount) setTimeout(countRatio, 1000);
        });
    } else {
        checkCountable();
        if (CONFIG.alwaysCount) setTimeout(countRatio, 1000);
    }
})();