# Disposable fixaspect native client probe

This is a **test-only** DayZ mod; it is not a change to Studio or a production mod. It borrows the proven generic widget-tree/native-getter strategy from the common geometry probe, but uses a separate prefix and does not overwrite that probe.

## Windows PowerShell 5.1 — prepare

From the `research/native-visual-parity-gate` checkout:

```powershell
.\tests\fixtures\native-aspect\runtime-mod\Prepare-AspectProbe.ps1
```

This stages files under `P:\NIH_NativeAspectProbe`. Use DayZ Tools Addon Builder with addon prefix **NIH_NativeAspectProbe** to produce a disposable PBO. Load it only for a local DayZ **client** session; do not run other disposable `modded MissionGameplay` probes simultaneously.

The client probe creates `NIHNativeAspectParity`, updates it to two root screen rectangles, then logs the *actual* native root and every descendant through `GetScreenPos/GetScreenSize`:

- `root-960x500-origin`: requested root at (0,0) and 960×500.
- `root-1280x720-offset`: requested root at (31,19) and 1280×720.

Do not replace actual getter values with the requested sizes or the Studio prediction. Both cases help identify root-offset or scaling effects; the test parents themselves remain exact-sized. The probe also logs local getters for diagnostics. Neither native getters nor this fixture establish visual clipping, font ink, image UVs, or style parity.

## Capture and compare

Capture the current client's actual build/version from the DayZ client (do **not** substitute the DayZ Tools/Addon Builder version). Keep the original client script log as evidence. Run the extractor on the original log; it requires all nine descendants in each of the two completed phases:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter 'script_*.log' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$nativeBuild = Read-Host 'Enter actual DayZ client build/version'
node scripts/extract-native-aspect-log.mjs "$($latest.FullName)" "$nativeBuild" "$env:TEMP\NIH-NativeAspect-capture.json"
npm run test:geometry-engine
npm run compare:workbench-common -- "$env:TEMP\NIH-NativeAspect-capture.json" tests/fixtures/native-aspect/NIH_NativeAspect_Parity.layout
```

If the capture is missing, has duplicate phases, an incomplete widget tree, or an unrecorded build, **do not** report native parity as PASS. The extractor does not edit original log files or silently complete observations with predicted Studio values. The comparator is generic and checks all nine native descendants against shared geometry. Preserve the generated JSON and client log, and collect a Workbench/Studio screenshot pair separately for pixel-level visual acceptance.

The EnScript probe has **not yet been compiled in DayZ**; Node unit tests only validate the log extractor's format and safety rules.
