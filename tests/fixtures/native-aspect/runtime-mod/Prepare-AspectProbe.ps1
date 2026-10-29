# Stage a disposable DayZ client probe without touching any existing mod.
# Compatible with Windows PowerShell 5.1.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_NativeAspectProbe',
	[switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$fixtureRoot = Split-Path -Parent $PSScriptRoot

$files = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_NativeAspectRuntime.c'); Relative = 'Scripts\5_Mission\NIH_NativeAspectRuntime.c' },
	@{ Source = (Join-Path $fixtureRoot 'NIH_NativeAspect_Parity.layout'); Relative = 'gui\layouts\NIH_NativeAspect_Parity.layout' }
)

foreach ($entry in $files) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing source: $($entry.Source)"
	}
	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Destination exists: $target (only use -Overwrite for this test mod)"
	}
}

foreach ($entry in $files) {
	$target = Join-Path $Destination $entry.Relative
	$parent = Split-Path -Parent $target
	if (-not (Test-Path -LiteralPath $parent)) {
		New-Item -ItemType Directory -Path $parent -Force | Out-Null
	}
	Copy-Item -LiteralPath $entry.Source -Destination $target -Force
	Write-Output "Prepared $target"
}

Write-Output 'Stage ready. Build with addon prefix NIH_NativeAspectProbe; do not install in production.'
Write-Output 'Disable all other disposable MissionGameplay probes during this capture.'
