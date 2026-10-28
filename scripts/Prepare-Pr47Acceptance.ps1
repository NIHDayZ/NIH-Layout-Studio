#Requires -Version 5.1
<#
.SYNOPSIS
  Prepare a non-destructive Windows acceptance bundle for NIH Layout Studio PR #47.
.DESCRIPTION
  Verifies the checked-out branch and fixture hashes, records local tool
  versions, and writes an evidence manifest and manual checklist under TEMP
  (or -OutputRoot). Does not launch DayZ, edit .layout files, build PBOs,
  install dependencies, save screenshots, or merge anything.
  Optional -RunChecks runs existing npm typecheck, geometry tests, and build,
  without npm install or changes to package-lock.json.
.EXAMPLE
  .\scripts\Prepare-Pr47Acceptance.ps1
.EXAMPLE
  .\scripts\Prepare-Pr47Acceptance.ps1 -RunChecks
#>
[CmdletBinding()]
param(
	[switch]$RunChecks,
	[string]$OutputRoot = (Join-Path $env:TEMP 'NIH-Layout-Studio-PR47-Acceptance'),
	[string[]]$RealLayouts = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Tool {
	param([string]$Command, [string[]]$Arguments)
	$output = & $Command @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "$Command failed with exit code $LASTEXITCODE"
	}
	return (($output | Out-String).Trim())
}

function Invoke-Check {
	param([string]$TaskName, [string]$CommandName)
	$logPath = Join-Path $folder "$TaskName.log"
	Write-Host "Running $CommandName" -ForegroundColor Cyan
	Push-Location $repoRoot
	try {
		& npm.cmd run $CommandName *> $logPath
		$exitCode = $LASTEXITCODE
	} finally {
		Pop-Location
	}
	if ($exitCode -ne 0) {
		Write-Host "FAILED: $CommandName (exit $exitCode). Last output:" -ForegroundColor Red
		Get-Content -LiteralPath $logPath -Tail 25 | Out-Host
		return @{ status = 'FAIL'; exitCode = $exitCode; log = $logPath }
	}
	Write-Host "PASS: $CommandName" -ForegroundColor Green
	return @{ status = 'PASS'; exitCode = 0; log = $logPath }
}

$null = Get-Command git -ErrorAction Stop
$null = Get-Command node -ErrorAction Stop
$null = Get-Command npm.cmd -ErrorAction Stop

$branch = Invoke-Tool -Command 'git' -Arguments @('-C', $repoRoot, 'branch', '--show-current')
$commit = Invoke-Tool -Command 'git' -Arguments @('-C', $repoRoot, 'rev-parse', 'HEAD')
if ($branch -ne 'feature/unified-layout-engine') {
	throw "Expected feature/unified-layout-engine; current branch is '$branch'. No files changed."
}
$dirtyLines = @(& git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0) {
	throw "Could not read git worktree status"
}

$fixturePaths = @(
	'tests\fixtures\workbench-common\NIH_Common_Geometry_Parity.layout',
	'tests\fixtures\workbench-scroll\NIH_Scroll_Parity.layout',
	'tests\fixtures\workbench-content\syntax-matrix\FrameBase.layout',
	'tests\fixtures\workbench-content\syntax-matrix\FrameContentBefore0.layout',
	'tests\fixtures\workbench-content\syntax-matrix\FrameContentAfter0.layout',
	'tests\fixtures\workbench-content\syntax-matrix\PanelContentBefore0.layout'
)

$fixtureDetails = @()
foreach ($relative in $fixturePaths) {
	$path = Join-Path $repoRoot $relative
	if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
		throw "Required acceptance fixture missing: $path"
	}
	$item = Get-Item -LiteralPath $path
	$fixtureDetails += @{
		path = $relative
		sizeBytes = $item.Length
		sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
	}
}

$realLayoutDetails = @()
foreach ($path in $RealLayouts) {
	if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
		throw "Representative .layout missing: $path"
	}
	if ([IO.Path]::GetExtension($path).ToLowerInvariant() -ne '.layout') {
		throw "RealLayouts accepts .layout files only: $path"
	}
	$item = Get-Item -LiteralPath $path
	$realLayoutDetails += @{
		fileName = $item.Name
		sizeBytes = $item.Length
		sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
		# Do not copy client/project layouts into the evidence bundle.
	}
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$folder = Join-Path $OutputRoot $stamp
$null = New-Item -ItemType Directory -Path $folder -Force

