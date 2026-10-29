# Native FNT5 default vertical baseline — 20-case screenshot comparison, 2026-10-29

Both editors successfully render the replacement `NIH_NativeFontDefaultBaseline.layout` at logical 1280×720, displayed zoom 68%. Workbench no longer displays the prior fixture's `Unknown keyword/data 'text valign'` message in the visible console; legacy localization warnings and the nonzero total error count remain, so absence of every native diagnostic is **not** certified. The original screenshot files are **not** committed. Root pixel extents, SHA-256 evidence, all 20 measured bounding boxes, and the 170 RGB threshold are preserved in `tests/fixtures/native-font-default-baseline/capture.visual.2026-10-29.json`.

## Major finding: Native font baselines are effectively common between TextWidget and ButtonWidget

Within the same native font at identical widget height, Workbench's **ink-top inset** is almost identical between TextWidget and ButtonWidget. Across eight matched pairs (MetronBook72 and MetronBook24 × 24/34/68/110px), every native top inset differs by **less than 1 logical px**, while Studio differs by up to **14.54px**.

| Height | Workbench Book72 Text–Button Y | Studio Book72 Text–Button Y | Workbench Book24 Text–Button Y | Studio Book24 Text–Button Y |
| --- | ---: | ---: | ---: | ---: |
| 24px | 0.9px | 4.2px | 0.8px | 4.2px |
| 34px | 0.8px | 4.2px | -0.6px | 5.7px |
| 68px | -0.6px | 10.1px | -0.6px | 8.7px |
| 110px | 0.8px | 14.5px | -0.6px | 14.5px |

The screenshot measure shows Studio's TextWidget glyph top **below native** for all 12 Text controls. Studio's Book72 Button is already close to native (±2px); Studio's Book24 Button sits above the native glyph position in all 4 height cases. Therefore **neither one universal Y-offset nor simply equating text/control CSS default alignment is a validated native algorithm**. But a shared native **glyph-ink anchor** is strongly supported across these two widget families.

## Next source-level investigation

The current `SdfTextCanvas` implementation sets `lineHeight = fontSize * 1.25` and `baseY = 0` for TextWidget's default `top`, whereas `ButtonWidget` defaults `vAlign = "center"` and receives `baseY = (height-lineHeight)/2`. This difference is source-confirmed. Native screenshot pairs do **not** exhibit such a widget-family difference for the tested font/height combinations. Font differences must also be accounted for by reusable glyph metrics rather than hard-coded Metron or widget exceptions.

**Recommended controlled next step:** opt-in route selecting the **same** effective default `center` alignment for FNT5 TextWidget and ButtonWidget, changing no other variables, to assess how much the current linebox default explains the differences. Anticipated caveat: the Book24 controls may require different ink/linebox metrics, so do not promote this simplification if it breaks them. A stronger follow-up is a shared glyph-ink vertical model using FNT5 bearings/ink extents; no production default is changed by this evidence commit.

**Limitations:** white-ink bounding box threshold, small font antialiasing and different editor rasterization/alpha affect measurements. This is independent native **visual placement** evidence, not recovered Enfusion C++ glyph baseline logic. No new user-run Node/typecheck/build transcript accompanies these screenshots, so the additional evidence regression test remains pending local validation. PR #47 stays draft.
