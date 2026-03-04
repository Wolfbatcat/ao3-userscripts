// ==UserScript==
// @name         AO3: Bookmarking Records
// @description  To keep track of bookmarks. Automatically adds the current date and the chapter you're currently reading into the bookmark notes. Used for keeping track of when you last read a fic, and what chapter you were on.
// @version      0.6
// @author       Bairdel, BlackBatCat
// @match     *://archiveofourown.org/works/*
// @match     *://archiveofourown.org/series/*
// @match     *://archiveofourown.org/collections/*/works/*
// @license     GNU GPLv3
// ==/UserScript==

// URLs collected for Internet Archive submission on bookmark save
const urls = [];

window.addEventListener("submit", function(){
    // Submit collected URLs to Internet Archive Wayback Machine
    for (const url of urls) {
        fetch("https://web.archive.org/save/" + url);
    }
});


(function() {
    "use strict";

    const divider = "Last Read: "; // the bit at the start of the automatically added text. this can be anything, but will need to follow bookmarkNotes in newBookmarkNotes down at the bottom

    // Cache DOM elements to avoid repeated queries
    const bookmarkNotesElem = document.getElementById("bookmark_notes");
    const bookmarkPrivateElem = document.getElementById("bookmark_private");
    
    if (!bookmarkNotesElem || !bookmarkPrivateElem) {
        return; // Exit if bookmark form elements don't exist
    }

    // automatically checks the Private Bookmark checkbox. Set to false if you don't want this.
    bookmarkPrivateElem.checked = true;


    // keeps any bookmark notes you've made previously. Must be above the "Last Read: ".
    // this updates the date you last read the fic each time.
    const bookmarkNotes = bookmarkNotesElem.innerHTML.split(divider)[0];


    ////////////////////////// customisations ///////////////////////////////// DO NOT WORRY ABOUT


    // get the current date. should be in local time. you could add HH:MM if you wanted.
    const currdate = new Date();
    const dd = String(currdate.getDate()).padStart(2, '0');
    const mm = String(currdate.getMonth() + 1).padStart(2, '0'); //January is 0
    const yyyy = currdate.getFullYear();
    const hh = String(currdate.getHours()).padStart(2, '0');
    const mins = String(currdate.getMinutes()).padStart(2, '0');

    // change to preferred date format
    let date;
    //date = dd + '/' + mm + '/' + yyyy + " " + hh + ":" + mins;
    date = dd + '/' + mm + '/' + yyyy;

    let author;
    let words;
    let status;
    let title;
    let lastChapter;
    let url;

    // checks if series
    const seriesElem = document.querySelector('.current');
    if (seriesElem) {
        // options for series bookmark notes
        // Cache repeated DOM queries to improve performance
        const statsElems = document.querySelectorAll(".stats");
        const seriesStatsElem = statsElems[2];
        const worksElems = document.querySelectorAll(".work.blurb.group");
        const seriesMetaElem = document.querySelector(".series.meta.group");
        
        if (seriesStatsElem && seriesMetaElem && worksElems.length > 0) {
            const seriesStats = seriesStatsElem.querySelectorAll("dd");
            const seriesMeta = seriesMetaElem.querySelectorAll("dd");
            
            const lastPart = "Part " + seriesStats[1].textContent;
            const lastWorkChapters = worksElems[worksElems.length - 1].querySelector(".chapters");
            lastChapter = lastPart + " Chapter " + (lastWorkChapters ? lastWorkChapters.textContent.split("/")[0] : "unknown");
            
            title = document.querySelector("h2").innerHTML.trim();
            words = seriesStats[0].textContent;
            author = seriesMeta[0].textContent; // fic author

            url = window.location.href; // series url

            for (let i = 0; i < worksElems.length; i++) { // urls for each work in series - useful for internet archive
                const workLink = worksElems[i].querySelector("a");
                if (workLink) {
                    url += "<br>Part " + (i + 1) + ": " + workLink + "?view_full_work=true";
                    urls.push(workLink + "?view_full_work=true");
                }
            }

            const complete = seriesStats[2].textContent;
            const updated = seriesMeta[2].textContent;
            if (complete === "No") {
                status = "Updated: " + updated;
            } else if (complete === "Yes") {
                status = "Completed: " + updated;
            }
        }


    } else {
        // options for fics
        // Check if viewing chapter-by-chapter (has /chapters/ in URL)
        if (window.location.href.includes('/chapters/')) {
            // Extract current chapter from the heading
            const chapterLink = document.querySelector('h3.title a');
            if (chapterLink) {
                lastChapter = chapterLink.textContent.trim();
            } else {
                // Fallback to existing logic if heading not found
                const chaptersElem = document.querySelectorAll(".chapters")[1];
                lastChapter = chaptersElem ? "Chapter " + chaptersElem.innerHTML.split("/")[0] : "Chapter unknown";
            }
        } else {
            // Full work view: use chapter count
            const chaptersElem = document.querySelectorAll(".chapters")[1];
            lastChapter = chaptersElem ? "Chapter " + chaptersElem.innerHTML.split("/")[0] : "Chapter unknown";
        }
        
        const titleElem = document.querySelector(".title.heading");
        title = titleElem ? titleElem.innerHTML.trim() : "Unknown Title"; // fic name
        
        const wordsElem = document.querySelectorAll(".words")[1];
        words = wordsElem ? wordsElem.innerHTML : "Unknown"; // fic wordcount
        
        const authorElem = document.querySelector(".byline.heading");
        author = authorElem ? authorElem.textContent : "Unknown Author"; // fic author

        url = window.location.href.split("?view_full_work=true")[0].split("/chapters")[0] + "?view_full_work=true"; // fic url
        urls.push(url);

        // status i.e. Completed: 2020-08-23, Updated: 2022-05-08, Published: 2015-06-29
        const statusElems = document.querySelectorAll(".status");
        const publishedElems = document.querySelectorAll(".published");
        
        if (statusElems.length > 0) {
            // for multichapters
            status = statusElems[0].innerHTML + " " + (statusElems[1] ? statusElems[1].innerHTML : "");
        } else if (publishedElems.length > 0) {
            // for single chapter fics
            status = publishedElems[0].innerHTML + " " + (publishedElems[1] ? publishedElems[1].innerHTML : "");
        } else {
            status = "Published: Unknown";
        }
    }



/*
//////////////////// CUSTOMIZE BOOKMARK FORMAT HERE ////////////////////////////////////////////////////////////////////////////////////

Put it all together. Feel free to change this format to whatever you like.
First part must always be the divider constant or a new date will be added each time.
<br> puts the next text on a new line.

Available variables:
- date              current date (format: DD/MM/YYYY)
- lastChapter       current chapter you're reading (for chapter view) OR highest chapter count (for full work view) / current part + chapter (for series)
- title             title of fic/series
- author            author of fic/series
- words             total word count
- status            publication status (e.g., "Completed: 2020-08-23" or "Updated: 2022-05-08")
- url               link to the fic/series

Examples you can modify:
const newBookmarkNotes = bookmarkNotes + "<br>Last Read: " + date + "<br>" + lastChapter;
const newBookmarkNotes = bookmarkNotes + "<br>Last Read: " + date + " | " + lastChapter;
const newBookmarkNotes = bookmarkNotes + "<br>Last Read: " + date + "<br>" + lastChapter + " | " + title + " by " + author;
const newBookmarkNotes = bookmarkNotes + "<br>Last Read: " + date + "<br>" + lastChapter + "<br>" + title + " by " + author + "<br>" + words + " words<br>" + status;
    */

    const newBookmarkNotes = bookmarkNotes + "<br>Last Read: " + date + "<br>" + lastChapter + "<br><br>" + title + " by " + author + "<br>" + status + "<br>" + url;


//// end of customization ////

    // Populate the bookmark notes field with the formatted text
    bookmarkNotesElem.innerHTML = newBookmarkNotes;



})();


