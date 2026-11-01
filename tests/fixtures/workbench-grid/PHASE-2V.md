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


## Phase 2V completed — real unseen background (2026-11-01)

**Local validation:** 357/357 existing regressions passed, TypeScript typecheck and Vite production build passed (89 modules; 1.03s). The blind prediction command returned the expected \`PREDICTION_ONLY_AWAITING_NATIVE_CAPTURE\` status before the screenshots were reviewed.

**Native and browser captures received:** \`image(20261101-074820).png\` (Workbench) and \`image(20261101-074827).png\` (Studio), 1919×1031 captured screenshot pixels, authored root 1920×1080, 46% preview zoom. Interior centers were measured using 7×7 median RGB patches. Native observed pixels are stored in \`panel-color-phase2v-workbench-observations.json\` along with the matched Studio pixels and exact screenshot sample coordinates.

**Crucial protocol:** The independent predictions were frozen in commit \`51f663f2091af0f4ab219e3aacbd62ac1eea1f6e\` **before** the chromatic Workbench screenshot was received. The original \`panel-color-phase2v-frozen-predictions.json\` was NOT edited or re-fitted after seeing the screenshot. All 30 observed native RGB triplets are in a separate file. New tests run the optional evaluator on the actual observation file and check its output.

### Results: 90 native RGB channels on the third background

- Parent backdrop: Workbench and Studio both \`(79,162,234)\`, identical to the pre-frozen quantized-sRGB prediction.
- Fully opaque source panels: all five native colors match both the frozen candidate and Studio exactly, 15/15 channel values.
- Fully transparent source panels: all five match the measured parent backdrop, 15/15 channel values.
- The full sample includes 30 panels × 3 channels = 90 RGB channels; 60 intermediate-alpha channels are independent of the exact endpoint controls.

| Alpha | Frozen model mean absolute error | Ordinary quantized-sRGB source-over mean absolute error | Actual Studio vs Workbench mean absolute error |
|---|---:|---:|---:|
| 1.00 | 0.0000 | 0.0000 | 0.0000 |
| 0.94 | **0.1333** | 2.4667 | 2.8000 |
| 0.75 | **1.0667** | 8.1333 | 8.5333 |
| 0.50 | **1.7333** | 12.1333 | 12.4667 |
| 0.25 | **1.3333** | 11.6000 | 11.2667 |
| 0.00 | 0.0000 | 0.0000 | 0.0000 |
| **90-channel overall** | **0.7111** | **5.7222** | **5.8444** |
| **60-channel intermediate-alpha only** | **1.0667** | **8.5833** | **8.7667** |

The frozen model therefore improves held-out mean absolute byte error by roughly **8×** versus normal sRGB source-over without any adjustment or fitting using the third background. This is important evidence of **predictive validity over an unseen chromatic background**.

**Still not an exact shader equation:** Worst frozen-model residual is 7 channel levels (red channel of blue sample at 50% opacity). Mean absolute error by channel over 30 samples is red 1.3333, green 0.3333, blue 0.4667. A slightly systematic residual survives even on the holdout. The model's intermediate coefficients are per sampled alpha, are not constrained to sum to one, and have not been demonstrated at unseen alpha values, textured/other widget styles, or different color-management environments.

**Decision:** The general idea of separable color-space and weighted linear-light compositing is strongly supported by independent data. Do not yet promote the *empirical* alpha weights to production. Continue by testing a **functional alpha equation** against unseen alpha values, or locate native shader/pipeline evidence; avoid collecting more examples at the same five known alphas unless a new variable is being tested.

### Reproduce actual native comparison

After pulling the branch containing the real measured observation file:

\`\`\`powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine

node scripts\Analyze-NativePanelHeldoutBackdrop.mjs "tests\fixtures\workbench-grid\panel-color-phase2v-workbench-observations.json"
\`\`\`

The second command is a **real measured** holdout comparison (\`HELD_OUT_NATIVE_COMPARISON\`), unlike the previous predictions-only invocation. It reports the frozen-model and ordinary CSS baseline MAEs without refitting.

New regression tests added for the native screenshot comparison extend the anticipated total to **360**; local execution of those new tests remains pending.
