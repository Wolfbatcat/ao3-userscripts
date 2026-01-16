# AO3: Reorder Ship Tags

Automatically reorders relationship tags on work blurbs so romantic ships (/) always appear before platonic ships (&).

---

### ⚙️ How It Works

The script runs automatically on all AO3 work list pages:
- Detects relationship tags containing `/` (romantic) or `&` (platonic)
- Reorders them so romantic relationships appear first
- Only processes works that have both types of relationships

---

### 📝 Notes

- **Load order compatibility:** This script uses `@run-at document-end`. If you're using [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942-ao3-advanced-blocker) with primary ship filtering, the Advanced Blocker will make blocking decisions **before** this script reorders tags, so your filters work as expected.

---

### 📜 Check out my other scripts:
- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942-ao3-advanced-blocker) - Block works on AO3 based on tags, authors, titles, word counts, language, completion status, and much more. 
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537-ao3-site-wizard) - Customize fonts and sizes across the entire site, adjust work reader margins, fix spacing issues, and configure text alignment preferences.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820-ao3-skin-switcher) - Change skins from anywhere on AO3.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/549777-ao3-reading-time-quality-score) - Adds reading time estimates and quality indicators to works.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571-ao3-chapter-shortcuts) - Add a customizable shortcut to the latest chapter of works.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623-ao3-no-re-kudos) - Hide kudos button if you've already left kudos.
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232-ao3-auto-pseud) - Assign pseuds based on fandoms when commenting and bookmarking works.

