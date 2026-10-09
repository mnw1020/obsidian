@echo off
chcp 65001 >nul

set CODEX_CONFIG=C:\Users\Mindwork\Downloads\config.toml
set MODEL=free-gpt-6-astra

REM Launch Codex GUI with environment variables
start "" "C:\Users\Mindwork\AppData\Local\OpenAI\Codex\bin\9691020b546a15b2\codex.exe" app