$results = @{}
if ($RunChecks) {
	if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules') -PathType Container)) {
		throw "Missing node_modules. From the repo root run 'npm ci' explicitly, then retry -RunChecks."
	}
	$results.typecheck = Invoke-Check 'typecheck' 'typecheck'
	$results.geometry = Invoke-Check 'geometry-engine' 'test:geometry-engine'
	$results.build = Invoke-Check 'build' 'build'
} else {
	$results.typecheck = @{ status = 'NOT_RUN' }
	$results.geometry = @{ status = 'NOT_RUN' }
	$results.build = @{ status = 'NOT_RUN' }
}

$manifest = @{
	schemaVersion = 1
	purpose = 'PR47 local Windows/Workbench acceptance (not native C++ parity)'
	capturedAt = (Get-Date).ToString('o')
	branch = $branch
	commit = $commit
	gitWorktreeClean = ($dirtyLines.Count -eq 0)
	node = Invoke-Tool -Command 'node' -Arguments @('--version')
	npm = Invoke-Tool -Command 'npm.cmd' -Arguments @('--version')
	os = [Environment]::OSVersion.VersionString
	fixtures = $fixtureDetails
	representativeLayouts = $realLayoutDetails
	checks = $results
	manualAcceptance = 'PENDING'
}

$manifestPath = Join-Path $folder 'manifest.json'
$manifest | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$checklist = @'
# PR #47 — Windows/Workbench acceptance record

This is a **manual review** of the current NIH Layout Studio branch, not proof
of native C++ layout parity. Leave cases PENDING until actually inspected.

## Environment
- Branch / commit: see manifest.json
- DayZ Tools/Workbench version (record if visible): PENDING
- Windows display scaling (%): PENDING
- Workbench preview canvas resolution and zoom: PENDING
- Studio viewport resolution and zoom: PENDING

## Visual checks (compare matching layouts, root sizes and visible controls)
| Case | PASS / FAIL / PENDING | Evidence filename / discrepancy |
|---|---|---|
| Common geometry: anchor, exact and relative positions | PENDING | |
| Nested panels and visibility (existing native fixture) | PENDING | |
| Scroll static state, clipping and overhang only | PENDING | |
| Real asset-heavy layout: bitmap/SDF text, imagesets, styles | PENDING | |
| Real layout: at least one edit, undo, redo, reload | PENDING | |

The Workbench ScrollWidget fixture does not permit reliable interactive
scrolling in the Layout Editor: do NOT claim scrolling parity from a
static screenshot or require a repeat of previously captured scrolling.

## Source and export checks
| Case | PASS / FAIL / PENDING | Evidence filename / discrepancy |
|---|---|---|
| FrameBase opens without a native warning | PENDING | |
| FrameContentBefore0 warns, Cancel does not export | PENDING | |
| FrameContentBefore0 Continue exports unchanged source | PENDING | |
| FrameContentAfter0 does not raise a false warning | PENDING | |
| Ctrl+S while SOURCE focused uses compatibility review | PENDING | |
| Real layout source edit, Save/Export and reload | PENDING | |
| Original vs exported SHA-256 hash (only if source unchanged) | PENDING | |

To compare source hashes locally:
Get-FileHash -Algorithm SHA256 -LiteralPath 'ORIGINAL.layout', 'EXPORTED.layout'

## Acceptance decision
- [ ] No unexpected geometry/text/rendering differences in the reviewed cases
- [ ] No data loss, child disappearance, or property reordering in tested exports
- [ ] Browser compatibility checks passed on the same commit
- [ ] Failures include original + Studio/Workbench screenshot pairs and steps

Decision: PENDING
Reviewer observations:

'@
$checklistPath = Join-Path $folder 'local-acceptance.md'
$checklist | Set-Content -LiteralPath $checklistPath -Encoding UTF8

Write-Host "PR #47 acceptance bundle created:" -ForegroundColor Green
Write-Host "  $folder"
Write-Host "  manifest.json (tool versions, commit, fixture hashes)"
Write-Host "  local-acceptance.md (manual visual/source acceptance)"
if (-not $manifest.gitWorktreeClean) {
	Write-Warning "Git worktree has local changes. Review them before treating results as branch-baseline evidence."
}
if ($RunChecks -and @($results.Values | Where-Object { $_.status -eq 'FAIL' }).Count -gt 0) {
	throw "One or more local npm checks failed. See logs under $folder."
}
