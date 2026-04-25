# AO3: Script Sync

Sync any AO3 userscript's localStorage data across multiple devices using Google Sheets as the storage backend.

## ✨ Features

- **Universal Sync**: Works with any AO3 userscript that uses localStorage
- **Selective Syncing**: Choose exactly which localStorage keys to sync
- **Automatic Updates**: Configure sync intervals (default: 60 seconds)
- **Visual Feedback**: Floating widget shows sync status and countdown
- **Multi-Device**: Seamlessly sync across unlimited devices
- **Manual Backup**: Export/import functionality for manual backups
- **Free**: Uses free Google Sheets as storage (no server costs)
- **Privacy**: Your data stays in your Google account

## 📝 How to Use

### 1. Copy the Template Google Sheet
👉 **[Click here to make a copy](https://docs.google.com/spreadsheets/d/1woW-QxlQY-vWx7t3h7ytd8NfzK9qhyA68A-LFNZ6ufk/copy)**

This creates your own copy with all the Apps Script code pre-configured.

### 2. Deploy as Web App
1. In your copied sheet: **Extensions → Apps Script**
2. Click **Deploy → New deployment → Web app**
3. Set "Execute as: Me" and "Who has access: Anyone"
4. Copy the deployment URL

### 3. Install & Configure Userscript
1. Install `AO3: Script Sync` in your userscript manager
2. On the AO3 homepage, click **Userscripts → Script Sync**
3. Select keys to sync, paste your deployment URL
4. Click **Test Connection**, then **Initialize**

**For detailed step-by-step instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)**

## 🎯 Use Cases

Perfect for syncing:
- Advanced Blocker or AO3 Savior settings and blacklists
- Quick Hide's hidden work history
- UI customization options

## 🐛 Troubleshooting

### Connection Test Fails
- Verify URL format: `https://script.google.com/macros/s/.../exec`
- Check deployment settings: "Who has access" must be **Anyone**
- Try opening URL in browser with `?action=ping` appended

## 🔄 How It Works

1. **Local Change**: Userscript modifies localStorage → queued in "pending changes"
2. **Sync Timer**: Every X seconds, send pending changes to Google Sheet
3. **Server Update**: Apps Script updates Storage sheet atomically (with lock)
4. **Server Response**: Returns complete current state of all synced keys
5. **Local Update**: Overwrite local localStorage with server values

**Conflict Resolution**: Server always wins (last-write-wins strategy)

## 🙏 Credits

Huge thanks to:
- [AO3 FicTracker](https://greasyfork.org/en/scripts/513435) by infiniMotis (sync architecture)
- [AO3: Import & Export Script Storage](https://greasyfork.org/en/scripts/545336) by escctrl (import/export architecture and menu design)

