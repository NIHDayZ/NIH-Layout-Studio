# Native/legacy DayZ layout compatibility: optional widget declaration IDs

**Branch:** `research/native-optional-widget-identifiers`; based on PR #47 head `7622914f`, not an edit to PR #47.

The real `day_z_hud.layout` renders incorrectly in NIH Layout Studio because its outer `FrameWidgetClass {` has no identifier before the opening brace. The original parser required a second token in *every* widget declaration. It skipped this outer frame and hoisted its descendants to top-level widgets, incorrectly calculating their positions relative to the full 1920×1080 canvas.

This is **format compatibility**, not a special case for `HudFrameWidget`. Both historical ID-less `WidgetClass { Name "Friendly" ... }` declarations and newer `WidgetClass "{HEXID}" { Name "Friendly" ... }` must be accepted for *all* class families. Existing pre-ID layouts with `WidgetClass OldName {` are also supported. A single document may mix these three forms.

## Implementation

- `LayoutParser.TryParseDeclaration` allows a missing declaration ID/name token for any `*Class`, including a brace on the next line.
- `ParseNode` retains `sourceHasNoIdentifier=true` when the declaration has no token. It takes the friendly `Name` property as `node.name`, or a **UI-only** `Type@sourceLine` label when that property is missing. Quoted ID declarations and legacy named declarations are unchanged.
- Canonical `SerializeNode` does **not fabricate** an identifier for original ID-less widgets; `Name` stays its own source property.
- Source-aware UI rename, paste and duplicate update the friendly `Name` property for ID-less widgets, rather than silently inserting a declaration ID. When `Name` is absent and the user renames, the property is inserted after the opening brace, including the next-line-brace form. Explicitly named/ID-backed copy and rename behavior is retained.

## Tests and acceptance

Seven new geometry-suite tests cover the real HUD's anonymous root shape, 90% centered 1728×972 logical root rectangle (x=96, y=54), nested parent-local geometry, 3-way ID/legacy/ID-less mixed hierarchies, brace-on-next-line, canonical parse–serialize–parse preservation and App operation guardrails. `test:layout-ids` gets a targeted compatibility case.

Run on Windows:

```powershell
git fetch origin
git switch research/native-optional-widget-identifiers
git pull --ff-only
npm run test:layout-ids
npm run test:geometry-engine
npm run typecheck
npm run build
```

**Visual confirmation:** Reload the **same** `day_z_hud.layout` with no FNT5/other experimental flags, 1920×1080 root, and compare Workbench and Studio at recorded zoom. The Studio canvas should now have one `HudFrameWidget` root with 90% dimensions (logical x=96, y=54, w=1728, h=972); previously there were eight detached roots. Remaining text/resource/default style mismatches must be evaluated separately.

**Do not merge automatically.** PR #47 remains draft. Real-project acceptance should not be marked PASS until the updated parser passes local tests and visual confirmation. Test counts reported by scripts, not estimated counts, are authoritative.

## Known limits

- A declaration lacking both identifier and `Name` gets a synthetic display label only, not a persisted source identifier. This is not a replacement for native widget IDs.
- The editor's existing name-based post-edit selection can be ambiguous when multiple different unnamed nodes share the same friendly `Name` property. That is a separate source-editor identity issue, not the recovered HUD geometry bug. Moving to provenance-based source selection is warranted before claiming perfect editing of duplicate-friendly-name trees.
- Saving the unmodified original source still uses its existing byte-preserving path; canonical reserialization is structurally stable but intentionally may rewrite whitespace.
