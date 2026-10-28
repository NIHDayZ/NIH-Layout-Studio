# Disposable DayZ native content-sizing diagnostic mod

This probe is **separate** from `NIH_LayoutScrollProbe` and
`NIH_CommonGeometryProbe`. Do **not** load multiple disposable test mods
at once: each installs an independent `modded MissionGameplay` hook.
This diagnostic is never intended for a production server.

## Stage and pack (Windows PowerShell 5.1)

From `Z:\GitHub\NIH-Layout-Studio` on branch
`feature/unified-layout-engine`, run:

```powershell
git pull --ff-only
.\tests\fixtures\workbench-content\runtime-mod\Prepare-ContentProbe.ps1

$builder = "D:\SteamLibrary\steamapps\common\DayZ Tools\Bin\AddonBuilder\AddonBuilder.exe"
$source = "P:\NIH_ContentSizingProbe"
$output = "P:\Mods\@NIH_ContentSizingProbe\addons"
if (-not (Test-Path -LiteralPath $builder -PathType Leaf)) {
    throw "DayZ Addon Builder not found at $builder"
}
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $builder $source $output "-prefix=NIH_ContentSizingProbe" "-packonly"
Get-ChildItem $output -Filter "*.pbo" | Select-Object Name,Length,LastWriteTime
```

Expected packed test-only file:
`P:\Mods\@NIH_ContentSizingProbe\addons\NIH_ContentSizingProbe.pbo`.
The preparation script guards against overwrites unless `-Overwrite`
is explicitly supplied and does not create/sign/install the PBO.

## Run and collect

Load `@NIH_ContentSizingProbe` on the **client** and local **test
server** as required by your existing local startup configuration.
Remove the earlier Scroll and CommonGeometry probe mods. Enter gameplay.

The harness creates a single root layout and captures four delayed
states: initial text, short mutated text, restored text, and a smaller
runtime root viewport. Native `TextWidget.GetTextSize(out int,out int)`
returns pixel dimensions, while `GetScreenSize` returns widget bounds.
The output distinguishes these and records all widget types generically.
The exact imageset source pixel size, painted text glyph bounds, and native
clipping/scissor context are *not* exposed by these getter calls.

After the last phase (around 6 seconds after creation), inspect the
most recently updated **client** log:

```powershell
$latest = Get-ChildItem "$env:LOCALAPPDATA\DayZ" -Filter "script_*.log" -File |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host "Client log: $($latest.FullName)"
Select-String -Path $latest.FullName -SimpleMatch "[NIH_LayoutStudio][ContentProbe]" |
    ForEach-Object { $_.Line }
```

Please supply the **complete client log** including any DayZ script
compile errors, rather than only the excerpt if possible. Also record the
DayZ client build, screen resolution and HUD/UI scale separately when
available; this harness does not capture them.

`npm run extract:workbench-content -- "<client-script.log>" capture.json`
will reject incomplete phases and malformed getters. The new runtime mod
has **NOT** been DayZ-compiled/tested yet; if the script compiler reports
an invalid signature or unknown layout property, preserve the exact error
and correct the harness before treating any result as native evidence.

See [fixture design](../README.md).
