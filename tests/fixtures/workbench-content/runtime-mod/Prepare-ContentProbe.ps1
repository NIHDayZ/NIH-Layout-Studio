# Stage an isolated DayZ native text/image/content-size probe.
# Compatible with Windows PowerShell 5.1, no forced cleanup or PBO build.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_ContentSizingProbe',
	[switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$fixtureRoot = Split-Path -Parent $PSScriptRoot
$sourceFiles = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_ContentSizingRuntime.c'); Relative = 'Scripts\5_Mission\NIH_ContentSizingRuntime.c' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_PropertyMatrixRuntime.c'); Relative = 'Scripts\5_Mission\NIH_PropertyMatrixRuntime.c' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_PropertySyntaxRuntime.c'); Relative = 'Scripts\5_Mission\NIH_PropertySyntaxRuntime.c' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_ContentSizing_Parity.layout'); Relative = 'gui\layouts\NIH_ContentSizing_Parity.layout' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_ContentProperty_Matrix.layout'); Relative = 'gui\layouts\NIH_ContentProperty_Matrix.layout' }
)

# Stage each isolated case as its own native layout resource. Every
# unsupported/unknown property is confined to one CreateWidgets call.
$syntaxFolder = Join-Path $fixtureRoot 'syntax-matrix'
$syntaxLayouts = @(Get-ChildItem -LiteralPath $syntaxFolder -Filter '*.layout' -File |
	Sort-Object Name)
if ($syntaxLayouts.Count -ne 12) {
	throw "Expected 12 isolated syntax layouts, found $($syntaxLayouts.Count)"
}
foreach ($syntaxLayout in $syntaxLayouts) {
	$sourceFiles += @{
		Source = $syntaxLayout.FullName
		Relative = (Join-Path 'gui\layouts\syntax-matrix' $syntaxLayout.Name)
	}
}

foreach ($entry in $sourceFiles) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing source: $($entry.Source)"
	}
	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Destination already exists: $target. Use -Overwrite only for this disposable probe."
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

Write-Output 'Ready to pack as a TEST-ONLY PBO with prefix NIH_ContentSizingProbe.'
Write-Output 'Do not load together with the earlier Scroll or CommonGeometry runtime probes.'
