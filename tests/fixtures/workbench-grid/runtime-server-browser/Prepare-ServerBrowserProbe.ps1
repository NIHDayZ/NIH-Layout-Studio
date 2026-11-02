# Stage a disposable client-only probe using the user's own local vanilla layout.
# PowerShell 5.1. The vanilla source is never added to the Git repository.
[CmdletBinding()]
param(
	[string]$Destination = 'P:\NIH_ServerBrowserGeometryProbe',
	[string]$SourceLayout = 'P:\gui\layouts\new_ui\server_browser\pc\server_browser_tab_pages.layout',
	[switch]$Overwrite
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SourceLayout -PathType Leaf)) {
	throw "Missing local vanilla layout: $SourceLayout"
}

$sourceFiles = @(
	@{ Source = (Join-Path $PSScriptRoot 'config.cpp'); Relative = 'config.cpp' },
	@{ Source = (Join-Path $PSScriptRoot 'NIH_ServerBrowserGeometryRuntime.c'); Relative = 'Scripts\5_Mission\NIH_ServerBrowserGeometryRuntime.c' },
	@{ Source = $SourceLayout; Relative = 'gui\layouts\server_browser_tab_pages.layout' }
)

foreach ($entry in $sourceFiles) {
	if (-not (Test-Path -LiteralPath $entry.Source -PathType Leaf)) {
		throw "Missing probe source: $($entry.Source)"
	}

	$target = Join-Path $Destination $entry.Relative
	if ((Test-Path -LiteralPath $target) -and -not $Overwrite) {
		throw "Target exists: $target (use -Overwrite only for this disposable probe)"
	}
}

foreach ($entry in $sourceFiles) {
	$target = Join-Path $Destination $entry.Relative
	$parent = Split-Path -Parent $target
	New-Item -ItemType Directory -Path $parent -Force | Out-Null
	Copy-Item -LiteralPath $entry.Source -Destination $target -Force
	Write-Output "Staged $target"
}

Write-Output 'Ready to pack NIH_ServerBrowserGeometryProbe. The local vanilla source stays outside Git.'
