// ==UserScript==
// @name         Ao3 Only Show Primary Pairing
// @namespace    https://greasyfork.org/en/users/36620
// @version      1
// @description  Hides works where specified pairing isn't the first listed.
// @author       Modified by Neeve, originally by scriptfairy
// @include      http://archiveofourown.org/*
// @include      https://archiveofourown.org/*
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/377386/Ao3%20Only%20Show%20Primary%20Pairing.user.js
// @updateURL https://update.greasyfork.org/scripts/377386/Ao3%20Only%20Show%20Primary%20Pairing.meta.js
// ==/UserScript==


// --- SETTINGS STORAGE ---
const AO3_PRIMARY_PAIRING_CONFIG_KEY = "ao3_primary_pairing_config";
const DEFAULT_PRIMARY_PAIRING_CONFIG = {
    relationships: ['Jeon Jungkook/Kim Taehyung | V','taekook','Jeon Jungkook | Jungkook/Kim Taehyung | V'],
    characters: [],
    relpad: 1,
    charpad: 5
};
let PRIMARY_PAIRING_CONFIG = { ...DEFAULT_PRIMARY_PAIRING_CONFIG };

function loadPrimaryPairingConfig() {
    try {
        const saved = localStorage.getItem(AO3_PRIMARY_PAIRING_CONFIG_KEY);
        if (saved) {
            PRIMARY_PAIRING_CONFIG = {
                ...DEFAULT_PRIMARY_PAIRING_CONFIG,
                ...JSON.parse(saved),
            };
        }
    } catch (e) {
        console.error("Error loading config:", e);
    }
}
function savePrimaryPairingConfig() {
    try {
        localStorage.setItem(
            AO3_PRIMARY_PAIRING_CONFIG_KEY,
            JSON.stringify(PRIMARY_PAIRING_CONFIG)
        );
    } catch (e) {
        console.error("Error saving config:", e);
    }
}

// --- SETTINGS MENU ---
function showPrimaryPairingMenu() {
    document.querySelectorAll(".ao3-primary-pairing-menu-dialog").forEach((d) => d.remove());
    let inputBg = "#fffaf5";
    const testInput = document.createElement("input");
    document.body.appendChild(testInput);
    try {
        const computedBg = window.getComputedStyle(testInput).backgroundColor;
        if (computedBg && computedBg !== "rgba(0, 0, 0, 0)" && computedBg !== "transparent") {
            inputBg = computedBg;
        }
    } catch (e) {}
    testInput.remove();

    const dialog = document.createElement("div");
    dialog.className = "ao3-primary-pairing-menu-dialog";
    dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${inputBg};
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 20px rgba(0,0,0,0.2);
        z-index: 10000;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: inherit;
        font-size: inherit;
        color: inherit;
        box-sizing: border-box;
    `;
    dialog.innerHTML = `
        <h3 style="margin-top: 0; text-align: center; font-size: 1.2em; font-family: inherit; color: inherit;">⚙️ Only Show Primary Pairing Settings ⚙️</h3>
        <hr style='margin: 16px 0; border: none; border-top: 1px solid #ccc;'>
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 5px; font-family: inherit; color: inherit;">Relationship tags to show (comma separated, case-sensitive):</label>
            <input type="text" id="primary-pairing-relationships" value="${PRIMARY_PAIRING_CONFIG.relationships.join(", ")}" style="width: 100%; padding: 5px; font-size: inherit; font-family: inherit; color: inherit; background: ${inputBg}; border: 1px solid #ccc; box-sizing: border-box;">
        </div>
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 5px; font-family: inherit; color: inherit;">Character tags to show (comma separated, case-sensitive):</label>
            <input type="text" id="primary-pairing-characters" value="${PRIMARY_PAIRING_CONFIG.characters.join(", ")}" style="width: 100%; padding: 5px; font-size: inherit; font-family: inherit; color: inherit; background: ${inputBg}; border: 1px solid #ccc; box-sizing: border-box;">
        </div>
        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <div style="flex:1">
                <label style="display: block; margin-bottom: 5px; font-family: inherit; color: inherit;">Relationship tag window (relpad):</label>
                <input type="number" id="primary-pairing-relpad" value="${PRIMARY_PAIRING_CONFIG.relpad}" min="1" max="10" style="width: 100%; padding: 5px; font-size: inherit; font-family: inherit; color: inherit; background: ${inputBg}; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
            <div style="flex:1">
                <label style="display: block; margin-bottom: 5px; font-family: inherit; color: inherit;">Character tag window (charpad):</label>
                <input type="number" id="primary-pairing-charpad" value="${PRIMARY_PAIRING_CONFIG.charpad}" min="1" max="10" style="width: 100%; padding: 5px; font-size: inherit; font-family: inherit; color: inherit; background: ${inputBg}; border: 1px solid #ccc; box-sizing: border-box;">
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px;">
            <button id="primary-pairing-save" style="flex: 1; padding: 10px; font-size: 1em; font-family: inherit; color: inherit;">Save</button>
            <button id="primary-pairing-cancel" style="flex: 1; padding: 10px; font-size: 1em; font-family: inherit; color: inherit;">Cancel</button>
        </div>
        <div style="text-align: center; margin-top: 5px;">
            <a href="#" id="primary-pairing-reset" style="font-size: 0.9em; color: #666; text-decoration: none; font-family: inherit;">Reset to Default</a>
        </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector("#primary-pairing-save").onclick = function() {
        PRIMARY_PAIRING_CONFIG.relationships = dialog.querySelector("#primary-pairing-relationships").value.split(",").map(s => s.trim()).filter(Boolean);
        PRIMARY_PAIRING_CONFIG.characters = dialog.querySelector("#primary-pairing-characters").value.split(",").map(s => s.trim()).filter(Boolean);
        PRIMARY_PAIRING_CONFIG.relpad = Math.max(1, parseInt(dialog.querySelector("#primary-pairing-relpad").value) || 1);
        PRIMARY_PAIRING_CONFIG.charpad = Math.max(1, parseInt(dialog.querySelector("#primary-pairing-charpad").value) || 1);
        savePrimaryPairingConfig();
        dialog.remove();
        location.reload();
    };
    dialog.querySelector("#primary-pairing-cancel").onclick = function() {
        dialog.remove();
    };
    dialog.querySelector("#primary-pairing-reset").onclick = function(e) {
        e.preventDefault();
        PRIMARY_PAIRING_CONFIG = { ...DEFAULT_PRIMARY_PAIRING_CONFIG };
        savePrimaryPairingConfig();
        dialog.remove();
        location.reload();
    };
}

