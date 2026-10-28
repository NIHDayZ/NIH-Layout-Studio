# Assemble the disposable runtime diagnostic mod in P:\NIH_LayoutScrollProbe.
# Compatible with Windows PowerShell 5.1. Does not invoke DayZ Tools or pack a PBO.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_LayoutScrollProbe',
	[switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$fixtureRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_ScrollParityRuntime.c'); Relative = 'Scripts\5_Mission\NIH_ScrollParityRuntime.c' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_Scroll_Parity.layout'); Relative = 'gui\layouts\NIH_Scroll_Parity.layout' }
)

foreach ($entry in $sourceFiles) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing source: $($entry.Source)"
	}

	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Destination file exists: $target (use -Overwrite only for this disposable test mod)"
	}
}

foreach ($entry in $sourceFiles) {
	$target = Join-Path $Destination $entry.Relative
	$parent = Split-Path -Parent $target
	if (-not (Test-Path -LiteralPath $parent)) {
		New-Item -ItemType Directory -Path $parent -Force | Out-Null
	}
	Copy-Item -LiteralPath $entry.Source -Destination $target -Force
	Write-Output "Prepared $target"
}

Write-Output 'Ready to pack as a test-only PBO with prefix NIH_LayoutScrollProbe.'
Write-Output 'Do not deploy this mod to a production server.'
