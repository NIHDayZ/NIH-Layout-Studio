# Native FNT5 height sizing — observed six-control Workbench comparison

The `research/native-font-height-sizing` experiment was captured with all four opt-in settings: standalone FNT5 source, median RGB/MSDF reconstruction, bearing placement and `experimentalFnt5Fit=height`. The supplied console confirms six `[SDF widget]` sizes of **34 / 110 / 44 / 44 / 68 / 44**, matching the six authored widget heights, and no missing resources.

Paired screenshots used logical **1280 × 720**, displayed zoom **68%**, and were measured using native preview-root pixel bounds to account for small screenshot scaling differences. The screenshot, console SHA-256 hashes, exact crop rectangles, threshold settings and all coordinates appear in `tests/fixtures/native-font-route/capture.height-visual.2026-10-29.json`. The original image and console bytes are not committed.

| Control | Workbench glyph width (logical px) | Studio glyph width (logical px) | Difference |
| --- | ---: | ---: | ---: |
| Text_Book72_Short | 128.6 | 128.4 | -0.1% |
| Text_Book72_Tall | 416.4 | 414.9 | -0.4% |
| Text_Book24 | 166.6 | 165.4 | -0.7% |
| Text_Light24 | 162.2 | 160.9 | -0.8% |
| Button_Book72 | 258.6 | 256.9 | -0.7% |
| Button_Book24 | 168.0 | 163.9 | -2.5% |

**Result:** all six within 3% of native measured ink width, using a **single shared font-sizing rule** without font-specific adjustment. This is stronger evidence for requesting the widget's height than the prior capped/0.9 heuristic. These are white-ink widths, not precise native font advance or text pixel equality.

**Important remaining discrepancy:** the tall Book72 TextWidget starts **12.2 logical pixels lower** in Studio and touches its bottom edge, while Workbench retains approximately 10.7px of bottom padding. Book24 ButtonWidget begins about 5.2px higher in Studio. Some smaller glyphs also differ in top/bottom insets. Do not promote vertical alignment based on width agreement. In the short Book72 glyph trace, `inkOutsideWidget: false` but the screenshot white box touches the lower control row, leaving little margin.

**Acceptance:** close the six-case *text-width* visual research gate only. Font-size behavior for other native widget families, explicit sizes, wrapping, multiple lines and DPI is still unverified. Native vertical baseline and exact raster shape/alpha parity remain open. The supplied console log does **not** include a fresh TypeScript, Vite or geometry test run after the new branch was created. This new evidence regression must run locally before marking it validated.

## Next isolate vertical placement rather than modifying production

Current `SdfTextCanvas` computes `lineHeight = fontSize * 1.25` and `baseY = 0` for top-aligned TextWidget, or offsets by `(widgetHeight - lineHeight)/2` for centered ButtonWidget. Workbench's observed ink offsets do not consistently match those assumptions. Test authored `text valign top|center|bottom` independently across TextWidget and ButtonWidget, plus distinct widget heights, before deriving a shared correction. The current experimental height rule remains opt-in; PR #47 remains draft and unmerged.
