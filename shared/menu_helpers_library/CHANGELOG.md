# Changelog

<!--
  This file IS the GreasyFork draft. Workflow:
  1. Jot notes under "Unreleased" as you work.
  2. On release: rename "Unreleased" to the version + date,
     copy that block into the GreasyFork changelog box,
     then start a fresh empty "Unreleased" at the top.
  GreasyFork renders Markdown, so bullets / **bold** / `code` carry over.
  Keep entries short and user-facing — this is release notes, not commit log.
-->

## Unreleased

- **Hardened CSS against aggressive site skins** — All injected dialog, button, input, link, and heading styles now use `!important` to resist skins that apply `!important` broadly (e.g. Moonlit Wisteria). SVG icon sizes locked with `max-width`/`max-height` against AO3's `.icon` class.
- **Theme toggle** — Switch between Auto, Light, and Dark fallback modes with a new button in dialog headers
- **Custom checkbox and radio styling** — Checkboxes and radio buttons now have a polished custom look in dialog settings
- **AO3-native help modals** — Scripts can now show help and about dialogs that match AO3's native modal style
- **Import, Export, and Reset row** — A single themed row replaces separate import, export, and reset buttons across scripts
- **Search input component** — Filter fields now match AO3's own site search bar for a consistent feel
- **Horizontal dividers and SVG icons** — New visual elements including separators and 18+ SVG icons for a polished interface
- **Improved skin detection** — The library now filters out AO3's default background colors, detecting custom skin styling only when a skin actually changes it
- Various small fixes and improvements

## v2.2.0 — 2026-06-10


## v1.0.0 — YYYY-MM-DD
- Initial release
