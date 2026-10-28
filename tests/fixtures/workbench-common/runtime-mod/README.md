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

The source is not included in Node/TypeScript CI; **a successful web CI
does not prove that the EnScript source compiles or runs**.

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

`capture.template.json` has two intentionally null observations. Once
native data is collected, create a separate dated capture JSON and preserve
the template. The comparator requires an independently reported parent
viewport in screen coordinates, as well as all widget screen rectangles.
The probe logs the actual root rectangle, but **does not log the parent
workspace rectangle**: that must be measured independently or left null.
Do not invent a matching parent rect from the expected Studio geometry.

Use:

```powershell
npm run test:geometry-engine
npm run compare:workbench-common -- tests/fixtures/workbench-common/capture.template.json --allow-pending
```

Two `PENDING` results are expected until native data exists.
The comparison checks common geometry only; it does not establish native
text measurement, imaging, clipping/scissor, rotation, safe-zone, scaling
branch, UI styling or interaction.
