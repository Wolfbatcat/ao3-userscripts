# AO3: Reorder Ship Tags

Automatically reorders relationship tags on work blurbs so romantic ships (/) always appear before platonic ships (&).

---

## ✨ Features

The script runs automatically on all AO3 work list pages:
- Detects relationship tags containing `/` (romantic) or `&` (platonic)
- Reorders them so romantic relationships appear first
- Only processes works that have both types of relationships

---

### ⚙️ How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209). For the Tampermonkey iOS app, see [this video](https://www.youtube.com/watch?v=e7Sme3FY0vI).


1. Install with a userscript manager:  
   - **Tampermonkey**
     - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)  
     - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)  
     - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)  
     - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

---

### 📝 Notes

- **Load order compatibility:** This script uses `@run-at document-end`. If you're using [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942-ao3-advanced-blocker) with primary ship filtering, the Advanced Blocker will make blocking decisions **before** this script reorders tags, so your filters work as expected.

---

> 💡 **Using AO3 on multiple devices?** Check out [AO3: Script Sync](https://greasyfork.org/en/scripts/568443-ao3-script-sync) — it automatically syncs your settings and data across devices using Google Sheets.

---

## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Quick Hide](https://greasyfork.org/en/scripts/564383) - Quickly hide works, bookmarks, and comments while browsing AO3.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106) – See reading time and engagement scores at a glance.
- [AO3: Script Sync](https://greasyfork.org/en/scripts/568443) Sync AO3 userscript settings and data across multiple devices.
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623) – Prevent accidentally re-kudosing works.
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232) – Auto-select pseuds based on fandom when commenting and bookmarking.

