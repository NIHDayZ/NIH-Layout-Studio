# Experimental FNT5 native widget-height sizing

Research-only branch `research/native-font-height-sizing`, based on source selection + median MSDF + bearing placement. This does **not** alter default rendering.

The paired Workbench/Studio screenshot records six named-font cases suggesting that when `exact text size`/author text size is absent, native glyph sizing follows **widget height** rather than the font generator's nominal 24px or 72px. Workbench's ink widths imply effective sizes around 33.7px for 34px Book72 short, 110.4px for 110px Book72 tall, 44.4px for 44px Book24, 46.3px for 44px Light24, 68.3px for 68px Book72 Button and 44.8px for 44px Book24 Button. See `tests/fixtures/native-font-route/capture.fit.2026-10-29.json`. These values come from screenshot width proportionality; they **do not prove** native's exact rule.

A new opt-in `experimentalFnt5Fit=height` applies `requestedFontSize = widgetHeight` to **loaded standalone FNT5 resources with pixel metrics, and only when an explicit authored font size is absent**. The previous `experimentalFnt5Fit=1` maintains the pre-existing `min(nominalSize, 0.9 * widgetHeight)` heuristic. Missing/invalid modes, the default path, bitmap/CSS fonts and explicit author text sizes are unchanged.

## Test with other font rendering variables held constant

```powershell
git fetch origin
git switch research/native-font-height-sizing
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build
npm run dev
```

Run this exact URL:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=height&debugFnt5Sampling=1
```

Use the unchanged `tests/fixtures/native-font-route/NIH_NativeFontRoute_Parity.layout`, with 1280×720 preview and Workbench DPI scaling unchecked. Reindex GUI assets. Expected `[SDF widget].requestedFontSize` values are **34** for Book72 short, **110** for Book72 tall, **44** for both Book24 and Light24, **68** for Book72 Button and **44** for Book24 Button. Default-font control stays CSS.

Capture one Studio screenshot and the console `[SDF widget]` and `[FNT5 placement]` records. Compare against existing Workbench `image(20261029-191539).png`, which is retained outside the GitHub repository, ideally at the same 68% displayed zoom with root dimensions matching. Record actual ink bounds and resource-selection checks, and assess native font sizes/glyph baselines separately. Do not treat an approximate width match as shader or alpha pixel equivalence.

This is a **controlled falsification test**, not authorization to promote height sizing or change PR #47. More widget fonts, DPI/scale states, text wrapping, alignment and explicit sizes require independent evidence.