// --- SHARED MENU MANAGEMENT ---
function initSharedMenu() {
    if (!window.AO3UserScriptMenu) {
        // fallback: minimal shared menu if not present
        window.AO3UserScriptMenu = {
            items: [],
            register: function(item) {
                this.items.push(item);
                this.renderMenu();
            },
            renderMenu: function() {
                let menuContainer = document.getElementById('ao3-userscript-menu');
                if (!menuContainer) {
                    const headerMenu = document.querySelector("ul.primary.navigation.actions");
                    const searchItem = headerMenu ? headerMenu.querySelector("li.search") : null;
                    if (!headerMenu || !searchItem) return;
                    menuContainer = document.createElement("li");
                    menuContainer.className = "dropdown";
                    menuContainer.id = "ao3-userscript-menu";
                    const title = document.createElement("a");
                    title.href = "#";
                    title.textContent = "Userscripts";
                    menuContainer.appendChild(title);
                    const menu = document.createElement("ul");
                    menu.className = "menu dropdown-menu";
                    menuContainer.appendChild(menu);
                    headerMenu.insertBefore(menuContainer, searchItem);
                }
                const menu = menuContainer.querySelector("ul.menu");
                if (menu) {
                    menu.innerHTML = "";
                    this.items.forEach(item => {
                        const li = document.createElement("li");
                        const a = document.createElement("a");
                        a.href = "#";
                        a.textContent = item.label;
                        a.addEventListener("click", (e) => {
                            e.preventDefault();
                            item.onClick();
                        });
                        li.appendChild(a);
                        menu.appendChild(li);
                    });
                }
            }
        };
    }
    window.AO3UserScriptMenu.register({
        label: "Primary Pairing Filter Settings",
        onClick: showPrimaryPairingMenu
    });
}

(function($) {
    loadPrimaryPairingConfig();
    $('<style>').text(
        '.workhide{border:1px solid rgb(221,221,221);margin:0.643em 0em;padding:0.429em 0.75em;height:29px;} .workhide .left{float:left;padding-top:5px;} .workhide .right{float:right}'
    ).appendTo($('head'));
    if (PRIMARY_PAIRING_CONFIG.relationships.length === 0 && PRIMARY_PAIRING_CONFIG.characters.length === 0) {initSharedMenu(); return;}
    var checkfandom = document.createElement('div');
    var fandomlink = $('h2.heading a')[0].href;
    fandomlink = fandomlink.slice(fandomlink.indexOf('tags'));
    $(checkfandom).load('/'+fandomlink+' .parent', function(){
        if ($('ul', checkfandom).text() == "No Fandom") {initSharedMenu(); return;}
        else {
            for(i=0;i<$('.index .blurb').length;i++){
                var tags = $('.index .blurb ul.tags')[i];
                var reltags = $('.relationships', tags).slice(0,PRIMARY_PAIRING_CONFIG.relpad); var chartags = $('.characters', tags).slice(0,PRIMARY_PAIRING_CONFIG.charpad);
                var temprel = []; var tempchar = [];
                $(reltags).map(function() {
                    temprel.push(this.innerText);
                });
                $(chartags).map(function() {
                    tempchar.push(this.innerText);
                });
                var relmatch = temprel.filter(function(n) {
                    return PRIMARY_PAIRING_CONFIG.relationships.indexOf(n) != -1;
                });
                var charmatch = tempchar.filter(function(n) {
                    return PRIMARY_PAIRING_CONFIG.characters.indexOf(n) != -1;
                });
                if (relmatch.length === 0 && charmatch.length === 0) {
                    var work = $('.index .blurb')[i];
                    work.style.display = 'none';
                    var button = document.createElement('div');
                    button.setAttribute('class','workhide');
                    button.innerHTML = '<div class="left">This work does not prioritize your preferred tags.</div><div class="right"><button type="button" class="showwork">Show Work</button></div>';
                    $(work).after(button);
                }
            }
            $(document).ready(function(){
                $('.showwork').click(function() {
                    var blurb = $(this).parents('.workhide').prev()[0];
                    $(blurb).removeAttr('style');
                    $(this).parents('.workhide').remove();
                });
            });
        }
        initSharedMenu();
    });
})(window.jQuery);