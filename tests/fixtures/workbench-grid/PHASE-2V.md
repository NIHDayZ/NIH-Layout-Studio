# Phase 2V — blind validation on a chromatic backdrop

## Why this experiment

Phase 2U passed **353** regression tests. The exact 8-bit-quantized sRGB transfer matches all sampled native *opaque* \`rover_sim_colorable\` channels, but standard alpha blending does not match native translucent panels.

A descriptive two-coefficient-per-alpha model fitted on **two neutral backgrounds** (dark and light) produced about 1.028 RGB MAE in leave-one-color-out analysis. That fit used both backgrounds. Phase 2V holds out an **entire third background** to test whether those coefficients generalize outside the conditions used to derive them.

**Pre-registration rule:** The third background is fixed, and all 30 predictions are committed to the repository **before any native Workbench screenshot of this background is captured**. No color, alpha, weight or other parameter may be adjusted based on the subsequent holdout results. If the model fails, report that failure.

## New independent fixture

\`tests/fixtures/workbench-grid/NIH_Panel_Heldout_Chromatic.layout\`

- Root type: \`FrameWidgetClass\`, matching the older Phase 2R calibration.
- One \`PanelWidgetClass QVBackdropChromatic\`, using \`style rover_sim_colorable\`.
- **Authored backdrop RGBA:** \`0.08 0.36 0.82 1\`.
- **Blind opaque sRGB prediction:** \`(79,162,234)\`.
- The same five authored colors and six alpha rows as Phase 2R; thirty child panels.
- Identical local child positions, exact sizes, RGB and authored alpha to the original Phase 2R dark-side fixture, with different widget names. No spacers, bitmap text, widget IDs or additional style effects.
- The parent is at exact \`position 36 36\`, \`size 800 670\`, so sample edges and center regions remain large at 46% zoom.

\`tests/fixtures/workbench-grid/panel-color-phase2v-frozen-predictions.json\` contains the **frozen** candidate coefficients and a 6×5 array of RGB predictions. Only the earlier **Dark and Light** native captures were used for fitting. Alpha = 1 is anchored to quantized sRGB, and alpha = 0 is anchored to the independent backdrop's fully opaque color; neither control is artificially re-fitted.

| Authored alpha | Frozen linear source coefficient | Frozen linear background coefficient |
|---|---:|---:|
| 1.00 | 1.0000 (verified control) | 0.0000 |
| 0.94 | 0.9007 | 0.0571 |
| 0.75 | 0.6450 | 0.2111 |
| 0.50 | 0.4262 | 0.3828 |
| 0.25 | 0.2435 | 0.6138 |
| 0.00 | 0.0000 | 1.0000 (verified control) |

The intermediate-alpha coefficients are **independent unconstrained least-squares descriptors**, not measured shader constants. They are not forced to sum to 1, so the model can produce non-convex results. This does not prove premultiplication or reveal DayZ's GPU blend state.

## Reproduce frozen predictions (no native capture required)

\`\`\`powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only

npm run test:geometry-engine
npm run typecheck
npm run build
npm run analyze:native-panel-heldout
\`\`\`

Expected new test-suite total: **357** (not locally validated when authored). The analysis script recomputes all the frozen coefficients and predictions from old evidence only and fails if a source or frozen value changes. By default it prints:

- \`status: "PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE"\`
- \`validatedHeldOut: false\`
- Blind 30-swatch \`predictedNativeRgb\`
- Ordinary sRGB CSS source-over predictions as a baseline

This report is **not an evaluation** until a new native screenshot is measured. The synthetic-observation automated test validates the ingestion code only; it is explicitly not native ground truth.

## Stage and capture the real held-out evidence

The existing PowerShell staging script is extended to copy the new file:

\`\`\`powershell
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
\`\`\`

Open in native DayZ Workbench:

\`P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Panel_Heldout_Chromatic.layout\`

Open the repository copy in Studio:

\`Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Panel_Heldout_Chromatic.layout\`

For Studio's **opt-in quantized-sRGB experimental paint**, use:

\`http://localhost:5173/?experimentalNativeColorablePanel=1&experimentalNativeColorableSRGB=1\`

Keep the authored preview at 1920×1080 and the zoom approximately 46%; avoid widget selection outlines and the mouse hovering over panels. Supply a clean Workbench screenshot and, ideally, a Studio screenshot. All swatch values are measured from multiple **interior** pixels (7×7 median) after confirming actual panel positions; never infer pixel values from the visual appearance alone.

A **new PBO build is not required**: this phase needs only Workbench's visual layout editor and Studio's browser editor. The original GridProbe mission script need not run to compare pixels. No runtime widget flags are required again because Phase 2S already verified them.

## After native screenshots: evaluate WITHOUT retraining

Measure the Workbench screenshot's opaque parent backdrop RGB and the interior of each of the 30 swatches, ordered by six rows (alpha descending) and five colors (Blue, Orange, Green, Pink, Lavender).

Create an observation JSON file (only **after** measuring the real image) with the following schema:

\`\`\`json
{
  "backdropRGB": [79, 162, 234],
  "swatchesRGB": [
    [[137, 200, 221], [224, 192, 142], [154, 212, 186], [214, 172, 196], [180, 188, 218]],
    "... five more measured rows of five RGB triplets each ..."
  ]
}
\`\`\`

**The example values above are opaque reference predictions only, NOT a captured native measurement.** In a real observation file, replace every field—including the backdrop and opaque row—with independently measured Workbench RGB values. Do not copy frozen predictions as native observations.

Run the evaluator with the actual observation file:

\`\`\`powershell
node scripts\Analyze-NativePanelHeldoutBackdrop.mjs "path\to\real-Workbench-observations.json"
\`\`\`

This reports per-alpha and overall **out-of-sample** error for both the frozen coefficients and ordinary quantized-sRGB CSS source-over, plus a verification of the backdrop control RGB. No third-background data enter the fitting operation. The holdout supplies **90 RGB channels** (30 swatches × 3), of which the 100% and 0% rows are independent controls.

## How to interpret results

- If the **opaque backdrop** disagrees with the pre-frozen \`(79,162,234)\`, first investigate rendering context, parent style and screenshot sampling; do not treat the blend analysis as trustworthy yet.
- If opaque and zero-alpha controls match, but the intermediate rows differ strongly, the background-independent two-coefficient candidate is **falsified or incomplete**.
- If intermediate-row MAE is substantially below ordinary CSS source-over across colors and channels, the coefficients show **predictive** value on an unseen chromatic backdrop. That is stronger evidence than in-sample fitting, but still not proof of a universal shader formula.
- Regardless of outcome, keep normal rendering, GridSpacer geometry, the blank-style PanelWidget correction, and the experimental transfer unchanged until additional confirmation.

## Scope and safeguards

This research phase adds only a new test fixture, stage-list entry, frozen measurement predictions, read-only analysis code, tests and documentation. It does **not** alter Canvas, native gameplay mods, the original phases' fixtures, the color parser, production rendering, or geometry.

Reference: \`tests/fixtures/workbench-grid/PHASE-2U.md\` and \`scripts/Analyze-NativePanelCompositing.mjs\`.
