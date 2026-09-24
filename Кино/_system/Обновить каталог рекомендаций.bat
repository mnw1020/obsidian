@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 goto :use_py

where python >nul 2>nul
if not errorlevel 1 goto :use_python

echo Python 3 was not found.
echo Install Python 3 and enable the Python Launcher or add Python to PATH.
set "RC=9009"
goto :done

:use_py
set "RC=%ERRORLEVEL%"
goto :done

:use_python
set "RC=%ERRORLEVEL%"
goto :done

:done
echo.
if not "%RC%"=="0" echo Recommendation catalog update FAILED. Exit code: %RC%
if "%RC%"=="0" echo Recommendation catalog updated successfully.
echo.
pause
exit /b %RC%
