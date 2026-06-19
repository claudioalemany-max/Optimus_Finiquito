@echo off
rem Opens a URL or local file in the default browser (Windows).
setlocal EnableExtensions
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=http://127.0.0.1:3847/"

rem 1) Native Windows start — most reliable when launched from a .bat double-click
start "" "%TARGET%"
if %ERRORLEVEL% equ 0 exit /b 0

rem 2) rundll32 handler
rundll32 url.dll,FileProtocolHandler "%TARGET%"
if %ERRORLEVEL% equ 0 exit /b 0

rem 3) PowerShell fallback
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process '%TARGET%'"
exit /b %ERRORLEVEL%
