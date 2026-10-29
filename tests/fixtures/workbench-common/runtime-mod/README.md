# Disposable native common geometry client probe

This is an **optional, standalone DayZ client test mod**, separate from the
existing ScrollWidget probe. It is NOT production code and should not be
loaded together with the earlier disposable ScrollWidget probe, as both add
a `modded MissionGameplay` hook for independent diagnostics.

## Prepare locally

From the `feature/unified-layout-engine` checkout, use Windows PowerShell 5.1:

```powershell
.\tests\fixtures\workbench-common\runtime-mod\Prepare-CommonProbe.ps1
```

The script refuses to overwrite files unless `-Overwrite` is explicitly
passed. It stages an independent test mod at `P:\NIH_CommonGeometryProbe`:

```text
P:\NIH_CommonGeometryProbe\config.cpp
P:\NIH_CommonGeometryProbe\Scripts\5_Mission\NIH_CommonGeometryRuntime.c
P:\NIH_CommonGeometryProbe\gui\layouts\NIH_Common_Geometry_Parity.layout
```

Build it as a disposable PBO under the prefix `NIH_CommonGeometryProbe`
using DayZ Tools Addon Builder, then load the matching client/server test
mod in a local session. Do not replace or modify the established Scroll
test PBO and do not install this on a production server.

The source is not included in Node/TypeScript CI, but this exact harness
**has now compiled and run successfully in DayZ** on October 28, 2026.
See [native findings](../2026-10-28-runtime-capture.md). Future EnScript
changes still require an independent client test; web CI alone cannot
validate the DayZ script.

## Behavior

The probe creates the original 17-widget fixture under the native UI
workspace, then uses `SetScreenPos/SetScreenSize` to request two physical
root rectangles, with separate delayed observations:

- `viewport-1120x460`
- `viewport-1440x900`

The root's *actual* screen rectangle and each descendant's screen rectangle
are captured through native getters after the size update. The probe
walks the actual hierarchy using `GetChildren/GetSibling`, so the capture
mechanism is generic across widget families rather than maintaining a list
of hardcoded widget names.

For each widget, records include name, runtime type, `screenRect`,
`localRect`, `IsVisible` and `IsVisibleHierarchy`. The latter two are
distinct native concepts. Neither visibility getter provides a scissor
rectangle or measured pixels.

`SetScreenSize` is a runtime adjustment to the test layout, not a
change to the original `.layout` source. Screen-space coordinates can
differ from authored size due to viewport and DPI scaling; do not
manually force native values to match the Studio prediction.

The logger prefixes all records with `[NIH_LayoutStudio][CommonProbe]`.
After testing, filter the **client** `script_*.log` using:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter 'script_*.log' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Select-String -Path $latest.FullName -Pattern '\[NIH_LayoutStudio\]\[CommonProbe\]'
```

Also capture the client build, screen resolution/HUD scale and relevant
startup warnings. If the requested root size cannot fit inside your game
viewport, note that; the probe captures its actual rectangles regardless.
No screenshot pixel/clip parity is inferred from the logs.

## Evidence mapping and limitations

`capture.template.json` preserves the original empty comparison slots.
An independently populated [dated runtime capture](../capture.runtime.2026-10-28.json)
now contains all descendant observations, with `nativeBuild:null` because
the client build identifier was absent from the submitted log. The comparator requires the independently observed **test root widget**
screen rectangle as `viewport`, plus screen rectangles for all **16
descendants**. The probe logs the root's rectangle directly through native
`GetScreenPos/GetScreenSize`; the root is deliberately not counted as an
authored-geometry prediction because `SetScreenSize` overrides its relative
layout dimensions at runtime. No physical parent-workspace rectangle is
required for this constrained descendant comparison. Do not infer the root
rectangle from the expected Studio geometry or assume the requested size was
the size actually reported by the native getter.

Use:

```powershell
npm run test:geometry-engine
npm run compare:workbench-common -- tests/fixtures/workbench-common/capture.template.json --allow-pending
```

Two `PENDING` results remain expected for the original template. The
dated runtime capture also returns `2 PENDING`, despite **16/16 numeric
matches in each case**, solely because its client build is unrecorded.
This gate prevents unversioned measurements from being silently promoted
to native parity PASS.
The comparison checks common geometry only; it does not establish native
text measurement, imaging, clipping/scissor, rotation, safe-zone, scaling
branch, UI styling or interaction.
