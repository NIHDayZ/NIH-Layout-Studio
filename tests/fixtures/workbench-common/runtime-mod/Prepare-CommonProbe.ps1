# Prepare a disposable DayZ client native geometry diagnostic mod.
# Windows PowerShell 5.1. Never modifies the existing ScrollWidget probe.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_CommonGeometryProbe',
	[switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$fixtureRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_CommonGeometryRuntime.c'); Relative = 'Scripts\5_Mission\NIH_CommonGeometryRuntime.c' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_Common_Geometry_Parity.layout'); Relative = 'gui\layouts\NIH_Common_Geometry_Parity.layout' }
)

foreach ($entry in $sourceFiles) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing source: $($entry.Source)"
	}

	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Destination exists: $target (only use -Overwrite for this test mod)"
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

Write-Output 'Ready for a test-only PBO with prefix NIH_CommonGeometryProbe.'
Write-Output 'Do not run this alongside the earlier ScrollWidget probe or production mods.'
