# AO3: Advanced Blocker

Block works on AO3 based on tags, authors, titles, word counts, and more. Filter by completion status, language, reading time, and primary pairings. Customize what you see—or don't see.

<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_advanced-blocker-2.png" width="600" alt="Advanced Blocker in action">
---

## ✨ Features

### **Tag Filtering**
- **Blacklist Tags** – Hide works containing specific tags (ratings, warnings, fandoms, ships, characters, freeforms, and more).
- **Whitelist Tags** – Always show works even if they match the blacklist.
- **Highlight Tags** – Make works with certain tags stand out with custom colors.
- **Wildcard Support** – Use `*` to match partial tags. For example: `Abandoned*` matches "Abandoned Work" and "Abandoned WIP."

### **Content Filtering**
- **Author Blacklist** – Block works by specific authors.
- **Title Blacklist** – Hide works whose titles contain specific words or phrases.
- **Summary Blacklist** – Hide works whose summaries contain specific words or phrases.

### **Work Metadata Filtering**
- **Word Count Limits** – Set minimum and maximum word counts.
- **Chapter Limits** – Filter by chapter count (great for hiding one-shots or avoiding epic-length works).
- **Language Filter** – Only show works in specified languages.
- **Fandom Limit** – Hide works with more fandoms than your threshold (useful for blocking crossovers).
- **Staleness Filter** – Hide ongoing works not updated in X months.

### **Completion & Primary Pairing**
- **Block Complete/Ongoing** – Toggle to hide works based on completion status.
- **Primary Relationship Filtering** – Only show works where your favorite relationships appear in the first few relationship tags.
- **Primary Character Filtering** – Only show works where your favorite characters appear in the first few character tags.
- Customize the search window for both (how many tags to check from the top).

### **Display Options**
- **Show/Hide Block Reasons** – See exactly why a work was blocked, or hide it completely.
- **Work Placeholders** – Blocked works appear as stubs you can click to reveal, or disappear entirely.
- **Per-Filter Hide Completely** – Toggle eye icons next to specific filters to hide matching works entirely, bypassing placeholders.
- **Highlighting on Your Content** – Re-enable tag highlighting on your own dashboard, bookmarks, and works pages.
- **Disable on My Content** – Skip blocking/filtering on your own profile pages entirely.

### **Convenience Features**
- **Quick-Add** – Hold **Alt** and click any tag or author name to instantly add them to your blacklist.
- **Pause Blocking** – Temporarily disable filtering without changing settings.
- **Import/Export Settings** – Save and restore your configuration across devices or browsers.


<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/images/image_advanced-blocker-1.png" width="600" alt="Advanced Blocker in action">

---

## 📋 How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209)

1. Install with a userscript manager:
   - **Tampermonkey**
     - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
     - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
     - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)
     - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. Navigate to any AO3 works page (search results, tag pages, user profiles, bookmarks, etc.).
3. Click **Userscripts** → **Advanced Blocker** to open settings.
4. Configure your filters and click **Save Settings**.

---

## ⚙️ Settings Guide

**Wildcard Syntax**
- Use `*` to match any sequence of characters (zero or more) in tag, title, and summary blacklists.
- The `*` acts as a placeholder—it can match letters, spaces, punctuation, or nothing at all.
- Examples:
  - `Abandoned*` matches: Abandoned, Abandoned Work, Abandoned WIP
  - `*Fix*` matches: Fix-It, I Can Fix Him, Fixing Things, Big Fix
  - `Self*Insert*` matches: Self-Insert, Self-Insert Player, Self...Insert (with anything between)
  - `*Angst` matches: Angst, Major Angst, Existential Angst

**Comma-Separated Lists**
- Enter multiple items separated by commas: `Tag1, Tag2, Tag3`

**Tag vs. Title/Summary Matching**
- **Tags** use exact matching but are case-insensitive: `romance` will match 'Romance' but not `Slow Burn Romance`.
- **Titles & Summaries** use partial matching automatically—they'll find your text anywhere in the title or summary. Example: blocking `prompt` catches "prompt fill," "writing prompt," and "story prompt." Wildcards are rarely needed here.
- **Authors** require exact name matches.

**Primary Relationships & Characters**
- Enter names exactly as they appear on AO3, including alternative names: `Luo Binghe/Shen Yuan | Shen Qingqiu`
- **Tag Window** settings let you check only the first X tags (default: 1 for relationships, 5 for characters).

**Language Filter**
- Enter language names as they appear on AO3: `English`, `Русский`, `中文-普通话国语`

**Hide Completely Toggles**
- Many filters have an eye icon (👁️) next to the input field. Clicking this toggle switches between showing a placeholder (which can be clicked to reveal the blocked work) and hiding the work completely. This allows fine-grained control over how different types of blocks are displayed.

---

## 🙌 Credits

Big thanks to [AO3 Blocker](https://greasyfork.org/en/scripts/409956-ao3-blocker) by Jaceboy and [AO3 Savior](https://greasyfork.org/en/scripts/3579-ao3-savior) by tuff.

---

## 📜 Check Out My Other Scripts

- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537-ao3-site-wizard) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106-ao3-reading-time-quality-score) – See reading time and engagement scores at a glance.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820-ao3-skin-switcher) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571-ao3-chapter-shortcuts) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623-ao3-no-re-kudos) – Prevent accidentally re-kudosing works.