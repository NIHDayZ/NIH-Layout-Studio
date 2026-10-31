# Phase 2K: relative-child GridSpacer native probe

This disposable client-only fixture extends the same Grid probe with a third, sequentially captured root. The twelve cases independently vary width ratio (0, 0.25, 0.5, 0.75), height ratio (0, 0.25, 0.5, 0.75), authored parent size (160×70, 240×100, 360×160), and H/V content-sizing flags. All use 2 columns, 2 rows, Padding 3, Margin 4, plus two fixed controls (40×10 and 30×25). The relative second child is intentionally unresolved in the model.

Three phases: `relative-after-create`, `relative-post-update`, and `relative-after-resize-1120x720`. The existing original and Phase 2G capture phases are preserved.

## Staging (PowerShell 5.1)

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
& $builder "P:\NIH_GridMeasurementProbe" "P:\Mods\@NIH_GridMeasurementProbe\addons" "-prefix=NIH_GridMeasurementProbe" "-packonly"
```

Restart the client with the updated test-only PBO. Capture client script logs after the third phase has finished. Upload the filtered log.

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter "script_*.log" -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Select-String -Path $latest.FullName -SimpleMatch "[NIH_LayoutStudio][GridProbe]" |
    ForEach-Object { $_.Line } | Set-Content "$env:TEMP\NIH-GridProbe-Phase2K.txt"
```

Do not infer dependency formulas without a complete native capture. The production renderer and PR #47 are unchanged.
