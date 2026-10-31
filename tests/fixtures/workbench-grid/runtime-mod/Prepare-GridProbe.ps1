# Stage isolated native Grid measurement probe. PowerShell 5.1.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_GridMeasurementProbe',
	[switch]$Overwrite
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$fixtureRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_GridMeasurementRuntime.c'); Relative = 'Scripts\5_Mission\NIH_GridMeasurementRuntime.c' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_Grid_Measurement_Matrix.layout'); Relative = 'gui\layouts\NIH_Grid_Measurement_Matrix.layout' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_Grid_Variation_Matrix.layout'); Relative = 'gui\layouts\NIH_Grid_Variation_Matrix.layout' }
)
foreach ($entry in $sourceFiles) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing source: $($entry.Source)"
	}
	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Existing destination: $target (use -Overwrite for disposable probe)"
	}
}
foreach ($entry in $sourceFiles) {
	$target = Join-Path $Destination $entry.Relative
	$parent = Split-Path -Parent $target
	New-Item -ItemType Directory -Path $parent -Force | Out-Null
	Copy-Item -LiteralPath $entry.Source -Destination $target -Force
	Write-Output "Prepared $target"
}
Write-Output 'Ready to pack test-only PBO with prefix NIH_GridMeasurementProbe.'
