# NIH Layout Studio — Workbench compatibility baseline

## Objective

Replace the previous single-property research loop with an evidence-based compatibility program covering **every Workbench widget family**. The end goal is a stable, modern editor that parses, displays, edits, and writes valid DayZ layouts while preserving native behavior. A test count by itself is not a completion percentage.

This is a **Phase 3A inventory/audit baseline**, not an assertion that the editor already has complete native parity.

## What is in this milestone

- `tests/fixtures/compatibility/baseline-evidence.json`: exactly the **49** Workbench types already catalogued in `src/schema/WidgetSchema.ts`, organized into eight practical widget families. It records the **specific** native observations and automated tests applicable to individual capabilities. It explicitly records native comparison tasks that remain pending.
- `scripts/Generate-NativeCompatibilityBaseline.mjs`: a read-only audit using Studio's **actual LayoutParser** against all public `.layout` fixtures. It reports fixture class occurrences, parse failures, coverage by widget, evidence boundaries, and optional `gui.pbo` declaration frequencies.
- `tests/native-compatibility-baseline.test.mjs`: regression tests checking the class catalogue, scoped evidence, pending states, unknown native classes, and the absence of a fabricated compatibility score.
- `npm run audit:native-compatibility`: automatically compiles the parser/schema for the audit and prints the Markdown matrix.

The output has separate axes for **geometry**, **rendering**, **interaction**, and **round-trip/export**, plus whether each class occurs in public fixture layouts. Editing infrastructure exists, but global property editing does not prove that a particular DayZ widget has fully native interaction behavior.

## Run the audit

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

npm run test:geometry-engine
npm run typecheck
npm run build

# Human-readable report (49 rows and cited evidence)
npm run audit:native-compatibility

# Structured JSON for additional analysis (without saving private sources)
npm run audit:native-compatibility -- --json
```

After this change the expected geometry/research suite has **374 tests** (369 prior validated + five new cases), subject to local confirmation.

The audit is intentionally designed to work without any private Workbench installation or asset files. The public fixture sample is **not** representative enough to rank actual widget prevalence, so the default output does **not** estimate an overall completion percentage.

## Optional: weight priorities by a private DayZ GUI widget census

We already have `scripts/audit-workbench-widgets.mjs`, which reads a local DayZ `gui.pbo` and reports widget declarations. This is a **read-only input** and does not modify DayZ assets or export any native code.

Adjust the path to the installed game as needed:

```powershell
$guiPbo = 'D:\SteamLibrary\steamapps\common\DayZ\Addons\gui.pbo'
$censusPath = Join-Path $env:TEMP 'nih-workbench-widget-census.json'

if (!(Test-Path $guiPbo)) {
    throw "Locate the installed DayZ gui.pbo and update the path first: $guiPbo"
}

node scripts\audit-workbench-widgets.mjs "$guiPbo" --json |
    Set-Content -LiteralPath $censusPath -Encoding UTF8

npm run audit:native-compatibility -- "--census=$censusPath"
```

**Important:** the existing PBO scanner skips compressed `.layout` payloads that it cannot parse. The output includes `skippedCompressedLayouts`. Any percentages or rankings derived from that census are a **sample of readable declarations**, not automatically the complete DayZ GUI. Do not commit extracted proprietary layouts, GUI PBOs, font files or atlas textures.

If a newer DayZ build contains unrecognized classes, the audit reports them under **native census classes missing from catalog**. It must not silently declare those classes supported.

## Status definitions

| Status | Meaning | Does *not* prove |
|---|---|---|
| `scoped-native-measurement` | A named behavior/property was actually measured in Workbench and has an evidence record | All geometry/rendering/interaction states for that widget |
| `automated-evidence-only` | Tests cover a selected behavior or algorithm | Native pixel parity or a fully functional editor |
| `native-comparison-pending` | The specific comparison is marked unfinished | Pass or failure |
| `not-demonstrated` | No capability-specific acceptance evidence has been catalogued | The feature is entirely absent from code |
| `parsed-in-repository-fixture` | Studio's actual parser accepted a local authored `.layout` containing the type | Native save/load round-trip or broad vanilla-corpus coverage |

As of this baseline:

- GridSpacer has measured native geometry in selected scenarios, not universal geometry proof.
- PanelWidget has measured color/style behavior for `rover_sim_colorable`, not all styles or layered alpha.
- FrameWidget has some measured geometry and native property-syntax/round-trip evidence.
- ScrollWidget has runtime captures, but the referenced numeric/visual comparison remains pending.
- FNT5, imagesets and other rendering tests demonstrate **partial** behavior, not full font/texture parity.
- Optional widget IDs are **not required** for a widget to be included in the census or parser checks.
- `overallParityPercentage` is deliberately `null` until a representative native acceptance suite is established.

## Next implementation steps

We should prioritize broad high-value work in the following order, adjusting based on the native census and the observed errors:

1. **Real-layout selection:** Choose a small representative collection from the vanilla DayZ GUI and existing user's mod layouts, including panels, text, images, controls, nested scroll/content, and complex spacers. Treat them as a regression corpus, keeping proprietary contents local where required.
2. **End-to-end golden tests:** For each layout, verify parse → render → edit a property → export → reopen, and compare native Workbench geometry, text, visible pixels and property preservation. Use explicit tolerances per rendering property and mark unsupported features.
3. **Diagnose shared causes:** Group failures by geometry, style/texture/font, scrolling/clipping, interaction, and serialization; avoid isolated per-widget CSS patches when a general algorithm is possible.
4. **Track measurable acceptance:** Report completed native visual and round-trip scenarios alongside pending and unsupported scenarios. Use a real, representative dataset and weighted class prevalence before publishing completion percentages.
5. **Integrate validated research:** The Phase 2U–2W alpha model is predictive but not a production compositor. Keep its preview flags experimental until correct nested style/textured compositing is demonstrated.

## Constraints

No change was made to production Canvas rendering, PCHIP/gamma experiments, native geometry, implicit blank-style PanelWidget semantics, UI interaction code or save/export logic in this milestone. The audit surfaces evidence gaps so future changes can be evaluated on the full editor, not merely one property.
