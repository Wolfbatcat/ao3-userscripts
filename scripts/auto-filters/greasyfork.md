# AO3: Auto Filters

![Coded with GitHub Copilot](https://vibecoded.fyi/badges/flat/agents/github-copilot.svg)

Save your go-to search filters once, and Auto Filters fills them in automatically every time you browse works, bookmarks, or series — no more re-entering the same tags, ratings, and word counts on every visit.

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/auto-filters/images/image-auto-filters-1.png" width="600" alt="Auto Filters settings panel">

---

## ✨ Features

### Include & Exclude
- **Include Tags** – Automatically add tags to AO3's "Other tags to include" filter.
- **Exclude Tags** – Automatically add tags to AO3's "Other tags to exclude" filter.
- **Ratings, Warnings & Categories** – Include or exclude them by name, so you don't have to click through the checkboxes every time.

### More Filters
- **Crossovers** – Include, exclude, or show only crossover works.
- **Completion Status** – Show all works, complete only, or works in progress only.
- **Word Count** – Set a minimum and/or maximum word count.
- **Date Updated** – Filter to a date range.
- **Search Within Results** – Prefill the keyword search box.
- **Language** – Show only works in a chosen language.

### Options
- **Hide Tag Chips** – Apply tags silently instead of showing them as removable chips in AO3's sidebar.
- **Auto Sort & Filter** – Automatically clicks AO3's "Sort and Filter" button after your filters are applied, so results load right away.
- **Disable on My Content** – Skip auto-filtering on your own dashboard, bookmarks, and works pages.

### Convenience
- **Pause Filters** – Turn off auto-filtering temporarily from the Userscripts menu, without losing your saved settings.
- **Import / Export Settings** – Save your configuration as a JSON file, or restore it on another device.

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/auto-filters/images/image-auto-filters-2.png" width="600" alt="Auto Filters settings panel">

---

## 📋 How to Use

> **⚠️ Important for Chromium-based browsers:** On Chrome, Brave, Vivaldi, or Microsoft Edge (PC), an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209) For the Tampermonkey iOS app, see [this video](https://www.youtube.com/watch?v=e7Sme3FY0vI).

1. Install a userscript manager such as **Tampermonkey**:
   - [Chrome / Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
2. Open any AO3 works, bookmarks, or series listing page.
3. Click **Userscripts** → **Auto Filters** to open the settings panel.
4. Enter the tags, ratings, and other filters you want applied, then click **Save**.
5. Your filters apply immediately — no page reload needed.

---

## ⚙️ Settings Guide

- Tags must match exact tag names but are case-insentive. Separate multiple tags with commas.
- AO3 only allows one included rating at a time, but you can exclude several.
- Language names must match AO3's filter dropdown exactly (e.g. "English", "Русский", "中文-普通话国语").

> 🔖 **Tip:** Exclude metatags to catch all their subtags at once. Excluding `Modern Era` filters out `Alternate Universe - Modern Setting` and similar tags in one go, instead of excluding each one individually.

---

## 💾 Backup Your Settings

- **Export Settings** – Download your configuration as a timestamped JSON file for backup or transfer.
- **Import Settings** – Upload a previously exported JSON file to restore your customizations.
- **Reset to Defaults** – Restore all settings to their original values.

> 💡 **Tip — Sync your filters across devices:** If you use AO3 on more than one device, [AO3: Script Sync](https://greasyfork.org/en/scripts/568443-ao3-script-sync) keeps your Auto Filters settings in sync automatically using Google Sheets.

---

## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Quick Hide](https://greasyfork.org/en/scripts/564383) – Quickly hide works, bookmarks, and comments while browsing AO3.
- [AO3: Custom Favorites](https://greasyfork.org/en/scripts/582586) – Replace AO3's "Find your favorites" with custom shortcuts to any page.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106) – See reading time and engagement scores at a glance.
- [AO3: Script Sync](https://greasyfork.org/en/scripts/568443) – Sync AO3 userscript settings and data across multiple devices.
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623) – Prevent accidentally re-kudosing works.
- [AO3: Reorder Ship Tags](https://greasyfork.org/en/scripts/562812) – Automatically reorder romantic ships (/) before platonic ships (&).
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232) – Auto-select pseuds based on fandom when commenting and bookmarking.
