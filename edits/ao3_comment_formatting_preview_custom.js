// ==UserScript==
// @name         AO3: Comment Formatting and Preview - Tweaked
// @namespace    https://greasyfork.org/en/users/906106-escctrl
// @version      7.2
// @description  Adds buttons to insert HTML formatting, and shows a live preview box of what the comment will look like
// @author       escctrl
// @license      GNU GPL-3.0-only
// @match        *://*.archiveofourown.org/*
// @require      https://update.greasyfork.org/scripts/542049/1780689/AO3%3A%20Initialize%20jQueryUI.js
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/484002/AO3%3A%20Comment%20Formatting%20and%20Preview.user.js
// @updateURL https://update.greasyfork.org/scripts/484002/AO3%3A%20Comment%20Formatting%20and%20Preview.meta.js
// ==/UserScript==

/* global q, qa, ins, $, createMenu, initGUI */

/*********** INITIALIZING ***********/

(function() {

    'use strict';

    if (window.self !== window.top) return; // make sure script isn't running in an iFrame

    let cfg = 'cmtFmtDialog';
    let main = q('#main');

    // the available standard buttons, display & insert stuff
    // SVGs from Lucide https://lucide.dev (Copyright (c) Cole Bemis 2013-2022 as part of Feather (MIT) and Lucide Contributors 2022 https://lucide.dev/license)
    // changelog: removed xmlns, width/height, classes. for "Bold" increased stroke-width.
    let settingsStandard = new Map([
        ["bold", { text: "Bold", ins_pre: "<b>", ins_app: "</b>",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>` }],
        ["italic", { text: "Italic", ins_pre: "<em>", ins_app: "</em>",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>` }],
        ["underline", { text: "Underline", ins_pre: "<u>", ins_app: "</u>",
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>` }],
        ["strike", { text: "Strikethrough", ins_pre: "<s>", ins_app: "</s>",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>` }],
        ["link", { text: "Link", ins_pre: "<a href=\"\">", ins_app: "</a>",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>` }],
        ["image", { text: "Image", ins_pre: "<img src=\"", ins_app: "\" />",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>` }],
        ["quote", { text: "Quote", ins_pre: "<blockquote>", ins_app: "</blockquote>",
                icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/></svg>` }],
        ["paragraph", { text: "Paragraph", ins_pre: "<p>", ins_app: "</p>",
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/></svg>` }],
        ["listnum", { text: "Numbered List", ins_pre: "<ol><li>", ins_app: "</li></ol>",
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>` }],
        ["listbull", { text: "Bullet List", ins_pre: "<ul><li>", ins_app: "</li></ul>",
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></svg>` }],
        ["listitem", { text: "List Item", ins_pre: "<li>", ins_app: "</li>",
                    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>` }],
    ]);

    ins(q("head"), 'beforeend', `<style type="text/css">ul.actions.fmtButtons svg, #${cfg} svg { width: 1em; height: 1em; display: inline-block; vertical-align: -0.125em; }
        ul.actions.fmtButtons { float: left; }
        div.fmtPreview.userstuff { border: 1px inset #f0f0f0; min-height: 1em; padding: 0.2em 1em; line-height: 1.5;
            code { display: revert; }
        }
        #float_cmt_dlg ul.actions.fmtButtons { font-size: 80%; }
        #${cfg} {
            .sortStandard li.ui-sortable-placeholder { max-height: 0.1em; }
            #custombutton {
                details { margin-bottom: 0.5em; }
                ol { padding-left: 1em; }
                li { display: list-item; }
                table { width: 100%;
                    textarea { min-height: unset; height: 3em; }
                    textarea, input[type=text] { width: unset; border-radius: 0.2em; }
                    textarea.err { background-image: url(); }
                }
            }
            div.grid2x2 { display: grid; grid-template-columns: auto 1fr; gap: 0.2em; }
            div.grid2x2 > * { align-self: center; }
        } </style>`);

    /*********** HANDLING BUTTON BAR AND PREVIEWS ***********/

    const [buttonOrder, settingsCustom] = loadConfigFromStorage();

    // create the HTML for the buttons bar (to be inserted BEFORE <textarea>s)
    let btnBar = [];
    buttonOrder.forEach((btnFmt) => {
        let source = btnFmt.startsWith('custom') ? settingsCustom.get(btnFmt) : settingsStandard.get(btnFmt);
        btnBar.push(`<li title="${source.text}"><button type="button" class="${btnFmt}">${source.icon === "" ? source.text : source.icon}</button></li>`);
    });
    btnBar = `<ul class="actions fmtButtons">${btnBar.join("")}</ul>`;

    // create the HTML for the preview box (to be inserted AFTER <textarea>s)
    let preview = `<div class='fmtPreview userstuff' title='Comment Preview (approximate)'></div>`;

    // delegated event handlers for button clicks and update of the comment preview
    q('body').addEventListener('click', function(e) {
        let fmtButtonClicked = e.target.closest('ul.fmtButtons button');
        if (fmtButtonClicked) insertFormat(fmtButtonClicked);
    });
    q('body').addEventListener('input', function(e) {
        if (e.target.matches('textarea.fmtTextbox')) updatePreview(e.target);
    });

    function insertFormat(elm) { // click event function called with the <button> that was clicked
        let area = [...elm.parentElement.parentElement.parentNode.children].filter((child) => child.classList.contains('fmtTextbox')).at(0); // button->li->ul->whatever->textarea
        let text = area.value; // the original content of the comment box
        let cursor_start = area.selectionStart, cursor_end = area.selectionEnd; // any highlighted text
        let fmt = elm.className.startsWith('custom') ? settingsCustom.get(elm.className) : settingsStandard.get(elm.className); // grab the formatting HTML corresponding to the clicked button

        // set the comment box text with the new content, and focus back on it
        area.value =
            text.slice(0, cursor_start) + // text from before cursor position or highlight
            fmt.ins_pre + text.slice(cursor_start, cursor_end) + fmt.ins_app + // wrap any highlighted text in the formatting HTML
            text.slice(cursor_end); // text from after cursor position or highlight
        area.focus();

        // set the cursor position to the same value so we don't highlight anymore
        let cursor_new =
            // if we only inserted format HTML, set it between the halves so you can enter the text to format
            (cursor_start == cursor_end) ? cursor_start + fmt.ins_pre.length :
            // if we highlighted, and this is a link (so the link text is already done), set the cursor into the href=""
            (elm.className == "link") ? cursor_start + fmt.ins_pre.length - 2 :
            // otherwise always set it at the end of the inserted text i.e. the same distance from the end as originally
            area.value.length - (text.length - cursor_end);
        area.selectionStart = area.selectionEnd = cursor_new;

        // manually trigger the value-has-changed event so the preview updates (not calling updatePreview directly as it would fail on Sticky Comment Box)
        area.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function updatePreview(elm) { // click event function called with the <textarea> that was updated
        let content = elm.value.trim();
        let prevbox = [...elm.parentNode.children].filter((child) => child.classList.contains('fmtPreview')).at(0);

        // if the textbox is still empty, show a simple placeholder
        if (content === "") prevbox.innerHTML = "<p><i>preview</i></p>";
        else {
            // if there is text, turn double linebreaks into paragraphs and single linebreaks into <br>
            // linebreak compatibility
            const lbr = (content.indexOf("\r\n") > -1) ? "\r\n" :
                        (content.indexOf("\r") > -1) ? "\r" : "\n";

            // remove obvious issues: whitespaces between <li>'s, a <br> plus linebreak (while editing)
            content = content.replace(/<\/li>\W+<li>/ig, '</li><li>');
            content = content.replace(/<br \/>(\r\n|\r|\n)/ig, '<br />');

            content = content.split(`${lbr}${lbr}`); // split content at each two linebreaks in a row
            const regexLine = new RegExp(`${lbr}`, "g");
            content.forEach((v, i) => {
                v = v.replace(regexLine, "<br />"); // a single linebreak is replaced by a <br>
                content[i] = "<p>"+v.trim()+"</p>"; // two linebreaks are wrapped in a <p>
            });

            prevbox.innerHTML = content.join(lbr);
        }
    }

    function loadConfigFromStorage() {
        // which configuration of custom buttons do we have?
        let cfgCustom = {
            old: localStorage.getItem('cmtfmtcustom'),
            new: localStorage.getItem('commentFormat-custom'),
            final: new Map() // in case neither exist, it's already an empty Map(), which is all we need
        };

        if (cfgCustom.old && cfgCustom.new) localStorage.removeItem('cmtfmtcustom'); // if new exists already, delete old
        else if (cfgCustom.old) { // if only old exists, translate and store again
            new Map(JSON.parse(cfgCustom.old)).forEach((val, key) => {
                let objVal = {};
                JSON.parse(val).forEach((v) => { objVal[v[0]] = v[1]; }); // turn the Array/Map into an object
                if (objVal.text === "") objVal.text = "(blank)"; // old code didn't enforce text, we do now
                objVal.placeholder = objVal.icon; // old FontAwesome v4 unicodes can be seen here
                objVal.icon = ""; // set icon blank since it isn't an SVG yet
                cfgCustom.final.set(key, objVal);
            });
            localStorage.setItem('commentFormat-custom', JSON.stringify(Array.from( cfgCustom.final.entries() ))); // store new version
            localStorage.removeItem('cmtfmtcustom'); // delete old version
        }
        if (cfgCustom.new) cfgCustom.final = new Map(JSON.parse(cfgCustom.new)); // if new existed, by itself or together with old, use it

        let cfgOrder = {
            old: localStorage.getItem('cmtfmtstandard'),
            new: localStorage.getItem('commentFormat-order'),
            final: Array.from(settingsStandard.keys() ).concat(Array.from(cfgCustom.final.keys() )) // in case neither exist, populate it with all standard & custom buttons
        };
        if (cfgOrder.old && cfgOrder.new) localStorage.removeItem('cmtfmtstandard'); // if new exists already, delete old
        else if (cfgOrder.old) { // if only old exists, translate and store again
            cfgOrder.final = JSON.parse(cfgOrder.old).filter((x) => x[1] === "true").map((x) => x[0]); // keep only the ones that were "true"
            cfgOrder.final = [...cfgOrder.final, ...Array.from(cfgCustom.final.keys() )]; // merge that list with the custom buttons (always at the end)
            localStorage.setItem('commentFormat-order', JSON.stringify(cfgOrder.final)); // store new version
            localStorage.removeItem('cmtfmtstandard'); // delete old version
        }
        if (cfgOrder.new) cfgOrder.final = JSON.parse(cfgOrder.new); // if new existed, by itself or together with old, use it

        return [cfgOrder.final, cfgCustom.final];
    }

    /*********** SUPPORTING ALL THE DIFFERENT TEXT AREAS ***********/

    // ** anything that is visible on the page immediately (not dynamically loaded):
    qa(`textarea#work_summary, textarea#work_notes, textarea#work_endnotes, textarea#chapter_summary, textarea#chapter_notes, textarea#chapter_endnotes,
        textarea[id^=collection_collection_profile_attributes]:not([id*=notification]), textarea[id^=prompt_meme_signup_instructions], textarea[id^=gift_exchange_signup_instructions],
        textarea[id^="comment_content_for"],
        textarea#bookmark_notes,
        #peekTopLevelCmt textarea,
        textarea#profile_about_me,
        textarea#series_summary, textarea#series_series_notes`).forEach((ta) => {
        ins(ta, 'beforebegin', btnBar);
        ins(ta, 'afterend', preview);
        ta.classList.add('fmtTextbox');
        updatePreview(ta); // update the preview for reloaded pages with cached comment text
    });

    // ** anything that is visible on the page immediately, but doesn't get a preview:
    qa(`#float_cmt_userinput textarea`).forEach((ta) => {
        ins(ta, 'beforebegin', btnBar);
        ta.classList.add('fmtTextbox');
    });

    // ** the dynamically loaded ones, with preview:
    if(qa('#feedback, #reply-to-comment, #main.comments-show').length > 0) {
        // inbox replies, work/tag replies, editing existing comments
        const obsComment = new MutationObserver(function(mutList, obs) {
            for (const mut of mutList) { for (const node of mut.addedNodes) {
                // check if the added node is our comment box
                if (node.nodeType == 1 && node.id.startsWith('comment_form_for')) {
                    let ta = q('textarea', node);
                    ins(ta, 'beforebegin', btnBar);
                    ins(ta, 'afterend', preview);
                    ta.classList.add('fmtTextbox');
                    updatePreview(ta); // update the preview for reloaded pages with cached comment text
                }
            }}
        });
        obsComment.observe(qa('#feedback, #reply-to-comment, #main.comments-show')[0], { attributes: false, childList: true, subtree: true });
    }
    if (qa('div[id^="bookmark_form_placement_for_"]').length > 0) {
        // on bookmarks, there's either an Edit button to manage my own bookmark, or a Save button to bookmark that work
        const obsBookmark = new MutationObserver(function(mutList, obs) {
            for (const mut of mutList) { for (const node of mut.addedNodes) {
                // check if the added node is our bookmark form
                if (node.nodeType == 1 && node.id === 'bookmark-form') {
                    let ta = q('textarea', node);
                    ins(ta, 'beforebegin', btnBar);
                    ins(ta, 'afterend', preview);
                    ta.classList.add('fmtTextbox');
                    updatePreview(ta); // update the preview with existing notes
                }
            }}
        });

        // listening to the places where Ao3 adds the HTML for the add/edit bookmark box
        // unfortunately the only way to listen to multiple elements is to loop through the list, but then we don't need to listen to the whole tree (:
        qa('div[id^="bookmark_form_placement_for_"]').forEach((el) => obsBookmark.observe(el, { attributes: false, childList: true, subtree: false }) );
    }
    if (qa('.work.index, .work.listbox', main).length > 0) {
        // on works listings, we might have the Safekeeping Buttons
        const obsBookmark = new MutationObserver(function(mutList, obs) {
            for (const mut of mutList) { for (const node of mut.addedNodes) {
                // check if the added node is our bookmark form
                if (node.nodeType == 1 && node.id === 'bookmark_form_placement') {
                    let ta = q('textarea', node);
                    ins(ta, 'beforebegin', btnBar);
                    ins(ta, 'afterend', preview);
                    ta.classList.add('fmtTextbox');
                    updatePreview(ta); // update the preview with existing notes
                }
            }}
        });
        // only listen for the form, if the Safekeeping bookmark button actually shows up (script is running)
        let btnSafeKeeping = qa('.blurb ul.actions li.bookmark').length;
        if (btnSafeKeeping === 0) { // if it wasn't loaded yet, listen for five seconds
            const obsSafeKeeping = new MutationObserver(function(mutList, obs) {
                for (const mut of mutList) { for (const node of mut.addedNodes) {
                    // check if the added node is our bookmark button
                    if (node.nodeType == 1 && node.tagName === "LI" && node.className == 'bookmark') {
                        obsSafeKeeping.disconnect(); // we only need to wait for the first
                        qa('.work.blurb').forEach((el) => obsBookmark.observe(el, { attributes: false, childList: true, subtree: false }) );
                    }
                }}
            });
            obsSafeKeeping.observe(q('.work.index ul.actions'), { attributes: false, childList: true, subtree: false });
            let timeout = setTimeout(() => { obsSafeKeeping.disconnect(); }, 5000); // failsafe: stop listening after 5 seconds (in case the other script isn't installed)
        }
        else qa('.work.blurb').forEach((el) => obsBookmark.observe(el, { attributes: false, childList: true, subtree: false }) );
    }

    // ** the dynamically loaded ones, without preview:
    if (main.classList.contains('works-show') || main.classList.contains('chapters-show')) {
        // Sticky Comment Box script compatibility
        const obsStickyComment = new MutationObserver(function(mutList, obs) {
            for (const mut of mutList) { for (const node of mut.addedNodes) {
                // check if the added node is our comment box
                if (node.id == 'float_cmt_dlg') {
                    obs.disconnect(); // stop listening, the dialog is static once loaded
                    let ta = q(`textarea`, node);
                    ins(ta, 'beforebegin', btnBar);
                    ta.classList.add('fmtTextbox');
                }
            }}
        });
        obsStickyComment.observe(q('body'), { attributes: false, childList: true, subtree: false });
        let timeout = setTimeout(() => { obsStickyComment.disconnect(); }, 5000); // failsafe: stop listening after 5 seconds (in case the other script isn't installed)
    }
    if (q('#wrangulator')) {
        // View & Post Comment From Bin script compatibility
        const obsCommentFromBin = new MutationObserver(function(mutList, obs) {
            for (const mut of mutList) { for (const node of mut.addedNodes) {
                // check if the added node is our comment box
                if (node.id == 'peekTopLevelCmt') {
                    obs.disconnect(); // stop listening, the dialog is re-used for every tag comment
                    let ta = q(`textarea`, node);
                    ins(ta, 'beforebegin', btnBar);
                    ta.classList.add('fmtTextbox');
                }
            }}
        });
        obsCommentFromBin.observe(main, { attributes: false, childList: true, subtree: false });
        let timeout = setTimeout(() => { obsCommentFromBin.disconnect(); }, 5000); // failsafe: stop listening after 5 seconds (in case the other script isn't installed)
    }

    /***************** CONFIG DIALOG *****************/

    // Only show the settings menu on the AO3 homepage
    if (window.location.pathname === '/') {
        // Library function: creates the "Userscripts" menu item with (id, heading) parameters
        createMenu(cfg, "Comment Formatting Buttons");

        // config rarely is opened, so we avoid running through its setup on every page load by initializing only on first click (it adds a listener for subsequent clicks)
        q("#opencfg_"+cfg).addEventListener("click", async function(e) {
            // Library function: initializes webix and the window component with (id, heading, maxWidth, views that may need to be styled) parameters
            //                   returns the (empty) layout component to which all other webix "views" can be added
            let uiElem = await initGUI(e, cfg, "Comment Formatting Buttons", 700);
            if (uiElem !== false) createDialog(uiElem);
        }, { once: true });
    }

    function createDialog(dlg) {
        // SVGs from Lucide https://lucide.dev (Copyright (c) Cole Bemis 2013-2022 as part of Feather (MIT) and Lucide Contributors 2022 https://lucide.dev/license)
        // changelog: removed xmlns, width/height, classes.
        const icons = {
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
            delete: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
            add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
            ext: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>`
        };

        let btnSorting = [], btnCustomForEditing = [];
        const newcustomrow = (id="", cust={ text:"", icon:"", ins_pre:"", ins_app:"" }) => `<tr>
                <td><button class="remove" type="button" title="Delete this button" data-custid="${id}">${icons.delete}</button></td>
                <td><div class="grid2x2">
                    <label>Text:</label><input type="text" name="text" value="${cust.text}">
                    <label>Icon:</label><textarea name="icon" ${ cust.placeholder ? `class="ui-state-error"` : ""}>${cust.icon}</textarea>
                </div>
                ${ cust.placeholder ? `<div style="white-space: wrap; font-size: smaller;">Get your old icon as SVG:<br />
                Check <a href="https://fontawesome.com/v4/cheatsheet/">FontAwsome v4</a> to find the name of &amp;#x${cust.placeholder};<br />
                then search for it in <a href="https://fontawesome.com/search?ic=free-collection">their latest icon library</a>.</div>` : "" }
                </td>
                <td><div class="grid2x2">
                    <label>Before:</label><input type="text" name="ins_pre" value="${cust.ins_pre}">
                    <label>After:</label><input type="text" name="ins_app" value="${cust.ins_app}">
                </div></td>
                </tr>`;
        settingsCustom.forEach((val, key) => btnCustomForEditing.push(newcustomrow(key, val))); // custom buttons to be edited in the table

        const newsortingitem = (k, s, c) => `<li title="${s.text}">
            <label for="${k}">${s.icon === "" ? s.text : s.icon}</label>
            <input type="checkbox" id="${k}" name="${k}" ${c ? `checked="checked"` : ""}>
            </li>`;
        buttonOrder.forEach((btnFmt) => { // btnSettings has the checked and ordered buttons (standard + custom)
            let source = btnFmt.startsWith('custom') ? settingsCustom.get(btnFmt) : settingsStandard.get(btnFmt);
            btnSorting.push(newsortingitem(btnFmt, source, true));
        });
        let btnUnchecked = [...Array.from(settingsStandard.keys()), ...Array.from(settingsCustom.keys())].filter((x) => !buttonOrder.includes(x)); // find anything that wasn't active
        btnUnchecked.forEach((btnFmt) => {
            let source = btnFmt.startsWith('custom') ? settingsCustom.get(btnFmt) : settingsStandard.get(btnFmt);
            btnSorting.push(newsortingitem(btnFmt, source, false));
        });

        $(dlg).html(`<form>
        <fieldset id='stdbutton'>
            <legend>Button Order</legend>
            <p>Select the buttons you'd like to have on the button bar, deselect to hide them.<br />You can drag them into a different order as well.</p>
            <ul class="sortStandard">${btnSorting.join("")}</ul>
        </fieldset>
        <fieldset id='custombutton'>
            <legend>Custom HTML or text</legend>
            <details><summary>To define a custom button:</summary>
            <ol><li>Provide a button text (required).</li>
            <li>Paste an icon SVG (for example from <a href="https://lucide.dev/icons" target=_blank>Lucide ${icons.ext}</a>) into the "Icon" field (optional).</li>
            <li>Put the text you want inserted around the cursor position into the Before and After fields.</li>
            <li>The button appears in the Button Order section above. Drag it to the position you want.</li></ol></details>
            <table class="listCustom">
                <thead><tr><th> </th><th>Button Appearance</th><th>Insert Around Cursor</th></tr></thead>
                <tbody>${btnCustomForEditing.join("")}</tbody>
            </table>
            <button class="add" type="button">${icons.add} Add another button</button>
        </fieldset>
        <p>Any changes only apply after reloading the page.</p>`);

        // the save/reset/cancel buttons and handling of storage
        $(dlg).dialog('option', 'buttons', [
            {
                text: "Reset",
                click: function() {
                    localStorage.removeItem('commentFormat-order');
                    localStorage.removeItem('commentFormat-custom');
                    qa(".listCustom button.remove").forEach(d => d.click());
                    qa(".sortStandard input[type='checkbox']").forEach((c) => { c.checked = true; });
                    $( `#${cfg} input[type='checkbox']` ).checkboxradio("refresh");
                    $( this ).dialog( "close" );
                }
            },
            {
                text: "Cancel",
                click: function() { $( this ).dialog( "close" ); }
            },
            {
                text: "Save",
                "class": "ui-priority-primary",
                click: function() {
                    let thisDlg = q(`#${cfg}`);

                    // check all user input on custom buttons
                    qa(".listCustom tbody tr", thisDlg).forEach((row) => {
                        validateIconTextarea(q('textarea', row)); // check that the SVG is valid
                        validateButtonText(q('input[name="text"]', row)); // check that the text label was given
                    });
                    if (qa(".listCustom .ui-state-error", thisDlg).length === 0) { // if there were no errors, build the Map and store
                        let btnActive = [...qa(".sortStandard input[type='checkbox']:checked", thisDlg)].map((x) => x.id); // get the ordered list of active buttons

                        let customChecked = new Map();
                        qa(".listCustom tbody tr", thisDlg).forEach((row, i) => {
                            let oldid = q('button.remove', row).dataset.custid;
                            if (btnActive.indexOf(oldid) !== -1) { // update the ordered button IDs to be continuous and match...
                                btnActive[btnActive.indexOf(oldid)] = 'custom'+i;
                            }
                            let parts = {};
                            qa('[name]', row).forEach((field) => { parts[field.name] = field.value; });
                            customChecked.set('custom'+i, parts); // ... with the way we store the custom buttons
                        });

                        localStorage.setItem('commentFormat-custom', JSON.stringify(Array.from(customChecked.entries() )));
                        localStorage.setItem('commentFormat-order', JSON.stringify(btnActive));

                        $( this ).dialog( "close" );
                    }
                }
            },
        ]);

        $(dlg).dialog('open');

        $( `#${cfg} input[type='checkbox']` ).checkboxradio({ icon: false }); // turn checkboxes into pretty buttons

        $( ".sortStandard" ).sortable({
            cursor: "grabbing", // switches cursor while dragging a tag for A+ cursor responsiveness
            containment: "parent" // limits dragging to the box and avoids scrollbars
        }).disableSelection(); // disable text selection

        $(dlg).on('click', '#custombutton button.add', (e) => { // add a new row for custom buttons
            let nextitem = parseInt($(`#${cfg} .listCustom tbody tr:last-of-type button.remove`)[0]?.dataset.custid.match(/\d+/)[0] ?? -1) + 1; // continue numbering
            ins(q(`#${cfg} .listCustom tbody`), 'beforeend', newcustomrow("custom"+nextitem));
            ins(q(`#${cfg} .sortStandard`), 'beforeend', newsortingitem("custom"+nextitem, { icon:"", text:"(blank)" }, true)); // add sortable listitem
            $(`#${cfg} input#custom${nextitem}`).checkboxradio({ icon: false }); // turn into pretty button
            $( ".sortStandard" ).sortable( "refresh" ); // recognize the new button for drag&drop
        });
        $(dlg).on('click', '#custombutton button.remove', (e) => { // delete this custom button row and the corresponding sortable item
            $(`.sortStandard input#${e.target.closest('button.remove').dataset.custid}`).parent().remove();
            e.target.closest('tr').remove();
        });
        $(dlg).on('change', '#custombutton input[name=text], #custombutton textarea[name=icon]', (e) => { // when the custom button text has changed
            let row = e.target.closest('tr');
            let label = q(`.sortStandard li:has(input#${ q('button.remove', row).dataset.custid }) label`);
            label.innerHTML = validateSVG(q('textarea[name=icon]', row).value) ? q('textarea[name=icon]', row).value : (q('input[name=text]', row).value || "(blank)");
            label.parentElement.title = q('input[name=text]', row).value || "(blank)";
        });
    }

    function validateButtonText(input) {
        if (input.value === "") {
            input.placeholder = "a text is required";
            input.classList.add('ui-state-error');
        }
        else {
            input.placeholder = "";
            input.classList.remove('ui-state-error');
        }
    }

    function validateIconTextarea(area) {
        if (area.value !== "" && !validateSVG(area.value)) {
            area.value = "";
            area.placeholder = "not a valid SVG, please try again";
            area.classList.add('ui-state-error');
        }
        else {
            area.placeholder = "";
            area.classList.remove('ui-state-error');
        }
    }

    function validateSVG(testText) {
        if (testText === "") return false;
        let doc = new DOMParser().parseFromString(testText, "image/svg+xml"); // in Firefox this throws an XML Parsing Error that can't be caught
        return (q('parsererror', doc)) ? false : true;
    }

})();