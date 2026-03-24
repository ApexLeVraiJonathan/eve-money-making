@echo off
setlocal

REM Run from this script directory.
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Prefer project virtualenv Python, fallback to system python.
set "PYTHON_EXE="
if exist "%SCRIPT_DIR%\.venv312\Scripts\python.exe" set "PYTHON_EXE=%SCRIPT_DIR%\.venv312\Scripts\python.exe"
if "%PYTHON_EXE%"=="" if exist "%SCRIPT_DIR%\.venv\Scripts\python.exe" set "PYTHON_EXE=%SCRIPT_DIR%\.venv\Scripts\python.exe"
if "%PYTHON_EXE%"=="" set "PYTHON_EXE=python"

echo Using Python: %PYTHON_EXE%
echo Running: undercut_reprice_automation.py --run-mode scheduled %*

"%PYTHON_EXE%" "%SCRIPT_DIR%undercut_reprice_automation.py" --run-mode scheduled %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Script failed with exit code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
