# AO3: Script Sync

Sync any AO3 userscript's data and settings across multiple devices using Google Sheets as the storage backend.

---

## ✨ Features

- **Universal Sync** – Works with any AO3 userscript that uses localStorage.
- **Selective Syncing** – Choose exactly which localStorage keys to sync.
- **Automatic Updates** – Configure sync intervals (default: 60 seconds).
- **Visual Feedback** – Floating widget shows sync status and countdown.
- **Multi-Device** – Seamlessly sync across unlimited devices.
- **Manual Backup** – Export/import functionality for manual backups.
- **Free** – Uses free Google Sheets as storage (no server costs).
- **Privacy** – Your data stays in your Google account.


![AO3: Script Sync](https://cdn.jsdelivr.net/gh/Wolfbatcat/ao3-userscripts@main/images/image_script-sync-1.png)


---

## 🎯 Use Cases

Perfect for syncing data from:
- AO3: Advanced Blocker, ao3 savior, and other blacklist scripts.
- AO3: Quick Hide's hidden work history
- AO3: No Re-Kudos

---

## 📋 How to Use

>  **⚠️ Important for Chromium-based browsers:** If you're using Chrome, Brave, Vivaldi, or Microsoft Edge on PC, an extra activation step is required. [Follow these instructions.](https://www.tampermonkey.net/faq.php?locale=en#Q209)

### 1. Install the Userscript

Install `AO3: Script Sync` with a userscript manager:
- **Tampermonkey**
  - [Chrome/Chromium](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
  - [Safari](https://apps.apple.com/us/app/tampermonkey/id6738342400)
  - [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. Copy the Template Google Sheet

👉 **[Click here to make a copy](https://docs.google.com/spreadsheets/d/1woW-QxlQY-vWx7t3h7ytd8NfzK9qhyA68A-LFNZ6ufk/copy)**

This creates your own copy with all the Apps Script code pre-configured.

### 3. Deploy as Web App

1. In your copied sheet: **Extensions → Apps Script**
2. Click **Deploy → New deployment**, then select **Web app** as the deployment type
3. Set "Execute as: Me" and "Who has access: Anyone", then click **Deploy**
4. In the resulting window, copy the link at the bottom — this is your deployment URL

### 4. Configure the Script

> **🚨 Important:** Initialize on the device that holds your most up-to-date userscript data. For example, if your phone has your most recent Advanced Blocker config, run the steps below on your phone first.

1. On the AO3 homepage, click **Userscripts → Script Sync**
2. Select the localStorage keys you want to sync
3. Paste your deployment URL into the **Google Script URL** field and click **Test Connection**
4. If the connection is successful, click **Initialize** — you're all set! 🎉

**For TamperMonkey users:** If you get the following window, press **Always allow**. If you press the wrong option, you may have to delete and reinstall Script Sync.

![Tampermonkey Permissions](https://cdn.jsdelivr.net/gh/Wolfbatcat/ao3-userscripts@main/images/image_script-sync-2.png)

To set up on additional devices, just install the script, enter the same Google Script URL, and press **Initialize**.

---

## 🐛 Troubleshooting

**Connection Test Fails**
- Verify URL format: `https://script.google.com/macros/s/.../exec`
- Check deployment settings: "Who has access" must be **Anyone**
- Try opening the URL in a browser with `?action=ping` appended

---

## 🙌 Credits

Big thanks to:
- [AO3 FicTracker](https://greasyfork.org/en/scripts/513435) by infiniMotis (sync architecture)
- [AO3: Import & Export Script Storage](https://greasyfork.org/en/scripts/545336) by escctrl (import/export architecture and menu design)

---

## 📜 Check Out My Other Scripts

- [AO3: Advanced Blocker](https://greasyfork.org/en/scripts/549942-ao3-advanced-blocker) – Block works on AO3 based on tags, authors, titles, word counts, and more.
- [AO3: Reading Time & Quality Score](https://greasyfork.org/en/scripts/551106-ao3-reading-time-quality-score) – See reading time and engagement scores at a glance.
- [AO3: Site Wizard](https://greasyfork.org/en/scripts/550537-ao3-site-wizard) – Customize fonts, sizes, and work spacing site-wide.
- [AO3: Skin Switcher](https://greasyfork.org/en/scripts/551820-ao3-skin-switcher) – Quickly switch between AO3 site skins.
- [AO3: Chapter Shortcuts](https://greasyfork.org/en/scripts/549571-ao3-chapter-shortcuts) – Quick links to the latest chapter of any work.
- [AO3: No Re-Kudos](https://greasyfork.org/en/scripts/551623-ao3-no-re-kudos) – Prevent accidentally re-kudosing works.
- [AO3: Reorder Ship Tags](https://greasyfork.org/en/scripts/562812-ao3-reorder-ship-tags) – Automatically reorder romantic ships (/) before platonic ships (&).
- [AO3: Auto Pseud](https://greasyfork.org/en/scripts/556232-ao3-auto-pseud) – Auto-select pseuds based on fandom when commenting and bookmarking.
