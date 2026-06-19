@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

call "%~dp0find-node.bat"
if errorlevel 1 (
  echo Instala Node.js desde https://nodejs.org/
  pause
  exit /b 1
)

"%NODE%" "%~dp0create-and-push-github.mjs" Optimus_Finiquito claudioalemany-max
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 pause
exit /b %EXIT_CODE%
