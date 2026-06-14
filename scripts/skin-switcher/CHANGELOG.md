# Changelog

## v3.0.3 — 2026-06-13
- **Fix: duplicate dividers on skins page** — Multiple dividers were accumulating between the pinned and unpinned sections on each filter/sort re-render. The section divider `<li>` was missing its `skin-section-divider` class, so the cleanup pass couldn't find and remove it before rebuilding.

## v3.0.1
- **Looser popup search** — Popup search now matches substrings by default. Typing "moon" matches "[BBC] Rose Pine Moon" without needing wildcards. Page-mode search stays strict (whole-word). Selectors (`*`, `"`, `-`, `AND`/`OR`/`NOT`) still work in both modes.

## v3.0.0 — 2026-06-10
- **Updated to Menu Helpers Library v2.2.0** — Dialog theming with Auto/Light/Dark toggle, improved skin detection, and polished form controls
- **Skins Organizer** — Sort, filter, search, and pin your skins directly on your AO3 skins page. Thank you to autocompleted for the original [Skin Organizer](https://greasyfork.org/en/scripts/579578) script!
- **Search within the switcher** — Filter your skin list by name right inside the skin switcher popup
- **Pin skins to the top** — Pin frequently-used skins in both the popup and on the skins page for instant access
- **Multi-account support** — Switch between accounts without stale data; username detection works reliably across all pages, including other users' profiles and dashboards
- Various small fixes and improvements 
