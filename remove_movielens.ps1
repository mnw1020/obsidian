$ErrorActionPreference = 'Stop'
$root = 'E:\_flashPhone_\_Sync\obsidian\Кино'

Get-ChildItem -LiteralPath $root -Recurse -File -Filter '*.md' | ForEach-Object {
    $path = $_.FullName
    $text = Get-Content -LiteralPath $path -Raw
    $next = [regex]::Replace($text, '(?m)^Прогноз MovieLens:\s*.*\r?\n', '')
    if ($next -ne $text) { Set-Content -LiteralPath $path -Value $next -Encoding utf8 }
}

$files = @(
    "$root\_system\predict_rating.js",
    "$root\_system\predict_all_ratings.js",
    "$root\_system\Examples_Attachments_movies.js",
    "$root\_system\рекомендации.md",
    "$root\_system\_README.md",
    "$root\_system\Проверка сборки.md",
    "$root\_system\Прогноз\README.md",
    "$root\_system\Прогноз\README_Рекомендации_v2.md",
    "$root\_Аналитика прогнозов.md",
    "$root\_Кино.base"
)

# Удаляем строки документации и UI, содержащие MovieLens; рабочие JS дополнительно
# переводим на локальный прогноз, убирая коллаборативную ветку.
foreach ($path in $files) {
    if (!(Test-Path -LiteralPath $path)) { continue }
    $text = Get-Content -LiteralPath $path -Raw
    $text = [regex]::Replace($text, '(?im)^.*movielens.*(?:\r?\n|$)', '')
    Set-Content -LiteralPath $path -Value $text -Encoding utf8
}

Remove-Item -LiteralPath "$root\_system\Прогноз\movielens_neighbors.json" -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath "$root\_system" -File -Filter '*MovieLens*.bat' | Remove-Item -Force

$left = rg -n -i 'movielens|movie lens' $root 2>$null
if ($LASTEXITCODE -eq 0) { Write-Host 'Остались упоминания:'; $left } else { Write-Host 'MovieLens полностью удалён.' }
