// ==UserScript==
// @name        AO3: Better Reading Time
// @description Customizable reading speed, automatic/manual calculation, and colour-coded read time. Based on oulfis' original Estimated Reading Time script, but fixed and improved.
// @author      Blackbatcat
// @version	    1.0
// @grant       none
// @include     http://archiveofourown.org/*
// @include     https://archiveofourown.org/*
// ==/UserScript==

// This script adapted from oulfis' original Estimated Reading Time https://greasyfork.org/en/scripts/391940-ao3-estimated-reading-time
// Fixes initial WPM bug and removes vestigle code from their adaption of 
// Min's kudos/hits ratio script, https://greasyfork.org/scripts/3144-ao3-kudos-hits-ratio

// ~~ SETTINGS ~~ //

// how many words per minute do you want to say your reading speed is?
var wpm = 375;

// count readtime automatically: true/false
var always_count = true;

// colour background depending on readtime: true/false
var colourbg = true;

// lvl1 & lvl2 - time levels separating red, yellow and green background (in minutes)
var lvl1 = 60;  // fics that take more than this many minutes to read will be yellow or read
var lvl2 = 160; // fics that take more than this many minutes to read will be red

// highlight_high, highlight_med, highlight_low - background colours
var highlight_high = '#eb6f92';
var highlight_med = '#9ccfd8';
var highlight_low = '#3e8fb0';
// Text color for readtime value
var highlight_text = '#fff';

// ~~ END OF SETTINGS ~~ //



// STUFF HAPPENS BELOW //



	// check user settings
	if (typeof(Storage) !== 'undefined') {

		var always_count_set = localStorage.getItem('alwayscountlocal');
		
		if (always_count_set == 'no') {
			always_count = false;
		}

	}

	// set defaults for countableness and sortableness
	var countable = false;
	var sortable = false;
	var stats_page = false;

	// check if it's a list of works or bookmarks, or header on work page, and attach the menu
	checkCountable();

	// if set to automatic
	if (always_count) {
		calculateReadtime();
	}




	// check if it's a list of works/bookmarks/statistics, or header on work page
	function checkCountable() {

		var found_stats = Array.from(document.querySelectorAll('dl.stats'));

		if (found_stats.length) {
			for (const stats of found_stats) {
				const li = stats.closest('li.work, li.bookmark');
				if (li) {
					countable = true;
					sortable = true;
					addReadtimeMenu();
					return;
				}
				const statistics = stats.closest('.statistics');
				if (statistics) {
					countable = true;
					sortable = true;
					stats_page = true;
					addReadtimeMenu();
					return;
				}
				const work = stats.closest('dl.work');
				if (work) {
					countable = true;
					addReadtimeMenu();
					return;
				}
			}
		}
	}


	function calculateReadtime() {

		if (countable) {
			const statsList = Array.from(document.querySelectorAll('dl.stats'));
			for (const stats of statsList) {
				const words_value = stats.querySelector('dd.words');
				if (words_value) {
					const words_count = parseInt(words_value.textContent.replace(/,/g, ''));
					if (!isNaN(words_count)) {
						const minutes = words_count / wpm;
						const hrs = Math.floor(minutes / 60);
						const mins = (minutes % 60).toFixed(0);
						const minutes_print = hrs > 0 ? hrs + "h" + mins + "m" : mins + "m";
						// Create elements
						const readtime_label = document.createElement('dt');
						readtime_label.className = 'kudoshits';
						readtime_label.textContent = 'Readtime:';
						const readtime_value = document.createElement('dd');
						readtime_value.className = 'kudoshits';
						readtime_value.textContent = minutes_print;
						// Insert after words_value
						words_value.insertAdjacentElement('afterend', readtime_label);
						readtime_label.insertAdjacentElement('afterend', readtime_value);
						if (colourbg) {
							if (minutes <= lvl1) {
								readtime_value.style.backgroundColor = highlight_low;
							} else if (minutes <= lvl2) {
								readtime_value.style.backgroundColor = highlight_med;
							} else {
								readtime_value.style.backgroundColor = highlight_high;
							}
							// Style to match score bar in ao3_better_quality_score.js
							readtime_value.style.color = highlight_text;
							readtime_value.style.borderRadius = '4px';
							readtime_value.style.padding = '0 6px';
							readtime_value.style.fontWeight = 'bold';
							readtime_value.style.display = 'inline-block';
							readtime_value.style.verticalAlign = 'middle';
							// Inherit font size and line height from dl.stats
							const parentStats = readtime_value.closest('dl.stats');
							if (parentStats) {
								const computed = window.getComputedStyle(parentStats);
								readtime_value.style.lineHeight = computed.lineHeight;
								readtime_value.style.fontSize = computed.fontSize;
							}
						}
					}
				}
			}
		}
	}


	// attach the menu
	function addReadtimeMenu() {

		// get the header menu
		var header_menu = document.querySelector('ul.primary.navigation.actions');
		if (!header_menu) return;
		// create and insert menu button
		var readtime_menu = document.createElement('li');
		readtime_menu.className = 'dropdown';
		var readtime_link = document.createElement('a');
		readtime_link.textContent = 'Readtime';
		readtime_menu.appendChild(readtime_link);
		var search_li = header_menu.querySelector('li.search');
		if (search_li) {
			header_menu.insertBefore(readtime_menu, search_li);
		} else {
			header_menu.appendChild(readtime_menu);
		}
		// create and append dropdown menu
		var drop_menu = document.createElement('ul');
		drop_menu.className = 'menu dropdown-menu';
		readtime_menu.appendChild(drop_menu);
		// create button - count
		var button_count = document.createElement('li');
		var button_count_link = document.createElement('a');
		button_count_link.textContent = 'Calculate readtime now on this page';
		button_count_link.style.cursor = 'pointer';
		button_count_link.addEventListener('click', function() { calculateReadtime(); });
		button_count.appendChild(button_count_link);
		// create button - always count YES
		var button_count_yes = document.createElement('li');
		button_count_yes.className = 'count-yes';
		var button_count_yes_link = document.createElement('a');
		button_count_yes_link.textContent = 'Always calculate (click to change): YES';
		button_count_yes_link.style.cursor = 'pointer';
		button_count_yes_link.addEventListener('click', function() {
			localStorage.setItem('alwayscountlocal', 'no');
			drop_menu.replaceChild(button_count_no, button_count_yes);
		});
		button_count_yes.appendChild(button_count_yes_link);
		// create button - always count NO
		var button_count_no = document.createElement('li');
		button_count_no.className = 'count-no';
		var button_count_no_link = document.createElement('a');
		button_count_no_link.textContent = 'Always calculate (click to change): NO';
		button_count_no_link.style.cursor = 'pointer';
		button_count_no_link.addEventListener('click', function() {
			localStorage.setItem('alwayscountlocal', 'yes');
			drop_menu.replaceChild(button_count_yes, button_count_no);
		});
		button_count_no.appendChild(button_count_no_link);
		// append buttons to the dropdown menu
		drop_menu.appendChild(button_count);
		if (typeof(Storage) !== 'undefined') {
			if (always_count) {
				drop_menu.appendChild(button_count_yes);
			} else {
				drop_menu.appendChild(button_count_no);
			}
		}
	}


