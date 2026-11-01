# Phase 2U — Native color transfer and compositing analysis

## Scope

Reanalyze **existing** Phase 2Q/R/S/T native evidence without gathering new fixtures or altering default rendering. The prior 347-test baseline is maintained. This phase adds a strictly opt-in transfer candidate, a reproducible 150-channel alpha comparison, and four regression tests.

### 1. Confirmed native inputs (Phase 2S)

- `Widget.GetColor()` contains the authored linear R/G/B/A values **rounded to unsigned 8-bit channels** (ARGB), not gamma-encoded values.
- `Widget.GetAlpha()` is the high byte divided by 255, e.g. authored 0.50 becomes 128/255.
- `rover_sim_colorable` references the `rover_imageset` 1×1 `WhitePixel`, decoded as `RGBA(255,255,255,255)`.
- The sampled panels have `GetFlags() == 0x2000003F`, none of SOURCEALPHA, BLEND, ADDITIVE or NOFILTER set.
- These observations do **not** identify the GPU blend state or shader transfer.

### 2. Opaque transfer — an exact match for all sampled colors

Applying standard sRGB's piecewise forward transfer **after quantizing each authored linear channel to 8-bit** reproduces all 15 screenshot channels of the five Workbench opaque-color swatches **exactly**:

```text
linear8 = round(authoredFloat * 255) / 255
encoded = linear8 <= 0.0031308
    ? 12.92 * linear8
    : 1.055 * linear8 ^ (1 / 2.4) - 0.055
displayByte = round(255 * encoded)
```

| Authored panel | Native Workbench RGB | Quantized sRGB candidate RGB |
|---|---|---|
| Blue (0.25, 0.58, 0.72) | 137, 200, 221 | 137, 200, 221 |
| Orange (0.75, 0.53, 0.27) | 224, 192, 142 | 224, 192, 142 |
| Green (0.32, 0.66, 0.49) | 154, 212, 186 | 154, 212, 186 |
| Pink (0.67, 0.41, 0.55) | 214, 172, 196 | 214, 172, 196 |
| Lavender (0.46, 0.50, 0.70) | 180, 188, 218 | 180, 188, 218 |

The same operation exactly predicts opaque authored backdrops `0.1 → RGB(90,90,90)` and `0.8 → RGB(231,231,231)`. This is **strong evidence** for a byte-quantized sRGB output transfer, but it is not native shader source or proof for other widget/image paths.

By contrast, the old unquantized power-2.2 model has ~1.27 average error/channel, and the unquantized sRGB model differs by one level in three of fifteen channels.

### 3. Alpha compositing — canonical models still fail

The script `scripts/Analyze-NativePanelCompositing.mjs` uses the existing two-background Phase 2R screenshot evidence: **150 native RGB channels** (two backdrops × five alpha levels × five source colors × three channels). It evaluates:

1. Legacy gamma2.2 encoded source-over, for an A/B baseline.
2. Quantized sRGB encoded CSS source-over.
3. Quantized source-over mixed in linear light, then encoded with sRGB.
4. Linear-light source-over with the source contribution premultiplied twice (explicitly a falsification candidate, not a recommended algorithm).

Representative overall mean absolute error (0–255 RGB levels) derived from these existing samples:

| Model | Approximate overall MAE |
|---|---:|
| Legacy power2.2 display-space source-over | 5.88 |
| **Quantized sRGB display-space source-over** | **6.03** |
| Quantized linear-light source-over, then sRGB | 8.10 |

The exact reproducible values and per-background/per-alpha breakdown come from `npm run analyze:native-panel-color`. The new opaque transfer is a much better model for **opaque** panels, but it does **not** improve the overall alpha-compositing fit.

The native Workbench light-backdrop 50%-alpha orange red channel is **205**, below both opaque source red **224** and backdrop red **231**. Every source-over convex interpolation, in either linear light or monotone sRGB space, stays within the endpoint interval. Therefore a single normal source-over equation with a different effective alpha cannot explain that observation.

### 4. Diagnostic model fitting — do not promote

The analysis script additionally fits *two linear-light coefficients per existing alpha row*, using four colors and the two observed backdrops; it predicts the fifth color held out from the fit, rotating the holdout over all five colors.

The cross-validated approximation is roughly **1.0 RGB level/channel** over the 150 samples, with per-alpha coefficients noticeably differing from ordinary `[alpha, 1-alpha]`. This demonstrates that the captured values admit a compact descriptive approximation but **does not establish a native blend equation**. In particular:

