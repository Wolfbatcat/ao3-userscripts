// ==UserScript==
// @name          AO3: Custom Favorites
// @version       2.0.0
// @description   Add custom favorite links to the AO3 homepage sidebar. Manage, edit, and reorder them from the Userscripts menu.
// @author        BlackBatCat
// @match         *://archiveofourown.org/
// @match         *://archiveofourown.org/*
// @license       MIT
// @require       https://update.greasyfork.org/scripts/552743/1757286/AO3%3A%20Menu%20Helpers%20Library.js?v=2.1.7
// @grant         none
// ==/UserScript==

(function () {
    "use strict";

    const MH = window.AO3MenuHelpers;
    const STORAGE_FAVS = "ao3_custom_favorites_data";
    const STORAGE_SETTINGS = "ao3_custom_favorites_config";

    // ─── Storage ────────────────────────────────────────────────────────────────

    function loadFavs() {
        try {
            const raw = localStorage.getItem(STORAGE_FAVS);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveFavs(arr) {
        localStorage.setItem(STORAGE_FAVS, JSON.stringify(arr));
    }

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_SETTINGS);
            if (!raw)
                return {
                    displayStyle: "list",
                    newWindow: false,
                    hideNative: false,
                    sectionTitle: "",
                    sectionPosition: 1,
                    showAddShortcut: true,
                    hideMenuOptions: false,
                };
            const parsed = JSON.parse(raw);
            return {
                displayStyle: parsed.displayStyle || "list",
                newWindow: !!parsed.newWindow,
                hideNative: !!parsed.hideNative,
                sectionTitle: typeof parsed.sectionTitle === "string" ? parsed.sectionTitle : "",
                sectionPosition: Number.isInteger(parsed.sectionPosition)
                    ? parsed.sectionPosition
                    : 1,
                showAddShortcut: parsed.showAddShortcut !== false,
            };
        } catch {
            return {
                displayStyle: "list",
                newWindow: false,
                hideNative: false,
                sectionTitle: "",
                sectionPosition: 1,
                showAddShortcut: true,
            };
        }
    }

    // Display style values:
    //   "list"   — separate "Custom Favorites" section in sidebar
    //   "native" — entries appended directly into AO3's "Find your favorites" section

    function saveSettings(obj) {
        localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(obj));
    }

    // ─── Input validation ────────────────────────────────────────────────────────

    function validateInput(name, url) {
        if (!name.trim()) return "Name is required.";
        try {
            const parsed = new URL(url.trim());
            if (parsed.protocol === "javascript:") return "Invalid URL.";
        } catch {
            return "Please enter a valid URL (include https://).";
        }
        return null;
    }

    function isValidBackup(data) {
        return (
            data &&
            Array.isArray(data[STORAGE_FAVS]) &&
            data[STORAGE_FAVS].every(
                (f) => typeof f.name === "string" && typeof f.url === "string",
            ) &&
            data[STORAGE_SETTINGS] !== undefined &&
            typeof data[STORAGE_SETTINGS] === "object" &&
            !Array.isArray(data[STORAGE_SETTINGS])
        );
    }

    // ─── Sidebar rendering ───────────────────────────────────────────────────────

    const SIDEBAR_ID = "custom-favs-sidebar";
    const NATIVE_STASH_ID = "custom-favs-native-stash";

    function buildFavLink(fav, settings) {
        const a = document.createElement("a");
        a.textContent = fav.name;
        a.href = fav.url;
        a.className = "tag custom-fav";
        if (settings.newWindow) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
        }
        return a;
    }

    const NATIVE_ITEM_ATTR = "data-custom-fav";

    function buildAddShortcut() {
        const addLink = document.createElement("p");
        addLink.style.marginTop = "0.5em";
        const addA = document.createElement("a");
        addA.textContent = "+ add favorite";
        addA.href = "javascript:void(0)";
        addA.style.fontSize = "0.85em";
        addA.addEventListener("click", (e) => {
            e.preventDefault();
            showAddEditDialog(null, null);
        });
        addLink.appendChild(addA);
        return addLink;
    }

    function restoreStashedNative() {
        const stash = document.getElementById(NATIVE_STASH_ID);
        if (!stash || !stash.firstElementChild) return;
        const splash = document.querySelector("div.splash");
        if (!splash) return;
        const restored = stash.firstElementChild;
        const nextId = stash.dataset.nextSiblingId;
        const nextClass = stash.dataset.nextSiblingClass;
        let anchor = null;
        if (nextId && nextId !== "__last__") anchor = document.getElementById(nextId);
        if (!anchor && nextClass)
            anchor = splash.querySelector("." + nextClass.trim().split(/\s+/)[0]);
        splash.insertBefore(restored, anchor || null);
    }

    function renderSidebar() {
        const favs = loadFavs();
        const settings = loadSettings();

        if (settings.displayStyle === "native") {
            renderNative(favs, settings);
        } else {
            renderStandalone(favs, settings);
        }
    }

    function renderStandalone(favs, settings) {
        // Remove any leftover native-mode injected items
        document.querySelectorAll(`li[${NATIVE_ITEM_ATTR}]`).forEach((el) => el.remove());

        // Remove existing standalone block if present
        const existing = document.getElementById(SIDEBAR_ID);
        if (existing) existing.remove();

        // Remove or restore the native "Find your favorites" section.
        // We physically move it out of div.splash rather than display:none so it
        // doesn't occupy a grid slot when hidden.
        const nativeSection =
            document.querySelector("div.favorite:not(#" + SIDEBAR_ID + ")") ||
            document.getElementById(NATIVE_STASH_ID)?.firstElementChild;
        const stash = document.getElementById(NATIVE_STASH_ID);

        if (settings.hideNative) {
            if (nativeSection && nativeSection.parentElement !== stash) {
                let s = stash;
                if (!s) {
                    s = document.createElement("div");
                    s.id = NATIVE_STASH_ID;
                    s.style.display = "none";
                    document.body.appendChild(s);
                }
                // Remember where it was so we can restore it to the right spot
                s.dataset.nextSiblingId = nativeSection.nextElementSibling
                    ? nativeSection.nextElementSibling.id || ""
                    : "__last__";
                s.dataset.nextSiblingClass = nativeSection.nextElementSibling
                    ? nativeSection.nextElementSibling.className
                    : "";
                s.appendChild(nativeSection);
            }
        } else {
            restoreStashedNative();
            if (nativeSection) nativeSection.style.display = "";
        }

        const splash = document.querySelector("div.splash");
        if (!splash) return;

        const section = document.createElement("div");
        section.id = SIDEBAR_ID;
        section.className = "favorite module";

        const heading = document.createElement("h3");
        heading.className = "heading";
        heading.textContent =
            settings.sectionTitle && settings.sectionTitle.trim()
                ? settings.sectionTitle.trim()
                : "Custom Favorites";
        section.appendChild(heading);

        if (favs.length === 0) {
            const empty = document.createElement("p");
            empty.className = "note";
            empty.textContent = "No favorites yet.";
            section.appendChild(empty);
        } else {
            const ul = document.createElement("ul");
            favs.forEach((fav) => {
                const li = document.createElement("li");
                li.appendChild(buildFavLink(fav, settings));
                ul.appendChild(li);
            });
            section.appendChild(ul);
        }

        if (settings.showAddShortcut) section.appendChild(buildAddShortcut());

        // Insert at the desired position (1-based) among visible splash children.
        // Hidden elements (e.g. the native section when hideNative is on) are
        // excluded from the count so they don't occupy a visual slot.
        const pos = Math.max(1, Math.min(5, settings.sectionPosition || 1));
        const visibleChildren = Array.from(splash.children).filter(
            (el) => el !== section && el.style.display !== "none",
        );
        if (pos - 1 >= visibleChildren.length) {
            splash.appendChild(section);
        } else {
            splash.insertBefore(section, visibleChildren[pos - 1]);
        }

        removeEarlyHide();
    }

    function renderNative(favs, settings) {
        // Remove any leftover standalone section
        const existing = document.getElementById(SIDEBAR_ID);
        if (existing) existing.remove();

        // Remove previously injected native items
        document.querySelectorAll(`li[${NATIVE_ITEM_ATTR}]`).forEach((el) => el.remove());

        // Restore the native section if it was previously stashed
        restoreStashedNative();

        removeEarlyHide();

        // Target the native "Find your favorites" <ul> — always visible in this mode
        const nativeSection = document.querySelector("div.favorite:not(#" + SIDEBAR_ID + ")");
        if (!nativeSection) return;
        const nativeUl = nativeSection.querySelector("ul");
        if (!nativeUl) return;

        favs.forEach((fav) => {
            const li = document.createElement("li");
            li.setAttribute(NATIVE_ITEM_ATTR, "true");
            li.appendChild(buildFavLink(fav, settings));
            nativeUl.appendChild(li);
        });

        // Add shortcut after the <ul>, not inside it
        const existingShortcut = nativeSection.querySelector("p.custom-fav-add");
        if (existingShortcut) existingShortcut.remove();
        if (settings.showAddShortcut) {
            const shortcut = buildAddShortcut();
            shortcut.className = "custom-fav-add";
            nativeSection.appendChild(shortcut);
        }
    }

    // ─── Management dialog ───────────────────────────────────────────────────────

    function showManagementDialog() {
        if (!MH) {
            alert("AO3 Menu Helpers Library is required for this script to function properly.");
            return;
        }
        MH.removeAllDialogs();

        const dialog = MH.createDialog("⭐ Custom Favorites ⭐", {
            maxWidth: "700px",
        });
        document.body.appendChild(dialog);

        // ── Section: Favorites list ──────────────────────────────────────────────
        const favsSection = MH.createSection("📋 My Favorites");

        let reorderMode = false;

        const listContainer = document.createElement("div");
        listContainer.style.cssText =
            "display:flex; flex-direction:column; gap:4px; margin-bottom:10px;";

        function rebuildList() {
            listContainer.innerHTML = "";
            const current = loadFavs();
            if (current.length === 0) {
                const empty = document.createElement("p");
                empty.style.cssText = "padding:4px 8px; opacity:0.7; margin:0;";
                empty.textContent = "No favorites yet. Add one below.";
                listContainer.appendChild(empty);
                return;
            }
            current.forEach((fav, i) => {
                listContainer.appendChild(buildManagementRow(fav, i, current));
            });
        }

        function buildManagementRow(fav, i, allFavs) {
            const row = document.createElement("div");
            row.className = "favs-mgmt-row";
            row.style.cssText =
                "display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:4px; overflow:hidden;";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = fav.name;
            nameSpan.style.cssText =
                "flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
            nameSpan.title = fav.url;
            row.appendChild(nameSpan);

            if (reorderMode) {
                const upBtn = makeIconButton(MH.getArrowUpIconSVG(), "Move up", () => {
                    if (i === 0) return;
                    [allFavs[i - 1], allFavs[i]] = [allFavs[i], allFavs[i - 1]];
                    saveFavs(allFavs);
                    rebuildList();
                    renderSidebar();
                });
                const downBtn = makeIconButton(MH.getArrowDownIconSVG(), "Move down", () => {
                    if (i === allFavs.length - 1) return;
                    [allFavs[i], allFavs[i + 1]] = [allFavs[i + 1], allFavs[i]];
                    saveFavs(allFavs);
                    rebuildList();
                    renderSidebar();
                });
                if (i === 0) upBtn.style.opacity = "0.25";
                if (i === allFavs.length - 1) downBtn.style.opacity = "0.25";
                row.appendChild(upBtn);
                row.appendChild(downBtn);
            } else {
                const editBtn = makeIconButton(MH.getEditIconSVG(), "Edit", () => {
                    showAddEditDialog(fav, i, rebuildList);
                });
                const delBtn = makeIconButton(MH.getTrashIconSVG(), "Delete", () => {
                    if (!confirm(`Remove "${fav.name}" from your favorites?`)) return;
                    const arr = loadFavs();
                    arr.splice(i, 1);
                    saveFavs(arr);
                    rebuildList();
                    renderSidebar();
                });
                row.appendChild(editBtn);
                row.appendChild(delBtn);
            }
            return row;
        }

        rebuildList();
        favsSection.appendChild(listContainer);

        const listActions = document.createElement("div");
        listActions.style.cssText =
            "display:flex; justify-content:flex-end; gap:6px; margin-top:8px;";

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.id = "favs-add-btn";
        addBtn.innerHTML = MH.getPlusIconSVG() + " Add";
        const addSvg = addBtn.querySelector("svg");
        if (addSvg) {
            addSvg.style.width = "1em";
            addSvg.style.height = "1em";
        }
        addBtn.style.cssText =
            "flex:0 0 auto; width:auto; display:inline-flex; align-items:center; gap:0.3em;";
        addBtn.addEventListener("click", (e) => {
            e.preventDefault();
            showAddEditDialog(null, null, rebuildList);
        });

        const reorderBtn = document.createElement("button");
        reorderBtn.type = "button";
        reorderBtn.id = "favs-reorder-btn";
        reorderBtn.innerHTML = MH.getSwitchVerticalIconSVG() + " Reorder";
        const reorderSvg = reorderBtn.querySelector("svg");
        if (reorderSvg) {
            reorderSvg.style.width = "1em";
            reorderSvg.style.height = "1em";
        }
        reorderBtn.style.cssText =
            "flex:0 0 auto; width:auto; display:inline-flex; align-items:center; gap:0.2em;";
        reorderBtn.addEventListener("click", (e) => {
            e.preventDefault();
            reorderMode = !reorderMode;
            reorderBtn.innerHTML = reorderMode
                ? "✓ Done"
                : MH.getSwitchVerticalIconSVG() + " Reorder";
            const rs = reorderBtn.querySelector("svg");
            if (rs) {
                rs.style.width = "1em";
                rs.style.height = "1em";
            }
            rebuildList();
        });

        listActions.appendChild(addBtn);
        listActions.appendChild(reorderBtn);
        favsSection.appendChild(listActions);

        dialog.appendChild(favsSection);

        // Hover via CSS to avoid JS event quirks with icon-button children
        const mgmtHoverStyle = document.createElement("style");
        mgmtHoverStyle.textContent = ".favs-mgmt-row:hover{background-color:rgba(128,128,128,0.1)}";
        dialog.appendChild(mgmtHoverStyle);

        // ── Section: Display options ─────────────────────────────────────────────
        const settings = loadSettings();
        const displaySection = MH.createSection("⚙️ Display Options");

        displaySection.appendChild(
            MH.createSelect({
                id: "favs-display-style",
                label: "Display Style",
                tooltip:
                    '"Own Section" creates a separate Custom Favorites section on the homepage. "Use AO3 Favorites" appends your links to AO3\'s existing "Find Your Favorites" section — you can reorder your own entries, but AO3\'s native links cannot be edited here.',
                options: [
                    {
                        value: "list",
                        label: "Own Section",
                        selected: settings.displayStyle === "list",
                    },
                    {
                        value: "native",
                        label: "Use AO3 Favorites",
                        selected: settings.displayStyle === "native",
                    },
                ],
            }),
        );

        // ── Standalone-only subsettings ──────────────────────────────────────────
        const sectionTitleInput = MH.createTextInput({
            id: "favs-section-title",
            label: "Title",
            value: settings.sectionTitle || "",
            placeholder: "Custom Favorites",
            tooltip:
                "The heading shown above your favorites on the homepage. Leave blank to use the default.",
        });

        const sectionPositionInput = MH.createNumberInput({
            id: "favs-section-position",
            label: "Position",
            value: settings.sectionPosition || 1,
            min: 1,
            max: 5,
            step: 1,
            tooltip:
                "Where your section appears among the homepage modules. AO3 has up to 4 native modules (Find Your Favorites, Inbox, Latest News, Follow Us), so position 1 places yours first.",
        });

        const titlePositionRow = MH.createTwoColumnLayout(sectionTitleInput, sectionPositionInput);
        titlePositionRow.style.display = settings.displayStyle === "list" ? "" : "none";
        displaySection.appendChild(titlePositionRow);

        const hideNativeCheckbox = MH.createCheckbox({
            id: "favs-hide-native",
            label: 'Hide AO3\'s "Find Your Favorites" section',
            checked: settings.hideNative,
            tooltip:
                'Hides the native "Find Your Favorites" module so only your custom section is shown.',
        });
        hideNativeCheckbox.style.display = settings.displayStyle === "list" ? "" : "none";
        displaySection.appendChild(hideNativeCheckbox);

        // Show/hide standalone-only controls when display style changes
        const styleSelect = document.getElementById("favs-display-style");
        if (styleSelect) {
            styleSelect.addEventListener("change", () => {
                const show = styleSelect.value === "list" ? "" : "none";
                titlePositionRow.style.display = show;
                hideNativeCheckbox.style.display = show;
            });
        }

        displaySection.appendChild(
            MH.createCheckbox({
                id: "favs-new-window",
                label: "Open links in a new tab",
                checked: settings.newWindow,
            }),
        );

        displaySection.appendChild(
            MH.createCheckbox({
                id: "favs-show-add-shortcut",
                label: 'Show "+ Add Favorite" link on homepage',
                checked: settings.showAddShortcut,
                tooltip:
                    'Displays a small "+ add favorite" link at the bottom of your favorites section for quick access without opening the menu.',
            }),
        );

        displaySection.appendChild(
            MH.createHideMenuCheckbox({
                id: "favs-hide-menu",
                checked: settings.hideMenuOptions,
            }),
        );

        dialog.appendChild(displaySection);

        // ── Save / Cancel ────────────────────────────────────────────────────────
        const buttons = MH.createButtonGroup([
            {
                text: "Save",
                id: "favs-save",
                onClick: (e) => {
                    e.preventDefault();
                    const displayStyle = MH.getValue("favs-display-style") || "list";
                    const isStandalone = displayStyle === "list";
                    const sectionTitle = isStandalone
                        ? MH.getValue("favs-section-title") || ""
                        : "";
                    const rawPos = MH.getValue("favs-section-position");
                    const sectionPosition = isStandalone
                        ? Math.max(1, Math.min(5, rawPos || 1))
                        : 1;
                    const hideNative = isStandalone ? !!MH.getValue("favs-hide-native") : false;
                    const newWindow = !!MH.getValue("favs-new-window");
                    const showAddShortcut = !!MH.getValue("favs-show-add-shortcut");
                    const hideMenuOptions = !!MH.getValue("favs-hide-menu");
                    saveSettings({
                        displayStyle,
                        newWindow,
                        hideNative,
                        sectionTitle,
                        sectionPosition,
                        showAddShortcut,
                        hideMenuOptions,
                    });
                    renderSidebar();
                    dialog.remove();
                },
            },
            {
                text: "Cancel",
                id: "favs-cancel",
                onClick: () => dialog.remove(),
            },
        ]);
        dialog.appendChild(buttons);

        dialog.appendChild(
            MH.createImportExportRow({
                onReset: () => {
                    saveFavs([]);
                    saveSettings({
                        displayStyle: "list",
                        newWindow: false,
                        hideNative: false,
                        sectionTitle: "",
                        sectionPosition: 1,
                        showAddShortcut: true,
                    });
                    renderSidebar();
                    alert("Reset complete! Reloading...");
                    location.reload();
                },
                exportData: () => ({
                    [STORAGE_FAVS]: loadFavs(),
                    [STORAGE_SETTINGS]: loadSettings(),
                }),
                exportPrefix: "ao3_custom_favorites_config",
                onImport: (file) => {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        try {
                            const data = JSON.parse(evt.target.result);
                            if (!isValidBackup(data)) throw new Error("Invalid backup structure");
                            saveFavs(data[STORAGE_FAVS]);
                            saveSettings(data[STORAGE_SETTINGS]);
                            alert("Favorites imported! Reloading...");
                            location.reload();
                        } catch (err) {
                            alert("Import failed: " + (err && err.message ? err.message : err));
                        }
                    };
                    reader.readAsText(file);
                },
            }),
        );
    }

    function makeIconButton(iconHtml, title, onClick) {
        const btn = document.createElement("button");
        btn.className = "icon-button";
        btn.title = title;
        btn.style.cssText =
            "width:1.25em; height:1.25em; font-size:1em; display:inline-flex; align-items:center; justify-content:center;";
        if (typeof iconHtml === "string" && iconHtml.startsWith("<")) {
            btn.innerHTML = iconHtml;
        } else {
            btn.textContent = iconHtml;
        }
        btn.addEventListener("click", onClick);
        return btn;
    }

    // ─── Add / Edit dialog ───────────────────────────────────────────────────────

    function showAddEditDialog(existingFav, index, onSaved) {
        const isEdit = existingFav !== null && index !== null;

        const dialog = MH.createDialog(isEdit ? "✏️ Edit Favorite" : "➕ Add Favorite", {
            maxWidth: "420px",
            showThemeToggle: false,
        });
        document.body.appendChild(dialog);

        dialog.appendChild(
            MH.createTextInput({
                id: "favs-name",
                label: "Name",
                value: isEdit ? existingFav.name : "",
                placeholder: "e.g. My Saved Searches",
            }),
        );

        dialog.appendChild(
            MH.createTextInput({
                id: "favs-url",
                label: "URL",
                value: isEdit ? existingFav.url : "",
                placeholder: "https://archiveofourown.org/…",
            }),
        );

        const errorMsg = document.createElement("p");
        errorMsg.style.cssText = "color:#c00; margin:4px 0 0; font-size:0.85em; min-height:1.2em;";
        dialog.appendChild(errorMsg);

        dialog.appendChild(
            MH.createButtonGroup([
                {
                    text: isEdit ? "Save" : "Add",
                    id: "favs-addedit-save",
                    onClick: (e) => {
                        e.preventDefault();
                        const name = MH.getValue("favs-name") || "";
                        const url = MH.getValue("favs-url") || "";
                        const err = validateInput(name, url);
                        if (err) {
                            errorMsg.textContent = err;
                            return;
                        }
                        const arr = loadFavs();
                        if (isEdit) {
                            arr[index] = { name: name.trim(), url: url.trim() };
                        } else {
                            arr.push({ name: name.trim(), url: url.trim() });
                        }
                        saveFavs(arr);
                        renderSidebar();
                        if (onSaved) onSaved();
                        dialog.remove();
                    },
                },
                {
                    text: "Cancel",
                    id: "favs-addedit-cancel",
                    onClick: () => dialog.remove(),
                },
            ]),
        );

        setTimeout(() => {
            const nameEl = document.getElementById("favs-name");
            if (nameEl) nameEl.focus();
        }, 50);
    }

    // ─── Init ────────────────────────────────────────────────────────────────────

    const EARLY_HIDE_ID = "custom-favs-early-hide";

    function earlyHide() {
        try {
            const raw = localStorage.getItem(STORAGE_SETTINGS);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed.displayStyle && parsed.displayStyle !== "list") return;
            const style = document.createElement("style");
            style.id = EARLY_HIDE_ID;
            style.textContent = "div.splash div.favorite { visibility: hidden; }";
            document.head.appendChild(style);
        } catch {
            // ignore
        }
    }

    function removeEarlyHide() {
        const el = document.getElementById(EARLY_HIDE_ID);
        if (el) el.remove();
    }

    function init() {
        if (!MH) return;
        MH.injectSharedStyles();
        const settings = loadSettings();
        if (!settings.hideMenuOptions || MH.isAO3Homepage()) {
            MH.addToSharedMenu({
                id: "custom-favs-menu",
                text: "Custom Favorites",
                onClick: showManagementDialog,
            });
        }
        if (MH.isAO3Homepage()) {
            earlyHide();
            renderSidebar();
        }
    }

    console.log("[AO3: Custom Favorites] loaded.");

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
