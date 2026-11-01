# Phase 2T — plain PanelWidget vs rover_sim_colorable

## Purpose

Phase 2S verified the runtime native `WidgetFlags` masks, `GetColor()` and `GetAlpha()`, and established that the style's referenced `WhitePixel` is an opaque [255,255,255,255] texel. The intermediate-opacity screenshot discrepancy remains unresolved.

**Phase 2T changes only one authored property: the panel's `style` field.** Compare an otherwise identical native `PanelWidgetClass` with **no explicit style** to one with `style rover_sim_colorable`. The experimental Studio gamma correction is not promoted to default, and no geometry engine or layout algorithm changes are made.

## Fixture

`NIH_Panel_Style_Comparison.layout` is a separate fixture and does not modify previously accepted Phase 2R geometry/color fixtures. It has:

- Two opaque `rover_sim_colorable` backgrounds: **Dark** RGB authored `0.10 0.10 0.10 1`, **Light** `0.80 0.80 0.80 1`.
- Under each background: two passive `FrameWidgetClass` containers, **Plain** (upper) and **Styled** (lower), each with thirty `PanelWidgetClass` children.
- Each group contains the identical five authored RGB colors (**Blue, Orange, Green, Pink, Lavender**) × six alpha rows (**1.00, 0.94, 0.75, 0.50, 0.25, 0.00**).
- **Plain** children omit the `style` property entirely. **Styled** children explicitly use `style rover_sim_colorable`. The color, alpha, size, exact pixel positioning, flags (unspecified), widget type and relative position are otherwise identical for each pair.
- 120 leaf panels in 60 exact pairs, plus four grouping frames, two colored backgrounds and one root = 127 total nodes.
- No image resource references on children, no GridSpacer/WrapSpacer, no widget-ID requirements, no text overlay occluding panel-center samples.

This deliberately avoids substituting `style blank` or `style empty` as the control, because those are additional style behaviors rather than **no authored style**. If Workbench gives unstyled panels an implicit default style, the runtime `GetStyleName()` probe records that.

## Visual capture

Pull the research branch and validate:

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build

.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
```

Expected suite after these fixture tests: **345** (subject to local confirmation).

Open the native layout directly in Workbench:

`P:\NIH_GridMeasurementProbe\gui\layouts\NIH_Panel_Style_Comparison.layout`

Open the matching source file in Studio:

`Z:\GitHub\NIH-Layout-Studio\tests\fixtures\workbench-grid\NIH_Panel_Style_Comparison.layout`

Use `http://localhost:5173/?experimentalNativeColorablePanel=1` in Studio so the **Styled** test group receives our **experimental** single-layer gamma preview, while the no-style **Plain** group uses its current default code. Compare the same native vs browser version at a 1920×1080 authored root, approximately 46% zoom, with widget bounds and selection outlines turned off. Keep Studio's default gray canvas. Do not change the native style XML or atlas texture.

Provide screenshots of **Workbench** and **experimental Studio**. Optionally capture the same Studio file without the gamma flag to expose the existing default's duplicate paint path; this is a control, not a required third capture.

**Important:** A plain native `PanelWidgetClass` may display no fill, a default implicit style, or a raw-color fill. All are legitimate observations. If plain is visually invisible, do not fabricate pixel colors as though it had rendered. Record whether the parent backdrop shows through and inspect `GetStyleName()` / `GetFlags()` before drawing conclusions.

## Native runtime metadata (new test-only PBO required)

The existing disposable `NIH_GridMeasurementProbe` module schedules the **read-only** Phase 2T capture after the prior grid and Phase 2S flag captures. Phase 2S data remains available; no old test files were overwritten.

Repack the updated PBO using the known local AddonBuilder:

```powershell
$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"

& $builder "P:\NIH_GridMeasurementProbe" `
    "P:\Mods\@NIH_GridMeasurementProbe\addons" `
    "-prefix=NIH_GridMeasurementProbe" "-packonly"
```

Restart a client session with the rebuilt `@NIH_GridMeasurementProbe` loaded. The extra Phase 2T capture prints:

`[NIH_LayoutStudio][PanelStyleProbe]`

- `BEGIN after-create`, `END after-create`, `BEGIN post-update`, `END post-update`
- Each phase samples **18 native widgets**: two backgrounds plus eight Plain/Styled pairs, including fully opaque, 50%, 25%, and fully transparent representatives across both backgrounds.
- `GetStyleName()`, `GetColor()` (signed packed ARGB), `GetAlpha()`, `GetFlags()`, `GetTypeName()`, visibility.
- No setters or mutation, and no dependence on optional widget IDs.

