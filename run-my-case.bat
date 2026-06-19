@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Chile Finiquito - Caso personalizado

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

if not exist "dist\cli\calculate.js" (
  if not exist "node_modules\typescript\lib\tsc.js" (
    if defined NPM call "%NPM%" install
  )
  "%NODE%" "%~dp0node_modules\typescript\lib\tsc.js" -p "%~dp0tsconfig.json"
)

set "CASE_FILE=%~1"
if "%CASE_FILE%"=="" (
  set /p CASE_FILE="Ruta al archivo JSON del caso: "
)

if not exist "%CASE_FILE%" (
  echo Archivo no encontrado: %CASE_FILE%
  pause
  exit /b 1
)

"%NODE%" "%~dp0dist\cli\calculate.js" "%CASE_FILE%"
call "%~dp0scripts\post-run-menu.bat"
exit /b 0
