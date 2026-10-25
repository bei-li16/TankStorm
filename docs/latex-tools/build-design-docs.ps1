param([switch]$KeepIntermediate)
$ErrorActionPreference = 'Stop'
$documentWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$documentTempRoot = Join-Path $documentWorkspace 'tmp/design-docs'
$buildWorkspace = Join-Path $documentTempRoot ('build-' + [Guid]::NewGuid().ToString('N'))
$baselinePath = Join-Path $documentWorkspace 'docs/70-architecture-design/generated/baseline.json'
$baseline = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json
$utf8 = [Text.UTF8Encoding]::new($false)
foreach ($sourceFile in $baseline.inventory) {
    $sourcePath = Join-Path $documentWorkspace $sourceFile.path
    $normalizedSource = [IO.File]::ReadAllText($sourcePath).Replace("`r`n", "`n")
    $sourceDigest = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($utf8.GetBytes($normalizedSource))).ToLowerInvariant()
    if ($sourceDigest -ne $sourceFile.sha256) { throw "Source baseline changed: $($sourceFile.path). Update the evidence and review the prose first." }
}
$documentTargets = @(
    @{ Name = 'architecture'; Folder = '70-architecture-design'; Output = 'TankStorm-Architecture-v0.40.0.pdf' },
    @{ Name = 'detailed'; Folder = '71-detailed-design'; Output = 'TankStorm-Detailed-Design-v0.40.0.pdf' }
)
try {
    foreach ($documentTarget in $documentTargets) {
        $sourceRoot = Join-Path $documentWorkspace ('docs/' + $documentTarget.Folder)
        $outputRoot = Join-Path $buildWorkspace $documentTarget.Name
        New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
        Push-Location -LiteralPath $sourceRoot
        try {
            for ($pass = 1; $pass -le 3; $pass++) {
                & xelatex -interaction=nonstopmode -halt-on-error -file-line-error "-output-directory=$outputRoot" main.tex *> (Join-Path $outputRoot ('console-' + $pass + '.txt'))
                if ($LASTEXITCODE -ne 0) { throw "XeLaTeX failed: $sourceRoot. Diagnostics: $outputRoot" }
            }
        } finally { Pop-Location }
        $texLog = Get-Content -LiteralPath (Join-Path $outputRoot 'main.log') -Raw
        if ($texLog -match 'Overfull \\[hv]box|Missing character:|There were undefined references|undefined on input line') {
            throw "PDF layout or glyph validation failed: $sourceRoot. Diagnostics: $outputRoot"
        }
        $finalPath = Join-Path $sourceRoot $documentTarget.Output
        Copy-Item -LiteralPath (Join-Path $outputRoot 'main.pdf') -Destination $finalPath
        [PSCustomObject]@{Document = $documentTarget.Name; Path = $finalPath; Bytes = (Get-Item -LiteralPath $finalPath).Length}
    }
} finally {
    if ((Test-Path -LiteralPath $buildWorkspace) -and -not $KeepIntermediate) {
        $resolvedBuildWorkspace = (Resolve-Path -LiteralPath $buildWorkspace).Path
        $resolvedTempRoot = [IO.Path]::GetFullPath($documentTempRoot).TrimEnd('\')
        if (-not $resolvedBuildWorkspace.StartsWith($resolvedTempRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to remove a build directory outside the designated document temp root.'
        }
        $reparsePoints = @(Get-ChildItem -LiteralPath $resolvedBuildWorkspace -Recurse -Force | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
        if ($reparsePoints.Count -gt 0) { throw 'Refusing to remove a document build containing reparse points.' }
        Remove-Item -LiteralPath $resolvedBuildWorkspace -Recurse -Force
    }
}
