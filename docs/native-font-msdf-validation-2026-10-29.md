# FNT5 median-channel MSDF glyph diagnostic — 2026-10-29

## Experimental comparison, not a production change

Comparing two user-supplied Studio screenshots and their detailed browser console logs at **1280×720 preview root**, **68% zoom** and the same `research/native-font-source-selection` source confirms that the glyph reconstruction mode was the only requested change. Both captures used the same standalone FNT5 source for MetronBook24, MetronLight24 and MetronBook72, with **legacy placement**; the new capture adds `experimentalMsdf=1` to switch alpha from red-channel SDF to RGB-median MSDF. The old capture's MSDF setting was false. Original logs and images are preserved with the conversation, not committed; SHA-256 identifiers are recorded in `tests/fixtures/native-font-route/capture.msdf.2026-10-29.json`.

The user's Windows terminal at baseline `6d30fc54` passed **278/278 geometry tests**, `npm run typecheck` and `npm run build`. A new evidence test is added by this commit and must be rerun; no fresh `test:native-image-uv` run is implied by this specific uploaded terminal.

## Quantitative ink-versus-metadata test

For each unique `font, character` among `ABC012` (18 glyphs), the browser's own `[FNT5 placement]` JSON provides both TCRD nominal width/height and thresholded ink bounding-box width/height (`alpha > 128`). Use `(|inkW - metricW| + |inkH - metricH|) / 2` and retain only the first diagnostic entry per glyph, excluding duplicate widget instances. **This is Studio-renderer instrumentation**, not a Workbench screenshot pixel test.

| Font | Red-channel mean deviation | Median MSDF mean deviation |
| --- | ---: | ---: |
| MetronBook24 | 6.583 px | 0.833 px |
| MetronLight24 | 6.500 px | 1.167 px |
| MetronBook72 | 16.500 px | 0.667 px |
| **All 18 glyphs** | **9.861 px** | **0.889 px** |

The dimension error falls approximately **91%**. Median MSDF produces recognizable glyphs and measured dimensions far closer to the FNT5 glyph metadata. This is strong evidence for using the median shader in experimental FNT5 reconstruction, **not** yet proof of the exact Enfusion shader, font placement, alpha filtering, or native Workbench fidelity.

The comparison still **fails full visual parity**. In particular Book72's short TextWidget is essentially blank due to clipping, its ButtonWidget text clips vertically, and text size/baseline/advances need separate comparisons to Workbench. A mathematically accurate glyph extent cannot fix a misplaced glyph origin or incorrect widget-height interpretation.

## Next controlled experiment

Without modifying production Canvas or current source selection, load the same font fixture at:

```
http://localhost:5173/?experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&debugFnt5Sampling=1
```

Verify `[FNT5 sampling].msdf === true`, `selected === "Standalone FNT5 cell"`, and `[SDF widget].placementMode === "bearing"`. Retain all other options disabled, especially `experimentalFnt5Layout`, `experimentalFnt5Cells`, `experimentalFnt5Fit`, and `experimentalMsdfSmoothing`. Capture screenshot plus `[FNT5 placement]` logs, compare directly against the frozen median/legacy baseline. If that experiment worsens the result, do not promote the heuristic bearing formula; instead derive placement from native glyph baseline/offset evidence. PR #47 remains draft.
