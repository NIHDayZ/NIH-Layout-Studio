# NIH Layout Studio — Native font pipeline consolidation audit

**Date:** 2026-10-29  
**Validated source baseline:** `research/native-font-descender-boundary` at `9155cc93664b96b7086c467caa4587dc520df658`.  
**Local user validation:** `npm run test:geometry-engine` **309 passed, zero failed/skipped/cancelled**, 776.7042 ms.  
**Review status:** Documentation / source audit only. No production renderer change and no new test count. PR #47 (`feature/unified-layout-engine` → `main`) remains **open/draft**, and is not this research branch.

## Executive decision

**Preserve the experimental pipeline as one coherent candidate; do not merge or globally enable it yet.** The tests and paired screenshots show substantial, repeatable improvement for the named Metron FNT5 fonts. They validate specific behaviors, not the exact Enfusion/Workbench font shader or the complete population of widgets, font resources and authored text properties.

The 309-test geometry suite proves its tested invariants and frozen evidence assertions pass. It does **not** render live Canvas or pixel-compare Workbench; the separate native/Studio screenshots provide that evidence.

## Implementation map and source of truth

| Stage | Current implementation | Controlled evidence | Readiness |
|---|---|---|---|
| Resource discovery | `ProjectWorkspace.ts` uses `experimentalStandaloneFnt5=1`, `ParseStandaloneFnt5`, `Fnt5SiblingPaths` and adjacent EDDS atlas; skips same-font FSDF overwrite | 8 short-name SDF resources available vs 1 initially; all named test font routes SDF | **Confirmed for sampled assets; experimental** |
| FNT5 metrics / atlas origins | `Fnt5Standalone.ts` reads HEAD/TCRD/atlas origins; derives a single cell pitch from adjacent glyph origins | MetronBook24/Light24 38px cells on 1024² atlas; MetronBook72 95px cells on 4096×2048 | **Needs broader family/format validation** |
| Distance reconstruction | `SdfTextCanvas.tsx` + `SdfMsdfMath.ts`, opt-in `experimentalMsdf=1`; RGB median instead of red-channel | 18 glyphs: mean ink width/height deviation from FNT5 metrics fell 9.861px → 0.889px | **Strong internal shape evidence; native shader parity unknown** |
| Glyph position | `Fnt5Placement.ts` + `experimentalFnt5Placement=1` | 18 glyphs: ink origin error against FNT5 bearings fell 15.250px → 0.861px | **Strong internal metric evidence, native formula unproven** |
| Widget-height text sizing | `Fnt5FontSizingExperiment.ts` invoked from `Canvas.tsx` with `experimentalFnt5Fit=height` | Six named ABC controls all within 3% native white-ink width; 20 default-baseline controls and unseen Hg9 holdout support same scale | **Visually supported for tested single-line widgets** |
| Shared one-line origin | `Fnt5LineOriginExperiment.ts` / `SdfTextCanvas.tsx` `experimentalFnt5LineOrigin=0.08` | 20 Hg9 holdout controls: 1.77px mean ink-top error vs **3.79px reconstructed**, not separately photographed, legacy | **Independent holdout supports candidate, not native engine constant** |
| Parent clipping | `Canvas.tsx` `BuildWidgetStyle` uses `clipchildren` to set `overflow`; Scroll explicitly hidden | 32-case Text/Button + 2 font + H9/Hg9 + 2px/24px overhang native comparison; significant overhang suppressed in both | **Behavioral visual pass; 1–2px raster edge differences** |

**Measured evidence:** `tests/fixtures/native-font-route/*`; `tests/fixtures/native-font-default-baseline/*`; `tests/fixtures/native-font-line-origin/*`; `tests/fixtures/native-font-descender/*`. Each validated visual JSON includes original external screenshot hashes. Source images remain attached to the conversation, not embedded in the Git repository.

## Confirmed cross-widget discrepancy separate from fonts

In `src/components/Canvas.tsx`, `BuildWidgetStyle` for a ButtonWidget with no `style` other than empty/blank and no authored `color` assigns **`rgba(50, 68, 86, 0.78)`** as a fallback background. The current Workbench fixture buttons visually render without that corresponding fill. This **hard-coded Studio background** accounts for the obvious blue-button mismatch in the screenshots. Do not "correct" the text alpha or font clipping to erase this background. Before changing the default style logic, check explicitly styled buttons, colored buttons, imported widget styles and pressed/hover/disabled states; resolve native-style precedence in a common visual-state policy.

## Boundaries, risks and technical debt

