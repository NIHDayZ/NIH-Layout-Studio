# Phase 2L — complex relative-child GridSpacer native matrix

Status: **probe staged, native data not yet captured**. This follows the 2026-10-31 Phase 2K observation set; it does not change production rendering, native Grid prototypes, or PR #47.

The 20 cases in `NIH_Grid_Complex_Matrix.layout` are specified by `grid-complex-phase2l-cases.json`. The inputs deliberately vary:

- Multiple relative children sharing a row, sharing a column, or distributed across rows and columns
- 2x2, 3x3, 1x4 and 4x1 grids, including sparse and full occupancy
- Relative ratios 0.25, 0.5, 0.75, 1 and above 1; axis-specific content requests
- Width-only, height-only and both-axis deficits against fixed children and spacing
- Default hidden-child exclusion versus `"Ignore invisible" 0`
- A nested content-sized GridSpacer that itself has a relative child
- Two intentionally over-capacity cases (3x3 with 10 children, 2x2 with 5 children)

**Safety note:** The two over-capacity cases are unverified native behavior. Use the disposable local **client-only** probe mod, not a live server or production client setup. If DayZ errors or exits when constructing the complex root, retain and send the earlier capture phases and full client script/crash logs; do not repeatedly run a crashing fixture. For a subsequent targeted run, remove just the over-capacity cases from the disposable source fixture and rebuild, then note that deviation with the capture.

The fixture does not assert a theoretical native formula. `tests/grid-native-complex-matrix.test.mjs` checks the fixture's intent and ensures the current geometry prototype remains blocked for unsupported relative children.

## Stage and pack (PowerShell 5.1)

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git fetch origin
git switch research/live-snapshot-bridge
git pull --ff-only

.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite

$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
& $builder "P:\NIH_GridMeasurementProbe" "P:\Mods\@NIH_GridMeasurementProbe\addons" "-prefix=NIH_GridMeasurementProbe" "-packonly"
```

Restart DayZ with the rebuilt local test-only PBO enabled. Sequential roots preserve Phase 2K and earlier captures. The new complex matrix runs after the previous three roots have finished, avoiding overlapping phase snapshots.

## Capture and verify

Wait for `END complex-after-resize-1120x720` in the newest **client** log (not the server log):

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter "script_*.log" -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

$filtered = "$env:TEMP\NIH-GridProbe-Phase2L.txt"
Select-String -Path $latest.FullName -SimpleMatch "[NIH_LayoutStudio][GridProbe]" |
    ForEach-Object { $_.Line } | Set-Content -Path $filtered

Select-String -Path $filtered -Pattern "BEGIN complex-|END complex-|ERROR complex"
Write-Output $filtered
```

Upload `NIH-GridProbe-Phase2L.txt` from the printed path. Complete captures have three new phases:

- `complex-after-create`
- `complex-post-update`
- `complex-after-resize-1120x720`

For each phase, expect the root plus 20 direct grid children, 21 total GridSpacer instances including the nested grid, and a complete traversal of their panel children. Never infer behavior from absent/truncated phases.

## Analysis after native capture

1. Parse native parent/child screen rectangles, comparing creation vs Update vs resizing.
2. Evaluate whether relative requests allocate remaining **authored** space by a fixed-child baseline or some other negotiated grid extent.
3. Check independently: cell maxima, competing fractions within columns/rows, negative free space, unused rows, hidden-child compacting, and nested dependencies.
4. Add captured fixtures and native-anchored tests before proposing changes to `GridNativeMeasurement`, `ConstrainedGrid`, or `LayoutArrangers`.
5. Preserve optional widget IDs and all existing fixed-child regressions; do not create an ad hoc per-case renderer.

Do not merge the research findings into the production geometry path until they generalize beyond a one-off fixture and pass the existing test suites.
