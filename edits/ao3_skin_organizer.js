// ==UserScript==
// @name         AO3: Skin Organizer
// @namespace    https://greasyfork.org/users/1603527
// @version      1.0.0
// @description  Adds sorting, filtering and pinning to AO3 user skin pages.
// @author       autocompleted
// @license      MIT
// @match        *://archiveofourown.org/users/*/skins*
// @match        *://archiveofourown.gay/users/*/skins*
// @match        *://archive.transformativeworks.org/users/*/skins*
// @match        *://insecure.archiveofourown.org/users/*/skins*
// @match        *://secure.archiveofourown.org/users/*/skins*
// @grant        none
// @run-at       document-start
// ==/UserScript==
 
(function () {
    'use strict';
 
    // =========================================================================
    // PAGE DETECTION AND CONSTANTS
    // =========================================================================
 
    let main = null;
 
    const CLOAK_CLASS    = 'ao3-skin-organizer-loading';
    const CLOAK_STYLE_ID = 'ao3-skin-organizer-startup-style';
    let cloakTimeout     = null;
 
    startLoadingCloak();
 
    // Site skins can appear with no param, ?skin_type=Skin, or ?skin_type=Site
    // depending on how the user navigated here. Anything that is not
    // 'WorkSkin' is treated as a site skin page.
    const skinTypeParam = new URLSearchParams(window.location.search).get('skin_type');
    const isWorkSkin    = skinTypeParam === 'WorkSkin';
 
    // Storage keys are scoped by skin type so site and work skin state and
    // pins are stored independently.
    const LS_KEY_PINS  = isWorkSkin ? 'ao3_skinpage_work_pins'  : 'ao3_skinpage_site_pins';
    const SS_KEY_STATE = isWorkSkin ? 'ao3_skinpage_work_state' : 'ao3_skinpage_site_state';
 
    const DEFAULT_STATE = {
        sortField:         'updated',
        sortDirection:     'desc',
        filterInUse:       'all',
        filterDescription: 'all',
        filterParent:      'all',
        filterSearch:      '',
    };
 
    // Backslash is generated instead of written as a string literal because
    // editors/consoles can invisibly mangle some regex escape sequences.
    const BS = String.fromCharCode(92);
 
    // =========================================================================
    // STORAGE
    // =========================================================================
 
    // Pin storage uses a single key per skin type. Since AO3 skin IDs are
    // globally unique, pins from other accounts or deleted skins are harmless —
    // they will never match a skin on the current page and are silently ignored.
    function loadPins() {
        try {
            const saved = localStorage.getItem(LS_KEY_PINS);
            if (saved) return new Set(JSON.parse(saved));
        } catch (e) {}
 
        return new Set();
    }
 
    function savePins(pins) {
        try {
            localStorage.setItem(LS_KEY_PINS, JSON.stringify([...pins]));
        } catch (e) {}
    }
 
    function loadState() {
        try {
            const navEntry = performance.getEntriesByType('navigation')[0];
            const navType  = navEntry ? navEntry.type : '';
 
            if (navType === 'reload') {
                // Restore state on reload so the user does not lose their
                // filters when refreshing the page.
                const saved = sessionStorage.getItem(SS_KEY_STATE);
                if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
            } else {
                // Fresh navigation — clear any saved state so filters always
                // start clean when coming from another page.
                sessionStorage.removeItem(SS_KEY_STATE);
            }
        } catch (e) {}
 
        return { ...DEFAULT_STATE };
    }
 
    function saveState(state) {
        try {
            sessionStorage.setItem(SS_KEY_STATE, JSON.stringify(state));
        } catch (e) {}
    }
 
    // =========================================================================
    // SEARCH QUERY HELPER
    // =========================================================================
 
    // Standalone boolean search helper — no knowledge of skins or state so it
    // can be reused if we add search against other fields in future.
    //
    // Supports AO3-like work search operators:
    //   *        wildcard
    //   space    AND — all space-separated terms must match
    //   AND      explicit AND keyword
    //   OR, ||   OR — either side may match
    //   NOT, -   NOT — prefixed term or phrase must not match
    //   ""       exact phrase — substring match anywhere in the text
    //
    // Implements the AO3-like syntax client-side for this page.
    //
    // AND binds more tightly than OR:
    //   a b || c d => (a AND b) OR (c AND d)
    function matchesSearchQuery(query, text) {
        if (!query || !query.trim()) return true;
 
        const lowerText = text.toLowerCase();
 
        // Tokenise the query, respecting quoted phrases and negated phrases.
        // A token is one of:
        //   - a quoted phrase: "foo bar"
        //   - a negated quoted phrase: -"foo bar"
        //   - the OR operator: ||
        //   - a word, optionally prefixed with - for NOT and/or containing *
        const tokenRegex = /(-?)"([^"]*)"|(\|\|)|([-]?[^\s"]+)/g;
        const rawTokens  = [];
        let match;
 
        while ((match = tokenRegex.exec(query)) !== null) {
            if (match[2] !== undefined) {
                rawTokens.push({
                    type:   'phrase',
                    value:  match[2].toLowerCase(),
                    negate: match[1] === '-',
                });
            } else if (match[3] !== undefined) {
                // || operator — OR keyword (as a word) is handled below.
                rawTokens.push({ type: 'or' });
            } else {
                const word    = match[4];
                const negate  = word.startsWith('-');
                const cleaned = negate ? word.slice(1) : word;
 
                if (!cleaned) continue;
 
                if (!negate && cleaned.toUpperCase() === 'AND') {
                    // Explicit AND — space is already AND, so this is a no-op
                    // in our token stream. It is consumed so it does not become
                    // a literal search term.
                    rawTokens.push({ type: 'and' });
                    continue;
                }
 
                if (!negate && cleaned.toUpperCase() === 'OR') {
                    // Explicit OR keyword — same as ||.
                    rawTokens.push({ type: 'or' });
                    continue;
                }
 
                if (!negate && cleaned.toUpperCase() === 'NOT') {
                    // Explicit NOT keyword — same as - prefix.
                    rawTokens.push({ type: 'not' });
                    continue;
                }
 
                rawTokens.push({
                    type:   cleaned.includes('*') ? 'wildcard' : 'term',
                    value:  cleaned.toLowerCase(),
                    negate,
                });
            }
        }
 
        if (rawTokens.length === 0) return true;
 
        function escapeRegexLiteral(value) {
            const specialChars = new Set([
                '.', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', BS,
            ]);
 
            let escaped = '';
 
            for (const ch of value) {
                escaped += specialChars.has(ch) ? BS + ch : ch;
            }
 
            return escaped;
        }
 
        function wildcardToRegexSource(value) {
            let source = '';
 
            for (const ch of value) {
                source += ch === '*' ? '.*' : escapeRegexLiteral(ch);
            }
 
            return source;
        }
 
        function testWholeWordTerm(value) {
            const escaped = escapeRegexLiteral(value);
 
            // Plain terms use token/word-like boundaries rather than substring
            // matching. This means "fel" does not match "felix", but does
            // match "fel.", "(fel)", and "dagen då allt gick fel".
            //
            // This more closely matches AO3/Elasticsearch token behaviour than
            // a simple includes() substring test.
            try {
                const boundary = '[^' + BS + 'p{L}' + BS + 'p{N}_]';
                const regex = new RegExp(
                    '(?:^|' + boundary + ')' +
                    escaped +
                    '(?:' + boundary + '|$)',
                    'u'
                );
 
                return regex.test(lowerText);
            } catch (e) {
                // Fallback for older engines without Unicode property escapes.
                const fallback = new RegExp(
                    '(?:^|[^A-Za-z0-9_])' +
                    escaped +
                    '(?:[^A-Za-z0-9_]|$)'
                );
 
                return fallback.test(lowerText);
            }
        }
 
        function matchToken(token) {
            let result = false;
 
            if (token.type === 'phrase') {
                // Quoted phrase — substring match so the phrase can appear
                // anywhere in the text.
                result = lowerText.includes(token.value);
            } else if (token.type === 'wildcard') {
                result = new RegExp(wildcardToRegexSource(token.value)).test(lowerText);
            } else {
                result = testWholeWordTerm(token.value);
            }
 
            return token.negate ? !result : result;
        }
 
        // Group consecutive non-OR tokens into AND groups, then OR across
        // those groups. This gives AND higher precedence than OR.
        const orGroups = [];
        let andGroup  = [];
        let negateNext = false;
 
        rawTokens.forEach(token => {
            if (token.type === 'or') {
                orGroups.push(andGroup);
                andGroup   = [];
                negateNext = false;
            } else if (token.type === 'and') {
                // Explicit AND continues the current group.
            } else if (token.type === 'not') {
                // Explicit NOT keyword — negate the next token.
                negateNext = true;
            } else {
                if (negateNext) {
                    token      = { ...token, negate: true };
                    negateNext = false;
                }
                andGroup.push(token);
            }
        });
 
        orGroups.push(andGroup);
 
        return orGroups.some(group =>
                             group.length > 0 && group.every(token => matchToken(token))
                            );
    }
 
    // =========================================================================
    // PARSE SKINS FROM PAGE
    // =========================================================================
 
    // Accepts the already-converted ol element. setupPage must run first to
    // convert the list from ul to ol.
    function parseSkins(skinList) {
        if (!skinList) return [];
 
        const skins = [];
 
        skinList.querySelectorAll('li.skins.own.picture.blurb.group').forEach((item, index) => {
            const link = item.querySelector('.heading a');
            if (!link) return;
 
            const idMatch = link.href.match(/\/skins\/(\d+)/);
            if (!idMatch) return;
 
            const name = link.textContent.trim();
            const id   = idMatch[1];
 
            const dateEl   = item.querySelector('p.datetime');
            const dateText = dateEl ? dateEl.textContent.trim() : '';
 
            const descEl   = item.querySelector('blockquote.userstuff.summary');
            const descText = descEl ? descEl.textContent.trim() : '';
 
            const hasUseButton  = !!item.querySelector('input[type="submit"][value="Use"]');
            const hasStopUsing  = !!item.querySelector('input[type="submit"][value="Stop Using"]');
            const hasEditButton = !!item.querySelector('a[href*="/edit"]');
 
            skins.push({
                id,
                name,
 
                // AO3 serves skins newest-updated-first, so index 0 is most
                // recently updated. This reconstructs page order for the
                // Last Updated sort. It is an approximation, not a real
                // timestamp-based updated date.
                updatedOrder: index,
 
                creationDate: parseAO3Date(dateText),
 
                hasDescription: descText !== '' && descText !== '(No Description Provided)',
                isInUse:        hasStopUsing,
 
                // A site skin with no Use/Stop Using button but with Edit is
                // treated as a parent-only skin, i.e. used as a base by other
                // skins. This filter is hidden on work skin pages because work
                // skins do not have global Use/Stop Using buttons.
                isParentOnly: !(hasUseButton || hasStopUsing) && hasEditButton,
 
                element: item,
            });
        });
 
        return skins;
    }
 
    function parseAO3Date(dateText) {
        // Parses AO3's date format, e.g. "19 Apr 2026".
        if (!dateText) return null;
 
        const parts = dateText.split(' ');
        if (parts.length !== 3) return null;
 
        const day = parseInt(parts[0], 10);
        const month = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ].indexOf(parts[1]);
        const year = parseInt(parts[2], 10);
 
        if (isNaN(day) || month === -1 || isNaN(year)) return null;
 
        return new Date(year, month, day);
    }
 
    // =========================================================================
    // SORT AND FILTER
    // =========================================================================
 
    function sortSkins(skins, field, direction) {
        return [...skins].sort((a, b) => {
            if (field === 'updated') {
                // updatedOrder 0 = most recently updated.
                // desc = newest first = lower updatedOrder first.
                // asc  = oldest first = higher updatedOrder first.
                return direction === 'desc'
                    ? a.updatedOrder - b.updatedOrder
                : b.updatedOrder - a.updatedOrder;
            }
 
            if (field === 'created') {
                const valA = a.creationDate ? a.creationDate.getTime() : 0;
                const valB = b.creationDate ? b.creationDate.getTime() : 0;
 
                return direction === 'asc' ? valA - valB : valB - valA;
            }
 
            if (field === 'name') {
                return direction === 'asc'
                    ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
            }
 
            return 0;
        });
    }
 
    function filterSkins(skins, state) {
        // Filters apply to all skins, including pinned ones. Pinned skins
        // appear first in the list, but they are not exempt from filtering.
        return skins.filter(skin => {
            if (state.filterInUse === 'yes' && !skin.isInUse) return false;
            if (state.filterInUse === 'no'  &&  skin.isInUse) return false;
 
            if (state.filterDescription === 'yes' && !skin.hasDescription) return false;
            if (state.filterDescription === 'no'  &&  skin.hasDescription) return false;
 
            if (state.filterParent === 'yes' && !skin.isParentOnly) return false;
            if (state.filterParent === 'no'  &&  skin.isParentOnly) return false;
 
            if (state.filterSearch && !matchesSearchQuery(state.filterSearch, skin.name)) {
                return false;
            }
 
            return true;
        });
    }
 
    // =========================================================================
    // BUILD SORT AND FILTER FORM
    // =========================================================================
 
    function buildFilterForm(state, allSkins, pins) {
        const form = document.createElement('form');
 
        // narrow-hidden matches AO3's native filter forms. On wide screens
        // the form is hidden; on narrow screens it becomes a sliding panel.
        form.className = 'narrow-hidden filters';
        form.id        = 'skin-filters';
 
        const heading = document.createElement('h3');
        heading.className   = 'landmark heading';
        heading.textContent = 'Filters';
        form.appendChild(heading);
 
        const fieldset = document.createElement('fieldset');
 
        const legend = document.createElement('legend');
        legend.textContent = 'Filter skins:';
        fieldset.appendChild(legend);
 
        const dl = document.createElement('dl');
 
        // Submit at top — matching AO3's own filter form pattern.
        dl.appendChild(buildSubmitRow());
 
        dl.appendChild(buildLabelDt('Sort by', 'skin-sort-field', 'sort'));
 
        const sortFieldDd = document.createElement('dd');
        sortFieldDd.className = 'sort';
        const sortSelect  = document.createElement('select');
 
        sortSelect.id   = 'skin-sort-field';
        sortSelect.name = 'skin_sort_field';
 
        [
            { value: 'updated', label: 'Date Updated' },
            { value: 'created', label: 'Date Created' },
            { value: 'name',    label: 'Skin Title'   },
        ].forEach(({ value, label }) => {
            const option = document.createElement('option');
            option.value       = value;
            option.textContent = label;
            if (value === state.sortField) option.selected = true;
            sortSelect.appendChild(option);
        });
 
        sortFieldDd.appendChild(sortSelect);
        dl.appendChild(sortFieldDd);
 
        dl.appendChild(buildLabelDt('Sort direction', 'skin-sort-direction', 'sort'));
 
        const sortDirDd = document.createElement('dd');
        sortDirDd.className = 'sort';
 
        const sortDirSelect = document.createElement('select');
        sortDirSelect.id   = 'skin-sort-direction';
        sortDirSelect.name = 'skin_sort_direction';
 
        [
            { value: 'asc',  label: 'Ascending'  },
            { value: 'desc', label: 'Descending' },
        ].forEach(({ value, label }) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            if (value === state.sortDirection) option.selected = true;
            sortDirSelect.appendChild(option);
        });
 
        sortDirDd.appendChild(sortDirSelect);
        dl.appendChild(sortDirDd);
 
        dl.appendChild(buildLabelDt('Filter by name', 'skin-search', 'search'));
 
        const searchDd = document.createElement('dd');
        searchDd.className = 'search';
        const searchInput = document.createElement('input');
 
        searchInput.type      = 'text';
        searchInput.id        = 'skin-search';
        searchInput.name      = 'skin_search';
        searchInput.className = 'text';
        searchInput.value     = state.filterSearch || '';
 
        searchDd.appendChild(searchInput);
        dl.appendChild(searchDd);
 
        // Currently in use and Is parent skin are site skin concepts.
        // Work skins are applied per-work, so they have no global in-use
        // state and never have Use/Stop Using buttons.
        if (!isWorkSkin) {
            dl.appendChild(buildDt('Currently in use'));
 
            const inUseDd = document.createElement('dd');
            inUseDd.appendChild(buildRadioGroup('skin_filter_in_use', [
                { value: 'yes', label: 'Yes'    },
                { value: 'no',  label: 'No'     },
                { value: 'all', label: 'Either' },
            ], state.filterInUse));
            dl.appendChild(inUseDd);
        }
 
        dl.appendChild(buildDt('Has description'));
 
        const descDd = document.createElement('dd');
        descDd.appendChild(buildRadioGroup('skin_filter_description', [
            { value: 'yes', label: 'Yes'    },
            { value: 'no',  label: 'No'     },
            { value: 'all', label: 'Either' },
        ], state.filterDescription));
        dl.appendChild(descDd);
 
        if (!isWorkSkin) {
            dl.appendChild(buildDt('Is parent skin'));
 
            const parentDd = document.createElement('dd');
            parentDd.appendChild(buildRadioGroup('skin_filter_parent', [
                { value: 'yes', label: 'Yes'    },
                { value: 'no',  label: 'No'     },
                { value: 'all', label: 'Either' },
            ], state.filterParent));
            dl.appendChild(parentDd);
        }
 
        dl.appendChild(buildSubmitRow());
 
        fieldset.appendChild(dl);
 
        // Clear Filters inside fieldset after dl — matching AO3's filter form pattern.
        const clearP    = document.createElement('p');
        const clearLink = document.createElement('a');
 
        clearP.className      = 'footnote';
        clearLink.href        = '#';
        clearLink.id          = 'skin-filters-clear';
        clearLink.textContent = 'Clear Filters';
 
        clearLink.addEventListener('click', e => {
            e.preventDefault();
            closeNarrowFilterPanel(false);
            clearFilters(allSkins, pins);
        });
 
        clearP.appendChild(clearLink);
        fieldset.appendChild(clearP);
 
        form.appendChild(fieldset);
 
        // On narrow screens with JS this becomes the invisible backdrop/close
        // control for the sliding filter panel. It is not visible as text.
        const topP    = document.createElement('p');
        const topLink = document.createElement('a');
 
        topP.className      = 'narrow-shown hidden';
        topLink.href        = '#main';
        topLink.id          = 'leave_filters';
        topLink.className   = 'close';
        topLink.textContent = 'Top of Skins';
 
        topP.appendChild(topLink);
        form.appendChild(topP);
 
        return form;
    }
 
    function buildSubmitRow() {
        const dt = document.createElement('dt');
        dt.className   = 'landmark';
        dt.textContent = 'Sort and Filter';
 
        const dd = document.createElement('dd');
        dd.className = 'submit actions';
 
        const btn = document.createElement('input');
        btn.type  = 'submit';
        btn.name  = 'commit';
        btn.value = 'Sort and Filter';
 
        dd.appendChild(btn);
 
        const fragment = document.createDocumentFragment();
        fragment.appendChild(dt);
        fragment.appendChild(dd);
 
        return fragment;
    }
 
    function buildDt(text) {
        const dt = document.createElement('dt');
        dt.textContent = text;
        return dt;
    }
 
    function buildLabelDt(text, forId, className) {
        const dt = document.createElement('dt');
        if (className) dt.className = className;
 
        const label = document.createElement('label');
        label.htmlFor = forId;
        label.textContent = text;
 
        dt.appendChild(label);
        return dt;
    }
 
    function buildRadioGroup(name, options, checkedValue) {
        const ul = document.createElement('ul');
 
        options.forEach(({ value, label }) => {
            const li        = document.createElement('li');
            const labelEl   = document.createElement('label');
            const input     = document.createElement('input');
            const indicator = document.createElement('span');
            const labelText = document.createElement('span');
 
            input.type  = 'radio';
            input.name  = name;
            input.value = value;
            if (value === checkedValue) input.checked = true;
 
            indicator.className = 'indicator';
            indicator.setAttribute('aria-hidden', 'true');
 
            labelText.textContent = label;
 
            labelEl.appendChild(input);
            labelEl.appendChild(indicator);
            labelEl.appendChild(labelText);
 
            li.appendChild(labelEl);
            ul.appendChild(li);
        });
 
        return ul;
    }
 
    // =========================================================================
    // PIN BUTTONS
    // =========================================================================
 
    function addPinButtons(allSkins, pins, state, onToggle) {
        allSkins.forEach(skin => {
            const actions = skin.element.querySelector('ul.actions');
            if (!actions) return;
 
            // Remove any existing pin button before adding a new one to avoid
            // duplicates after re-rendering.
            actions.querySelector('.skin-pin-btn')?.closest('li')?.remove();
 
            const li  = document.createElement('li');
            const btn = document.createElement('a');
 
            btn.href      = '#';
            btn.className = 'skin-pin-btn';
            btn.textContent = pins.has(skin.id) ? 'Unpin' : 'Pin to Top';
 
            btn.addEventListener('click', e => {
                e.preventDefault();
                // Preserve any in-progress form choices if pinning causes a
                // re-render before the user submits the filter form.
                const activeForm   = document.getElementById('skin-filters');
                const currentState = activeForm ? readFormState(activeForm, state) : state;
 
                saveState(currentState);
                onToggle(skin.id, currentState);
            });
 
            li.appendChild(btn);
            actions.appendChild(li);
        });
    }
 
    // =========================================================================
    // APPLY SORT AND FILTER TO ORIGINAL LIST
    // =========================================================================
 
    function applyToOriginalList(originalList, visiblePinnedSkins, visibleUnpinnedSkins, allSkins) {
        // Remove script-injected list items before rebuilding the list.
        originalList.querySelectorAll('li.skin-section-divider, li.skin-no-matches').forEach(el => {
            el.remove();
        });
 
        // Detach real skin items. allSkins keeps the element references, so they
        // can be reinserted on the next render.
        allSkins.forEach(skin => {
            skin.element.style.display = '';
            skin.element.remove();
        });
 
        const hasPinned   = visiblePinnedSkins.length > 0;
        const hasUnpinned = visibleUnpinnedSkins.length > 0;
        const hasVisible  = hasPinned || hasUnpinned;
 
        if (hasPinned) {
            visiblePinnedSkins.forEach(skin => {
                originalList.appendChild(skin.element);
            });
        }
 
        // Separate pinned and unpinned results only when both groups are visible.
        if (hasPinned && hasUnpinned) {
            originalList.appendChild(buildSectionDivider());
        }
 
        if (hasUnpinned) {
            visibleUnpinnedSkins.forEach(skin => {
                originalList.appendChild(skin.element);
            });
        }
 
        if (!hasVisible) {
            originalList.appendChild(buildNoMatchesItem());
        }
    }
 
    function buildSectionDivider() {
        const li = document.createElement('li');
 
        // The direct children of an ol should be li elements, so this is an
        // empty presentational li rather than a direct hr. It draws a real
        // between-items separator without putting the line inside a skin blurb.
        li.className = 'skin-section-divider';
        li.setAttribute('aria-hidden', 'true');
        li.setAttribute('role', 'presentation');
 
        // Structural styling only. No hardcoded color: currentColor follows
        // the active AO3/site skin.
        li.style.listStyle = 'none';
        li.style.margin    = '1.5em 0';
        li.style.padding   = '0';
        li.style.borderTop = '1.5px solid currentColor';
        li.style.opacity   = '0.5';
 
        return li;
    }
 
    function buildNoMatchesItem() {
        const li = document.createElement('li');
        li.className = 'skin-no-matches blurb group';
 
        const p = document.createElement('p');
        p.className = 'notes';
        p.textContent = 'No skins match these filters.';
 
        li.appendChild(p);
 
        return li;
    }
 
    // =========================================================================
    // READ FORM STATE
    // =========================================================================
 
    function readFormState(form, currentState) {
        const sortField    = form.querySelector('#skin-sort-field');
        const sortDir      = form.querySelector('#skin-sort-direction');
        const filterInUse  = form.querySelector('input[name="skin_filter_in_use"]:checked');
        const filterDesc   = form.querySelector('input[name="skin_filter_description"]:checked');
        const filterParent = form.querySelector('input[name="skin_filter_parent"]:checked');
        const search       = form.querySelector('#skin-search');
 
        return {
            sortField:         sortField    ? sortField.value     : currentState.sortField,
            sortDirection:     sortDir      ? sortDir.value       : currentState.sortDirection,
            filterInUse:       filterInUse  ? filterInUse.value   : currentState.filterInUse,
            filterDescription: filterDesc   ? filterDesc.value    : currentState.filterDescription,
            filterParent:      filterParent ? filterParent.value  : currentState.filterParent,
            filterSearch:      search       ? search.value.trim() : currentState.filterSearch,
        };
    }
 
    // =========================================================================
    // STARTUP CLOAK
    // =========================================================================
 
    function startLoadingCloak() {
        document.documentElement.classList.add(CLOAK_CLASS);
 
        if (!document.getElementById(CLOAK_STYLE_ID)) {
            const style = document.createElement('style');
            style.id = CLOAK_STYLE_ID;
            style.textContent = `
                html.${CLOAK_CLASS} #main.skins-index ul.skin.picture.index.group,
                html.${CLOAK_CLASS} #main.skins-index ol.skin.picture.index.group {
                    visibility: hidden !important;
                }
            `;
 
            // At document-start, document.head may not exist yet.
            (document.head || document.documentElement).appendChild(style);
        }
 
        // Fail-safe: never leave the list hidden if initialization fails.
        cloakTimeout = window.setTimeout(stopLoadingCloak, 3000);
    }
 
    function stopLoadingCloak() {
        document.documentElement.classList.remove(CLOAK_CLASS);
        document.getElementById(CLOAK_STYLE_ID)?.remove();
 
        if (cloakTimeout) {
            window.clearTimeout(cloakTimeout);
            cloakTimeout = null;
        }
    }
    // =========================================================================
    // ONE-TIME PAGE SETUP
    // =========================================================================
 
    function setupPage(mainEl) {
        // filtered class enables AO3's narrow-screen filtered-page layout.
        mainEl.classList.add('filtered');
 
        convertSkinListToOrderedList(mainEl);
        wrapSkinTypeNavigation(mainEl);
        addNarrowFiltersLink(mainEl);
        setupNarrowScreenFilterPanel();
    }
 
    function convertSkinListToOrderedList(mainEl) {
        const skinListUl = mainEl.querySelector('ul.skin.picture.index.group');
        if (!skinListUl) return;
 
        // Some site skins use selectors like ol.index > li.blurb to detect
        // whether index content exists and conditionally show/hide filter UI.
        // The skin items already have blurb, so converting ul to ol makes
        // those selectors work correctly.
        const ol = document.createElement('ol');
 
        [...skinListUl.attributes].forEach(attr => {
            ol.setAttribute(attr.name, attr.value);
        });
 
        while (skinListUl.firstChild) {
            ol.appendChild(skinListUl.firstChild);
        }
 
        skinListUl.parentNode.replaceChild(ol, skinListUl);
    }
 
    function wrapSkinTypeNavigation(mainEl) {
        const skinTypeNav = [...mainEl.querySelectorAll("ul.actions[role='navigation']")]
        .find(ul => ul.querySelector('a[href*="skin_type"]'));
 
        if (!skinTypeNav || document.getElementById('skin-type-nav-wrapper')) return;
 
        const skinTypeNavHeading = [...mainEl.querySelectorAll('h3.landmark.heading')]
        .find(el => el.textContent.trim() === 'Skin Type Navigation');
 
        // Match the works page pattern and prevent the skin type navigation
        // from breaking the filtered-page float layout.
        const wrapper = document.createElement('div');
        wrapper.className = 'navigation actions module';
        wrapper.id        = 'skin-type-nav-wrapper';
 
        skinTypeNav.parentNode.insertBefore(wrapper, skinTypeNav);
 
        if (skinTypeNavHeading) wrapper.appendChild(skinTypeNavHeading);
        wrapper.appendChild(skinTypeNav);
    }
 
    function addNarrowFiltersLink(mainEl) {
        const createSkinNav = [...mainEl.querySelectorAll('ul.navigation.actions')]
        .find(ul => ul.querySelector('a[href*="/skins/new"]'));
 
        if (!createSkinNav || document.getElementById('go_to_filters')) return;
 
        // Visible on narrow screens only, matching AO3's go_to_filters pattern.
        const li = document.createElement('li');
        li.className = 'narrow-shown hidden';
 
        const a = document.createElement('a');
        a.href        = '#skin-filters';
        a.id          = 'go_to_filters';
        a.textContent = 'Filters';
 
        li.appendChild(a);
        createSkinNav.appendChild(li);
    }
 
    // =========================================================================
    // NARROW-SCREEN FILTER PANEL
    // =========================================================================
 
    function setupNarrowScreenFilterPanel() {
        // AO3's filter setup runs before this userscript creates its form,
        // so the panel open/close behavior is wired here.
        const outer   = document.getElementById('outer');
        const goToBtn = document.getElementById('go_to_filters');
 
        if (outer && goToBtn && !goToBtn.dataset.skinFilterboxBound) {
            goToBtn.dataset.skinFilterboxBound = 'true';
 
            goToBtn.addEventListener('click', e => {
                e.preventDefault();
                openNarrowFilterPanel();
            });
        }
 
        if (outer && !outer.dataset.skinFilterboxLeaveBound) {
            outer.dataset.skinFilterboxLeaveBound = 'true';
 
            // Delegated because #leave_filters is recreated on render.
            outer.addEventListener('click', e => {
                if (!(e.target instanceof Element)) return;
 
                if (!e.target.closest('#leave_filters')) return;
 
                e.preventDefault();
                closeNarrowFilterPanel(true);
            });
        }
    }
 
    function openNarrowFilterPanel() {
        const outer    = document.getElementById('outer');
        const skinForm = document.getElementById('skin-filters');
 
        if (!outer || !skinForm) return;
 
        skinForm.classList.remove('narrow-hidden');
        outer.classList.add('filtering');
 
        // Match AO3's native filter-panel focus behavior.
        const firstFocusable = skinForm.querySelector('a, button, input, select, textarea');
        if (firstFocusable) firstFocusable.focus();
    }
 
    function closeNarrowFilterPanel(refocusGoToFilters) {
        const outer    = document.getElementById('outer');
        const skinForm = document.getElementById('skin-filters');
        const goToBtn  = document.getElementById('go_to_filters');
 
        if (skinForm) skinForm.classList.add('narrow-hidden');
        if (outer) outer.classList.remove('filtering');
 
        if (refocusGoToFilters && goToBtn) {
            goToBtn.focus();
        }
    }
 
    // =========================================================================
    // UPDATE PAGE HEADING
    // =========================================================================
 
    function updatePageHeading(visibleCount, totalCount) {
        const h2 = document.querySelector('#main h2.heading');
        if (!h2) return;
 
        // Store the original text on first run so re-renders do not keep
        // appending counts to an already-modified heading.
        if (!h2.dataset.originalText) {
            h2.dataset.originalText = h2.textContent.trim();
        }
 
        // Match AO3's filterable page pattern:
        //   "My Site Skins (12 of 85)" when filtered
        //   "My Site Skins (85)" otherwise
        const count = visibleCount < totalCount
        ? `${visibleCount} of ${totalCount}`
        : `${totalCount}`;
 
        h2.textContent = `${h2.dataset.originalText} (${count})`;
    }
 
    // =========================================================================
    // RENDER
    // =========================================================================
 
    function render(allSkins, state, pins) {
        const originalList = main.querySelector('ol.skin.picture.index.group');
        if (!originalList) return;
 
        // Remove previously injected filter form before rebuilding it.
        document.getElementById('skin-filters')?.remove();
 
        const pinnedSkins   = allSkins.filter(s =>  pins.has(s.id));
        const unpinnedSkins = allSkins.filter(s => !pins.has(s.id));
 
        const sortedPinned   = sortSkins(pinnedSkins,   state.sortField, state.sortDirection);
        const sortedUnpinned = sortSkins(unpinnedSkins, state.sortField, state.sortDirection);
 
        // Both pinned and unpinned skins are filtered and sorted the same way.
        // Pinned skins appear first, but filtering still applies to them.
        const filteredPinned   = filterSkins(sortedPinned,   state);
        const filteredUnpinned = filterSkins(sortedUnpinned, state);
 
        applyToOriginalList(originalList, filteredPinned, filteredUnpinned, allSkins);
 
        updatePageHeading(
            filteredPinned.length + filteredUnpinned.length,
            allSkins.length
        );
 
        addPinButtons(allSkins, pins, state, (skinId, currentState) => {
            if (pins.has(skinId)) {
                pins.delete(skinId);
            } else {
                pins.add(skinId);
            }
 
            savePins(pins);
            render(allSkins, currentState, pins);
        });
 
        const form = buildFilterForm(state, allSkins, pins);
 
        form.addEventListener('submit', e => {
            e.preventDefault();
 
            const newState = readFormState(form, state);
 
            saveState(newState);
 
            // If the narrow filter panel is open, close the overlay state
            // before the form is removed/rebuilt.
            closeNarrowFilterPanel(false);
 
            render(allSkins, newState, pins);
        });
 
        // AO3's filtered pages place form.filters after the index list;
        // the float layout depends on this order.
        originalList.insertAdjacentElement('afterend', form);
    }
 
    // =========================================================================
    // CLEAR FILTERS
    // =========================================================================
 
    function clearFilters(allSkins, pins) {
        const defaultState = { ...DEFAULT_STATE };
 
        saveState(defaultState);
        render(allSkins, defaultState, pins);
    }
 
    // =========================================================================
    // INIT
    // =========================================================================
 
    function init() {
        try {
            main = document.getElementById('main');
            if (!main) return;
 
            // Only run on skin index pages; /users/*/skins* can also match related pages.
            const initialSkinList = main.querySelector('ul.skin.picture.index.group, ol.skin.picture.index.group');
            if (!initialSkinList) return;
 
            // setupPage must run before parseSkins because it converts the skin
            // list from ul to ol, and parseSkins expects the ol.
            setupPage(main);
 
            const skinList = main.querySelector('ol.skin.picture.index.group');
            const allSkins = parseSkins(skinList);
            const state    = loadState();
            const pins     = loadPins();
 
            render(allSkins, state, pins);
        } finally {
            stopLoadingCloak();
        }
    }
 
    function scheduleInit() {
        // Defer until after any synchronous post-DOMContentLoaded scripts have run.
        window.setTimeout(init, 0);
    }
 
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleInit, { once: true });
    } else {
        scheduleInit();
    }
})();