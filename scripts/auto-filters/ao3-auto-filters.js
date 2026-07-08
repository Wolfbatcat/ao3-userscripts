// ==UserScript==
// @name          AO3: Auto Filters
// @version       1.0.0
// @description   Auto-apply your favorite filters every time you search.
// @author        BlackBatCat
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/collections*
// @match         *://archiveofourown.org/users/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1859007/AO3%3A%20Menu%20Helpers%20Library.js?v=2.3.0
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
    "use strict";

    // ============================================================
    // CONSTANTS
    // ============================================================

    const STORAGE_KEY = "ao3_auto_filters_config";
    const VERSION = "1.0.0";

    const RATINGS = [
        { id: "9", label: "Not Rated" },
        { id: "10", label: "General Audiences" },
        { id: "11", label: "Teen And Up Audiences" },
        { id: "12", label: "Mature" },
        { id: "13", label: "Explicit" },
    ];

    const WARNINGS = [
        { id: "16", label: "No Archive Warnings Apply" },
        { id: "14", label: "Creator Chose Not To Use Archive Warnings" },
        { id: "17", label: "Graphic Depictions Of Violence" },
        { id: "18", label: "Major Character Death" },
        { id: "19", label: "Rape/Non-Con" },
        { id: "20", label: "Underage Sex" },
    ];

    const CATEGORIES = [
        { id: "21", label: "Gen" },
        { id: "22", label: "F/M" },
        { id: "23", label: "M/M" },
        { id: "116", label: "F/F" },
        { id: "2246", label: "Multi" },
        { id: "24", label: "Other" },
    ];

    const RATINGS_BY_LABEL = new Map(RATINGS.map((r) => [r.label.toLowerCase(), r.id]));
    const WARNINGS_BY_LABEL = new Map(WARNINGS.map((w) => [w.label.toLowerCase(), w.id]));
    const CATEGORIES_BY_LABEL = new Map(CATEGORIES.map((c) => [c.label.toLowerCase(), c.id]));

    const DEFAULTS = {
        includeRatings: "",
        includeWarnings: "",
        includeCategories: "",
        includeTagNames: "",

        excludeRatings: "",
        excludeWarnings: "",
        excludeCategories: "",
        excludeTagNames: "",

        crossoversFilter: "",
        completionFilter: "",
        minWords: "",
        maxWords: "",
        dateFrom: "",
        dateTo: "",
        searchQuery: "",
        language: "",

        hideChips: false,
        autoSubmit: true,
        pauseFilters: false,
        disableOnMyContent: true,
        username: null,
        hideMenu: false,
        _version: VERSION,
    };

    let cachedUsername = null;

    // ============================================================
    // STORAGE
    // ============================================================

    function loadConfig() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return { ...DEFAULTS };
            const parsed = JSON.parse(stored);
            return { ...DEFAULTS, ...parsed };
        } catch (e) {
            return { ...DEFAULTS };
        }
    }

    function saveConfig(config) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            return false;
        }
    }

    // ============================================================
    // UTILITY
    // ============================================================

    function parseTagList(raw) {
        if (!raw || typeof raw !== "string") return [];
        return raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    /**
     * Checks whether the current page belongs to the given username,
     * matching dashboard, works, bookmarks, readings, and individual bookmark pages.
     */
    function isMyContentPage(username) {
        if (!username || !username.trim()) return false;
        const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const path = window.location.pathname;
        const myContentRegex = new RegExp(
            `^/users/${escapedUsername}(?:/pseuds/[^/]+)?(?:/(?:bookmarks|works|readings))?/?(?:$|[?#])`,
            "i",
        );
        if (myContentRegex.test(path)) return true;
        const params = new URLSearchParams(window.location.search);
        const userId = params.get("user_id");
        if (userId && userId.toLowerCase() === username.toLowerCase()) return true;
        // Check for individual bookmark pages
        if (path.match(/^\/bookmarks\/\d+$/)) {
            const userLink = document.querySelector(`a[href="/users/${username}"]`);
            if (userLink) return true;
        }
        return false;
    }

    /**
     * Detects the logged-in username, memoized for the lifetime of the page.
     * Delegates to MHL, which only persists authoritative (header-derived)
     * detections — never the non-authoritative URL fallback. Only
     * authoritative results are cached here too, so a later call (after the
     * header has rendered) can still recover the real username instead of
     * being stuck on an unreliable URL guess for the rest of the page.
     */
    function detectUsername(config) {
        if (cachedUsername) return cachedUsername;
        const { username, isAuthoritative } = window.AO3MenuHelpers.detectUsername({
            getStored: () => config.username,
            setStored: (username) => {
                config.username = username;
                saveConfig(config);
            },
        });
        if (username && isAuthoritative) cachedUsername = username;
        return username;
    }

    // ============================================================
    // UI HELPERS
    // ============================================================

    function labelToIds(raw, map) {
        if (!raw) return [];
        return parseTagList(raw)
            .map((name) => map.get(name.toLowerCase()) ?? null)
            .filter(Boolean);
    }

    function unknownLabels(raw, map) {
        if (!raw) return [];
        return parseTagList(raw).filter((name) => !map.has(name.toLowerCase()));
    }

    /**
     * Validates the settings form before save.
     * Returns { errors, warnings } — errors block save, warnings need user confirmation.
     */
    function validateSettingsForm(values) {
        const errors = [];
        const warnings = [];

        const includeRatingIds = labelToIds(values.includeRatings, RATINGS_BY_LABEL);
        if (includeRatingIds.length > 1) {
            errors.push(
                "Include Ratings: only one rating can be included at a time (AO3 limitation). Please enter a single rating.",
            );
        }

        const excludeRatingIds = labelToIds(values.excludeRatings, RATINGS_BY_LABEL);
        if (excludeRatingIds.length >= RATINGS.length) {
            warnings.push(
                "Exclude Ratings: every rating is excluded, so no works can ever match. Is this intended?",
            );
        }

        if (values.language.includes(",")) {
            errors.push(
                "Language: AO3's filter only accepts one language at a time. Please enter a single language.",
            );
        }

        [
            ["Include Ratings", values.includeRatings, RATINGS_BY_LABEL],
            ["Exclude Ratings", values.excludeRatings, RATINGS_BY_LABEL],
            ["Include Warnings", values.includeWarnings, WARNINGS_BY_LABEL],
            ["Exclude Warnings", values.excludeWarnings, WARNINGS_BY_LABEL],
            ["Include Categories", values.includeCategories, CATEGORIES_BY_LABEL],
            ["Exclude Categories", values.excludeCategories, CATEGORIES_BY_LABEL],
        ].forEach(([field, raw, map]) => {
            const unknown = unknownLabels(raw, map);
            if (unknown.length > 0) {
                warnings.push(
                    `${field}: "${unknown.join(", ")}" doesn't match any known option and will be ignored.`,
                );
            }
        });

        const minWords = values.minWords.trim();
        const maxWords = values.maxWords.trim();
        if (minWords && !/^\d+$/.test(minWords)) {
            errors.push("Min Word Count must be a whole number.");
        }
        if (maxWords && !/^\d+$/.test(maxWords)) {
            errors.push("Max Word Count must be a whole number.");
        }
        if (
            minWords &&
            maxWords &&
            /^\d+$/.test(minWords) &&
            /^\d+$/.test(maxWords) &&
            Number(minWords) > Number(maxWords)
        ) {
            errors.push("Min Word Count cannot be greater than Max Word Count.");
        }

        const dateFrom = values.dateFrom.trim();
        const dateTo = values.dateTo.trim();
        const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
        if (dateFrom && !isValidDate(dateFrom)) {
            errors.push("Date Updated From must be a valid date (YYYY-MM-DD).");
        }
        if (dateTo && !isValidDate(dateTo)) {
            errors.push("Date Updated To must be a valid date (YYYY-MM-DD).");
        }
        if (dateFrom && dateTo && isValidDate(dateFrom) && isValidDate(dateTo)) {
            if (Date.parse(dateFrom) > Date.parse(dateTo)) {
                errors.push("Date Updated From cannot be later than Date Updated To.");
            }
        }

        return { errors, warnings };
    }

    // ============================================================
    // CORE LOGIC
    // ============================================================

    function mergeTagsIntoHidden(hiddenInput, tags) {
        const existing = hiddenInput.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const toAdd = tags.filter(
            (t) => !existing.some((e) => e.toLowerCase() === t.toLowerCase()),
        );
        if (toAdd.length > 0) {
            hiddenInput.value = [...existing, ...toAdd].join(", ");
        }
    }

    /**
     * Prefills an AO3 autocomplete field with tags.
     * When showChips is true: writes tags into the autocomplete's backing input and
     * injects visual chip elements so the user can see and remove them.
     * When showChips is false: clears the backing input (so AO3's widget renders no
     * chips) and injects a separate plain hidden input with the same name. AO3's
     * server merges all values for the same name, so filtering still works.
     */
    function prefillAutocompleteField(
        autocompleteInput,
        hiddenInput,
        tags,
        showChips = true,
        urlParams = null,
    ) {
        if (!hiddenInput && !autocompleteInput) return;

        if (showChips) {
            // Set hidden input now so chips reflect what will be submitted
            if (hiddenInput) mergeTagsIntoHidden(hiddenInput, tags);

            if (!autocompleteInput) return;
            const ul = autocompleteInput.closest("ul.autocomplete");
            if (!ul) return;
            const inputLi = ul.querySelector("li.input");
            if (!inputLi) return;

            const existingChips = new Set(
                Array.from(ul.querySelectorAll("li.added.tag")).map(
                    (li) => li.firstChild?.textContent?.trim()?.toLowerCase() ?? "",
                ),
            );

            tags.forEach((tag) => {
                if (existingChips.has(tag.toLowerCase())) return;

                const li = document.createElement("li");
                li.className = "added tag";
                li.dataset.autoFilter = "true";
                li.appendChild(document.createTextNode(tag + " "));

                const deleteSpan = document.createElement("span");
                deleteSpan.className = "delete";
                const deleteLink = document.createElement("a");
                deleteLink.href = "#";
                deleteLink.title = `remove ${tag}`;
                deleteLink.textContent = "×";
                deleteLink.addEventListener("click", (e) => {
                    e.preventDefault();
                    li.remove();
                    if (hiddenInput) {
                        hiddenInput.value = hiddenInput.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.toLowerCase() !== tag.toLowerCase())
                            .join(", ");
                    }
                });
                deleteSpan.appendChild(deleteLink);
                li.appendChild(deleteSpan);

                ul.insertBefore(li, inputLi);
                existingChips.add(tag.toLowerCase());
            });
        } else {
            // Strategy: write all tags into the backing input (so AO3 submits them all),
            // hide only the auto-filter chips visually, and inject visible chips for any
            // user-added tags that AO3 didn't render on the results page.
            //
            // We do NOT use a second hidden input — AO3 uses last-value-wins for
            // duplicate param names, so a second input would clobber user-added tags.
            const tagSet = new Set(tags.map((t) => t.toLowerCase()));
            const ul = autocompleteInput ? autocompleteInput.closest("ul.autocomplete") : null;

            // Merge auto-filter tags into the backing input so all tags submit together.
            if (hiddenInput) mergeTagsIntoHidden(hiddenInput, tags);

            // Hide chips belonging to the auto-filter set (leave user chips visible).
            const hideAutoFilterChips = () => {
                if (!ul) return;
                ul.querySelectorAll("li.added.tag:not([data-auto-filter-user])").forEach((li) => {
                    const tagText = li.firstChild?.textContent?.trim()?.toLowerCase();
                    if (tagSet.has(tagText)) li.style.display = "none";
                });
            };

            hideAutoFilterChips();

            if (ul) {
                const obs = new MutationObserver(hideAutoFilterChips);
                obs.observe(ul, { childList: true });
                setTimeout(() => obs.disconnect(), 2000);
            }

            // Inject visible chips for user-added tags that AO3 didn't render.
            // AO3 only populates the backing input from its own canonical param value —
            // tags the user added on a previous page may be in the URL but absent from
            // the backing input (and therefore have no chip). We recover them from the
            // URL and inject chips so the user can see and remove them.
            if (ul && hiddenInput) {
                const paramName = hiddenInput.name;
                const urlTagsMap = new Map(); // lowercase → original-case

                (urlParams ?? new URLSearchParams(location.search))
                    .getAll(paramName)
                    .forEach((val) => {
                        val.split(",").forEach((t) => {
                            const trimmed = t.trim();
                            if (trimmed) urlTagsMap.set(trimmed.toLowerCase(), trimmed);
                        });
                    });

                const existingChipTexts = new Set(
                    Array.from(ul.querySelectorAll("li.added.tag")).map((li) =>
                        li.firstChild?.textContent?.trim()?.toLowerCase(),
                    ),
                );
                const inputLi = ul.querySelector("li.input");

                urlTagsMap.forEach((originalTag, tagLower) => {
                    if (tagSet.has(tagLower)) return; // auto-filter tag — chip already hidden
                    if (existingChipTexts.has(tagLower)) return; // chip already present

                    // Ensure this user tag is also in the backing input
                    if (hiddenInput) mergeTagsIntoHidden(hiddenInput, [originalTag]);

                    const li = document.createElement("li");
                    li.className = "added tag";
                    li.dataset.autoFilterUser = "true";
                    li.appendChild(document.createTextNode(originalTag + " "));

                    const deleteSpan = document.createElement("span");
                    deleteSpan.className = "delete";
                    const deleteLink = document.createElement("a");
                    deleteLink.href = "#";
                    deleteLink.title = `remove ${originalTag}`;
                    deleteLink.textContent = "×";
                    deleteLink.addEventListener("click", (e) => {
                        e.preventDefault();
                        li.remove();
                        if (hiddenInput) {
                            hiddenInput.value = hiddenInput.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter((s) => s.toLowerCase() !== tagLower)
                                .join(", ");
                        }
                    });
                    deleteSpan.appendChild(deleteLink);
                    li.appendChild(deleteSpan);

                    if (inputLi) ul.insertBefore(li, inputLi);
                    else ul.appendChild(li);
                    existingChipTexts.add(tagLower);
                });
            }
        }
    }

    /**
     * Locates the active AO3 filter form on this page and identifies which
     * search param namespace it uses ("work_search" on works/series listings,
     * "bookmark_search" on bookmark listings). The two forms share most field
     * names under their respective namespace, but bookmark forms lack
     * crossover/completion filters and use different names for the query and
     * tag-autocomplete fields.
     */
    function getActiveFilterForm() {
        const workForm = document.getElementById("work-filters");
        if (workForm) return { filterForm: workForm, ns: "work_search" };
        const bookmarkForm = document.getElementById("bookmark-filters");
        if (bookmarkForm) return { filterForm: bookmarkForm, ns: "bookmark_search" };
        return null;
    }

    /**
     * Strips previously injected auto-filter state from the filter form so
     * applyAutoFilters can be called again without duplicating chips or values.
     */
    function resetFilterForm() {
        const active = getActiveFilterForm();
        if (!active) return;
        const { filterForm, ns } = active;

        // Remove chips this script injected (showChips=true mode)
        filterForm.querySelectorAll("li[data-auto-filter]").forEach((li) => {
            const tag = li.firstChild?.textContent?.trim() ?? "";
            const ul = li.closest("ul.autocomplete");
            const hiddenInput = ul
                ? ul.parentElement?.querySelector("input[type='hidden'][name]")
                : null;
            li.remove();
            if (hiddenInput && tag) {
                hiddenInput.value = hiddenInput.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.toLowerCase() !== tag.toLowerCase())
                    .join(", ");
            }
        });

        // Unhide chips this script hid (showChips=false mode)
        filterForm.querySelectorAll("li.added.tag[style*='display']").forEach((li) => {
            li.style.display = "";
        });

        // Remove user-tag chips this script injected (showChips=false mode)
        filterForm.querySelectorAll("li[data-auto-filter-user]").forEach((li) => li.remove());

        // Uncheck all rating/warning/category checkboxes and radios set by this script
        filterForm
            .querySelectorAll(
                `input[name='include_${ns}[rating_ids][]'],` +
                    `input[name='include_${ns}[archive_warning_ids][]'],` +
                    `input[name='include_${ns}[category_ids][]'],` +
                    `input[name='exclude_${ns}[rating_ids][]'],` +
                    `input[name='exclude_${ns}[archive_warning_ids][]'],` +
                    `input[name='exclude_${ns}[category_ids][]']`,
            )
            .forEach((el) => (el.checked = false));

        // Reset crossover/completion radio groups and text fields
        const crossoverDefault = filterForm.querySelector(
            `input[name="${ns}[crossover]"][value=""]`,
        );
        if (crossoverDefault) crossoverDefault.checked = true;
        const completeDefault = filterForm.querySelector(`input[name="${ns}[complete]"][value=""]`);
        if (completeDefault) completeDefault.checked = true;
        const wordsFrom = filterForm.querySelector(`input[name="${ns}[words_from]"]`);
        if (wordsFrom) wordsFrom.value = "";
        const wordsTo = filterForm.querySelector(`input[name="${ns}[words_to]"]`);
        if (wordsTo) wordsTo.value = "";
        const dateFrom = filterForm.querySelector(`input[name="${ns}[date_from]"]`);
        if (dateFrom) dateFrom.value = "";
        const dateTo = filterForm.querySelector(`input[name="${ns}[date_to]"]`);
        if (dateTo) dateTo.value = "";
        const queryName = ns === "bookmark_search" ? "bookmarkable_query" : "query";
        const query = filterForm.querySelector(`input[name="${ns}[${queryName}]"]`);
        if (query) query.value = "";
        const lang = filterForm.querySelector(`select[name="${ns}[language_id]"]`);
        if (lang) lang.value = "";
    }

    /**
     * Prefills the AO3 filter form with all saved config values.
     * Runs on page load; returns early if the filter form is absent.
     * @param {Object} config
     */
    function applyAutoFilters(config, { suppressAutoSubmit = false } = {}) {
        const active = getActiveFilterForm();
        if (!active) return;
        const { filterForm, ns } = active;
        if (config.pauseFilters) return;

        const username = detectUsername(config);
        if (config.disableOnMyContent && username && isMyContentPage(username)) return;

        const urlParams = new URLSearchParams(location.search);
        const tagAutocompleteId = ns === "bookmark_search" ? "bookmark_search" : "work_search";

        // Build value→element Maps for each checkbox/radio group (one querySelectorAll each)
        const toMap = (sel) =>
            new Map(Array.from(filterForm.querySelectorAll(sel)).map((el) => [el.value, el]));
        const incRatingMap = toMap(`input[name="include_${ns}[rating_ids][]"]`);
        const incWarningMap = toMap(`input[name="include_${ns}[archive_warning_ids][]"]`);
        const incCategoryMap = toMap(`input[name="include_${ns}[category_ids][]"]`);
        const excRatingMap = toMap(`input[name="exclude_${ns}[rating_ids][]"]`);
        const excWarningMap = toMap(`input[name="exclude_${ns}[archive_warning_ids][]"]`);
        const excCategoryMap = toMap(`input[name="exclude_${ns}[category_ids][]"]`);

        // Include ratings (radio buttons — AO3 only allows one at a time)
        const includeRatingIds = labelToIds(config.includeRatings, RATINGS_BY_LABEL);
        if (includeRatingIds.length > 0) {
            const radio = incRatingMap.get(includeRatingIds[includeRatingIds.length - 1]);
            if (radio) radio.checked = true;
        }

        // Include warnings
        labelToIds(config.includeWarnings, WARNINGS_BY_LABEL).forEach((id) => {
            const cb = incWarningMap.get(id);
            if (cb) cb.checked = true;
        });

        // Include categories
        labelToIds(config.includeCategories, CATEGORIES_BY_LABEL).forEach((id) => {
            const cb = incCategoryMap.get(id);
            if (cb) cb.checked = true;
        });

        // Include free tags
        const includeTags = parseTagList(config.includeTagNames);
        if (includeTags.length > 0) {
            prefillAutocompleteField(
                filterForm.querySelector(`#${tagAutocompleteId}_other_tag_names_autocomplete`),
                filterForm.querySelector(`#${tagAutocompleteId}_other_tag_names`),
                includeTags,
                config.hideChips !== true,
                urlParams,
            );
        }

        // Exclude ratings
        labelToIds(config.excludeRatings, RATINGS_BY_LABEL).forEach((id) => {
            const cb = excRatingMap.get(id);
            if (cb) cb.checked = true;
        });

        // Exclude warnings
        labelToIds(config.excludeWarnings, WARNINGS_BY_LABEL).forEach((id) => {
            const cb = excWarningMap.get(id);
            if (cb) cb.checked = true;
        });

        // Exclude categories
        labelToIds(config.excludeCategories, CATEGORIES_BY_LABEL).forEach((id) => {
            const cb = excCategoryMap.get(id);
            if (cb) cb.checked = true;
        });

        // Exclude free tags
        const excludeTags = parseTagList(config.excludeTagNames);
        if (excludeTags.length > 0) {
            prefillAutocompleteField(
                filterForm.querySelector(`#${tagAutocompleteId}_excluded_tag_names_autocomplete`),
                filterForm.querySelector(`#${tagAutocompleteId}_excluded_tag_names`),
                excludeTags,
                config.hideChips !== true,
                urlParams,
            );
        }

        // Crossovers and completion filters — works/series listings only, no
        // equivalent field exists on the bookmark filter form. AO3 renders
        // these as radio groups, not <select> elements.
        if (ns === "work_search") {
            if (config.crossoversFilter) {
                const radio = filterForm.querySelector(
                    `input[name="${ns}[crossover]"][value="${config.crossoversFilter}"]`,
                );
                if (radio) radio.checked = true;
            }

            if (config.completionFilter) {
                const radio = filterForm.querySelector(
                    `input[name="${ns}[complete]"][value="${config.completionFilter}"]`,
                );
                if (radio) radio.checked = true;
            }
        }

        // Word count
        if (config.minWords) {
            const el = filterForm.querySelector(`input[name="${ns}[words_from]"]`);
            if (el) el.value = config.minWords;
        }
        if (config.maxWords) {
            const el = filterForm.querySelector(`input[name="${ns}[words_to]"]`);
            if (el) el.value = config.maxWords;
        }

        // Date updated — works/series listings only, no equivalent field on
        // the bookmark filter form.
        if (ns === "work_search") {
            if (config.dateFrom) {
                const el = filterForm.querySelector(`input[name="${ns}[date_from]"]`);
                if (el) el.value = config.dateFrom;
            }
            if (config.dateTo) {
                const el = filterForm.querySelector(`input[name="${ns}[date_to]"]`);
                if (el) el.value = config.dateTo;
            }
        }

        // Search within results — append to any existing URL query, don't overwrite it.
        // Strip our own suffix first so repeated page loads don't double-append.
        // Bookmark forms use "bookmarkable_query" instead of "query".
        if (config.searchQuery) {
            const queryName = ns === "bookmark_search" ? "bookmarkable_query" : "query";
            const el = filterForm.querySelector(`input[name="${ns}[${queryName}]"]`);
            if (el) {
                const suffix = config.searchQuery;
                const base = el.value
                    .trim()
                    .replace(
                        new RegExp(`\\s*${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`),
                        "",
                    )
                    .trim();
                el.value = base ? `${base} ${suffix}` : suffix;
            }
        }

        // Language — match option text case-insensitively
        if (config.language) {
            const sel = filterForm.querySelector(`select[name="${ns}[language_id]"]`);
            if (sel) {
                const target = config.language.toLowerCase();
                const opt = Array.from(sel.options).find(
                    (o) => o.textContent.trim().toLowerCase() === target,
                );
                if (opt) sel.value = opt.value;
            }
        }

        // Auto-submit: click the Sort and Filter button after all prefills are applied.
        // Skip if the URL already contains filter/sort params — covers paginated results,
        // back-navigation, and any other page where filters are already in effect.
        if (config.autoSubmit && !suppressAutoSubmit && !location.search.includes(ns)) {
            const submitBtn = filterForm.querySelector(
                `input[type="submit"], button[type="submit"]`,
            );
            if (submitBtn) {
                requestAnimationFrame(() => submitBtn.click());
            }
        }
    }

    // ============================================================
    // SETTINGS MENU
    // ============================================================

    function showAutoFiltersMenu() {
        if (!window.AO3MenuHelpers) {
            alert("AO3 Menu Helpers Library is required for this script to function properly.");
            return;
        }
        window.AO3MenuHelpers.removeAllDialogs();

        const config = loadConfig();

        const dialog = window.AO3MenuHelpers.createDialog("🔍 Auto Filters 🔍", {
            maxWidth: "800px",
        });

        // ── Include section ──────────────────────────────────────

        const includeSection = window.AO3MenuHelpers.createSection("✅ Include");

        const includeTagsInput = window.AO3MenuHelpers.createTextarea({
            id: "auto-filter-include-input",
            label: "Include Tags",
            value: config.includeTagNames || "",
            placeholder: "Happy Ending, Slow Burn, Hurt/Comfort",
            tooltip:
                "Tags to add to AO3's 'Other tags to include' filter. Separate with commas. Must match AO3 tag names exactly.",
        });
        includeSection.appendChild(includeTagsInput);

        const includeRatingsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-include-ratings",
            label: "Ratings",
            value: config.includeRatings || "",
            placeholder: "Teen And Up Audiences, Mature",
            tooltip:
                "Rating name to include. AO3 only supports one included rating at a time. Options: Not Rated, General Audiences, Teen And Up Audiences, Mature, Explicit.",
        });

        const includeWarningsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-include-warnings",
            label: "Warnings",
            value: config.includeWarnings || "",
            placeholder: "No Archive Warnings Apply",
            tooltip:
                "Warning names to include, separated by commas. Options: No Archive Warnings Apply, Creator Chose Not To Use Archive Warnings, Graphic Depictions Of Violence, Major Character Death, Rape/Non-Con, Underage Sex.",
        });

        includeSection.appendChild(
            window.AO3MenuHelpers.createTwoColumnLayout(includeRatingsInput, includeWarningsInput),
        );

        const includeCategoriesInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-include-categories",
            label: "Categories",
            value: config.includeCategories || "",
            placeholder: "M/M, F/F",
            tooltip:
                "Category names to include, separated by commas. Options: Gen, F/M, M/M, F/F, Multi, Other.",
        });
        includeSection.appendChild(includeCategoriesInput);

        dialog.appendChild(includeSection);

        // ── Exclude section ──────────────────────────────────────

        const excludeSection = window.AO3MenuHelpers.createSection("🚫 Exclude");

        const excludeTagsInput = window.AO3MenuHelpers.createTextarea({
            id: "auto-filter-exclude-input",
            label: "Exclude Tags",
            value: config.excludeTagNames || "",
            placeholder: "Explicit, Major Character Death",
            tooltip:
                "Tags to add to AO3's 'Other tags to exclude' filter. Separate with commas. Must match AO3 tag names exactly.",
        });
        excludeSection.appendChild(excludeTagsInput);

        const excludeRatingsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-exclude-ratings",
            label: "Ratings",
            value: config.excludeRatings || "",
            placeholder: "Explicit",
            tooltip:
                "Rating names to exclude, separated by commas. Options: Not Rated, General Audiences, Teen And Up Audiences, Mature, Explicit.",
        });

        const excludeWarningsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-exclude-warnings",
            label: "Warnings",
            value: config.excludeWarnings || "",
            placeholder: "Major Character Death, Rape/Non-Con",
            tooltip:
                "Warning names to exclude, separated by commas. Options: No Archive Warnings Apply, Creator Chose Not To Use Archive Warnings, Graphic Depictions Of Violence, Major Character Death, Rape/Non-Con, Underage Sex.",
        });

        excludeSection.appendChild(
            window.AO3MenuHelpers.createTwoColumnLayout(excludeRatingsInput, excludeWarningsInput),
        );

        const excludeCategoriesInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-exclude-categories",
            label: "Categories",
            value: config.excludeCategories || "",
            placeholder: "F/M, Other",
            tooltip:
                "Category names to exclude, separated by commas. Options: Gen, F/M, M/M, F/F, Multi, Other.",
        });
        excludeSection.appendChild(excludeCategoriesInput);

        dialog.appendChild(excludeSection);

        // ── More Options section ─────────────────────────────────

        const moreSection = window.AO3MenuHelpers.createSection("🛠️ More Options");

        const crossoversSelect = window.AO3MenuHelpers.createSelect({
            id: "auto-filter-crossovers",
            label: "Crossovers",
            options: [
                { value: "", label: "Include crossovers", selected: !config.crossoversFilter },
                { value: "T", label: "Only crossovers", selected: config.crossoversFilter === "T" },
                {
                    value: "F",
                    label: "Exclude crossovers",
                    selected: config.crossoversFilter === "F",
                },
            ],
        });

        const completionSelect = window.AO3MenuHelpers.createSelect({
            id: "auto-filter-completion",
            label: "Completion Status",
            options: [
                { value: "", label: "All works", selected: !config.completionFilter },
                {
                    value: "T",
                    label: "Complete works only",
                    selected: config.completionFilter === "T",
                },
                {
                    value: "F",
                    label: "Works in progress only",
                    selected: config.completionFilter === "F",
                },
            ],
        });

        const selectRow = window.AO3MenuHelpers.createTwoColumnLayout(
            crossoversSelect,
            completionSelect,
        );
        moreSection.appendChild(selectRow);

        const minWordsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-min-words",
            label: "Min Word Count",
            value: config.minWords || "",
            placeholder: "1000",
        });

        const maxWordsInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-max-words",
            label: "Max Word Count",
            value: config.maxWords || "",
            placeholder: "100000",
        });

        const wordCountRow = window.AO3MenuHelpers.createTwoColumnLayout(
            minWordsInput,
            maxWordsInput,
        );
        moreSection.appendChild(wordCountRow);

        const dateFromInput = window.AO3MenuHelpers.createDateInput({
            id: "auto-filter-date-from",
            label: "Date Updated From",
            value: config.dateFrom || "",
            placeholder: "2026-06-02",
        });

        const dateToInput = window.AO3MenuHelpers.createDateInput({
            id: "auto-filter-date-to",
            label: "Date Updated To",
            value: config.dateTo || "",
            placeholder: "2026-06-02",
        });

        const dateRow = window.AO3MenuHelpers.createTwoColumnLayout(dateFromInput, dateToInput);
        moreSection.appendChild(dateRow);

        const searchQueryInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-query",
            label: "Search Within Results",
            value: config.searchQuery || "",
            placeholder: "coffee shop AU",
            tooltip: "Prefills the keyword search field on works listing pages.",
        });
        moreSection.appendChild(searchQueryInput);

        const languageInput = window.AO3MenuHelpers.createTextInput({
            id: "auto-filter-language",
            label: "Language",
            value: config.language || "",
            placeholder: "English",
            tooltip:
                "Language name as it appears in AO3's filter dropdown (e.g. 'English', 'Русский', '中文-普通话国语'). Case-insensitive. Only one language can be set.",
        });
        moreSection.appendChild(languageInput);

        dialog.appendChild(moreSection);

        // ── Options section ──────────────────────────────────────

        const optionsSection = window.AO3MenuHelpers.createSection("⚙️ Options");

        const hideChipsCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-hide-chips",
            label: "Hide tag chips",
            checked: config.hideChips === true,
            tooltip:
                "When disabled, included/excluded tags appear as removable chips in AO3's filter sidebar. When enabled, tags are applied silently — filtering still works but no chips are shown.",
        });

        const autoSubmitCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-auto-submit",
            label: "Automatically sort and filter on page load",
            checked: config.autoSubmit === true,
            tooltip:
                "When enabled, AO3's 'Sort and Filter' button is clicked automatically after your saved filters are applied. The page will reload with filtered results immediately.",
        });
        const optionsRow1 = window.AO3MenuHelpers.createTwoColumnLayout(
            hideChipsCheckbox,
            autoSubmitCheckbox,
        );
        optionsSection.appendChild(optionsRow1);

        const disableOnMyContentCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-disable-on-my-content",
            label: "Disable on my content",
            checked: config.disableOnMyContent !== false,
            tooltip:
                "Don't apply saved filters on your own dashboard, bookmarks, history, and works pages.",
        });

        const hideMenuCheckbox = window.AO3MenuHelpers.createHideMenuCheckbox({
            id: "auto-filters-hide-menu-checkbox",
            checked: config.hideMenu,
        });

        const optionsRow2 = window.AO3MenuHelpers.createTwoColumnLayout(
            disableOnMyContentCheckbox,
            hideMenuCheckbox,
        );
        optionsSection.appendChild(optionsRow2);
        dialog.appendChild(optionsSection);

        // ── Tip ──────────────────────────────────────────────────

        const tipContent = document.createElement("span");
        tipContent.innerHTML =
            "<strong>Tip:</strong> Exclude metatags to filter out all similar subtags. For example, instead of excluding `Alternate Universe - Modern Setting`, use `Modern Era` to filter out all modern setting works.";
        dialog.appendChild(window.AO3MenuHelpers.createTipBox(tipContent, { icon: "🔖" }));

        // ── Buttons ──────────────────────────────────────────────

        const buttons = window.AO3MenuHelpers.createButtonGroup([
            { text: "Save", id: "auto-filters-save" },
            { text: "Cancel", id: "auto-filters-cancel" },
        ]);
        dialog.appendChild(buttons);

        dialog.appendChild(
            window.AO3MenuHelpers.createImportExportRow({
                onReset: () => {
                    if (saveConfig({ ...DEFAULTS })) {
                        alert("Settings reset! Reloading...");
                        location.reload();
                    }
                },
                exportData: () => loadConfig(),
                exportPrefix: "ao3_auto_filters_config",
                onImport: (file) => {
                    const reader = new FileReader();
                    reader.onerror = () =>
                        alert("Failed to read file. It may be corrupted or inaccessible.");
                    reader.onload = function (evt) {
                        try {
                            const imported = JSON.parse(evt.target.result);
                            if (typeof imported !== "object" || !imported)
                                throw new Error("Invalid JSON");
                            const valid = { ...DEFAULTS };
                            Object.keys(valid).forEach((key) => {
                                if (Object.prototype.hasOwnProperty.call(imported, key))
                                    valid[key] = imported[key];
                            });
                            if (saveConfig(valid)) {
                                alert("Settings imported! Reloading...");
                                location.reload();
                            } else {
                                throw new Error("Failed to save imported settings");
                            }
                        } catch (err) {
                            alert("Import failed: " + (err && err.message ? err.message : err));
                        }
                    };
                    reader.readAsText(file);
                },
            }),
        );

        // ── Save handler ─────────────────────────────────────────

        const saveBtn = dialog.querySelector("#auto-filters-save");
        if (saveBtn) {
            saveBtn.addEventListener("click", () => {
                const updatedConfig = {
                    includeRatings:
                        window.AO3MenuHelpers.getValue("auto-filter-include-ratings") || "",
                    includeWarnings:
                        window.AO3MenuHelpers.getValue("auto-filter-include-warnings") || "",
                    includeCategories:
                        window.AO3MenuHelpers.getValue("auto-filter-include-categories") || "",
                    includeTagNames:
                        window.AO3MenuHelpers.getValue("auto-filter-include-input") || "",
                    excludeRatings:
                        window.AO3MenuHelpers.getValue("auto-filter-exclude-ratings") || "",
                    excludeWarnings:
                        window.AO3MenuHelpers.getValue("auto-filter-exclude-warnings") || "",
                    excludeCategories:
                        window.AO3MenuHelpers.getValue("auto-filter-exclude-categories") || "",
                    excludeTagNames:
                        window.AO3MenuHelpers.getValue("auto-filter-exclude-input") || "",
                    crossoversFilter:
                        window.AO3MenuHelpers.getValue("auto-filter-crossovers") || "",
                    completionFilter:
                        window.AO3MenuHelpers.getValue("auto-filter-completion") || "",
                    minWords: window.AO3MenuHelpers.getValue("auto-filter-min-words") || "",
                    maxWords: window.AO3MenuHelpers.getValue("auto-filter-max-words") || "",
                    dateFrom: window.AO3MenuHelpers.getValue("auto-filter-date-from") || "",
                    dateTo: window.AO3MenuHelpers.getValue("auto-filter-date-to") || "",
                    searchQuery: window.AO3MenuHelpers.getValue("auto-filter-query") || "",
                    language: window.AO3MenuHelpers.getValue("auto-filter-language") || "",
                    hideChips: window.AO3MenuHelpers.getValue("auto-filter-hide-chips") === true,
                    autoSubmit: window.AO3MenuHelpers.getValue("auto-filter-auto-submit") === true,
                    disableOnMyContent:
                        window.AO3MenuHelpers.getValue("auto-filter-disable-on-my-content") ===
                        true,
                    username: config.username || null,
                    hideMenu: window.AO3MenuHelpers.getValue("auto-filters-hide-menu-checkbox"),
                    _version: VERSION,
                };

                const { errors, warnings } = validateSettingsForm(updatedConfig);
                if (errors.length > 0) {
                    alert(errors.join("\n"));
                    return;
                }
                if (warnings.length > 0 && !confirm(warnings.join("\n") + "\n\nSave anyway?")) {
                    return;
                }

                if (saveConfig(updatedConfig)) {
                    resetFilterForm();
                    applyAutoFilters(updatedConfig, { suppressAutoSubmit: true });
                    dialog.remove();
                } else {
                    alert("Error saving settings.");
                }
            });
        }

        const cancelBtn = dialog.querySelector("#auto-filters-cancel");
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => dialog.remove());
        }

        document.body.appendChild(dialog);
    }

    // ============================================================
    // SHARED MENU
    // ============================================================

    function initSharedMenu() {
        const config = loadConfig();

        let menuContainer = document.getElementById("scriptconfig");

        if (!menuContainer) {
            const headerMenu = document.querySelector("ul.primary.navigation.actions");
            const searchItem = headerMenu?.querySelector("li.search");
            if (!headerMenu || !searchItem) return;

            menuContainer = document.createElement("li");
            menuContainer.className = "dropdown";
            menuContainer.id = "scriptconfig";
            menuContainer.innerHTML = `
                <a class="dropdown-toggle" href="/" data-toggle="dropdown" data-target="#">Userscripts</a>
                <ul class="menu dropdown-menu"></ul>
            `;
            headerMenu.insertBefore(menuContainer, searchItem);
        }

        const menu = menuContainer.querySelector(".dropdown-menu");
        if (!menu) return;

        if (
            !menu.querySelector("#opencfg_auto_filters") &&
            (!config.hideMenu || window.AO3MenuHelpers?.isAO3Homepage())
        ) {
            const settingsItem = document.createElement("li");
            settingsItem.innerHTML =
                '<a href="javascript:void(0);" id="opencfg_auto_filters">Auto Filters</a>';
            settingsItem.querySelector("a").addEventListener("click", showAutoFiltersMenu);
            menu.appendChild(settingsItem);
        }

        if (!menu.querySelector("#toggle-auto-filters-pause")) {
            const pauseItem = document.createElement("li");
            const pauseLink = document.createElement("a");
            pauseLink.href = "javascript:void(0);";
            pauseLink.id = "toggle-auto-filters-pause";
            pauseLink.innerHTML = config.pauseFilters
                ? `Auto Filters: Resume ▶`
                : `Auto Filters: Pause ⏸`;
            pauseLink.addEventListener("click", () => {
                const current = loadConfig();
                current.pauseFilters = !current.pauseFilters;
                saveConfig(current);
                location.reload();
            });
            pauseItem.appendChild(pauseLink);
            menu.appendChild(pauseItem);
        }
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function init() {
        const config = loadConfig();
        applyAutoFilters(config);
        initSharedMenu();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    try {
        console.log("[AO3: Auto Filters] loaded.");
    } catch (e) {}
})();
