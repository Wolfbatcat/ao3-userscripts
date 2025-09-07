// ==UserScript==
// @name        AO3: Example Script
// @version     1.0
// @description Example feature for AO3
// @author      YourName
// @match       *://archiveofourown.org/*
// @match       *://*.archiveofourown.org/*
// @grant       none
// @run-at      document-end
// ==/UserScript==

(function() {
    'use strict';

    // Wait for AO3UserScriptMenu to be available and register the menu item
    function registerMenu(attempts = 20, interval = 250) {
        if (window.AO3UserScriptMenu && typeof window.AO3UserScriptMenu.register === 'function') {
            window.AO3UserScriptMenu.register({
                label: "Example Script",
                onClick: function() {
                    alert("This feature works!");
                }
            });
        } else if (attempts > 0) {
            setTimeout(() => registerMenu(attempts - 1, interval), interval);
        } else {
            console.error('[AO3 Example Script] Failed to find AO3UserScriptMenu API');
        }
    }
    registerMenu();
})();