# Changelog

<!--
  This file IS the GreasyFork draft. Workflow:
  1. Jot notes under "Unreleased" as you work.
  2. On release: rename "Unreleased" to the version + date,
     copy that block into the GreasyFork changelog box,
     then start a fresh empty "Unreleased" at the top.
  GreasyFork renders Markdown, so bullets / **bold** / `code` carry over.

  Bullet style — every bullet must satisfy ALL of:
  - One line, one sentence. No sub-clauses explaining mechanism or cause.
  - Lead with **what changed**, in user-facing terms (feature/fix name, not function/variable names).
  - Say what changed, not how it was implemented or why it broke.
  - Cut anything a non-developer wouldn't need: internal reasons, code paths, "instead of X" explanations.
  - This is release notes, not a commit log — when in doubt, cut it shorter.

  Bad:  "Fixed X — it was checking a stale saved value instead of re-detecting the current one"
  Good: "Fixed X not working after switching accounts"
-->

## v2.3.0 — 2026-06-23

- **Date input with calendar popup** matching AO3's own datepicker style
- **Smarter username detection** for scripts that need to know who's logged in

## v2.2.2 — 2026-06-19

- **Hardened CSS against aggressive site skins**

## v2.2.0 — 2026-06-10
- **Theme toggle** (Auto/Light/Dark) with custom checkbox, radio, and form control styling
- **AO3-native help modals** that match AO3's own popup style
- **Import, Export, and Reset buttons** for settings dialogs
- **Better skin auto-detection** and mobile polish
- Various small bug fixes and stability improvements

## v1.0.0 — YYYY-MM-DD
- Initial release
