# Grid native measurement — run procedure

The dedicated `NIH_GridMeasurementProbe` is a disposable **client-side** mod. It loads `NIH_Grid_Measurement_Matrix.layout`, records all actual widgets and descendants at `after-create`, `post-update`, and `after-resize-1120x720`. Log lines record local/screen position and size, type, native visibility, and immediate child count. **No observation is synthesized from the TypeScript model.**

From repository root on Windows PowerShell 5.1:

```powershell
git pull --ff-only
.\tests\fixtures\workbench-grid\runtime-mod\Prepare-GridProbe.ps1 -Overwrite
$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
$source = "P:\NIH_GridMeasurementProbe"
$output = "P:\Mods\@NIH_GridMeasurementProbe\addons"
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $builder $source $output "-prefix=NIH_GridMeasurementProbe" "-packonly"
Get-ChildItem $output -Filter '*.pbo' | Select-Object Name,Length,LastWriteTime
```

Load `@NIH_GridMeasurementProbe` **on your local client** and join the local test server (server also needs the mod if its launcher requires matched mods). Remove other disposable NIH probe mods because each hooks `MissionGameplay`. Do not use on a production server.

After joining gameplay and allowing the delayed capture, collect the *client* script log:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter 'script_*.log' -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host $latest.FullName
Select-String -Path $latest.FullName -SimpleMatch '[NIH_LayoutStudio][GridProbe]' |
    ForEach-Object { $_.Line } |
    Set-Content -Path "$env:TEMP\NIH-GridProbe-Capture.txt"
```

Upload `NIH-GridProbe-Capture.txt` together with any script compile errors. Record the client build, actual display resolution and UI scale. We will first verify the complete per-phase widget roster; native loader omission is evidence, not something to paper over.

The probe cannot guarantee parent-independent native viewport conditions from a single run, nor does it recover the native update algorithm automatically. Once the first capture is valid, we can add a controlled second viewport or explicit probes where required. No default rendering changes.
