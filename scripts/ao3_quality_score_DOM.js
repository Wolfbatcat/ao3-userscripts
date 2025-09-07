// ==UserScript==
// @name        AO3: Quality score (Adjusted Kudos/Hits ratio) - DOM version
// @description Uses the kudos/hits ratio, number of chapters, and statistical evaluation to score and sort AO3 works. Pure JS version.
// @namespace   https://greasyfork.org/scripts/3144-ao3-kudos-hits-ratio
// @author      cupkax
// @version     2.4
// @include     http://archiveofourown.org/*
// @include     https://archiveofourown.org/*
// @license     MIT
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration object: centralizes all settings for easier management
    const CONFIG = {
    alwaysCount: true,
    alwaysSort: false,
    hideHitcount: false,
    colourBackground: true,
    normalizeScoreTo100: false,
    thresholds: { low: 8, high: 14 },
    colors: { red: '#8b0000', yellow: '#994d00', green: '#006400' }
    };

    // Variables to track the state of the page
    let countable = false;
    let sortable = false;
    let statsPage = false;

    // --- HELPER FUNCTIONS ---
    const $ = (selector, root = document) => root.querySelectorAll(selector);
    const $1 = (selector, root = document) => root.querySelector(selector);

    // Load user settings from localStorage
    const loadUserSettings = () => {
        if (typeof Storage !== 'undefined') {
            CONFIG.alwaysCount = localStorage.getItem('alwaysCountLocal') !== 'no';
            CONFIG.alwaysSort = localStorage.getItem('alwaysSortLocal') === 'yes';
            CONFIG.hideHitcount = localStorage.getItem('hideHitcountLocal') !== 'no';
            CONFIG.normalizeScoreTo100 = localStorage.getItem('normalizeScoreTo100Local') === 'yes';
        }
    };

    // SUPER Robust function to get a number from an element
    const getNumberFromElement = (element) => {
        if (!element) {
            console.warn("getNumberFromElement: Element not found.");
            return NaN;
        }

        let numberText = element.getAttribute('data-ao3e-original') || element.textContent;

        if (numberText === null) {
            console.warn("getNumberFromElement: No text content found.");
            return NaN;
        }

        let cleanText = numberText.replace(/[,\s  ]/g, '');

        if (element.matches('dd.chapters')) {
            cleanText = cleanText.split('/')[0];
        }

        const number = parseInt(cleanText, 10);
        if (isNaN(number)) {
            console.warn(`getNumberFromElement: Failed to parse "${numberText}" -> "${cleanText}" as integer.`);
        }
        return isNaN(number) ? NaN : number;
    };

    // --- CORE LOGIC ---
    const checkCountable = () => {
        const foundStats = $('dl.stats');
        if (foundStats.length === 0) {
            console.log("AO3 Quality Score: No stats elements found on this page.");
            return;
        }

        const firstStat = foundStats[0];
        if (firstStat.closest('li')?.matches('.work, .bookmark')) {
            countable = sortable = true;
            console.log("AO3 Quality Score: Countable page detected (work/list).");
            addRatioMenu();
        } else if (firstStat.closest('.statistics')) {
            countable = sortable = statsPage = true;
            console.log("AO3 Quality Score: Countable page detected (stats).");
            addRatioMenu();
        } else if (firstStat.closest('dl.work')) {
            countable = true;
            console.log("AO3 Quality Score: Countable page detected (single work).");
            addRatioMenu();
        }
    };

    const countRatio = () => {
        if (!countable) {
            console.log("AO3 Quality Score: Page not countable, skipping countRatio.");
            return;
        }

        const allStats = $('dl.stats');
        console.log(`AO3 Quality Score: Processing ${allStats.length} stats blocks.`);

        allStats.forEach((statsElement) => {
            const hitsElement = $1('dd.hits', statsElement);
            const kudosElement = $1('dd.kudos', statsElement);
            const chaptersElement = $1('dd.chapters', statsElement);
            const parentLi = statsElement.closest('li');

            try {
                const hitsCount = getNumberFromElement(hitsElement);
                const kudosCount = getNumberFromElement(kudosElement);
                const chaptersCount = getNumberFromElement(chaptersElement);

                console.log(`Parsed values - Hits: ${hitsCount}, Kudos: ${kudosCount}, Chapters: ${chaptersCount}`);

                if (isNaN(hitsCount) || isNaN(kudosCount) || isNaN(chaptersCount) || chaptersCount === 0) {
                    throw new Error(`Missing or invalid required statistics. Hits: ${hitsCount}, Kudos: ${kudosCount}, Chapters: ${chaptersCount}`);
                }

                const newHitsCount = hitsCount / Math.sqrt(chaptersCount);
                let percents = 100 * kudosCount / newHitsCount;

                if (CONFIG.normalizeScoreTo100) {
                    percents = Math.min(Math.ceil((percents / 35) * 100), 100);
                }

                if (kudosCount < 11) percents = 1;
                const pValue = getPValue(newHitsCount, kudosCount, chaptersCount);
                if (pValue < 0.05) percents = 1;

                const percents_print = percents.toFixed(1).replace(',', '.');

                // Check if score is already added to avoid duplicates
                if (!$1('dt.kudoshits', statsElement)) {
                    const ratioLabel = document.createElement('dt');
                    ratioLabel.className = 'kudoshits';
                    ratioLabel.textContent = 'Score:';

                    const ratioValue = document.createElement('dd');
                    ratioValue.className = 'kudoshits';
                    ratioValue.textContent = percents_print;

                    ratioValue.style.color = '#fff';
                    if (CONFIG.colourBackground) {
                        if (percents >= CONFIG.thresholds.high) {
                            ratioValue.style.backgroundColor = CONFIG.colors.green;
                        } else if (percents >= CONFIG.thresholds.low) {
                            ratioValue.style.backgroundColor = CONFIG.colors.yellow;
                        } else {
                            ratioValue.style.backgroundColor = CONFIG.colors.red;
                        }
                    }
                    hitsElement.insertAdjacentElement('afterend', ratioValue);
                    hitsElement.insertAdjacentElement('afterend', ratioLabel);
                }

                if (CONFIG.hideHitcount && !statsPage && hitsElement) {
                    hitsElement.style.display = 'none';
                }

                if (parentLi) parentLi.setAttribute('kudospercent', percents);
                console.log(`Successfully calculated score: ${percents_print}%`);

            } catch (error) {
                console.error(`Error processing work stats: ${error.message}`);
                if (parentLi) parentLi.setAttribute('kudospercent', '0');
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

            // Clear and re-append sorted elements
            list.innerHTML = '';
            list.append(...listElements);
        });
    };

    // --- STATISTICAL FUNCTIONS ---
    const nullHyp = 0.04;

    const getPValue = (hits, kudos, chapters) => {
        const testProp = kudos / hits;
        const zValue = (testProp - nullHyp) / Math.sqrt((nullHyp * (1 - nullHyp)) / hits);
        return normalcdf(0, -1 * zValue, 1);
    };

    const normalcdf = (mean, upperBound, standardDev) => {
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
    };

    // --- UI FUNCTIONS ---
    const addRatioMenu = () => {
        const headerMenu = $1('ul.primary.navigation.actions');
        const searchItem = $1('li.search', headerMenu);
        if (!headerMenu || !searchItem) return;

        const ratioMenu = document.createElement('li');
        ratioMenu.className = 'dropdown';
        ratioMenu.innerHTML = '<a>Kudos/hits</a>';
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

        addMenuItem('Count on this page', countRatio);
        if (sortable) {
            addMenuItem('Sort on this page', () => sortByRatio());
        }

        if (typeof Storage !== 'undefined') {
            const settingsHeader = document.createElement('li');
            settingsHeader.innerHTML = '<a style="padding: 0.5em 0.5em 0.25em; text-align: center; font-weight: bold;">&mdash; Settings (click to change): &mdash;</a>';
            dropMenu.appendChild(settingsHeader);

            const createToggleButton = (text, storageKey, onState, offState) => {
                const button = addMenuItem(`${text}: ${CONFIG[storageKey] ? 'YES' : 'NO'}`, () => {
                    CONFIG[storageKey] = !CONFIG[storageKey];
                    localStorage.setItem(storageKey + 'Local', CONFIG[storageKey] ? onState : offState);
                    button.querySelector('a').textContent = `${text}: ${CONFIG[storageKey] ? 'YES' : 'NO'}`;
                    if (storageKey === 'hideHitcount') {
                        $('.stats .hits').forEach(el => {
                            el.style.display = CONFIG.hideHitcount ? 'none' : '';
                        });
                    }
                });
                return button;
            };

            createToggleButton('Count automatically', 'alwaysCount', 'yes', 'no');
            createToggleButton('Sort automatically', 'alwaysSort', 'yes', 'no');
            createToggleButton('Hide hitcount', 'hideHitcount', 'yes', 'no');
            createToggleButton('Normalize score to 100 (35=100%)', 'normalizeScoreTo100', 'yes', 'no');
        }
    };

    // --- INITIALIZATION ---
    console.log("AO3 Quality Score script loaded (Pure JS).");
    loadUserSettings();

    // Wait for DOM to be fully interactive
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkCountable);
    } else {
        checkCountable();
    }

    if (CONFIG.alwaysCount) {
        setTimeout(countRatio, 500);
    }
})();