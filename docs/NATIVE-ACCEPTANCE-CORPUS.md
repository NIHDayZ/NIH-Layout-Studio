# Phase 3C — Native acceptance corpus from actual vanilla DayZ usage

## Census results confirmed November 1, 2026

After the extracted-layout parser census was executed locally:

| Observation | Count |
|---|---:|
| Passed geometry/research tests | 381 |
| TypeScript typecheck / Vite build | PASS / PASS |
| Extracted native `.layout` files | 227 |
| Files with reported parse failures | 0 |
| Vanilla widget declarations | 9,525 |
| Distinct native classes observed | 31 |
| Classes in broader schema catalog | 49 |
| ID-less declarations in this extracted corpus | 1 |

These numbers prove parser acceptance of this collection, **not** semantic parity or lossless layout round-tripping. The additional 18 catalogued classes were not observed in this corpus; they are not necessarily obsolete or unsupported.

## A prevalence-based priority order

| Rank | Native widget | Declarations | Layout files | Share of observed declarations |
|---|---|---:|---:|---:|
| 1 | ImageWidgetClass | 1,913 | 126 | 20.1% |
| 2 | PanelWidgetClass | 1,629 | 159 | 17.1% |
| 3 | TextWidgetClass | 1,403 | 157 | 14.7% |
| 4 | FrameWidgetClass | 1,211 | 147 | 12.7% |
| 5 | GridSpacerWidgetClass | 1,149 | 132 | 12.1% |
| 6 | ButtonWidgetClass | 737 | 100 | 7.7% |

**Top six: 8,042 / 9,525 = 84.4%** of observed declarations. Adding MultilineText (339), RichText (292), and WrapSpacer (261) reaches **8,934 / 9,525 = 93.8%**.

High-frequency priorities: image/style/resource fidelity; typography/FNT5 metrics; shared Frame/Panel/Grid geometry; Button editing, export and native reinsertion. ScrollWidget appears only 54 times in 42 files but remains a high-risk workflow because a single incorrect clipping or scroll region can break a large screen. Favor end-to-end workflow impact over declaration counts alone.

## Five complementary native acceptance candidates

Added `scripts/Select-NativeAcceptanceCorpus.mjs`. The tool scans the extracted `P:\gui` `.layout` tree with NIH Layout Studio's actual parser, and selects **five distinct files** using deterministic, log-weighted native widget prevalence and distinct-role coverage:

1. **Images and styles:** strong ImageWidget coverage, with Panel/Frame structure.
2. **Typography:** TextWidget, RichText and/or MultilineText.
3. **Managed layout:** GridSpacer and/or WrapSpacer with nested containers.
4. **Interactive controls:** Button, EditBox, CheckBox and/or Slider.
5. **Scroll and clipping:** ScrollWidget with surrounding panels/content.

One file is never used for multiple selection roles. If no eligible distinct file exists, the role remains **unfilled**, rather than quietly selecting an unrelated layout. Scores only guide representative validation selection; no score claims a widget works correctly.

### Run locally

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

npm run test:geometry-engine
npm run typecheck
npm run build

npm run audit:native-acceptance-corpus -- 'P:\gui'
```

Expected regression suite: **387** after six new corpus-selection tests; local validation pending.

To preserve the five selected relative paths and their widget count breakdown in a local temporary JSON file:

```powershell
$corpusPath = Join-Path $env:TEMP 'nih-native-acceptance-candidates.json'
npm --silent run audit:native-acceptance-corpus -- 'P:\gui' --json |
    Set-Content -LiteralPath $corpusPath -Encoding UTF8

$candidates = Get-Content -LiteralPath $corpusPath -Raw | ConvertFrom-Json
$candidates.selected |
    Select-Object role,path,targetDeclarations,widgetDeclarations,distinctClasses |
    Format-Table -AutoSize

$candidates | Select-Object status,requestedRoles,unfilledRoles,selectedDistinctClasses
```

This report contains relative filenames, widget class counts and candidate scores, not source bodies or authored widget identifiers. Keep native assets in the local installation. Avoid committing extracted vanilla `.layout` sources or resources to the public repository.

## Required acceptance for each selected real-world layout

| Area | Native acceptance condition | Failure classification |
|---|---|---|
| Parse and hierarchy | Native widgets (including optional IDs), declared properties, and child groups survive source import | syntax / hierarchy |
| Geometry | Root, anchored children, managed spacers and nested subtrees compare to Workbench across applicable viewports | geometry / content / managed layout |
| Visual rendering | Image styles, assets, text/FNT5, panel tint, visual priority and clipping agree within predeclared tolerances | resource / font / compositing |
| Edit | Change a known-supported property without altering unrelated properties or source group order | editing / serialization |
| Save and reopen | Export and load in native Workbench without lost descendants, unsupported synthetic identifiers or unexpected fallback changes | round-trip / native loader |

Every candidate needs an explicit result per area: PASS with independent native evidence, FAIL with reproducible discrepancy, or PENDING when a native behavior cannot be compared. A fixture's parser acceptance must never be promoted to a visual or round-trip PASS.

## Immediate follow-up after running the selector

Use the five selected **relative paths** to assemble a local evidence table with native Workbench screenshot, matching Studio screenshot, property/order diff, and Workbench reopen result. Start by capturing the original unedited layouts before performing the first source edit; this separates import/render defects from editor/export defects.

Focus on shared causes across those five screens and only then implement fixes. In particular, do not revert the default gray canvas, change tested GridSpacer behavior, or promote the still-experimental color alpha compositor.

## Scope

Phase 3C adds a read-only vanilla acceptance selector, its six tests, one npm command, and documentation. No production Canvas, geometry engine, editor UI, resource importer, runtime mod or serializer modifications were made.
