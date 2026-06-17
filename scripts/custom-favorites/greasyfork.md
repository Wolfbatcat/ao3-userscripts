# AO3: Custom Favorites

AO3's built-in "Find your favorites" section only lets you follow a single tag — no filtering, no customization. Custom Favorites replaces it with your own shortcuts to anything on AO3: a ship search pre-filtered exactly how you like it, your favorite authors' pages, collections, gift exchanges, your own bookmarks, whatever you actually go back to.

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/-custom-favorites/images/image_custom_favorites_1.png" alt="Custom Favorites">

---

## ✨ Features

- **Save any AO3 link** — filtered searches, authors, collections, series, bookmarks, and more.
- **Reorder** favorites with up/down controls, **edit** or **delete** entries at any time.
- **Quick-add shortcut** — a "+ add favorite" link in the sidebar so you can add entries without opening the full dialog.
- **Open in new tab** — optionally open links in a new window.
- **Custom section title** — rename the sidebar section to whatever you want.
- **Control section position** — choose where your favorites sit among the other sidebar modules.
- **Hide the native section** — replace AO3's default panel entirely, or keep both.
- **Import / Export** — back up your favorites as a JSON file or restore them on another device.

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/-custom-favorites/images/image_custom_favorites_2.png" alt="Custom Favorites Menu">

---

## 🔎 How to Build a Filtered Search

1. Go to your favorite fandom or ship tag.
2. Use the filter sidebar to set things up how you want — exclude tags, set min/max word count, language, completion, etc.
3. Hit **Sort and Filter**, then copy the URL from your address bar.
4. Paste it into Custom Favorites with a name.

That's it — one click gets you back to that exact filtered view every time.

> **💡 Tip:** When filtering, use [metatags](https://archiveofourown.org/faq/glossary?language_id=en#metatagdef) where you can as they cover all related subtags automatically. For example, excluding [Modern Era](https://archiveofourown.org/tags/Modern%20Era) blocks every modern AU variant, not just [Alternate Universe - Modern Setting](https://archiveofourown.org/tags/Alternate%20Universe%20-%20Modern%20Setting). To check if a tag has a metatag, search for it on the [tag search page](https://archiveofourown.org/tags/search) and select wrangling status -> [canonical](https://archiveofourown.org/faq/glossary?language_id=en#canonicaldef). The tag's page will list any metatags and subtags at the bottom.

---

## 📋 How to Use

> **⚠️ Important for Chromium-based browsers:** On Chrome, Brave, Vivaldi, or Microsoft Edge (PC), an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209) For the Tampermonkey iOS app, see [this video](https://www.youtube.com/watch?v=e7Sme3FY0vI).

1. Install a userscript manager such as **Tampermonkey**:
   - [Chrome / Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)
   - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
2. Navigate to the AO3 homepage.
3. Click **Userscripts** → **Custom Favorites** to open the management dialog.
4. Click **+ Add Favorite**, enter a name and URL, and click **Save**.

---

## 💾 Backup Your Settings

- **Export** – Download your favorites and settings as a timestamped JSON file.
- **Import** – Upload a previously exported JSON file to restore everything.

> 💡 **Using AO3 on multiple devices?** Check out [AO3: Script Sync](https://greasyfork.org/en/scripts/568443-ao3-script-sync) — it automatically syncs your settings and data across devices using Google Sheets.

---

## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Quick Hide](https://greasyfork.org/en/scripts/564383) – Quickly hide works, bookmarks, and comments while browsing AO3.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106) – See reading time and engagement scores at a glance.
- [AO3: Script Sync](https://greasyfork.org/en/scripts/568443) – Sync AO3 userscript settings and data across multiple devices.
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623) – Prevent accidentally re-kudosing works.
- [AO3: Reorder Ship Tags](https://greasyfork.org/en/scripts/562812) – Automatically reorder romantic ships (/) before platonic ships (&).
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232) – Auto-select pseuds based on fandom when commenting and bookmarking.
