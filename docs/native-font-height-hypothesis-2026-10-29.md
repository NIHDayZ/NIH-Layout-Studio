# Native font height-based sizing hypothesis — Workbench paired screenshot (2026-10-29)

**Parent branch:** `research/native-font-source-selection`, captured after prior bearing evidence. The user supplied a 1280×720 Studio screenshot at 68% displayed zoom using `experimentalStandaloneFnt5=1&experimentalMsdf=1&experimentalFnt5Placement=1&experimentalFnt5Fit=1&debugFnt5Sampling=1` and matching diagnostic console. The log confirms **Book72 short 30.6px, tall 72px, button 61.2px**, with no observed short-label ink clipping. The earlier native Workbench screenshot was also at 1280×720 and displayed zoom 68%.

The two screenshot images were loaded at their true 1919px widths, aligned using the root preview rectangles, and their thresholded white glyph bounds compared for **six named FNT5 controls** (excluding the default-font control). See `tests/fixtures/native-font-route/capture.fit.2026-10-29.json` for hashes, pixel bounds, method, and data. Original screenshots and diagnostic logs remain outside GitHub.

| Control | Workbench white ink width | Studio current white ink width | Inferred size needed | Widget height |
| --- | ---: | ---: | ---: | ---: |
| Book72 short | 88px | 79px | 33.7px | 34px |
| Book72 tall | 285px | 184px | 110.4px | 110px |
| Book24 text | 114px | 61px | 44.4px | 44px |
| Light24 text | 111px | 57px | 46.3px | 44px |
| Book72 button | 177px | 157px | 68.3px | 68px |
| Book24 button | 115px | 61px | 44.8px | 44px |

The inferred size is `studioRequestedFontSize * WorkbenchInkWidth / StudioInkWidth * (StudioRootPxWidth / WorkbenchRootPxWidth)`. Five of six results are within ~2% of the **authored widget height**; all six within ~6%. This is a much more consistent explanation than capping requested font size at the FNT5 nominal size. Native screenshot *text ink height* is also around 75% of logical widget height in each named-font case (expected from glyph ink coverage).

**Hypothesis:** native auto-sized named fonts may request an effective font size equal (or very close) to the widget's logical height, unless an explicitly authored text size overrides it. This is not evidence of the exact native font-sizing algorithm or an exhaustive font/style/widget matrix. Rendering differences, default font, DPI scaling, multiline/wrapping, controls and explicit text size remain open.

**Next research action:** add a separate opt-in `experimentalFnt5Fit=height` mode that requests the full widget height **without the nominal font-size cap**, while keeping the existing `experimentalFnt5Fit=1` 0.9/capped behavior unchanged and leaving the default route untouched. Run paired Workbench/Studio at 1280×720 and 68%, compare text ink bounds. Do not promote heuristic values into production until this native pair validates them.
