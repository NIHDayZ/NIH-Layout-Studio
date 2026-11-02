# Phase 3J — Real vanilla server-browser allocated-grid acceptance

## Capture and status

Received 2026-11-02: Studio screenshot image(20261102-174614).png, 1919×1034 pixels. The unchanged vanilla source is P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout, at a 1920×1080 authored root and 46% zoom.

Three experimental URL flags are active: experimentalGeometrySnapshot=1, experimentalGridRelativeContent=1, and experimentalAllocatedParentRelativeGrid=1. The VANILLA P:\gui resource indicator remains active.

**Result: partial visual improvement, not Workbench parity.** Relative to the earlier shared-snapshot capture, more filter labels/controls appear beneath the upper-right heading. But the controls are still tightly clustered, the left server list is mostly absent, the top headings overlap, and the bottom navigation is below its native server-list subregion. Workbench's original screenshot remains the independent reference. The separate eight-grid controlled fixture had 0.9479 screenshot-pixel mean error across 96 swatch rectangle coordinates; that result does not certify this vanilla screen.

## New diagnostic: determine which GridSpacers really activated

Extend the existing read-only Analyze-NativeLayoutGeometry.mjs script to compute three snapshot variants (basic, Phase 2O relative, Phase 3I allocated-parent), plus the existing live Grid comparison. It reports:

- allocatedSnapshotAppliedStrategies: exact names and modes of actually activated parent grids
- gridEligibility.allocatedReasonCounts: coarse reasons for grids that did not activate; descriptive categories only, not Workbench proof
- allocatedVsRelative: local versus inherited rectangle differences and dominant ancestor-level changes
- focused[].allocatedLocal and allocatedVsRelativeDelta: named filter descendant rectangles and changes

The allocated-parent experiment intentionally requires BOTH Size To Content axes. The server-browser research baseline contained 43 GridSpacers: 7 both-axis, 28 width-only and 8 height-only. Thus the preview cannot address most grids yet. Do not remove the guards to make a screenshot look better without further native evidence.

## Run locally

```powershell
cd Z:\GitHub\NIH-Layout-Studio
git pull --ff-only
npm run test:geometry-engine

$layoutPath = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout'
$reportPath = Join-Path $env:TEMP 'nih-phase3j-server-browser.json'

npm --silent run audit:native-layout-geometry -- "$layoutPath" --json '--focus=filters_content' '--max-focused=60' |
    Set-Content -LiteralPath $reportPath -Encoding UTF8

$report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
$report | Select-Object basicSnapshotWidgets,relativeSnapshotWidgets,allocatedSnapshotWidgets
$report.gridEligibility | Select-Object totalGridSpacers,appliedStrategyCount,allocatedAppliedStrategyCount,allocatedReasonCounts
$report.allocatedSnapshotAppliedStrategies | Select-Object name,mode | Format-Table -AutoSize
$report.allocatedVsRelative.topRootCauses | Select-Object name,affected,localDelta | Format-Table -AutoSize
$report.gridEligibility.items |
    Where-Object { $_.name -in @('filters_root','filters_content','server_list_root','server_list_content_root','server_list_scroller') } |
    Select-Object name,contentSizingMode,childTopologyReason,allocatedReason,allocatedMode |
    Format-Table -AutoSize
```

**Expected suite:** 419 tests (416 prior target + three new diagnostic tests), pending local confirmation. Diagnostics do not modify the vanilla source or production renderer. If the allocated strategies are only a small fraction of 43, prioritize the first unsupported ancestor with the highest descendant impact, then obtain native Workbench rectangle evidence for that mode before implementing it.

Source parser round-trip success, localization, fonts, images, clipping, and actual Workbench reopen acceptance are separate tracks. These screenshots are not native-acceptance certifications.
