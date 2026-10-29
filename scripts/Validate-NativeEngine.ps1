<#
.SYNOPSIS
  Validate native-derived layout and image behavior using local Node/npm only.

.DESCRIPTION
  Runs the project's existing TypeScript build and geometry, grid, image,
  SDF and imageset tests without using GitHub Actions minutes. The script
  preserves each log and writes a ZIP that can be uploaded for review.
  It does not commit, merge, deploy or modify Git configuration.

.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Validate-NativeEngine.ps1
.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Validate-NativeEngine.ps1 -InstallDependencies
#>
[CmdletBinding()]
param(
    [switch]$InstallDependencies
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)
if ($null -eq $npm) {
    $npm = Get-Command npm -ErrorAction Stop
}
$node = Get-Command node -ErrorAction Stop
$git = Get-Command git -ErrorAction Stop
$outputRoot = Join-Path $env:USERPROFILE "Documents\NIH-Workbench-Native"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $outputRoot "native-engine-validation-$stamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
$summary = New-Object 'System.Collections.Generic.List[object]'
$anyFailed = $false

function Run-NpmStep {
    param([Parameter(Mandatory=$true)][string]$Step)
    $safe = $Step.Replace(":", "-")
    $logFile = Join-Path $runDir "$safe.log"
    Write-Host ""
    Write-Host ("=== npm run " + $Step + " ===")
    $global:LASTEXITCODE = 0
    $stepErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $npm.Source run $Step 2>&1 | Out-File -FilePath $logFile -Encoding UTF8
        $exitCode = $LASTEXITCODE
    }
    catch {
        $exitCode = 1
        Add-Content -Path $logFile -Value ("PowerShell invocation error: " + $_.Exception.Message)
    }
    finally {
        $ErrorActionPreference = $stepErrorPreference
    }
    if ($null -eq $exitCode) {
        $exitCode = 1
    }
    Get-Content -Path $logFile -Tail 18
    $status = "PASS"
    if ($exitCode -ne 0) {
        $status = "FAIL"
        $script:anyFailed = $true
    }
    $summary.Add([pscustomobject]@{
        Step = $Step
        Status = $status
        ExitCode = $exitCode
        Log = Split-Path -Leaf $logFile
    })
    Write-Host ("[" + $status + "] " + $Step)
}

Push-Location $repoRoot
try {
    $branch = (& $git.Source branch --show-current | Select-Object -First 1)
    $revision = (& $git.Source rev-parse HEAD | Select-Object -First 1)
    $nodeVersion = (& $node.Source --version | Select-Object -First 1)
    [pscustomobject]@{
        Branch = $branch
        Commit = $revision
        NodeVersion = $nodeVersion
        CapturedAt = (Get-Date).ToString("o")
        Repo = $repoRoot
    } | ConvertTo-Json | Set-Content -Path (Join-Path $runDir "environment.json") -Encoding UTF8

    if ($branch -ne "research/native-engine-consolidation") {
        Write-Warning ("Expected research/native-engine-consolidation, found " + $branch + ".")
        Write-Warning "Tests will still run, but may not cover the intended research changes."
    }

    if ($InstallDependencies) {
        $logFile = Join-Path $runDir "npm-ci.log"
        Write-Host "=== npm ci ==="
        $global:LASTEXITCODE = 0
        & $npm.Source ci 2>&1 | Out-File -FilePath $logFile -Encoding UTF8
        if ($LASTEXITCODE -ne 0) {
            throw ("npm ci failed. See " + $logFile)
        }
    }

    # Run all checks rather than stop at the first test failure.
    foreach ($step in @(
        "typecheck",
        "test:geometry-engine",
        "test:native-image-uv",
        "test:grid-layout",
        "test:imageset",
        "test:sdf-preview",
        "build"
    )) {
        Run-NpmStep -Step $step
    }
}
catch {
    $anyFailed = $true
    $_.Exception.ToString() | Set-Content -Path (Join-Path $runDir "launcher-error.txt") -Encoding UTF8
    Write-Warning $_.Exception.Message
}
finally {
    Pop-Location
    $summary | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $runDir "summary.json") -Encoding UTF8
    $zipPath = Join-Path $outputRoot "NIH_Native_Engine_Validation_$stamp.zip"
    Compress-Archive -Path (Join-Path $runDir "*") -DestinationPath $zipPath -Force
    Write-Host ""
    Write-Host ("Results: " + $zipPath)
    $summary | Format-Table -AutoSize
}

if ($anyFailed) {
    exit 1
}
exit 0
