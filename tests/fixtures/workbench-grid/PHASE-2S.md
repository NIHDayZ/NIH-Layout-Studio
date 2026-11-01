# Phase 2S — native rover pixel and widget rendering-state evidence

## Verified native facts

- `P:\gui\looknfeel\dayzwidgets.styles`, lines 3284–3307, defines `rover_sim_colorable` with `rover_imageset`, white style modulation `0xFFFFFFFF`, and nine WhitePixel references in both Normal and Disabled states.
- `P:\gui\imagesets\rover_imageset.imageset` defines `WhitePixel` at atlas (1,101), 1x1, `Flags 0`, in `Gui/imagesets/rover_imageset.edds`.
- The user ran `npm run inspect:rover-whitepixel`, which successfully decoded 169120-byte EDDS to 256x512 RGBA. The specified **single central texel is [255,255,255,255]**, fully opaque white.
- The decoded 3x3 neighborhood contains transparent white neighbors (RGBA [255,255,255,0]), especially at x=0 and y=100. Those adjacent texels may be relevant at sprite borders/filtering, **not demonstrated to affect large interior panel center samples**.
- Native 50-swatch dark/light screenshots had strong opacity-dependent background differences, including an orange 50% sample on light backdrop outside the ordinary convex source-over interval. `WhitePixel` texture alpha cannot explain the interior color deviation because its referenced center is opaque.

`rover-colorable-native-style-evidence.json` freezes the style declarations and decoded pixel values. `tests/native-colorable-texel-evidence.test.mjs` asserts these facts. No raw EDDS asset is included or redistributed.

## A targeted native runtime check (requires a NEW test PBO)

DayZ `Widget` exposes `GetFlags()`, `GetAlpha()`, `GetColor()`, `GetStyleName()`, and the `WidgetFlags.SOURCEALPHA`, `BLEND`, `ADDITIVE`, `NOFILTER` bits (see `scripts/1_Core/proto/EnWidgets.c`). Their documented meaning makes them more informative than trying additional screenshot-fitted alpha curves.

The existing disposable client-only `NIHGridMeasurementProbe` now additionally captures ten selected color swatches (five over each backing color) **after** finishing all original grid measurements. The new log prefix is `[NIH_LayoutStudio][ColorFlagProbe]`, separate from `[NIH_LayoutStudio][GridProbe]`.

It captures `after-create` and `post-update`, with style, ARGB color, alpha, raw flag integer, and decoded sourceAlpha/blend/additive/noFilter booleans. Widget lookup uses **names, not optional IDs**, and the probe **never calls setters**. The extra color-layout instance is independent of the already captured geometry roots.

### On the Windows test machine (PowerShell 5.1)

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine
npm run typecheck
npm run build

.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite

$builder = 'D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe'
& $builder 'P:\NIH_GridMeasurementProbe' 'P:\Mods\@NIH_GridMeasurementProbe\addons' '-prefix=NIH_GridMeasurementProbe' '-packonly'
```

Load the rebuilt `@NIH_GridMeasurementProbe` **client-side** in DayZ and restart the game/test session so the new native script runs. The existing Workbench screenshots do not execute this client mission script. This is a new runtime probe, so merely staging the layout or opening it in Workbench is not enough.

Extract the new lines from the latest local script log:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter 'script_*.log' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

$filtered = "$env:TEMP\NIH-ColorFlagProbe-Phase2S.txt"
Select-String -LiteralPath $latest.FullName -SimpleMatch '[NIH_LayoutStudio][ColorFlagProbe]' |
    ForEach-Object { $_.Line } | Set-Content $filtered

Get-Content $filtered
```

Expected diagnostic markers: `BEGIN after-create`, `END after-create`, `BEGIN post-update`, `END post-update`, plus ten selected widget records in each phase. Capture `ERROR missing widget` or missing-layout lines if any; the source intentionally fails visibly instead of asserting success.

### Interpretation rules

- If `SOURCEALPHA` is set, the native documentation says texture alpha is multiplied with widget color alpha; however the decoded WhitePixel center is 255, so this cannot by itself explain partial-alpha center differences.
- `BLEND` and `ADDITIVE` indicate possible native blend paths; do not assume their numeric flag values or effective GPU state from the source `.layout` alone.
- `GetColor()`/`GetAlpha()` and the flags may show authored versus runtime-adjusted values; avoid changing them in the probe, since that would alter the screenshot condition.
- Even if the flags identify an alpha-blend mode, the *exact native GPU shader equation* and its color-space interpretation remain unverified. Retain the single-layer gamma conversion as **experimental only**.

## Local validation limits

The new geometry-suite tests validate research evidence and static probe structure; they do NOT compile/run DayZ EnScript. The PBO build and native logs remain independent acceptance steps.
