// ==UserScript==
// @name          AO3: Auto Filters
// @version       1.0.0-beta
// @description   Automatically prefills AO3's filter sidebar with your saved preferences — tags, ratings, warnings, categories, completion, crossovers, word count, language, and search query.
// @author        BlackBatCat
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/tags/*
// @match         *://archiveofourown.org/works*
// @match         *://archiveofourown.org/bookmarks*
// @match         *://archiveofourown.org/collections*
// @match         *://archiveofourown.org/users/*
// @match         *://archiveofourown.org/series/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1850777/AO3%3A%20Menu%20Helpers%20Library.js?v=2.2.3
// @grant         none
// @run-at        document-end
// ==/UserScript==

(function () {
    "use strict";

    // ============================================================
    // CONSTANTS
    // ============================================================

    const STORAGE_KEY = "ao3_auto_filters_config";
    const VERSION = "1.0.0-beta";

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
        searchQuery: "",
        language: "",

        showIncludeChips: true,
        showExcludeChips: true,
        autoSubmit: false,
        pauseFilters: false,
        hideMenu: false,
        _version: VERSION,
    };

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

    // ============================================================
    // UI HELPERS
    // ============================================================

    function labelToIds(raw, map) {
        if (!raw) return [];
        return parseTagList(raw)
            .map((name) => map.get(name.toLowerCase()) ?? null)
            .filter(Boolean);
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
     * Strips previously injected auto-filter state from the filter form so
     * applyAutoFilters can be called again without duplicating chips or values.
     */
    function resetFilterForm() {
        const filterForm = document.getElementById("work-filters");
        if (!filterForm) return;

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
                "input[name='include_work_search[rating_ids][]']," +
                    "input[name='include_work_search[archive_warning_ids][]']," +
                    "input[name='include_work_search[category_ids][]']," +
                    "input[name='exclude_work_search[rating_ids][]']," +
                    "input[name='exclude_work_search[archive_warning_ids][]']," +
                    "input[name='exclude_work_search[category_ids][]']",
            )
            .forEach((el) => (el.checked = false));

        // Reset selects and text fields
        const crossoverSel = filterForm.querySelector(`select[name="work_search[crossover]"]`);
        if (crossoverSel) crossoverSel.value = "";
        const completeSel = filterForm.querySelector(`select[name="work_search[complete]"]`);
        if (completeSel) completeSel.value = "";
        const wordsFrom = filterForm.querySelector(`input[name="work_search[words_from]"]`);
        if (wordsFrom) wordsFrom.value = "";
        const wordsTo = filterForm.querySelector(`input[name="work_search[words_to]"]`);
        if (wordsTo) wordsTo.value = "";
        const query = filterForm.querySelector(`input[name="work_search[query]"]`);
        if (query) query.value = "";
        const lang = filterForm.querySelector(`select[name="work_search[language_id]"]`);
        if (lang) lang.value = "";
    }

    /**
     * Prefills the AO3 filter form with all saved config values.
     * Runs on page load; returns early if the filter form is absent.
     * @param {Object} config
     */
    function applyAutoFilters(config, { suppressAutoSubmit = false } = {}) {
        const filterForm = document.getElementById("work-filters");
        if (!filterForm) return;
        if (config.pauseFilters) return;

        const urlParams = new URLSearchParams(location.search);

        // Build value→element Maps for each checkbox/radio group (one querySelectorAll each)
        const toMap = (sel) =>
            new Map(Array.from(filterForm.querySelectorAll(sel)).map((el) => [el.value, el]));
        const incRatingMap = toMap(`input[name="include_work_search[rating_ids][]"]`);
        const incWarningMap = toMap(`input[name="include_work_search[archive_warning_ids][]"]`);
        const incCategoryMap = toMap(`input[name="include_work_search[category_ids][]"]`);
        const excRatingMap = toMap(`input[name="exclude_work_search[rating_ids][]"]`);
        const excWarningMap = toMap(`input[name="exclude_work_search[archive_warning_ids][]"]`);
        const excCategoryMap = toMap(`input[name="exclude_work_search[category_ids][]"]`);

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
                filterForm.querySelector("#work_search_other_tag_names_autocomplete"),
                filterForm.querySelector("#work_search_other_tag_names"),
                includeTags,
                config.showIncludeChips !== false,
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
                filterForm.querySelector("#work_search_excluded_tag_names_autocomplete"),
                filterForm.querySelector("#work_search_excluded_tag_names"),
                excludeTags,
                config.showExcludeChips !== false,
                urlParams,
            );
        }

        // Crossovers filter
        if (config.crossoversFilter) {
            const sel = filterForm.querySelector(`select[name="work_search[crossover]"]`);
            if (sel) sel.value = config.crossoversFilter;
        }

        // Completion filter
        if (config.completionFilter) {
            const sel = filterForm.querySelector(`select[name="work_search[complete]"]`);
            if (sel) sel.value = config.completionFilter;
        }

        // Word count
        if (config.minWords) {
            const el = filterForm.querySelector(`input[name="work_search[words_from]"]`);
            if (el) el.value = config.minWords;
        }
        if (config.maxWords) {
            const el = filterForm.querySelector(`input[name="work_search[words_to]"]`);
            if (el) el.value = config.maxWords;
        }

        // Search within results — append to any existing URL query, don't overwrite it.
        // Strip our own suffix first so repeated page loads don't double-append.
        if (config.searchQuery) {
            const el = filterForm.querySelector(`input[name="work_search[query]"]`);
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
            const sel = filterForm.querySelector(`select[name="work_search[language_id]"]`);
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
        if (config.autoSubmit && !suppressAutoSubmit && !location.search.includes("work_search")) {
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
                "Rating names to include, separated by commas. AO3 only supports one included rating at a time — if multiple are listed, the last one is applied. Options: Not Rated, General Audiences, Teen And Up Audiences, Mature, Explicit.",
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

        const moreSection = window.AO3MenuHelpers.createSection("⚙️ More Options");

        const crossoversSelect = window.AO3MenuHelpers.createSelect({
            id: "auto-filter-crossovers",
            label: "Crossovers",
            options: [
                { value: "", label: "— No preference —", selected: !config.crossoversFilter },
                { value: "T", label: "Only crossovers", selected: config.crossoversFilter === "T" },
                { value: "F", label: "No crossovers", selected: config.crossoversFilter === "F" },
            ],
        });

        const completionSelect = window.AO3MenuHelpers.createSelect({
            id: "auto-filter-completion",
            label: "Completion Status",
            options: [
                { value: "", label: "— All works —", selected: !config.completionFilter },
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
                "Language name as it appears in AO3's filter dropdown (e.g. 'English', 'Русский', '中文-普通话国语'). Case-insensitive.",
        });
        moreSection.appendChild(languageInput);

        dialog.appendChild(moreSection);

        // ── Options section ──────────────────────────────────────

        const optionsSection = window.AO3MenuHelpers.createSection("🛠️ Options");

        const showIncludeChipsCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-show-include-chips",
            label: "Show included tags as chips",
            checked: config.showIncludeChips !== false,
            tooltip:
                "When enabled, included tags appear as removable chips in AO3's filter sidebar. When disabled, tags are applied silently — filtering still works but no chips are shown.",
        });
        const showExcludeChipsCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-show-exclude-chips",
            label: "Show excluded tags as chips",
            checked: config.showExcludeChips !== false,
            tooltip:
                "When enabled, excluded tags appear as removable chips in AO3's filter sidebar. When disabled, tags are applied silently — filtering still works but no chips are shown.",
        });
        const chipsRow = window.AO3MenuHelpers.createTwoColumnLayout(
            showIncludeChipsCheckbox,
            showExcludeChipsCheckbox,
        );
        optionsSection.appendChild(chipsRow);

        const autoSubmitCheckbox = window.AO3MenuHelpers.createCheckbox({
            id: "auto-filter-auto-submit",
            label: "Automatically sort and filter on page load",
            checked: config.autoSubmit === true,
            tooltip:
                "When enabled, AO3's 'Sort and Filter' button is clicked automatically after your saved filters are applied. The page will reload with filtered results immediately.",
        });
        optionsSection.appendChild(autoSubmitCheckbox);

        const hideMenuCheckbox = window.AO3MenuHelpers.createHideMenuCheckbox({
            id: "auto-filters-hide-menu-checkbox",
            checked: config.hideMenu,
        });
        optionsSection.appendChild(hideMenuCheckbox);
        dialog.appendChild(optionsSection);

        // ── Tip ──────────────────────────────────────────────────

        const tipContent = document.createElement("span");
        tipContent.innerHTML =
            "<strong>Tip:</strong> All saved filters are applied automatically on page load. You can adjust or remove them per-session directly in AO3's sidebar before clicking Sort and Filter.";
        dialog.appendChild(window.AO3MenuHelpers.createTipBox(tipContent, { icon: "ℹ️" }));

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
                    searchQuery: window.AO3MenuHelpers.getValue("auto-filter-query") || "",
                    language: window.AO3MenuHelpers.getValue("auto-filter-language") || "",
                    showIncludeChips:
                        window.AO3MenuHelpers.getValue("auto-filter-show-include-chips") === true,
                    showExcludeChips:
                        window.AO3MenuHelpers.getValue("auto-filter-show-exclude-chips") === true,
                    autoSubmit: window.AO3MenuHelpers.getValue("auto-filter-auto-submit") === true,
                    hideMenu: window.AO3MenuHelpers.getValue("auto-filters-hide-menu-checkbox"),
                    _version: VERSION,
                };
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
