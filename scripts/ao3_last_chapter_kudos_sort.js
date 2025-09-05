// ==UserScript==
// @name         AO3: Chapter Shortcuts & Kudos-sortable Bookmarks
// @namespace    Blackbatcat, saxamaphone
// @version      1
// @description  Adds shortcuts for first/last chapter and bookmark sorting by kudos and filtering by complete only.
// @author       saxamaphone, Fangirlishness
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
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
        // Optionally refresh display if needed
    });
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
    var aMatch = window.location.pathname.match(/works\/(\d+)/);
    if(aMatch !== null)
        return aMatch[1];
    else
        return jQuery('#chapter_index li form').attr('action').match(/works\/(\d+)/)[1];
}

function getBookmarks(sNextPath, aBookmarks, oDeferred) {
    jQuery.get(sNextPath, function(oData) {
        aBookmarks = jQuery.merge(aBookmarks, jQuery(oData).find('li.bookmark'));
        if(jQuery(oData).find('.next a').length) {
            // Add a delay of 1 second between requests to avoid rate-limiting
            setTimeout(function() {
                getBookmarks(jQuery(oData).find('.next').first().find('a').attr('href'), aBookmarks, oDeferred);
            }, 1000);
        }
        else {
            jQuery("#sortable_bookmarks_loading").remove();
            oDeferred.resolve();
        }
    });
}

