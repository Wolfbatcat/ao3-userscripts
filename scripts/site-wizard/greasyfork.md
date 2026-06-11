# AO3: Site Wizard

Transform your AO3 reading experience with complete font and layout control:
- **✏️ Site-Wide Font Customization** — Change fonts, sizes, and weights across the entire site.
- **🎨 Custom Colors** — Personalize site colors and the AO3 logo appearance.
- **📖 Work-Specific Formatting** — Customize how stories appear with width, alignment, and spacing controls.
- **🎯 Element-Specific Fonts** — Set different fonts for headers, code blocks, and other elements.
- **✨ Automatic Spacing Fix** — Eliminates excessive paragraph spacing in poorly formatted works.

---
### ✨ Features

#### **Site-Wide Formatting**
- **Base Font Size**: Adjust the overall text size for the entire site (50-200% of browser default).
- **General Text Font**: Set a custom font family for most site text.
- **Font Weight**: Control the boldness of general text across AO3.
<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/site-wizard/images/image_site_wizard_1.png" alt="Site-Wide Settings" width="570">

#### **Work Formatting**
- **Work Margin Width**: Control how wide the work reader appears (10-100% of viewport).
- **Font Size**: Scale work text relative to your site base size (50-200%).
- **Text Alignment**: Choose between left-aligned, justified, or right-aligned text.
- **Line Spacing**: Fine-tune vertical space between paragraphs with decimal precision.
- **Work Font**: Set a specific font family just for reading stories.
- **Spacing Fix**: Automatically removes unnecessary blank lines and excessive spacing.
<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/site-wizard/images/image_site_wizard_2.png" alt="Work Settings" width="570">

#### **Element-Specific Formatting**
- **Header Font**: Customize fonts for all headings (H1-H6).
- **Header Weight**: Control header text boldness separately from body text.
- **Code/Monospace Font**: Set fonts for code blocks and preformatted text.
- **Code Font Style**: Choose normal or italic styling for code elements.
- **Code Font Size**: Scale code text relative to surrounding content.
- **Apply code font to comments**: Use code font on all textareas.
<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/site-wizard/images/image_site_wizard_3.png" alt="Element-Specific Settings" width="570">

#### **Colors**
- **Background Color**: Customize the background color of the entire site.
- **Text Color**: Change the default text color across AO3.
- **Header Color**: Set a custom color for headers and primary UI elements.
- **Accent Color**: Control the color of accent elements like borders and highlights.
- **Logo Color**: Transform the AO3 logo color using CSS filters. Use the [color filter generator](https://angel-rs.github.io/css-color-filter-generator/) to create custom filter values for any desired logo color.
<img src="https://raw.githubusercontent.com/Wolfbatcat/ao3-userscripts/refs/heads/main/scripts/site-wizard/images/image_site_wizard_4.png" alt="Color Settings" width="570">

---
### ⚙️ How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209). For the Tampermonkey iOS app, see [this video](https://www.youtube.com/watch?v=e7Sme3FY0vI).

1. Install with a userscript manager:  
   - **Tampermonkey**
     - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)  
     - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)  
     - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)  
     - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
3. Click **Userscripts** in the header menu, then **Site Wizard** to customize.
4. Adjust fonts, sizes, alignment, and spacing to your preference.
5. Click **Save** — changes persist across browser sessions.

---
### 💾 Backup Your Settings

- **Export Settings**: Download your configuration as a timestamped JSON file for backup or transfer.
- **Import Settings**: Upload a previously exported JSON file to restore your customizations.
- **Reset to Defaults**: Restore all settings to their original values.

> 💡 **Using AO3 on multiple devices?** Check out [AO3: Script Sync](https://greasyfork.org/en/scripts/568443-ao3-script-sync) — it automatically syncs your settings and data across devices using Google Sheets.

---
### 🎨 Customization Tips

#### **Font Recommendations**
- **Sans-serif**: [Figtree](https://fonts.google.com/specimen/Figtree), [Apfel Grotezk ](https://www.collletttivo.it/typefaces/apfel-grotezk), [SF Pro](https://developer.apple.com/fonts/)
- **Serif**: [Merriweather](https://fonts.google.com/specimen/Merriweather), [Bitter](https://fonts.google.com/specimen/Bitter), [Domine](https://fonts.google.com/specimen/Domine)
- **Monospace**: [Victor Mono](https://rubjo.github.io/victor-mono/) (set to italics for cursive), [Cascadia Code](https://fonts.google.com/specimen/Cascadia+Code), [Martian Mono](https://fonts.google.com/specimen/Martian+Mono)


## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Quick Hide](https://greasyfork.org/en/scripts/564383) - Quickly hide works, bookmarks, and comments while browsing AO3.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106) – See reading time and engagement scores at a glance.
- [AO3: Script Sync](https://greasyfork.org/en/scripts/568443) Sync AO3 userscript settings and data across multiple devices.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623) – Prevent accidentally re-kudosing works.
- [AO3: Reorder Ship Tags](https://greasyfork.org/en/scripts/562812) – Automatically reorder romantic ships (/) before platonic ships (&).
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232) – Auto-select pseuds based on fandom when commenting and bookmarking.