- Each row has two fitted coefficients, not a common shader parameterization across unseen alpha values.
- Both observed backdrops are used in training; a third held-out backdrop is not available.
- Even a low cross-validation error across five colors cannot distinguish GPU premultiplication, shader modulation, color management, and multi-stage compositing.
- Do not install those coefficients into `Canvas.tsx` or the production color parser.

### 5. Isolated opt-in preview for the exact opaque transfer

A second research-only flag enables **quantized-sRGB** for specifically `rover_sim_colorable` PanelWidgets:

```text
http://localhost:5173/?experimentalNativeColorablePanel=1&experimentalNativeColorableSRGB=1
```

Compare with the original gamma2.2 experiment:

```text
http://localhost:5173/?experimentalNativeColorablePanel=1
```

And the unchanged normal renderer without either flag:

```text
http://localhost:5173/
```

The sRGB flag is gated on the existing colorable-panel experiment; it does not affect any other panel, widget, texture or style. The model quantizes alpha to `round(alpha*255)/255` to align with observed native getters but otherwise uses ordinary CSS alpha as a **known approximation**. This is only for A/B experiments; translucent native parity is explicitly unverified.

The original `PreviewNativeColorablePanelColor` power-2.2 implementation remains available, and the normal renderer remains unchanged.

### 6. Reproducible local commands

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build

npm run analyze:native-panel-color
```

Expected new regression total: **351 tests**, pending local confirmation. The analysis command prints a JSON report with transfer exactness, per-model MAE, the convex-hull counterexample, and descriptive leave-one-color-out diagnostics. No native PBO rebuild or additional screenshot is needed to audit the mathematical results.

## Phase 2U screenshot and local validation — confirmed (2026-11-01)

The user confirmed **351/351 geometry/research regressions passing**, TypeScript typecheck PASS, Vite build PASS (89 modules; 1.25 seconds), and the analysis command completed with no errors. They also supplied a real 1919×1026 browser screenshot using both `experimentalNativeColorablePanel=1` and `experimentalNativeColorableSRGB=1`, with `NIH_Panel_Style_Comparison.layout` at 46% zoom.

The screenshot's central-pixel measurements (7×7 medians) are frozen independently in `panel-color-phase2u-quantized-srgb-screenshot-evidence.json`, and two new regression tests compare them with Phase 2R Workbench observations.

| Authored alpha | Actual Studio vs Workbench dark-background RGB MAE | Light-background RGB MAE |
|---|---:|---:|
| 1.00 | **0.00** | **0.00** |
| 0.94 | 1.07 | 3.33 |
| 0.75 | 3.67 | 11.87 |
| 0.50 | 1.20 | 17.60 |
| 0.25 | 7.13 | 14.33 |
| 0.00 | **0.00** | **0.00** |

**Result:** all 15 fully opaque colored swatch channels exactly equal native Workbench values, **over both backgrounds**, and both sampled parent backgrounds exactly match native output: dark `(90,90,90)`, light `(231,231,231)`. The transparent row shows precisely those parents. The intermediate-alpha error remains concentrated on the light backdrop.

The previously confirmed implicit-blank behavior persists: plain (no authored style) panels do not paint, leaving the upper groups uncolored. The quantized-sRGB flag affects only the styled panel experimental path.

The screenshot cannot prove the GPU shader or unseen widget styles. The resulting evidence tests extend the expected geometry-suite count from **351 to 353** after this documentation-only Phase 2U evidence update. No default renderer changes were made.

### Next falsifiable question

The held-out-color linear-weight diagnostic has MAE 1.0281, but its two coefficients were fitted using both available background colors at each opacity. It is **not a native compositor implementation**.

The most informative next independent measurement would be the **same five colors and alpha rows on a third, chromatic opaque background**, explicitly excluded from fitting, so the model is tested against a genuinely unseen backdrop. The third backdrop's native sRGB-encoded RGB should be measured and its authored color independently verified before evaluating predictions. This helps distinguish one set of backdrop-independent source/destination weights from a screenshot-specific fit. Do not fit new parameters or change default rendering based solely on those results.

### Decision

**Accept as evidence:** quantized-sRGB matches sampled opaque panels exactly, and authored gamma is not the full native alpha operation.

**Do not accept yet:** a universal native composite formula, a texture-independent opacity curve, or global default renderer changes.

**Next meaningful distinction:** inspect native UI shader/blend operations or capture a *third, independently held-out* backdrop to validate a candidate model without fitting to all backgrounds. Preserve all 347 earlier regressions, geometry and style selection behavior.
