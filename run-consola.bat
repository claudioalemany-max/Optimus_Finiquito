@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Chile Finiquito — Consola

call "%~dp0scripts\find-node.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

if not defined NODE (
  pause
  exit /b 1
)

if not exist "node_modules\typescript\lib\tsc.js" (
  if defined NPM call "%NPM%" install
)

"%NODE%" "%~dp0node_modules\typescript\lib\tsc.js" -p "%~dp0tsconfig.json"
if errorlevel 1 (
  pause
  exit /b 1
)

set "CASE_FILE=%~1"
if "%CASE_FILE%"=="" set "CASE_FILE=%~dp0examples\employer_case_private_art161.json"

"%NODE%" "%~dp0dist\cli\calculate.js" "%CASE_FILE%"
call "%~dp0scripts\post-run-menu.bat"
exit /b 0