1. **Font coverage:** the standalone parser assumes a regular atlas pitch inferred from the first adjacent origins, validates width/height against that pitch, and limits it to 256px. It is not a proven universal FNT5 binary decoder. Broader supported FNT5/FSDF assets should be tested before removing the opt-in.
2. **Shader fidelity:** RGB median gives excellent metadata-aligned glyph shapes, but the current `MsdfAlpha` uses smoothing 12 and a CSS/canvas antialiased raster path. Exact native MSDF distance range, filtering, gamma, edge alpha, tint, inversion, hinting and subpixel sampling are not established.
3. **Sizing semantics:** `experimentalFnt5Fit=height` is applied only without explicitly authored font size and only to resources with `fnt5PixelMetrics`. Multiline wrapping, explicit text size, scaling contexts, odd widget heights, and non-Metron fonts remain unverified.
4. **Line origin:** the 0.08 coefficient was initially fitted to ABC screenshots and independently supported by Hg9. It **overrides** the current default vertical alignment for single-line standalone FNT5 when the flag is active. Test accepted/native-supported alignment, multiline, other glyph combinations, wrapping, text shadows and widget state before promoting it.
5. **Property compatibility:** Workbench 1.30 rejected the authored `"text valign"` in the earlier 20-case fixture. It remains a negative compatibility observation, not a universal declaration about all DayZ layouts or runtime APIs. Keep native parser/serialization compatibility distinct from Studio's permissive property handling.
6. **Clipping:** the parent `clipchildren` gate is behaviorally matched in the 32-case fixture. Workbench retained tiny thresholded white fringe in the first 1–2 screenshot rows beyond rounded parent edges; Studio did not. Generic CSS clipping changes are **not justified** from these screenshots. Individual glyph self-clipping and font atlas edge sampling remain separate.
7. **Diagnostics and test scope:** `debugFnt5Sampling` has key/limit-based dedup; it is instrumentation, not a production contract. The 309-test `geometry-engine` suite includes evidence-schema tests and geometry logic, **not** a browser/Workbench pixel CI gate. Keep isolated native UV, FNT5 parser/atlas, build/typecheck and screenshot/manual parity checks independent.
8. **Experimental switches:** startup URL flags are currently read in multiple source modules. Consolidating their research configuration into one typed internal policy would reduce accidental mixed modes, but do not introduce a shared global or change startup defaults until branch integration is approved.

## Proposed integration sequence (no action taken)

1. **Freeze evidence and establish a single candidate profile.** Preserve the five enabled controls `experimentalStandaloneFnt5=1`, `experimentalMsdf=1`, `experimentalFnt5Placement=1`, `experimentalFnt5Fit=height`, `experimentalFnt5LineOrigin=0.08`. Keep tests reproducing the default, sidecar and bitmap routes unchanged.
2. **Architectural cleanup on a separate branch.** Consolidate resource selection and paint metrics in small pure helpers, keep FNT5 decoder/font metrics independent of React and URL handling, and avoid duplicating bounds calculations. Preserve one data flow: FNT5 bytes + EDDS → font metrics + atlas → font size → bearing placement → shared line origin → draw alpha → parent clip.
3. **Resolve widget style defaults separately.** Audit Canvas' synthetic ButtonWidget background against native style/skin behavior and the `rover_sim_colorable` requirement where PanelWidget colors are expected to render; do not tie button chrome to font compatibility.
4. **Native paint acceptance.** Add or extend representative, rather than endless widget-specific, comparisons for missing font families, multiline, explicitly authored sizes, DPI, shadows and clipping edges. Require no regression to the six ABC controls, 20 Hg9 holdout controls and 32 clipping cases. Record Workbench version and image-root normalization for every visual claim.
5. **Promotion review.** Promote each behavior only after stable offline tests, full typecheck/build and independent Workbench comparisons; **do not merge PR #47 solely because 309/309 geometry tests passed**. PR #47 head is currently `7622914f35da3ecaea8991e931616734d146a130`, while the validated font research is a different branch lineage.

## Validated status matrix

- **Pass:** resource resolution on sampled FNT5s, median-channel internal glyph metrics, bearing-origin internal metrics, near-native single-line widths, independent Hg9 top alignment, parent clipping behavioral screenshots.
- **Pending:** exact native FNT5 shader, universal decoder coverage, explicit vertical alignment, multiline/layout, widget font-state and DPI parity, text self-clipping/edge alpha, ButtonWidget default style.
- **Do not change by default:** existing nonexperimental CSS/font rendering, FSDF sidecar preference (except under explicit standalone opt-in), browser font fallback, parent `clipchildren`, or `rover_sim_colorable` decisions without actual native evidence.

**Next engineering deliverable should be a consolidation design/review, not another fixture.** This document records the current architectural state and acceptance gates; it does not claim implementation or native parity beyond the cited evidence.
