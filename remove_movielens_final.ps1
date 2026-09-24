$ErrorActionPreference = 'Stop'
$root = 'E:\_flashPhone_\_Sync\obsidian\Кино'

# Удалить MovieLens и старые отдельные прогнозные поля из YAML карточек.
Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.md' | ForEach-Object {
    $p = $_.FullName
    $s = Get-Content -LiteralPath $p -Raw
    $n = [regex]::Replace($s, '(?m)^(Прогноз MovieLens|Прогноз локальный|Прогноз метод):\s*.*\r?\n', '')
    if ($n -ne $s) { Set-Content -LiteralPath $p -Value $n -Encoding utf8 }
}

# В аналитике удаляется весь источник таблицы, а не только его строка.
$analytics = "$root\_Аналитика прогнозов.md"
if (Test-Path -LiteralPath $analytics) {
    $s = Get-Content -LiteralPath $analytics -Raw
    $s = [regex]::Replace($s, '(?ms)^// --- Method comparison ---.*?^// --- Biggest misses ---', '// --- Biggest misses ---')
    $s = [regex]::Replace($s, '(?m)^\s*const (localPred|mlPred|withLocal|withML)\s*=.*\r?\n', '')
    Set-Content -LiteralPath $analytics -Value $s -Encoding utf8
}

# Удалить оставшийся интерфейс MovieLens в рекомендациях и документации.
Get-ChildItem -LiteralPath "$root\_system" -Recurse -File | Where-Object { $_.Extension -in '.md','.js','.py','.bat' } | ForEach-Object {
    $p = $_.FullName
    $s = Get-Content -LiteralPath $p -Raw
    $n = [regex]::Replace($s, '(?im)^.*movielens.*(?:\r?\n|$)', '')
    if ($n -ne $s) { Set-Content -LiteralPath $p -Value $n -Encoding utf8 }
}

Remove-Item -LiteralPath "$root\_system\Прогноз\movielens_neighbors.json" -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath "$root\_system" -Recurse -File -Filter '*MovieLens*.bat' | Remove-Item -Force -ErrorAction SilentlyContinue

$left = rg -n -i 'movielens|movie lens|Прогноз локальный|Прогноз метод' $root 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host $left } else { Write-Host 'Очистка завершена: упоминаний не найдено.' }
