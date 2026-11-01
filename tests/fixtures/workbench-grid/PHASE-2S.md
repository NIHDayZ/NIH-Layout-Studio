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

## Native runtime result — 2026-10-31

The user supplied `NIH-ColorFlagProbe-Phase2S.txt` after rebuilding the client PBO. The log has **two runs**, each with complete `after-create` and `post-update` phases and exactly **10 records per phase**. All 40 records are valid; both update phases and both runs are identical. No missing-widget or missing-layout errors were reported.

A normalized, independently auditable record of the ten unique widgets is frozen in `panel-color-phase2s-runtime-observations.json`. The regression `tests/native-colorable-runtime-observations.test.mjs` compares all numeric colors with the original authored .layout values, rather than fitting new values.

| Native widget | Unsigned ARGB | `GetAlpha()` | Explanation |
|---|---|---|---|
| `QBackdropDark` | `0xFF1A1A1A` | 1 | Authored neutral 0.10 → 26 per channel |
| `QDarkBlueAlpha100` | `0xFF4094B8` | 1 | Authored 0.25,0.58,0.72 → 64,148,184 |
| `QDarkOrangeAlpha050` | `0x80BF8745` | 0.501961 | Alpha rounded to 128/255 |
| `QDarkGreenAlpha025` | `0x4052A87D` | 0.25098 | Alpha rounded to 64/255 |
| `QDarkPinkAlpha000` | `0x00AB698C` | 0 | Zero alpha preserved |
| `QBackdropLight` | `0xFFCCCCCC` | 1 | Authored neutral 0.80 → 204 per channel |

The five paired dark/light foreground widgets have identical packed `GetColor()` results on both backgrounds. All ten widgets report:

- Type `PanelWidget`, style `rover_sim_colorable`, visible `true`
- `GetFlags() = 536870975 = 0x2000003F`
- Probe bitwise tests `SOURCEALPHA=false`, `BLEND=false`, `ADDITIVE=false`, `NOFILTER=false`
- No change between creation and update

**Interpretation:** DayZ's native `GetColor()` reports the authored channels quantized to 8 bits, not the gamma-encoded appearance visible on screen. `GetAlpha()` agrees with the packed high byte. The display gamma/color transform, alpha blending, and any style-specific composition happen downstream of these getters.

**Important open question:** We logged the raw flags and four false bitwise checks, but **did not log the numeric values of the `WidgetFlags` enum constants**. We must not turn those four booleans into a claim about the GPU blend state without establishing the enum masks and whether these flags govern the style renderer. The follow-up read-only probe now prints a `MASKS` record with the four actual enum values once per capture phase.

### Small native follow-up — verify enum constants

Rebuild the disposable probe PBO using the same commands above after pulling the current branch. The updated script adds a `[NIH_LayoutStudio][ColorFlagProbe] MASKS` log line without changing widget state or the existing grid measurements.

Filter the new lines with:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter 'script_*.log' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

Select-String -LiteralPath $latest.FullName -SimpleMatch '[NIH_LayoutStudio][ColorFlagProbe] MASKS'
```

The four numeric mask values are sufficient to interpret the earlier `0x2000003F` flags correctly. **No additional screenshots or alpha calibration layouts are required** for this targeted check.

## Local validation limits

The new geometry-suite tests validate research evidence and static probe structure; they do NOT compile/run DayZ EnScript. The PBO build and native logs remain independent acceptance steps.
