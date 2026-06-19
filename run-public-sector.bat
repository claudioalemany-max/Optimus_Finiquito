@echo off
setlocal EnableExtensions
cd /d "%~dp0"

call "%~dp0scripts\find-node.bat"
if errorlevel 1 (
  pause
  exit /b 1
)

if not defined NODE (
  echo No se detecto Node.js.
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

"%NODE%" "%~dp0dist\cli\calculate.js" "%~dp0examples\public_sector_case.json"
call "%~dp0scripts\post-run-menu.bat"
exit /b 0