jQuery(window).ready(function() {
    // Process bookmarks first because of extra sorting steps. Once this is done, handle everything else
    var oBookmarksProcessed = jQuery.Deferred();
    
    // If on the bookmarks page, add option to sort by kudos
    if(window.location.pathname.indexOf('/bookmarks') != -1) {
        // Wait to handle the bookmarks after they're loaded
        var oBookmarksLoaded = jQuery.Deferred();
        var bKudos = false;
        // If the search/sort/submit button is clicked and kudos is selected, change selection and save the value in local storage before calling the search
        jQuery("form#bookmark-filters").find(':submit').click(function(e) {
          var val = jQuery('#bookmark_search_sort_column').val();
          if(val == 'kudos_count') {
            jQuery('#bookmark_search_sort_column').val('created_at');
            localStorage.setItem('sort_by_kudos', 'true');
          }
        });
        // Add option for Kudos sorting
        if(jQuery('#bookmark_search_sort_column option[value="kudos_count"]').length === 0) {
            jQuery('#bookmark_search_sort_column').append('<option value="kudos_count">Kudos</option>');
        }
            // Ensure default sort is set immediately after options are appended
            if (KUDOS_SORT_CONFIG.defaultBookmarkSort && jQuery('#bookmark_search_sort_column').length) {
                jQuery('#bookmark_search_sort_column').val(KUDOS_SORT_CONFIG.defaultBookmarkSort).trigger('change');
            }
        // Add Complete/Ongoing checkboxes to the filter UI if not present
        if (jQuery('#work_search_complete').length === 0) {
            jQuery('#bookmark_search_with_notes').parent().parent().after(
                '<li><dt>Completion status</dt><dd>' +
                '<div style="padding-block:0.25em;">' +
                '<label for="work_search_complete">' +
                '<input type="checkbox" value="1" name="work_search[complete]" id="work_search_complete">' +
                '<span class="indicator" aria-hidden="true"></span><span style="padding-left:0.5em;">Complete works only</span></label>' +
                '</div>' +
                '<div style="padding-block:0.25em;">' +
                '<label for="work_search_complete_f">' +
                '<input type="checkbox" value="F" name="work_search[complete_f]" id="work_search_complete_f">' +
                '<span class="indicator" aria-hidden="true"></span><span style="padding-left:0.5em;">Works in progress only</span></label>' +
                '</div></dd></li>'
            );
        }
        // Set default checked state and sort/language from config
        setTimeout(function() {
            if (KUDOS_SORT_CONFIG.defaultCompleteChecked) {
                jQuery('#work_search_complete').prop('checked', true);
            }
            if (KUDOS_SORT_CONFIG.defaultOngoingChecked) {
                jQuery('#work_search_complete_f').prop('checked', true);
            }
            if (KUDOS_SORT_CONFIG.defaultBookmarkSort && jQuery('#bookmark_search_sort_column').length) {
                jQuery('#bookmark_search_sort_column').val(KUDOS_SORT_CONFIG.defaultBookmarkSort);
            }
            // Removed default language setting
        }, 0);
        if(localStorage.getItem('sort_by_kudos') == 'true') {
            jQuery('#bookmark_search_sort_column').val('kudos_count');
            localStorage.removeItem('sort_by_kudos');
            bKudos = true;
        }
        // If kudos option has been selected, we perform our own process
        if(bKudos) {
            // Get bookmarks, this takes at least a few seconds so we have to wait for that to finish
            var aBookmarks = [];
            jQuery("ol.pagination").before('<div id="sortable_bookmarks_loading">(Loading...)</div>');
            getBookmarks(window.location.href.replace(/&page=\d+/, '').replace(/&bookmark_search%5Bsort_column%5D=kudos_count/, ''), aBookmarks, oBookmarksLoaded);
            jQuery.when(oBookmarksLoaded).done(function () {
                aBookmarks.sort(function(oA, oB) {
                    return (parseInt(jQuery(oB).find('dd.kudos').find('a').html()) || 0) - (parseInt(jQuery(oA).find('dd.kudos').find('a').html()) || 0);
                });
                var iPage = getURLParameter('page');
                if(iPage === null)
                    iPage = 1;
                jQuery('li.bookmark').remove();
                var iIndex;
                var iNumBookmarks = aBookmarks.length;
                for(iIndex = (iPage-1) * 20; iIndex < (iPage*20) && iIndex < iNumBookmarks; iIndex++) {
                    jQuery('ol.bookmark').append(aBookmarks[iIndex]);
                }
                oBookmarksProcessed.resolve();
            });
        } else {
            oBookmarksProcessed.resolve();
        }
    } else {
        oBookmarksProcessed.resolve();
    }
    
    jQuery.when(oBookmarksProcessed).done(function() {
        // Check if you're on a story or a list
        // If not a story page, presume an index page (tags, collections, author, bookmarks, series) and process each work individually
        if(jQuery('.header h4.heading').length) {
            // Near as I can figure, the best way of identifying actual stories in an index page is with the h4 tag with class 'heading' within a list of type 'header' 
            jQuery('.header h4.heading').each(function() {
                var sStoryPath = jQuery(this).find('a').first().attr('href');
                var oHeader = this;

                // If link is from collections, get proper link
                var aMatch = sStoryPath.match(/works\/(\d+)/);
                if(aMatch !== null) {
                    var iStoryId = aMatch[1];
                    jQuery.get('/works/' + iStoryId + '/navigate', function(oData) {
                        var sLastChapterPath = jQuery(oData).find('ol li').last().find('a').attr('href');
                        loadKudosSortConfig();
                        var symbol = KUDOS_SORT_CONFIG.lastChapterSymbol || '';
                        jQuery(oHeader).append('<a href="' + sLastChapterPath +'" title="Jump to last chapter"> ' + symbol + '</a>');
                    });
                }
            });
        }
        // Last chapter buttons are story-specific
        else if(jQuery('ul.work') && !jQuery('ul.index').length) {
            // Before adding button for Last Chapter, make sure we're not on the last (or only) chapter already
            if(jQuery('.next').length) {
                // Add button for Last Chapter
                jQuery('ul.work').prepend('<li id="go_to_last_chap"><a>Last Chapter</a></li>');

                // If the above button is clicked, go to last chapter
                jQuery('#go_to_last_chap').click(function() {
                    window.location.href = '/works/' + getStoryId() + '/chapters/' + jQuery('#selected_id option').last().val();
                });
            }

            // Adding a First Chapter button
            if(jQuery('.previous').length) {
                // Add button for First Chapter
                jQuery('ul.work').prepend('<li id="go_to_first_chap"><a>First Chapter</a></li>');

                // If the above button is clicked, go to first chapter
                jQuery('#go_to_first_chap').click(function() {
                    window.location.href = '/works/' + getStoryId();
                });
            }
        }
    });
    
    // In the bookmarks page logic, set the default sort based on config
    if(window.location.pathname.indexOf('/bookmarks') != -1) {
        // Do not add extra sort options, just use the ones already present
        const $sortSelect = jQuery('#bookmark_search_sort_column');
        // ...existing code...
        setTimeout(function() {
            /*
            if (KUDOS_SORT_CONFIG.defaultCompleteChecked) {
                jQuery('#work_search_complete').prop('checked', true);
            }
            if (KUDOS_SORT_CONFIG.defaultOngoingChecked) {
                jQuery('#work_search_complete_f').prop('checked', true);
            }
            if (KUDOS_SORT_CONFIG.defaultBookmarkSort && $sortSelect.length) {
                $sortSelect.val(KUDOS_SORT_CONFIG.defaultBookmarkSort);
            }
            */
        }, 0);
    }
});