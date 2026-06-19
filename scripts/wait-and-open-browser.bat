@echo off
rem Waits for the local server, then opens the default browser.
setlocal EnableExtensions
set "URL=%~1"
if "%URL%"=="" set "URL=http://127.0.0.1:3847/"
set "TRIES=0"

:wait_loop
set /a TRIES+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 1).StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% equ 0 goto :open_browser
if %TRIES% geq 30 goto :open_browser
ping 127.0.0.1 -n 2 >nul
goto :wait_loop

:open_browser
call "%~dp0open-browser.bat" "%URL%"
exit /b 0
