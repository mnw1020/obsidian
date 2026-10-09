@echo off
chcp 65001 >nul
cls

set CONFIG_PATH=C:\Users\Mindwork\Downloads\config.toml
set MODEL=free-gpt-6-astra

REM Alternative models (uncomment if needed):
REM set MODEL=claude-opus-5.5
REM set MODEL=gpt-5.5
REM set MODEL=gpt-5.6-luna
REM set MODEL=gpt-6-astra
REM set MODEL=gemini-3.8-flash
REM set MODEL=deepseek-v4-pro
REM set MODEL=claude-sonnet-5.5

echo Starting ChatGPT with Tokenator settings...
echo Model: %MODEL%
echo Config: %CONFIG_PATH%
echo.

REM Check where chatgpt command is installed
where chatgpt 2>nul
if %errorlevel% neq 0 (
    echo ERROR: chatgpt command not found!
    echo.
    echo Please install it first:
    echo   npm install -g @openai/chatgpt-cli
    echo or
    echo   pip install chatgpt-cli
    pause
    exit /b 1
)

chatgpt --config "%CONFIG_PATH%" --model "%MODEL%" %*

pause
