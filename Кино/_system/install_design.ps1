[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$vaultRoot = (Resolve-Path -LiteralPath (Join-Path $projectRoot '..')).Path
$configRoot = (Resolve-Path -LiteralPath (Join-Path $vaultRoot '.obsidian')).Path
$snippetRoot = (Resolve-Path -LiteralPath (Join-Path $configRoot 'snippets')).Path
$sourceFile = Join-Path $PSScriptRoot 'kino-design.css'
$targetFile = Join-Path $snippetRoot 'kino-design.css'
$appearanceFile = Join-Path $configRoot 'appearance.json'
if ($configRoot -ne (Join-Path $vaultRoot '.obsidian') -or $snippetRoot -ne (Join-Path $configRoot 'snippets')) {
    throw 'Unexpected Obsidian configuration directory.'
}
if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw 'Design stylesheet is not ready.' }
$appearance = Get-Content -LiteralPath $appearanceFile -Raw | ConvertFrom-Json -AsHashtable
$enabled = @($appearance.enabledCssSnippets)
if ($CheckOnly) {
    $same = (Test-Path -LiteralPath $targetFile) -and ((Get-FileHash -LiteralPath $sourceFile).Hash -eq (Get-FileHash -LiteralPath $targetFile).Hash)
    [pscustomobject]@{ SnippetInstalled = $same; SnippetEnabled = ($enabled -contains 'kino-design'); Target = $targetFile } | ConvertTo-Json -Compress
    exit
}
Copy-Item -LiteralPath $sourceFile -Destination $targetFile
if ($enabled -notcontains 'kino-design') {
    $appearance.enabledCssSnippets = @($enabled) + @('kino-design')
    $appearance | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $appearanceFile -Encoding utf8NoBOM
}
$check = Get-Content -LiteralPath $appearanceFile -Raw | ConvertFrom-Json -AsHashtable
if (@($check.enabledCssSnippets) -notcontains 'kino-design') { throw 'Snippet did not become enabled.' }
if ((Get-FileHash -LiteralPath $sourceFile).Hash -ne (Get-FileHash -LiteralPath $targetFile).Hash) { throw 'Installed CSS differs from project source.' }
[pscustomobject]@{ SnippetInstalled = $true; SnippetEnabled = $true; Target = $targetFile } | ConvertTo-Json -Compress
