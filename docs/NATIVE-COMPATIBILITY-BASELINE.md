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

## Phase 3B — Higher-fidelity native widget census from extracted layouts

The first audit passed locally with **374 / 374 tests**, zero parse failures in the 26 public research fixtures, and no actual native widget-frequency data. This new census path addresses the critical missing input: real vanilla widget prevalence. The older raw PBO scanner can undercount **ID-less widget declarations and declarations using next-line braces**, so use the extracted-source census below when possible.

New file: `scripts/Census-ExtractedNativeLayouts.mjs`. It invokes Studio's **production LayoutParser** against the local extracted `gui` tree. It supports both ID-less and ID-backed class declarations, ignores source auxiliary metadata, and counts actual widget types rather than matching one assumed declaration syntax. It emits only aggregate counts, relative filenames, and parse failure diagnostics. It never includes actual `.layout` source content or authored widget names.

### Run locally on the DayZ workdrive

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

$layoutRoot = 'P:\gui'
$censusPath = Join-Path $env:TEMP 'nih-native-widget-census.json'

if (!(Test-Path $layoutRoot)) {
    throw "Missing extracted DayZ GUI directory: $layoutRoot"
}

# --silent keeps npm's script banners out of the JSON pipeline.
npm --silent run audit:extracted-layouts -- "$layoutRoot" --json |
    Set-Content -LiteralPath $censusPath -Encoding UTF8

$census = Get-Content -LiteralPath $censusPath -Raw | ConvertFrom-Json
$census | Select-Object source, layoutFiles, parsedLayoutFiles, parseFailures, widgetDeclarations, idlessWidgetDeclarations, distinctClasses
$census.classes | Select-Object -First 20 name, count, layoutCount | Format-Table -AutoSize

# Merge the native prevalence data into the 49-class evidence matrix.
npm run audit:native-compatibility -- "--census=$censusPath"
```

PowerShell 5.1 `Set-Content -Encoding UTF8` writes a byte-order mark; the compatibility audit now strips that BOM when reading JSON. The preexisting PBO scanning route is retained for independent comparison, but its readable-layout regex is not a complete inventory of all native declaration forms.

**Fail-closed boundaries:** The extracted scanner rejects empty/missing directories, reports files that have no parseable root, and records native ID-less declarations separately. Any parse failures mean native population statistics are incomplete; do not claim 100% coverage. Native prevalence is not native rendering fidelity. Avoid committing proprietary extracted layouts or their contents. Use the local temporary summary for prioritization.

### Interpreting the new output

The audit should now report `nativeCensusProvided: true`, `nativeCensusSource: local-extracted-layouts`, and explicit `nativeParseFailures` and `nativeIdlessWidgetDeclarations` fields. `overallParityPercentage` remains `null` until we have actual native render/edit/export acceptance for the representative high-frequency layouts.

### Validation

```powershell
npm run test:geometry-engine
npm run typecheck
npm run build
```

The new seven extracted-layout census regression cases raise the expected count to **381**, pending local execution. They exercise ID-less widgets, mixed declaration formats, source metadata, duplicate source IDs, parse failure accounting, privacy, native-matrix ingestion, and a Windows PowerShell UTF-8 BOM round-trip.

The subsequent project step is to select 3–5 *frequent* vanilla layouts from the census and validate the complete import → preview → edit → save → native Workbench reopen cycle. This is deliberately broader than another isolated color study.
