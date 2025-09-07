// ==UserScript==
// @name         AO3: Chapter Shortcuts & Kudos-sortable Bookmarks
// @namespace    Blackbatcat, saxamaphone
// @version      1
// @description  Adds shortcuts for first/last chapter and bookmark sorting by kudos and filtering by complete only.
// @author       saxamaphone, Fangirlishness
// @match        http://archiveofourown.org/*
// @match        https://archiveofourown.org/*
// @exclude      http://archiveofourown.org/*/edit
// @exclude      https://archiveofourown.org/*/edit
// @exclude      http://archiveofourown.org/*/new
// @exclude      https://archiveofourown.org/*/new
// @grant        none
// ==/UserScript==
// Settings storage
const AO3_KUDOS_SORT_CONFIG_KEY = 'ao3_kudos_sort_config';
const DEFAULT_KUDOS_SORT_CONFIG = {
    lastChapterSymbol: '»',
    defaultCompleteChecked: false,
    defaultOngoingChecked: false,
    defaultBookmarkSort: 'created_at' // Default: Date Posted
};

let KUDOS_SORT_CONFIG = { ...DEFAULT_KUDOS_SORT_CONFIG };

function loadKudosSortConfig() {
    try {
        const saved = localStorage.getItem(AO3_KUDOS_SORT_CONFIG_KEY);
        if (saved) {
            KUDOS_SORT_CONFIG = { ...DEFAULT_KUDOS_SORT_CONFIG, ...JSON.parse(saved) };
        }
    } catch (e) { console.error('Error loading config:', e); }
}

function saveKudosSortConfig() {
    try {
        localStorage.setItem(AO3_KUDOS_SORT_CONFIG_KEY, JSON.stringify(KUDOS_SORT_CONFIG));
    } catch (e) { console.error('Error saving config:', e); }
}

