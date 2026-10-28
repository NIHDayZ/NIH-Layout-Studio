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
.\tests\fixtures\workbench-content\runtime-mod\Prepare-ContentProbe.ps1 -Overwrite

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
Use `-Overwrite` when updating your existing **disposable** test folder.
For the current syntax-matrix probe, the script replaces **18 files**:
config, three client EnScript files, two existing `.layout` resources,
and 12 independently loadable syntax layouts. It does not create/sign/install the PBO. Check the Builder log again before
testing. No production mod is touched.

## Run and collect

Load `@NIH_ContentSizingProbe` on the **client** and local **test
server** as required by your existing local startup configuration.
Remove the earlier Scroll and CommonGeometry probe mods. Enter gameplay.

The existing v2 harness still creates its original **27-widget** root
and captures four delayed states: initial text, short mutated text, restored
text, and a smaller runtime root viewport. It also checks independently
whether expected nested children can be found by name and how many direct
children each content-sized parent reports. Native `TextWidget.GetTextSize(out int,out int)`
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
will reject incomplete phases and malformed getters. The **v1 and v2 runtime harnesses compiled and ran in DayZ**. The v2
native log recorded 20/27 created widgets and validated class-dependent
behavior with direct lookups. This new **v3 property-matrix addition has
NOT been DayZ-compiled/tested yet**; it runs independently after the v2
four-phase capture, logging a separate `[NIH_LayoutStudio][PropertyProbe]`
prefix. See [the controlled property matrix](../PROPERTY-MATRIX.md).
If the script compiler reports
an invalid signature or unknown layout property, preserve the exact error
and correct the harness before treating any result as native evidence.

See [fixture design](../README.md).

### v3 property matrix extraction

The test mod now creates a second, independent layout after the
original content-sizing phases. Its three phases (`after-create`,
`post-update`, `after-resize`) use the separate
`[NIH_LayoutStudio][PropertyProbe]` prefix and examine 14 matched
Frame/Panel/Wrap parents.

```powershell
Select-String -Path $latest.FullName -SimpleMatch "[NIH_LayoutStudio][PropertyProbe]" |
    ForEach-Object { $_.Line }
npm run extract:workbench-property-matrix -- $latest.FullName property-matrix-native.json
```

The new parser refuses incomplete/unknown cases and does not infer
any missing child sizes. Capture the **complete** client log so we can
also inspect unrelated native script compilation or widget resource errors.

### v4 isolated native syntax probe

The same disposable PBO now includes **12 separate** `syntax-matrix/*.layout`
resources and `NIH_PropertySyntaxRuntime.c`. The cases isolate the
ordinary Frame/Panel property grammar: `Size To Content V 0` versus
a deliberately unknown property and known `clipchildren 1`,
placed **before or after the child block**. Each is created separately
and logged with `[NIH_LayoutStudio][SyntaxProbe]`, so a malformed
case cannot consume sibling definitions within another test file.

The probe runs after the existing content and property matrix
captures, logs an after-create and post-update record per case,
and does not modify any production mod. Its new extractor is
`npm run extract:workbench-property-syntax -- $latest.FullName syntax-native.json`.
The syntax tests **compiled and ran inside DayZ on 2026-10-28**.
All 12 native resources loaded and both observation phases completed;
see [native results](../2026-10-28-property-syntax-native-results.md).

Full protocol: [PROPERTY-SYNTAX.md](../PROPERTY-SYNTAX.md).
