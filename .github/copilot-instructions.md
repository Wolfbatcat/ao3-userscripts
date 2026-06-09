<!-- AO3-GUIDE:START -->
# AO3 Dev Guide Routing

## AO3 Dev Guide Routing

AO3 reference docs live in docs/ao3/. Start with docs/ao3/agent-routing.md and load only task-relevant docs.

Rule type meanings:
- HARD RULE: AO3 enforces this through sanitizer, parser, runtime, or config.
- BASELINE: AO3 currently ships this style, DOM, class, or behavior; useful to match or override, not a requirement.
- RECOMMENDATION: Safer authoring or userscript practice; valid alternatives may exist.
- REFERENCE: Lookup data for selectors, tokens, constants, sprites, or routing.

Use docs/ao3/ao3-dev-guide.json as machine-readable routing metadata.
When answering AO3 skin or userscript questions, consult docs/ao3/agent-routing.md and the listed task-specific docs. Keep responses clear about HARD RULE vs BASELINE vs RECOMMENDATION.
<!-- AO3-GUIDE:END -->