Capture the new lines only:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter "script_*.log" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

$filtered = "$env:TEMP\NIH-PanelStyleProbe-Phase2T.txt"

Select-String -LiteralPath $latest.FullName -SimpleMatch '[NIH_LayoutStudio][PanelStyleProbe]' |
    ForEach-Object { $_.Line } |
    Set-Content $filtered

Get-Content $filtered
```

Provide both screenshots and the extracted log. Native runtime metadata supports conclusions about style assignment and flags; **it cannot identify a GPU shader equation by itself**.

## Interpretation / decision gate

| Native observation | Supported conclusion | Not established |
|---|---|---|
| Plain invisible; Styled visible | Rendering the color requires an explicit/resolved style in that configuration | Shader colorspace or alpha formula |
| Plain visible, same color/opacity as Styled | Behavior likely common to the native widget path or shared draw backend | Both styles have identical native implementation |
| Plain visible but alpha or color differs from Styled | Style resolution/imaging is a relevant contributor to the mismatch | Precise native blend equation |
| Plain has an implicit style in `GetStyleName()` | No authored style is **not** equivalent to no runtime style | That implicit style's material/texture semantics |

If we need a follow-up, it should be a *separately authorized* comparison of renderer paths informed by these observations—not another fitted CSS alpha constant.

## Phase 2T result — native blank style, renderer correction (2026-11-01)

The user supplied the actual Workbench and experimental Studio screenshots plus `NIH-PanelStyleProbe-Phase2T.txt`.

**Native runtime confirms that an unstyled PanelWidget resolves to `GetStyleName() == "blank"`.** The log reports two complete phases with 18 native widget records each; all values are stable across `after-create` and `post-update`. The eight sampled Plain children have runtime style `blank`; the eight Styled children retain `rover_sim_colorable`. All 18 remain `visible=true` with the same raw flags `536870975`, and each same-color Plain/Styled pair retains identical packed ARGB and alpha.

The Workbench screenshot confirms that native `blank` panels **do not paint their authored color**: they show the dark/light parent surface completely unchanged, even when the child color alpha equals 1. Studio previously invented raw-color backgrounds for those same plain panels.

Representative actual screenshot-center samples:

| Control | Workbench | Studio before fix |
|---|---|---|
| Dark, Plain opaque blue | `(90,90,90)` (parent) | `(64,148,184)` |
| Light, Plain opaque blue | `(231,231,231)` (parent) | `(64,148,184)` |
| Dark, Plain 50%-alpha blue | `(90,90,90)` (parent) | `(77,119,137)` |
| Light, Plain 50%-alpha blue | `(231,231,231)` (parent) | `(147,189,207)` |
| Dark, Styled opaque blue | `(137,200,221)` | `(136,199,220)` |
| Light, Styled opaque blue | `(137,200,221)` | `(136,199,220)` |

Source screenshots: `image(20261101-064920).png` (Workbench), `image(20261101-064757).png` (Studio). Pixel-center coordinates and values are captured in `panel-color-phase2t-screenshot-evidence.json`; the regression test asserts the native plain-background invariants and opaque styled parity.

**Confirmed and corrected:** `Canvas.tsx::GetPanelBackground` previously returned `color` when no `style` property was present, despite treating explicit `style blank` and `style empty` as transparent. It now returns **undefined** for missing style as well. This is the general `PanelWidgetClass` implicit-blank rule, not a per-widget-name fix or an experimental preview toggle. The widget still exists in the DOM, preserves geometry/children/interaction, and keeps its authored color property for editing and serialization. Only its fabricated paint is suppressed.

This change **does not** modify `rover_sim_colorable` colors (including experimental gamma) or resolve the remaining intermediate-alpha differences; a truly unstyled PanelWidget has no independent native colored-pixel paint path to compare.

No additional PBO build or native capture is needed for this Phase 2T observation. To validate the browser correction, reload the same Studio fixture after pulling. Its upper Plain groups should show only their respective dark/light background surfaces; the lower Styled groups remain rendered. All baseline GridSpacer geometry remains unchanged.

## Safeguards

- No change to default or experimental Canvas rendering, GridSpacer rules, widget IDs, font handling or color parsing.
- No changes to Phase 2R and Phase 2S baseline fixtures.
- Native probe remains disposable/client-only, uses names, and runs after existing captures.
- Tests check paired fixture equivalence and that passive panels cannot trigger managed geometry.
- The original 341-test baseline remains intact; two new tests in each new test file bring the expected geometry suite to 345.