// Settings menu UI
function showKudosSortMenu() {
    // Remove any existing dialog
    document.querySelectorAll('.ao3-kudos-sort-menu-dialog').forEach(d => d.remove());
    // Only allow Date Bookmarked, Date Updated, and Kudos as sort options
    const sortOptions = [
        { value: 'created_at', text: 'Date Bookmarked' },
        { value: 'bookmarkable_date', text: 'Date Updated' },
        { value: 'kudos_count', text: 'Kudos' }
    ];
    const sortOptionsHtml = sortOptions.map(opt =>
        `<option value="${opt.value}" ${KUDOS_SORT_CONFIG.defaultBookmarkSort === opt.value ? 'selected' : ''}>${opt.text}</option>`
    ).join('');
    const dialog = document.createElement('div');
    dialog.className = 'ao3-kudos-sort-menu-dialog';
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
        max-width: 350px;
        max-height: 80vh;
        overflow-y: auto;
        color: #333;
        font-family: inherit;
        font-size: 16px;
        box-sizing: border-box;
    `;
    dialog.innerHTML = `
        <h3 style="margin-top: 0; text-align: center; font-size: 1.2em;">⚙️ Settings ⚙️</h3>
        <h4 style="margin-bottom: 8px; margin-top: 18px; font-size: 1.05em; border-bottom: 1px solid #eee;">Last Chapter</h4>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 10px;">Choose a symbol for the Last Chapter button:</label>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <button type="button" class="preset-symbol" data-symbol="»">»</button>
                <button type="button" class="preset-symbol" data-symbol="❥">❥</button>
                <button type="button" class="preset-symbol" data-symbol="➼">➼</button>
                <button type="button" class="preset-symbol" data-symbol="➺">➺</button>
            </div>
            <label style="display: block; margin-bottom: 5px;">Or enter your own:</label>
            <input type="text" id="custom-symbol" value="${KUDOS_SORT_CONFIG.lastChapterSymbol}" maxlength="4" style="width: 100%; padding: 5px; font-size: 1em; font-family: inherit;">
        </div>
        <h4 style="margin-bottom: 8px; margin-top: 18px; font-size: 1.05em; border-bottom: 1px solid #eee;">Bookmark Filters</h4>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Default checked on bookmarks page:</label>
            <label style="display: block; margin-bottom: 5px;"><input type="checkbox" id="default-complete-checked" ${KUDOS_SORT_CONFIG.defaultCompleteChecked ? 'checked' : ''}> Complete works only</label>
            <label style="display: block; margin-bottom: 5px;"><input type="checkbox" id="default-ongoing-checked" ${KUDOS_SORT_CONFIG.defaultOngoingChecked ? 'checked' : ''}> Works in progress only</label>
        </div>
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px;">Default sort for bookmarks:</label>
            <select id="default-bookmark-sort" style="width: 100%; padding: 5px; font-size: 1em; font-family: inherit;">
                ${sortOptionsHtml}
            </select>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 10px;">
            <button id="kudos-sort-save" style="flex: 1; padding: 10px; font-size: 1em;">Save</button>
            <button id="kudos-sort-cancel" style="flex: 1; padding: 10px; font-size: 1em;">Cancel</button>
        </div>
    `;
    document.body.appendChild(dialog);
    // Preset symbol buttons
    dialog.querySelectorAll('.preset-symbol').forEach(btn => {
        btn.addEventListener('click', () => {
            dialog.querySelector('#custom-symbol').value = btn.dataset.symbol;
        });
    });
    // Save/cancel
    dialog.querySelector('#kudos-sort-save').addEventListener('click', () => {
        KUDOS_SORT_CONFIG.lastChapterSymbol = dialog.querySelector('#custom-symbol').value || '»';
        KUDOS_SORT_CONFIG.defaultCompleteChecked = dialog.querySelector('#default-complete-checked').checked;
        KUDOS_SORT_CONFIG.defaultOngoingChecked = dialog.querySelector('#default-ongoing-checked').checked;
        KUDOS_SORT_CONFIG.defaultBookmarkSort = dialog.querySelector('#default-bookmark-sort').value;
        saveKudosSortConfig();
        dialog.remove();
        // After saving, ensure checkboxes are present in filter UI
        injectCompletionCheckboxes();
    });
// Inject completion checkboxes into the bookmarks filter UI if missing
function injectCompletionCheckboxes() {
    const filterForm = document.querySelector('form#bookmark-filters');
    if (!filterForm) return;
    // Check if already present
    let complete = document.getElementById('work_search_complete');
    let ongoing = document.getElementById('work_search_complete_f');
    if (!complete || !ongoing) {
        // Find the notes field and its parent <li>
        let notesElem = document.getElementById('bookmark_search_with_notes');
        let insertAfter = notesElem ? notesElem.closest('li') : null;
        const li = document.createElement('li');
        li.innerHTML = `<dt>Completion status</dt><dd>
            <div style="padding-block:0.25em;">
                <label for="work_search_complete">
                    <input type="checkbox" value="1" name="work_search[complete]" id="work_search_complete">
                    <span class="indicator" aria-hidden="true"></span><span style="padding-left:0.5em;">Complete works only</span>
                </label>
            </div>
            <div style="padding-block:0.25em;">
                <label for="work_search_complete_f">
                    <input type="checkbox" value="F" name="work_search[complete_f]" id="work_search_complete_f">
                    <span class="indicator" aria-hidden="true"></span><span style="padding-left:0.5em;">Works in progress only</span>
                </label>
            </div>
        </dd>`;
        if (insertAfter && insertAfter.parentNode) {
            insertAfter.parentNode.insertBefore(li, insertAfter.nextSibling);
        } else {
            filterForm.appendChild(li);
        }
    }
    // Set checked state from config
    complete = document.getElementById('work_search_complete');
    ongoing = document.getElementById('work_search_complete_f');
    if (complete) complete.checked = !!KUDOS_SORT_CONFIG.defaultCompleteChecked;
    if (ongoing) ongoing.checked = !!KUDOS_SORT_CONFIG.defaultOngoingChecked;
}
    dialog.querySelector('#kudos-sort-cancel').addEventListener('click', () => {
        dialog.remove();
    });
}

// Register with AO3UserScriptMenu
function injectKudosSortMenuRegistration() {
    const fn = function() {
        function waitForMenu(attempts = 20, interval = 250) {
            if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function') {
                window.AO3UserScriptMenu.register({
                    label: 'Chapter Shortcuts & Bookmarks Sorting',
                    onClick: function() {
                        window.dispatchEvent(new CustomEvent('ao3kudossortmenu-open'));
                    }
                });
            } else if (attempts > 0) {
                setTimeout(() => waitForMenu(attempts - 1, interval), interval);
            }
        }
        waitForMenu();
    };
    const script = document.createElement('script');
    script.textContent = '(' + fn.toString() + ')();';
    document.documentElement.appendChild(script);
    script.remove();
    window.addEventListener('ao3kudossortmenu-open', showKudosSortMenu);
}

loadKudosSortConfig();
injectKudosSortMenuRegistration();

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search.replace(/\[/g, '%5B').replace(/\]/g, '%5D')) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function getStoryId() {
    const aMatch = window.location.pathname.match(/works\/(\d+)/);
    if (aMatch !== null) {
        return aMatch[1];
    } else {
        const form = document.querySelector('#chapter_index li form');
        if (form && form.action) {
            const match = form.action.match(/works\/(\d+)/);
            return match ? match[1] : null;
        }
        return null;
    }
}

async function getBookmarks(sNextPath, aBookmarks, oDeferred) {
    try {
        const response = await fetch(sNextPath);
        const text = await response.text();
        const parser = new DOMParser();
        const oData = parser.parseFromString(text, 'text/html');
        aBookmarks.push(...Array.from(oData.querySelectorAll('li.bookmark')));
        const nextLink = oData.querySelector('.next a');
        if (nextLink) {
            setTimeout(() => {
                getBookmarks(nextLink.getAttribute('href'), aBookmarks, oDeferred);
            }, 1000);
        } else {
            const loading = document.getElementById('sortable_bookmarks_loading');
            if (loading) loading.remove();
            oDeferred.resolve();
        }
    } catch (e) {
        console.error('Error fetching bookmarks:', e);
        oDeferred.resolve();
    }
}

window.addEventListener('DOMContentLoaded', function() {
    // Process bookmarks first because of extra sorting steps. Once this is done, handle everything else
    // Simple Deferred polyfill for compatibility
    function Deferred() {
        let resolve, promise = new Promise(r => resolve = r);
        return { resolve, promise };
    }
    var oBookmarksProcessed = Deferred();
    
    // If on the bookmarks page, add option to sort by kudos
    if(window.location.pathname.indexOf('/bookmarks') != -1) {
        // Wait to handle the bookmarks after they're loaded
    var oBookmarksLoaded = Deferred();
        var bKudos = false;
        // If the search/sort/submit button is clicked and kudos is selected, change selection and save the value in local storage before calling the search
        document.querySelectorAll("form#bookmark-filters button, form#bookmark-filters input[type='submit']").forEach(btn => {
            btn.addEventListener('click', function(e) {
                const sortSelect = document.getElementById('bookmark_search_sort_column');
                if (sortSelect && sortSelect.value === 'kudos_count') {
                    sortSelect.value = 'created_at';
                    localStorage.setItem('sort_by_kudos', 'true');
                }
            });
        });
        // Add option for Kudos sorting
        const sortSelect = document.getElementById('bookmark_search_sort_column');
        if (sortSelect && !sortSelect.querySelector('option[value="kudos_count"]')) {
            const option = document.createElement('option');
            option.value = 'kudos_count';
            option.textContent = 'Kudos';
            sortSelect.appendChild(option);
        }
            // Ensure default sort is set immediately after options are appended
            if (KUDOS_SORT_CONFIG.defaultBookmarkSort && jQuery('#bookmark_search_sort_column').length) {
                jQuery('#bookmark_search_sort_column').val(KUDOS_SORT_CONFIG.defaultBookmarkSort).trigger('change');
            }
        // Add Complete/Ongoing checkboxes to the filter UI if not present
    injectCompletionCheckboxes();
        // Set default checked state and sort/language from config
        setTimeout(function() {
            if (KUDOS_SORT_CONFIG.defaultCompleteChecked) {
                const complete = document.getElementById('work_search_complete');
                if (complete) complete.checked = true;
            }
            if (KUDOS_SORT_CONFIG.defaultOngoingChecked) {
                const ongoing = document.getElementById('work_search_complete_f');
                if (ongoing) ongoing.checked = true;
            }
            if (KUDOS_SORT_CONFIG.defaultBookmarkSort && sortSelect) {
                sortSelect.value = KUDOS_SORT_CONFIG.defaultBookmarkSort;
            }
        }, 0);
        if(localStorage.getItem('sort_by_kudos') == 'true') {
            if (sortSelect) sortSelect.value = 'kudos_count';
            localStorage.removeItem('sort_by_kudos');
            bKudos = true;
        }
        // If kudos option has been selected, we perform our own process
        if(bKudos) {
            // Get bookmarks, this takes at least a few seconds so we have to wait for that to finish
            var aBookmarks = [];
            const pagination = document.querySelector('ol.pagination');
            if (pagination) {
                const loadingDiv = document.createElement('div');
                loadingDiv.id = 'sortable_bookmarks_loading';
                loadingDiv.textContent = '(Loading...)';
                pagination.parentNode.insertBefore(loadingDiv, pagination);
            }
            getBookmarks(window.location.href.replace(/&page=\d+/, '').replace(/&bookmark_search%5Bsort_column%5D=kudos_count/, ''), aBookmarks, oBookmarksLoaded);
            oBookmarksLoaded.promise.then(function () {
                aBookmarks.sort(function(oA, oB) {
                    const kudosA = parseInt((oA.querySelector('dd.kudos a') || {}).textContent) || 0;
                    const kudosB = parseInt((oB.querySelector('dd.kudos a') || {}).textContent) || 0;
                    return kudosB - kudosA;
                });
                var iPage = getURLParameter('page');
                if(iPage === null)
                    iPage = 1;
                document.querySelectorAll('li.bookmark').forEach(el => el.remove());
                var iIndex;
                var iNumBookmarks = aBookmarks.length;
                const olBookmark = document.querySelector('ol.bookmark');
                for(iIndex = (iPage-1) * 20; iIndex < (iPage*20) && iIndex < iNumBookmarks; iIndex++) {
                    if (olBookmark) olBookmark.appendChild(aBookmarks[iIndex]);
                }
                oBookmarksProcessed.resolve();
            });
        } else {
            oBookmarksProcessed.resolve();
        }
    } else {
        oBookmarksProcessed.resolve();
    }
    
    oBookmarksProcessed.promise.then(function() {
        // Check if you're on a story or a list
        // If not a story page, presume an index page (tags, collections, author, bookmarks, series) and process each work individually
        const headers = document.querySelectorAll('.header h4.heading');
        if (headers.length) {
            headers.forEach(function(header) {
                const link = header.querySelector('a');
                const sStoryPath = link ? link.getAttribute('href') : null;
                // If link is from collections, get proper link
                const aMatch = sStoryPath ? sStoryPath.match(/works\/(\d+)/) : null;
                if (aMatch !== null) {
                    const iStoryId = aMatch[1];
                    fetch('/works/' + iStoryId + '/navigate')
                        .then(resp => resp.text())
                        .then(html => {
                            const parser = new DOMParser();
                            const oData = parser.parseFromString(html, 'text/html');
                            const lastLi = oData.querySelector('ol li:last-child a');
                            const sLastChapterPath = lastLi ? lastLi.getAttribute('href') : null;
                            loadKudosSortConfig();
                            const symbol = KUDOS_SORT_CONFIG.lastChapterSymbol || '';
                            if (sLastChapterPath) {
                                const a = document.createElement('a');
                                a.href = sLastChapterPath;
                                a.title = 'Jump to last chapter';
                                a.textContent = ' ' + symbol;
                                header.appendChild(a);
                            }
                        });
                }
            });
        }
        // Last chapter buttons are story-specific
        else if(document.querySelector('ul.work') && !document.querySelector('ul.index')) {
            // Before adding button for Last Chapter, make sure we're not on the last (or only) chapter already
            if(document.querySelector('.next')) {
                // Add button for Last Chapter
                const ulWork = document.querySelector('ul.work');
                if (ulWork) {
                    const li = document.createElement('li');
                    li.id = 'go_to_last_chap';
                    const a = document.createElement('a');
                    a.textContent = 'Last Chapter';
                    li.appendChild(a);
                    ulWork.insertBefore(li, ulWork.firstChild);
                    li.addEventListener('click', function() {
                        const selectedId = document.getElementById('selected_id');
                        if (selectedId) {
                            const lastOption = selectedId.querySelector('option:last-child');
                            if (lastOption) {
                                window.location.href = '/works/' + getStoryId() + '/chapters/' + lastOption.value;
                            }
                        }
                    });
                }
            }
            // Adding a First Chapter button
            if(document.querySelector('.previous')) {
                const ulWork = document.querySelector('ul.work');
                if (ulWork) {
                    const li = document.createElement('li');
                    li.id = 'go_to_first_chap';
                    const a = document.createElement('a');
                    a.textContent = 'First Chapter';
                    li.appendChild(a);
                    ulWork.insertBefore(li, ulWork.firstChild);
                    li.addEventListener('click', function() {
                        window.location.href = '/works/' + getStoryId();
                    });
                }
            }
        }
    });
    
    // In the bookmarks page logic, set the default sort based on config
    if(window.location.pathname.indexOf('/bookmarks') != -1) {
        // Do not add extra sort options, just use the ones already present
        // ...existing code...
        setTimeout(function() {
            // (No jQuery code here; already handled above)
        }, 0);
    }
});