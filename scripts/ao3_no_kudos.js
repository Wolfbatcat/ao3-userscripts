// ==UserScript==
// @name         AO3: No Re-Kudos
// @version      1
// @author       BlackCatBat
// @description  Hide kudos button if you've already left kudos.
// @match        *://archiveofourown.org/works/*
// @match        *://archiveofourown.org/chapters/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Get work ID from URL
    const workIdMatch = window.location.pathname.match(/\/(works|chapters)\/(\d+)/);
    if (!workIdMatch) return;
    const workId = workIdMatch[2];

    // Check if we've already given kudos to this work
    const kudosHistory = JSON.parse(localStorage.getItem('ao3_no_rekudos_config') || '{}');

    if (kudosHistory[workId]) {
        // Hide the kudos button immediately
        const kudoButton = document.getElementById('kudo_submit');
        if (kudoButton) {
            kudoButton.style.display = 'none';
        }
    } else {
        // Set up click listener to record when kudos is given
        const kudoButton = document.getElementById('kudo_submit');
        if (kudoButton) {
            kudoButton.addEventListener('click', function() {
                // Record that we've given kudos to this work
                const kudosHistory = JSON.parse(localStorage.getItem('ao3_no_rekudos_config') || '{}');
                kudosHistory[workId] = true;
                localStorage.setItem('ao3_no_rekudos_config', JSON.stringify(kudosHistory));
                
                // Hide the button
                this.style.display = 'none';
            });
        }
    }
})();