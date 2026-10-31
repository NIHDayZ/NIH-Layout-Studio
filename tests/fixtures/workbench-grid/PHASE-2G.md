# Phase 2G — controlled native Grid variation probe

This second resource is loaded **after** the original 8-scenario runtime capture. The same dedicated client-only mod logs a separate `variation-*` phase set, preserving the original baseline untouched.

12 matrices: matched original 2x2 baseline; padding 0 and 7; margin 0 and 7; 1, 2, and 4 children; 3x2, 2x3, 1x4 counts; and one relative second child. All have both Size To Content axes enabled; children have fixed authored dimensions except the marked relative child.

Each phase logs native getter localRect, screenRect, childCount, and visible state for the root, containers, and descendants. The relative case is included as evidence, **not** an assumption of a fixed-point equation. Use these observations to test competing measurements before changing shared geometry.

## Run (Windows PowerShell 5.1)

```powershell
git pull --ff-only
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
$source = "P:\NIH_GridMeasurementProbe"
$output = "P:\Mods\@NIH_GridMeasurementProbe\addons"
& $builder $source $output "-prefix=NIH_GridMeasurementProbe" "-packonly"
```

Restart DayZ with the updated test-only mod, join your local test server, then collect client script log:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter "script_*.log" -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Select-String -Path $latest.FullName -SimpleMatch "[NIH_LayoutStudio][GridProbe]" |
    ForEach-Object { $_.Line } |
    Set-Content "$env:TEMP\NIH-GridProbe-Phase2G.txt"
```

Upload the text file and report any client compilation errors. Expected **12** variation containers plus their descendants, across three phases; completeness and native rects must be checked before drawing conclusions. Default rendering and PR #47 are unaffected.
