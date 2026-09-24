@echo off
setlocal
cd /d "%~dp0"
echo Updating compact MovieLens recommendation catalog...
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "build_movielens_model.py" --catalog-only
) else (
  python "build_movielens_model.py" --catalog-only
)
if errorlevel 1 (
  echo.
  echo FAILED. See the error above.
) else (
  echo.
  echo Recommendation catalog updated successfully.
)
pause
