// ==UserScript==
// @name         AO3: No Re-Kudos
// @version      1.1
// @author       BlackCatBat
// @description  Hide kudos button if you've already left kudos.
// @license      MIT
// @match        *://archiveofourown.org/works/*
// @match        *://archiveofourown.org/chapters/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Get work ID from the kudos form (not URL, since chapter IDs differ from work IDs)
    const kudoButton = document.getElementById('kudo_submit');
    if (!kudoButton) return;
    
    const workIdInput = document.getElementById('kudo_commentable_id');
    if (!workIdInput) return;
    
    const workId = workIdInput.value;
    if (!workId) return;

    // Check if we've already given kudos to this work
    const kudosHistory = JSON.parse(localStorage.getItem('ao3_no_rekudos_config') || '{}');

    if (kudosHistory[workId]) {
        // Hide the kudos button immediately
        kudoButton.style.display = 'none';
    } else {
        // Set up click listener to record when kudos is given
        kudoButton.addEventListener('click', function() {
            // Record that we've given kudos to this work
            const kudosHistory = JSON.parse(localStorage.getItem('ao3_no_rekudos_config') || '{}');
            kudosHistory[workId] = true;
            localStorage.setItem('ao3_no_rekudos_config', JSON.stringify(kudosHistory));
            
            // Hide the button
            this.style.display = 'none';
        });
    }
})();