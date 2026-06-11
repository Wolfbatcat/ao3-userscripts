// ==UserScript==
// @name          AO3: Skin Switcher
// @version       3.0.0
// @description   Change site skins from anywhere. Sort/filter/pin on your skins page.
// @author        BlackBatCat
// @match         *://archiveofourown.org/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1848100/AO3%3A%20Menu%20Helpers%20Library.js?v=2.2.0
// @grant         none
// @run-at        document-start
// ==/UserScript==

(function () {
    "use strict";

    // ============================================================
    // CONSTANTS
    // ============================================================

    // Page-mode constants (from Organizer)
    const CLOAK_CLASS = "ao3-skin-organizer-loading";
    const CLOAK_STYLE_ID = "ao3-skin-organizer-startup-style";
    const SS_KEY_STATE = "ao3_skinpage_site_state";
    const DEFAULT_STATE = {
        sortField: "updated",
        sortDirection: "desc",
        filterInUse: "all",
        filterDescription: "all",
        filterParent: "all",
        filterSearch: "",
    };
    // Page-detection constants
    const isSkinsPage = !!/users\/[^/]+\/skins/.test(window.location.pathname);
    const isWorkSkin = new URLSearchParams(window.location.search).get("skin_type") === "WorkSkin";

    // Popup-mode constants (from Switcher)
    const CONFIG_KEY = "ao3_skin_switcher_config";
    const CACHE_KEY = "ao3_skin_switcher_cache";
    const CACHE_DURATION = 10 * 60 * 1000;
    const PINS_KEY = "ao3_skin_switcher_pins";

    // ============================================================
    // STATE
    // ============================================================

    let main = null;
    let cloakTimeout = null;
    let cachedUsername = null;
    let config = isSkinsPage ? null : loadConfig();
    let isLoadingMenu = false;

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    // ── Date parsing ────────────────────────────────────────────

    function parseAO3Date(dateText) {
        if (!dateText) return null;
        const parts = dateText.split(" ");
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ].indexOf(parts[1]);
        const year = parseInt(parts[2], 10);
        if (isNaN(day) || month === -1 || isNaN(year)) return null;
        return new Date(year, month, day);
    }

    // ── Search query helpers (page-mode) ────────────────────────

    /**
     * Tokenizes search query into OR-groups of AND-terms.
     * Supports: phrases in quotes, wildcards (*), negation (-word, NOT),
     * boolean operators (AND, OR, NOT), and || as alternative OR.
     * @param {string} query
     * @returns {Array<Array<{type:string, value:string, negate:boolean}>>}
     */
    function tokenizeQuery(query) {
        if (!query || !query.trim()) return [];
        const tokenRegex = /(-?)"([^"]*)"|(\|\|)|([-]?[^\s"]+)/g;
        const rawTokens = [];
        let match;
        while ((match = tokenRegex.exec(query)) !== null) {
            if (match[2] !== undefined) {
                rawTokens.push({
                    type: "phrase",
                    value: match[2].toLowerCase(),
                    negate: match[1] === "-",
                });
            } else if (match[3] !== undefined) {
                rawTokens.push({ type: "or" });
            } else {
                const word = match[4];
                const negate = word.startsWith("-");
                const cleaned = negate ? word.slice(1) : word;
                if (!cleaned) continue;
                const uc = cleaned.toUpperCase();
                if (!negate && uc === "AND") {
                    rawTokens.push({ type: "and" });
                    continue;
                }
                if (!negate && uc === "OR") {
                    rawTokens.push({ type: "or" });
                    continue;
                }
                if (!negate && uc === "NOT") {
                    rawTokens.push({ type: "not" });
                    continue;
                }
                rawTokens.push({
                    type: cleaned.includes("*") ? "wildcard" : "term",
                    value: cleaned.toLowerCase(),
                    negate,
                });
            }
        }
        if (rawTokens.length === 0) return [];
        const orGroups = [];
        let andGroup = [];
        let negateNext = false;
        rawTokens.forEach((t) => {
            if (t.type === "or") {
                orGroups.push(andGroup);
                andGroup = [];
                negateNext = false;
            } else if (t.type === "and") {
            } else if (t.type === "not") {
                negateNext = true;
            } else {
                if (negateNext) {
                    t = { ...t, negate: true };
                    negateNext = false;
                }
                andGroup.push(t);
            }
        });
        orGroups.push(andGroup);
        return orGroups;
    }

    // Backslash literal — editors/consoles can mangle inline escape sequences.
    const BS = String.fromCharCode(92);

    function escapeRegexLiteral(value) {
        const special = new Set([".", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", BS]);
        let r = "";
        for (const ch of value) r += special.has(ch) ? BS + ch : ch;
        return r;
    }
    function wildcardToRegexSource(value) {
        let s = "";
        for (const ch of value) s += ch === "*" ? ".*" : escapeRegexLiteral(ch);
        return s;
    }

    /**
     * Tests text against tokenized OR-groups. Each OR-group is satisfied
     * if every term matches (AND). Uses whole-word regex with Unicode fallback.
     * @param {Array} orGroups - from tokenizeQuery
     * @param {string} text - skin name to test
     * @returns {boolean}
     */
    function matchesTokenizedQuery(orGroups, text) {
        if (!orGroups || orGroups.length === 0) return true;
        const lowerText = text.toLowerCase();
        function testWholeWord(v) {
            const e = escapeRegexLiteral(v);
            try {
                const b = "[^" + BS + "p{L}" + BS + "p{N}_]";
                return new RegExp("(?:^|" + b + ")" + e + "(?:" + b + "|$)", "u").test(lowerText);
            } catch (_) {
                return new RegExp("(?:^|[^A-Za-z0-9_])" + e + "(?:[^A-Za-z0-9_]|$)").test(
                    lowerText,
                );
            }
        }
        function matchToken(t) {
            let r = false;
            if (t.type === "phrase") r = lowerText.includes(t.value);
            else if (t.type === "wildcard")
                r = new RegExp(wildcardToRegexSource(t.value)).test(lowerText);
            else r = testWholeWord(t.value);
            return t.negate ? !r : r;
        }
        return orGroups.some((g) => g.length > 0 && g.every((t) => matchToken(t)));
    }

    // ============================================================
    // STORAGE
    // ============================================================

    function loadPins() {
        try {
            const s = localStorage.getItem(PINS_KEY);
            if (s) return new Set(JSON.parse(s));
        } catch (e) {}
        return new Set();
    }
    function savePins(pins) {
        try {
            localStorage.setItem(PINS_KEY, JSON.stringify([...pins]));
        } catch (e) {}
    }

    function loadConfig() {
        try {
            const s = localStorage.getItem(CONFIG_KEY);
            if (s) {
                const cfg = JSON.parse(s);
                if (cfg.username && cfg.username.includes("?")) {
                    cfg.username = cfg.username.split("?")[0];
                    saveConfig(cfg);
                }
                return cfg;
            }
        } catch (e) {}
        return { username: null };
    }
    function saveConfig(cfg) {
        try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
        } catch (e) {}
    }

    /**
     * Load filter/sort state. On page reload reads sessionStorage;
     * on fresh navigation resets to defaults. Uses Performance API
     * navigation type detection.
     * @returns {Object}
     */
    function loadState() {
        try {
            // Detect page reload vs fresh navigation via Performance API
            const navEntry = performance.getEntriesByType("navigation")[0];
            const navType = navEntry ? navEntry.type : "";
            if (navType === "reload") {
                const saved = sessionStorage.getItem(SS_KEY_STATE);
                if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
            } else {
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

    // ============================================================
    // CORE LOGIC
    // ============================================================

    // ── Startup cloak ───────────────────────────────────────────

    /**
     * Hides skin list immediately on page-mode load to prevent
     * unsorted flicker. Clears automatically after 3s timeout.
     */
    function startLoadingCloak() {
        document.documentElement.classList.add(CLOAK_CLASS);
        if (!document.getElementById(CLOAK_STYLE_ID)) {
            const style = document.createElement("style");
            style.id = CLOAK_STYLE_ID;
            style.textContent =
                "html." +
                CLOAK_CLASS +
                " #main ul.skin.picture.index.group,html." +
                CLOAK_CLASS +
                " #main ol.skin.picture.index.group{visibility:hidden!important}";
            (document.head || document.documentElement).appendChild(style);
        }
        cloakTimeout = window.setTimeout(stopLoadingCloak, 3000);
    }

    /** Remove cloak styles and clear timeout. Safe to call multiple times. */
    function stopLoadingCloak() {
        document.documentElement.classList.remove(CLOAK_CLASS);
        document.getElementById(CLOAK_STYLE_ID)?.remove();
        if (cloakTimeout) {
            window.clearTimeout(cloakTimeout);
            cloakTimeout = null;
        }
    }

    // ── Page-mode: parse skins from DOM ─────────────────────────

    /**
     * Parses skin entries from a DOM list element into structured objects.
     * @param {HTMLElement} skinList - UL/OL containing li.skins.own elements
     * @returns {Array<{id: string, name: string, updatedOrder: number, creationDate: Date|null, hasDescription: boolean, isInUse: boolean, isParentOnly: boolean, element: HTMLElement}>}
     */
    function parseSkins(skinList) {
        if (!skinList) return [];
        const skins = [];
        skinList.querySelectorAll("li.skins.own.picture.blurb.group").forEach((item, index) => {
            const link = item.querySelector(".heading a");
            if (!link) return;
            const idMatch = link.href.match(/\/skins\/(\d+)/);
            if (!idMatch) return;
            const name = link.textContent.trim();
            const id = idMatch[1];
            const dateText = item.querySelector("p.datetime")?.textContent.trim() || "";
            const descText =
                item.querySelector("blockquote.userstuff.summary")?.textContent.trim() || "";
            const hasUse = !!item.querySelector('input[type="submit"][value="Use"]');
            const hasStop = !!item.querySelector('input[type="submit"][value="Stop Using"]');
            const hasEdit = !!item.querySelector('a[href*="/edit"]');
            skins.push({
                id,
                name,
                updatedOrder: index,
                creationDate: parseAO3Date(dateText),
                hasDescription: descText !== "" && descText !== "(No Description Provided)",
                isInUse: hasStop,
                isParentOnly: !(hasUse || hasStop) && hasEdit,
                element: item,
            });
        });
        return skins;
    }

    // ── Page-mode: sort and filter ──────────────────────────────

    /**
     * Sorts skin array by field (updated/created/name) in given direction.
     * @param {Array} skins
     * @param {string} field - "updated"|"created"|"name"
     * @param {string} direction - "asc"|"desc"
     * @returns {Array}
     */
    function sortSkins(skins, field, direction) {
        return [...skins].sort((a, b) => {
            if (field === "updated")
                return direction === "desc"
                    ? a.updatedOrder - b.updatedOrder
                    : b.updatedOrder - a.updatedOrder;
            if (field === "created") {
                const va = a.creationDate ? a.creationDate.getTime() : 0;
                const vb = b.creationDate ? b.creationDate.getTime() : 0;
                return direction === "asc" ? va - vb : vb - va;
            }
            if (field === "name")
                return direction === "asc"
                    ? a.name.localeCompare(b.name)
                    : b.name.localeCompare(a.name);
            return 0;
        });
    }

    /**
     * Filters skin array by in-use, description, parent, and search state.
     * @param {Array} skins
     * @param {Object} state - filter state with filterInUse, filterDescription, filterParent, filterSearch
     * @returns {Array}
     */
    function filterSkins(skins, state) {
        const searchTokens =
            state.filterSearch && state.filterSearch.trim()
                ? tokenizeQuery(state.filterSearch)
                : null;
        return skins.filter((skin) => {
            if (state.filterInUse === "yes" && !skin.isInUse) return false;
            if (state.filterInUse === "no" && skin.isInUse) return false;
            if (state.filterDescription === "yes" && !skin.hasDescription) return false;
            if (state.filterDescription === "no" && skin.hasDescription) return false;
            if (state.filterParent === "yes" && !skin.isParentOnly) return false;
            if (state.filterParent === "no" && skin.isParentOnly) return false;
            if (searchTokens && !matchesTokenizedQuery(searchTokens, skin.name)) return false;
            return true;
        });
    }

    // ── Page-mode: pin buttons ──────────────────────────────────

    /**
     * Injects pin/unpin buttons into each skin's action list.
     * @param {Array} allSkins
     * @param {Set} pins - pinned skin IDs
     * @param {Object} state - current filter/sort state
     * @param {Function} onToggle - callback(skinId, capturedState)
     */
    function addPinButtons(allSkins, pins, state, onToggle) {
        allSkins.forEach((skin) => {
            const actions = skin.element.querySelector("ul.actions");
            if (!actions) return;
            actions.querySelector(".skin-pin-btn")?.closest("li")?.remove();
            const li = document.createElement("li");
            const btn = document.createElement("a");
            btn.href = "#";
            btn.className = "skin-pin-btn";
            btn.textContent = pins.has(skin.id) ? "Unpin" : "Pin to Top";
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                const af = document.getElementById("skin-filters");
                const cs = af ? readFormState(af, state) : state;
                saveState(cs);
                onToggle(skin.id, cs);
            });
            li.appendChild(btn);
            actions.appendChild(li);
        });
    }

    // ── Page-mode: apply to DOM list ────────────────────────────

    /**
     * Rebuilds the skin <ol> with pinned section, divider, unpinned section,
     * or a no-matches placeholder when empty.
     * @param {HTMLOListElement} ol
     * @param {Array} pinned
     * @param {Array} unpinned
     * @param {Array} allSkins
     */
    function applyToOriginalList(ol, pinned, unpinned, allSkins) {
        ol.querySelectorAll("li.skin-section-divider, li.skin-no-matches").forEach((e) =>
            e.remove(),
        );
        allSkins.forEach((s) => {
            s.element.style.display = "";
            s.element.remove();
        });
        if (pinned.length > 0) pinned.forEach((s) => ol.appendChild(s.element));
        if (pinned.length > 0 && unpinned.length > 0) ol.appendChild(buildSectionDivider());
        if (unpinned.length > 0) unpinned.forEach((s) => ol.appendChild(s.element));
        if (pinned.length === 0 && unpinned.length === 0) ol.appendChild(buildNoMatchesItem());
    }

    function buildSectionDivider() {
        const li = document.createElement("li");
        li.setAttribute("aria-hidden", "true");
        li.setAttribute("role", "presentation");
        li.style.cssText = "list-style:none;margin:1.5em 0;padding:0";
        li.appendChild(window.AO3MenuHelpers.createDivider("0", 0.8, true));
        return li;
    }
    function buildNoMatchesItem() {
        const li = document.createElement("li");
        li.className = "skin-no-matches blurb group";
        const p = document.createElement("p");
        p.className = "notes";
        p.textContent = "No skins match these filters.";
        li.appendChild(p);
        return li;
    }

    // ── Page-mode: read form state ──────────────────────────────

    /**
     * Reads current filter/sort state from the DOM form, null-safe.
     * @param {HTMLFormElement} form
     * @param {Object} cur - fallback defaults
     * @returns {Object}
     */
    function readFormState(form, cur) {
        const sf = form.querySelector("#skin-sort-field");
        const sd = form.querySelector("#skin-sort-direction");
        const fi = form.querySelector('input[name="skin_filter_in_use"]:checked');
        const fd = form.querySelector('input[name="skin_filter_description"]:checked');
        const fp = form.querySelector('input[name="skin_filter_parent"]:checked');
        const sr = form.querySelector("#skin-search");
        return {
            sortField: sf ? sf.value : cur.sortField,
            sortDirection: sd ? sd.value : cur.sortDirection,
            filterInUse: fi ? fi.value : cur.filterInUse,
            filterDescription: fd ? fd.value : cur.filterDescription,
            filterParent: fp ? fp.value : cur.filterParent,
            filterSearch: sr ? sr.value.trim() : cur.filterSearch,
        };
    }

    // ── Page-mode: narrow-screen filter panel ───────────────────

    function setupNarrowScreenFilterPanel() {
        const outer = document.getElementById("outer");
        const goBtn = document.getElementById("go_to_filters");
        if (outer && goBtn && !goBtn.dataset.skinFilterboxBound) {
            goBtn.dataset.skinFilterboxBound = "true";
            goBtn.addEventListener("click", (e) => {
                e.preventDefault();
                openNarrowFilterPanel();
            });
        }
        if (outer && !outer.dataset.skinFilterboxLeaveBound) {
            outer.dataset.skinFilterboxLeaveBound = "true";
            outer.addEventListener("click", (e) => {
                if (!(e.target instanceof Element)) return;
                if (!e.target.closest("#leave_filters")) return;
                e.preventDefault();
                closeNarrowFilterPanel(true);
            });
        }
    }

    function openNarrowFilterPanel() {
        const f = document.getElementById("skin-filters");
        if (!main || !f) return;
        f.classList.remove("narrow-hidden");
        main.classList.add("filtering");
        const ff = f.querySelector("a, button, input, select, textarea");
        if (ff) ff.focus();
    }

    function closeNarrowFilterPanel(refocus) {
        const f = document.getElementById("skin-filters");
        const g = document.getElementById("go_to_filters");
        if (f) f.classList.add("narrow-hidden");
        if (main) main.classList.remove("filtering");
        if (refocus && g) g.focus();
    }

    // ── Page-mode: one-time setup ───────────────────────────────

    /**
     * One-time page-mode DOM setup: adds filtered class, converts UL to OL,
     * wraps skin-type navigation, and adds narrow-filter link.
     * @param {HTMLElement} mainEl - #main element
     */
    function setupPage(mainEl) {
        mainEl.classList.add("filtered");
        convertSkinListToOrderedList(mainEl);
        wrapSkinTypeNavigation(mainEl);
        addNarrowFiltersLink(mainEl);
        setupNarrowScreenFilterPanel();
    }

    function convertSkinListToOrderedList(mainEl) {
        const ul = mainEl.querySelector("ul.skin.picture.index.group");
        if (!ul) return;
        const ol = document.createElement("ol");
        [...ul.attributes].forEach((a) => ol.setAttribute(a.name, a.value));
        while (ul.firstChild) ol.appendChild(ul.firstChild);
        ul.parentNode.replaceChild(ol, ul);
    }

    function wrapSkinTypeNavigation(mainEl) {
        const nav = [...mainEl.querySelectorAll("ul.actions[role='navigation']")].find((u) =>
            u.querySelector('a[href*="skin_type"]'),
        );
        if (!nav || document.getElementById("skin-type-nav-wrapper")) return;
        const heading = [...mainEl.querySelectorAll("h3.landmark.heading")].find(
            (e) => e.textContent.trim() === "Skin Type Navigation",
        );
        const w = document.createElement("div");
        w.className = "navigation actions module";
        w.id = "skin-type-nav-wrapper";
        nav.parentNode.insertBefore(w, nav);
        if (heading) w.appendChild(heading);
        w.appendChild(nav);
    }

    function addNarrowFiltersLink(mainEl) {
        const nav = [...mainEl.querySelectorAll("ul.navigation.actions")].find((u) =>
            u.querySelector('a[href*="/skins/new"]'),
        );
        if (!nav || document.getElementById("go_to_filters")) return;
        const li = document.createElement("li");
        li.className = "narrow-shown hidden";
        const a = document.createElement("a");
        a.href = "#skin-filters";
        a.id = "go_to_filters";
        a.textContent = "Filters";
        li.appendChild(a);
        nav.appendChild(li);
    }

    function updatePageHeading(visible, total) {
        const h2 = document.querySelector("#main h2.heading");
        if (!h2) return;
        if (!h2.dataset.originalText) h2.dataset.originalText = h2.textContent.trim();
        const c = visible < total ? visible + " of " + total : "" + total;
        h2.textContent = h2.dataset.originalText + " (" + c + ")";
    }

    // ── Page-mode: render ───────────────────────────────────────

    /**
     * Central page-mode render: sorts by field/direction, splits pinned/unpinned,
     * filters, applies to DOM, updates heading count, rebuilds pin buttons
     * and filter form.
     * @param {Array} allSkins
     * @param {Object} state
     * @param {Set} pins
     */
    function pageRender(allSkins, state, pins) {
        const ol = main.querySelector("ol.skin.picture.index.group");
        if (!ol) return;
        // Remove old filter form before rebuilding
        document.getElementById("skin-filters")?.remove();
        // Split into pinned and unpinned, sort each, then filter
        const pinned = allSkins.filter((s) => pins.has(s.id));
        const unpinned = allSkins.filter((s) => !pins.has(s.id));
        const sp = sortSkins(pinned, state.sortField, state.sortDirection);
        const su = sortSkins(unpinned, state.sortField, state.sortDirection);
        const fp = filterSkins(sp, state);
        const fu = filterSkins(su, state);
        // Apply sorted/filtered list to DOM
        applyToOriginalList(ol, fp, fu, allSkins);
        updatePageHeading(fp.length + fu.length, allSkins.length);
        // Rebuild pin buttons on visible skins
        addPinButtons([...fp, ...fu], pins, state, (id, cs) => {
            if (pins.has(id)) pins.delete(id);
            else pins.add(id);
            savePins(pins);
            pageRender(allSkins, cs, pins);
        });
        // Build and attach filter form after the skin list
        const form = buildFilterForm(state, allSkins, pins);
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const ns = readFormState(form, state);
            saveState(ns);
            closeNarrowFilterPanel(false);
            pageRender(allSkins, ns, pins);
        });
        ol.insertAdjacentElement("afterend", form);
    }

    function clearFilters(allSkins, pins) {
        const ds = { ...DEFAULT_STATE };
        saveState(ds);
        pageRender(allSkins, ds, pins);
    }

    // ── Page-mode: init ─────────────────────────────────────────

    /** Bootstraps page-mode: finds #main, parses skins, loads state/pins, renders. */
    function initPageMode() {
        main = document.getElementById("main");
        if (!main) return;
        const list = main.querySelector("ul.skin.picture.index.group, ol.skin.picture.index.group");
        if (!list) return;
        setupPage(main);
        const ol = main.querySelector("ol.skin.picture.index.group");
        const allSkins = parseSkins(ol);
        const state = loadState();
        const pins = loadPins();
        pageRender(allSkins, state, pins);
    }

    // ── Popup-mode: cache ───────────────────────────────────────

    /**
     * Retrieves cached skin data for username with expiry check.
     * Revives Date objects on hit.
     * @param {string} username
     * @returns {Object|null}
     */
    function getCachedSkins(username) {
        // Strip query params from corrupted usernames (defense in depth)
        username = username.includes("?") ? username.split("?")[0] : username;
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp, cachedUsername } = JSON.parse(cached);
                const cleanCached =
                    cachedUsername && cachedUsername.includes("?")
                        ? cachedUsername.split("?")[0]
                        : cachedUsername;
                if (cleanCached !== username) return null;
                if (Date.now() - timestamp < CACHE_DURATION) {
                    if (data && data.skins) {
                        data.skins.forEach((skin) => {
                            if (skin.lastModified) skin.lastModified = new Date(skin.lastModified);
                        });
                    }
                    return data;
                }
            }
        } catch (e) {}
        return null;
    }
    /** Persists skin data with timestamp and username to localStorage. */
    function setCachedSkins(data, username) {
        try {
            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    data,
                    timestamp: Date.now(),
                    cachedUsername: username,
                }),
            );
        } catch (e) {}
    }
    function clearSkinsCache() {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {}
    }

    // ── Popup-mode: username detection ──────────────────────────

    /**
     * Detects logged-in username via nav link, greeting dropdown, URL,
     * or stored config. Persists result and clears cache on change.
     * @returns {string|null}
     */
    function detectUsername() {
        cachedUsername = null;
        // 1. "Hi, Username!" greeting — authoritative (who is CURRENTLY logged in,
        //    regardless of what page/profile URL you're viewing)
        //    Try standard <a> first; #greeting .user matches <ul> on default skin (bad).
        let greeting = document.querySelector("a.dropdown-toggle[href^='/users/']");
        if (!greeting) {
            greeting = document.querySelector("#greeting .dropdown-toggle, #greeting .user");
        }
        if (greeting) {
            const text = greeting.textContent.trim();
            const hiMatch = text.match(/^Hi,\s*(.+?)!?$/);
            if (hiMatch && hiMatch[1] && !hiMatch[1].includes(" ")) {
                cachedUsername = hiMatch[1];
                if (cachedUsername !== config.username) {
                    config.username = cachedUsername;
                    saveConfig(config);
                    clearSkinsCache();
                }
                return cachedUsername;
            }
        }
        // 2. Old nav link (href-based, some skins use this layout)
        //    Only persist if no greeting element exists (this layout is the primary one).
        const navLink = document.querySelector("li.user.logged-in > a[href^='/users/']");
        if (navLink) {
            const m = navLink.getAttribute("href")?.match(/\/users\/([^\/?]+)/);
            if (m && m[1]) {
                cachedUsername = m[1];
                if (cachedUsername.includes("?")) cachedUsername = cachedUsername.split("?")[0];
                if (cachedUsername !== config.username) {
                    if (!greeting) {
                        config.username = cachedUsername;
                        saveConfig(config);
                    }
                    clearSkinsCache();
                }
                return cachedUsername;
            }
        }
        // 3. Greeting element href/text fallbacks (if "Hi" pattern didn't match)
        if (greeting) {
            const href = greeting.getAttribute("href");
            if (href && href.match(/\/users\//)) {
                const m = href.match(/\/users\/([^\/?]+)/);
                if (m && m[1]) {
                    cachedUsername = m[1];
                    if (cachedUsername !== config.username) {
                        config.username = cachedUsername;
                        saveConfig(config);
                        clearSkinsCache();
                    }
                    return cachedUsername;
                }
            }
            const text = greeting.textContent.trim();
            if (text && !text.match(/\s/)) {
                cachedUsername = text;
                if (cachedUsername !== config.username) {
                    config.username = cachedUsername;
                    saveConfig(config);
                    clearSkinsCache();
                }
                return cachedUsername;
            }
        }
        // 4. URL bar (profile/dashboard pages — NOT authoritative, may be viewing another user)
        //    Do NOT persist to config — URL bar username can be another user's profile.
        const urlMatch = window.location.href.match(/\/users\/([^\/?]+)/);
        if (urlMatch && urlMatch[1]) {
            cachedUsername = urlMatch[1];
            return cachedUsername;
        }
        // 5. Stored config (last resort)
        if (config.username) {
            cachedUsername = config.username;
            return cachedUsername;
        }
        return null;
    }

    // ── Popup-mode: fetch skins ─────────────────────────────────

    /**
     * Fetches the user's skins page, parses skins and preference form
     * action URL from the DOM.
     * @param {string} username
     * @returns {Promise<{skins: Array, formAction: string}>}
     */
    async function fetchSkins(username) {
        const resp = await fetch(
            "https://archiveofourown.org/users/" + username + "/skins?skin_type=Skin",
        );
        if (!resp.ok) throw new Error("Failed to fetch skins");
        const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
        const prefForm = doc.querySelector('form[id^="edit_preference_"]');
        const formAction = prefForm ? prefForm.action : null;
        const skins = [];
        doc.querySelectorAll("li.skins.own").forEach((item) => {
            const link = item.querySelector(".heading a");
            const skinName = link ? link.textContent.trim() : null;
            const skinIdMatch = link ? link.href.match(/\/skins\/(\d+)/) : null;
            const skinId = skinIdMatch ? skinIdMatch[1] : null;
            const hasStop = !!item.querySelector('input[type="submit"][value="Stop Using"]');
            const hasUse = !!item.querySelector('input[type="submit"][value="Use"]');
            const hasEdit = !!item.querySelector('a[href*="/edit"]');
            const isUsable = hasUse || hasStop;
            const isParentOnly = !isUsable && hasEdit;
            const dateText = item.querySelector(".datetime")?.textContent.trim() || "";
            if (skinName && skinId && (isUsable || isParentOnly)) {
                skins.push({
                    name: skinName,
                    id: skinId,
                    isActive: !!hasStop,
                    isParentOnly,
                    lastModified: parseAO3Date(dateText),
                });
            }
        });
        return { skins, formAction };
    }

    // ── Popup-mode: CSRF + apply/revert ─────────────────────────

    /** Retrieves CSRF token from input[name=authenticity_token] or meta[csrf-token]. */
    function getFreshToken() {
        const ti = document.querySelector('input[name="authenticity_token"]');
        if (ti) return ti.value;
        const mt = document.querySelector('meta[name="csrf-token"]');
        if (mt) return mt.content;
        return null;
    }

    /**
     * Submits skin-change form via POST with CSRF token.
     * Clears cache and reloads on success.
     * @param {string} skinId
     * @param {string} formAction - preference form action URL
     */
    function applySkin(skinId, formAction) {
        const token = getFreshToken();
        if (!token) {
            alert("Could not find authentication token. Please try refreshing the page.");
            return;
        }
        const fd = new FormData();
        fd.append("_method", "put");
        fd.append("authenticity_token", token);
        fd.append("preference[skin_id]", skinId);
        fd.append("commit", "Use");
        fetch(formAction, {
            method: "POST",
            body: fd,
            credentials: "same-origin",
            redirect: "manual",
        })
            .then(() => {
                clearSkinsCache();
                location.reload();
            })
            .catch(() => {
                alert("Failed to apply skin. Please try again.");
            });
    }

    /**
     * Reverts to default AO3 skin (skin_id=1) via POST with CSRF token.
     * Clears cache and reloads on success.
     * @param {string} formAction - preference form action URL
     */
    function revertToDefault(formAction) {
        const token = getFreshToken();
        if (!token) {
            alert("Could not find authentication token. Please try refreshing the page.");
            return;
        }
        const fd = new FormData();
        fd.append("_method", "patch");
        fd.append("authenticity_token", token);
        fd.append("preference[skin_id]", "1");
        fd.append("commit", "Revert to Default Skin");
        fetch(formAction, {
            method: "POST",
            body: fd,
            credentials: "same-origin",
            redirect: "manual",
        })
            .then(() => {
                clearSkinsCache();
                location.reload();
            })
            .catch(() => {
                alert("Failed to revert to default skin. Please try again.");
            });
    }

    // ============================================================
    // DOM / UI
    // ============================================================

    // ── Page-mode: filter form ──────────────────────────────────

    /**
     * Builds the DOM filter form for the skins page with sort, search,
     * and radio-group filter controls.
     * @param {Object} state - current filter/sort state
     * @param {Array} allSkins
     * @param {Set} pins - pinned skin IDs
     * @returns {HTMLFormElement}
     */
    function buildFilterForm(state, allSkins, pins) {
        const form = document.createElement("form");
        form.className = "narrow-hidden filters";
        form.id = "skin-filters";
        const h3 = document.createElement("h3");
        h3.className = "landmark heading";
        h3.textContent = "Filters";
        form.appendChild(h3);
        const fs = document.createElement("fieldset");
        const leg = document.createElement("legend");
        leg.textContent = "Filter skins:";
        fs.appendChild(leg);
        const dl = document.createElement("dl");
        dl.appendChild(buildSubmitRow());
        dl.appendChild(buildLabelDt("Sort by", "skin-sort-field", "sort"));
        const sDd = document.createElement("dd");
        sDd.className = "sort";
        const sSel = document.createElement("select");
        sSel.id = "skin-sort-field";
        sSel.name = "skin_sort_field";
        [
            { v: "updated", l: "Date Updated" },
            { v: "created", l: "Date Created" },
            { v: "name", l: "Skin Title" },
        ].forEach(({ v, l }) => {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = l;
            if (v === state.sortField) o.selected = true;
            sSel.appendChild(o);
        });
        sDd.appendChild(sSel);
        dl.appendChild(sDd);
        dl.appendChild(buildLabelDt("Sort direction", "skin-sort-direction", "sort"));
        const dDd = document.createElement("dd");
        dDd.className = "sort";
        const dSel = document.createElement("select");
        dSel.id = "skin-sort-direction";
        dSel.name = "skin_sort_direction";
        [
            { v: "asc", l: "Ascending" },
            { v: "desc", l: "Descending" },
        ].forEach(({ v, l }) => {
            const o = document.createElement("option");
            o.value = v;
            o.textContent = l;
            if (v === state.sortDirection) o.selected = true;
            dSel.appendChild(o);
        });
        dDd.appendChild(dSel);
        dl.appendChild(dDd);
        dl.appendChild(buildLabelDt("Filter by name", "skin-search", "search"));
        const srDd = document.createElement("dd");
        srDd.className = "search";
        const srIn = document.createElement("input");
        srIn.type = "text";
        srIn.id = "skin-search";
        srIn.name = "skin_search";
        srIn.className = "text";
        srIn.value = state.filterSearch || "";
        srDd.appendChild(srIn);
        dl.appendChild(srDd);
        if (!isWorkSkin) {
            dl.appendChild(buildDt("Enabled"));
            const iDd = document.createElement("dd");
            iDd.appendChild(
                buildRadioGroup(
                    "skin_filter_in_use",
                    [
                        { v: "yes", l: "Yes" },
                        { v: "no", l: "No" },
                        { v: "all", l: "Either" },
                    ],
                    state.filterInUse,
                ),
            );
            dl.appendChild(iDd);
        }
        dl.appendChild(buildDt("Description"));
        const dDd2 = document.createElement("dd");
        dDd2.appendChild(
            buildRadioGroup(
                "skin_filter_description",
                [
                    { v: "yes", l: "Yes" },
                    { v: "no", l: "No" },
                    { v: "all", l: "Either" },
                ],
                state.filterDescription,
            ),
        );
        dl.appendChild(dDd2);
        if (!isWorkSkin) {
            dl.appendChild(buildDt("Parent Skin"));
            const pDd = document.createElement("dd");
            pDd.appendChild(
                buildRadioGroup(
                    "skin_filter_parent",
                    [
                        { v: "yes", l: "Yes" },
                        { v: "no", l: "No" },
                        { v: "all", l: "Either" },
                    ],
                    state.filterParent,
                ),
            );
            dl.appendChild(pDd);
        }
        dl.appendChild(buildSubmitRow());
        fs.appendChild(dl);
        const cP = document.createElement("p");
        cP.className = "footnote";
        const cL = document.createElement("a");
        cL.href = "#";
        cL.id = "skin-filters-clear";
        cL.textContent = "Clear Filters";
        cL.addEventListener("click", (e) => {
            e.preventDefault();
            closeNarrowFilterPanel(false);
            clearFilters(allSkins, pins);
        });
        cP.appendChild(cL);
        fs.appendChild(cP);
        form.appendChild(fs);
        const tP = document.createElement("p");
        tP.className = "narrow-shown hidden";
        const tL = document.createElement("a");
        tL.href = "#main";
        tL.id = "leave_filters";
        tL.className = "close";
        tL.textContent = "Top of Skins";
        tP.appendChild(tL);
        form.appendChild(tP);
        return form;
    }

    function buildSubmitRow() {
        const dt = document.createElement("dt");
        dt.className = "landmark";
        dt.textContent = "Sort and Filter";
        const dd = document.createElement("dd");
        dd.className = "submit actions";
        const btn = document.createElement("input");
        btn.type = "submit";
        btn.name = "commit";
        btn.value = "Sort and Filter";
        dd.appendChild(btn);
        const f = document.createDocumentFragment();
        f.appendChild(dt);
        f.appendChild(dd);
        return f;
    }
    function buildDt(t) {
        const d = document.createElement("dt");
        d.textContent = t;
        return d;
    }
    function buildLabelDt(t, fId, c) {
        const d = document.createElement("dt");
        if (c) d.className = c;
        const l = document.createElement("label");
        l.htmlFor = fId;
        l.textContent = t;
        d.appendChild(l);
        return d;
    }
    /**
     * Builds a radio-group <ul> with labels and spans matching AO3 filter markup.
     * @param {string} n - input name
     * @param {Array<{v:string, l:string}>} opts - value/label pairs
     * @param {string} chk - checked value
     * @returns {HTMLUListElement}
     */
    function buildRadioGroup(n, opts, chk) {
        const u = document.createElement("ul");
        opts.forEach(({ v, l }) => {
            const li = document.createElement("li");
            const lb = document.createElement("label");
            const i = document.createElement("input");
            i.type = "radio";
            i.name = n;
            i.value = v;
            if (v === chk) i.checked = true;
            const sp = document.createElement("span");
            sp.className = "indicator";
            sp.setAttribute("aria-hidden", "true");
            const t = document.createElement("span");
            t.textContent = l;
            lb.appendChild(i);
            lb.appendChild(sp);
            lb.appendChild(t);
            li.appendChild(lb);
            u.appendChild(li);
        });
        return u;
    }

    // ── Popup-mode: menu dialog ─────────────────────────────────

    /**
     * Fetches or loads cached skins, then renders the skin switcher
     * dialog with search, sort, edit-mode, and pinning.
     */
    async function showSkinMenu() {
        if (isLoadingMenu) return;
        isLoadingMenu = true;
        try {
            if (window.AO3MenuHelpers) window.AO3MenuHelpers.removeAllDialogs();
            const username = detectUsername();
            if (!username) {
                alert("Could not detect your AO3 username.");
                return;
            }
            if (config.lastUsername && config.lastUsername !== username) clearSkinsCache();
            if (config.username && config.username !== username) clearSkinsCache();
            config.lastUsername = username;
            saveConfig(config);
            let data = getCachedSkins(username);
            if (!data) {
                data = await fetchSkins(username);
                if (data) setCachedSkins(data, username);
            }
            if (!data) return;
            const { skins, formAction } = data;
            let editMode = false,
                searchQuery = "",
                sortMode = "name",
                dialog = null,
                pins = loadPins();

            function getFilteredSkins() {
                let r = editMode
                    ? [...skins]
                    : [...skins]
                          .filter((s) => !s.isParentOnly)
                          .sort((a, b) => a.name.localeCompare(b.name));
                if (sortMode === "date" || editMode)
                    r.sort((a, b) => {
                        const da = a.lastModified ? a.lastModified.getTime() : 0;
                        const db = b.lastModified ? b.lastModified.getTime() : 0;
                        return db - da;
                    });
                if (searchQuery.trim()) {
                    const tokens = tokenizeQuery(searchQuery);
                    r = r.filter((s) => matchesTokenizedQuery(tokens, s.name));
                }
                const pinned = r.filter((s) => pins.has(s.id));
                const unpinned = r.filter((s) => !pins.has(s.id));
                return { pinned, unpinned, total: r.length };
            }
            function render() {
                const { pinned, unpinned, total } = getFilteredSkins();
                const cc = document.createElement("div");
                const sw = document.createElement("div");
                sw.style.cssText =
                    "margin:0 -6px;padding:4px 6px 6px;position:sticky;top:0;z-index:1";
                // Match dialog background — respect palette fallback when active
                const palette = window.AO3MenuHelpers._getEffectivePalette();
                const dialogBg = palette
                    ? palette.dialog.backgroundColor
                    : window.AO3MenuHelpers.themeDetector.getDialogStyles().backgroundColor;
                sw.style.backgroundColor = dialogBg;
                const se = window.AO3MenuHelpers.createSearchInput({
                    placeholder: "Search skins...",
                    value: searchQuery,
                    onInput: () => {
                        searchQuery = se.value;
                        render();
                    },
                });
                se.id = "skin-switcher-search";
                // Read computed styles before any writes to avoid forced layout thrashing
                const seCS = getComputedStyle(se);
                const seBg = seCS.backgroundColor;
                const seBorder = seCS.borderTopColor || seCS.borderColor;
                const seColor = seCS.color;
                // Lock inline styles with !important so MHL hover rules cannot override them
                se.style.setProperty("background", seBg, "important");
                se.style.setProperty("border-color", seBorder, "important");
                se.style.setProperty("color", seColor, "important");
                se.style.setProperty("box-shadow", "none", "important");
                sw.appendChild(se);
                cc.appendChild(sw);
                if (!editMode) {
                    const rotateSvg = window.AO3MenuHelpers.getRotateIconSVG().replace(
                        'stroke-width="2"',
                        'stroke-width="2.5"',
                    );
                    const ri = window.AO3MenuHelpers.createListItem({
                        text: "Revert to Default Skin",
                        icon: rotateSvg,
                        onClick: () => revertToDefault(formAction),
                        dataAttribute: "data-action",
                        dataValue: "revert",
                    });
                    ri.style.fontWeight = "bold";
                    // Size icon, move before text
                    const iconSvg = ri.querySelector("svg");
                    if (iconSvg) {
                        iconSvg.style.width = "1em";
                        iconSvg.style.height = "1em";
                        const iconDiv = iconSvg.parentElement;
                        if (iconDiv) {
                            iconDiv.style.marginRight = "0.5em";
                            ri.insertBefore(iconDiv, ri.firstChild);
                        }
                    }
                    cc.appendChild(ri);
                }
                function appendItem(skin, cont) {
                    const badge = skin.isParentOnly ? "Parent-only" : "";
                    const isPin = pins.has(skin.id);
                    const item = window.AO3MenuHelpers.createListItem({
                        text: skin.name + (skin.isActive ? "\u00A0\u00A0\u00A0\u2713" : ""),
                        onClick: editMode
                            ? () => {
                                  clearSkinsCache();
                                  window.location.href =
                                      "https://archiveofourown.org/skins/" + skin.id + "/edit";
                              }
                            : () => applySkin(skin.id, formAction),
                        dataAttribute: editMode ? "data-edit-id" : "data-skin-id",
                        dataValue: skin.id,
                        badge,
                        badgeClass: "unread parent-badge",
                        badgeSize: "0.7em",
                    });
                    if (editMode) {
                        const pb = document.createElement("span");
                        pb.style.cssText =
                            "cursor:pointer;margin-left:auto;padding:0 6px 0 4px;flex-shrink:0;line-height:0;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;opacity:0.8;transition:opacity 0.2s";
                        pb.title = isPin ? "Unpin" : "Pin to top";
                        pb.innerHTML = isPin
                            ? window.AO3MenuHelpers.getPinFilledIconSVG()
                            : window.AO3MenuHelpers.getPinIconSVG();
                        pb.addEventListener("mouseenter", () => {
                            pb.style.opacity = "1";
                        });
                        pb.addEventListener("mouseleave", () => {
                            pb.style.opacity = "0.7";
                        });
                        pb.addEventListener("click", (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (pins.has(skin.id)) pins.delete(skin.id);
                            else pins.add(skin.id);
                            savePins(pins);
                            render();
                        });
                        item.style.display = "flex";
                        item.style.alignItems = "center";
                        item.appendChild(pb);
                    }
                    cont.appendChild(item);
                }
                const fragment = document.createDocumentFragment();
                pinned.forEach((s) => appendItem(s, fragment));
                if (pinned.length > 0 && unpinned.length > 0) {
                    fragment.appendChild(window.AO3MenuHelpers.createDivider("4px 0"));
                }
                unpinned.forEach((s) => appendItem(s, fragment));
                cc.appendChild(fragment);
                if (total === 0) {
                    const e = document.createElement("p");
                    e.style.cssText = "text-align:center;padding:1em;opacity:0.6";
                    e.textContent = "No skins found";
                    cc.appendChild(e);
                }
                if (!dialog) {
                    dialog = window.AO3MenuHelpers.createFixedHeightDialog({
                        title: "\uD83D\uDD04 Skin Switcher",
                        content: cc,
                        height: "550px",
                        width: "90%",
                        maxWidth: "600px",
                        headerActions: [
                            {
                                id: "edit-toggle",
                                icon: window.AO3MenuHelpers.getEditIconSVG(),
                                title: editMode ? "Exit Edit Mode" : "Edit Mode",
                                onClick: () => {
                                    editMode = !editMode;
                                    render();
                                },
                            },
                            {
                                id: "home-btn",
                                icon: window.AO3MenuHelpers.getHomeIconSVG(),
                                title: "Go to Skins Page",
                                onClick: () => {
                                    clearSkinsCache();
                                    window.location.href =
                                        "https://archiveofourown.org/users/" + username + "/skins";
                                },
                            },
                        ],
                        onThemeToggle: () => {
                            render();
                        },
                    });
                    document.body.appendChild(dialog);
                } else {
                    const sc = dialog.querySelector(".ao3-menu-dialog > div:last-child");
                    if (sc) {
                        sc.innerHTML = "";
                        sc.appendChild(cc);
                        const ni = sc.querySelector('input[type="text"]');
                        if (ni) ni.focus();
                    }
                }
                const eb = dialog.querySelector("#edit-toggle");
                if (eb) {
                    eb.style.opacity = editMode ? "1" : "0.7";
                    eb.title = editMode ? "Exit Edit Mode" : "Edit Mode";
                }
            }
            render();
        } catch (e) {
            console.error("[AO3: Skin Switcher] Error:", e);
        } finally {
            isLoadingMenu = false;
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function initSharedMenu() {
        if (window.AO3MenuHelpers) {
            window.AO3MenuHelpers.addToSharedMenu({
                id: "opencfg_skin_changer",
                text: "Skin Switcher",
                onClick: showSkinMenu,
            });
        }
    }

    const hidePreferenceFlash = () => {
        const url = window.location.href;
        if (url.includes("/preferences") || url.match(/\/users\/[^\/]+\/?$/)) return;
        const flash = document.querySelector(".flash.notice");
        if (flash && flash.textContent.includes("Your preferences were successfully updated"))
            flash.style.display = "none";
    };

    function init() {
        try {
            if (isSkinsPage) {
                startLoadingCloak();
                initPageMode();
            } else {
                config = loadConfig();
                initSharedMenu();
            }
        } finally {
            stopLoadingCloak();
            hidePreferenceFlash();
        }
        // Clear skin cache on logout so next login starts fresh
        document.addEventListener("click", (e) => {
            if (e.target.closest('a[data-method="delete"][href*="/logout"]')) {
                clearSkinsCache();
            }
        });
    }

    function scheduleInit() {
        window.setTimeout(init, 0);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleInit, { once: true });
    } else {
        scheduleInit();
    }

    console.log("[AO3: Skin Switcher] " + (isSkinsPage ? "page mode" : "popup mode") + " loaded.");
})();
