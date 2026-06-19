@echo off
rem Sets NODE and NPM for the caller. Do not use setlocal here.

set "NODE="
set "NPM="

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
  for /f "delims=" %%i in ('where node 2^>nul') do (
    if /i "%%~nxi"=="node.exe" (
      set "NODE=%%~fi"
      goto :found_node
    )
  )
)

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE=%ProgramFiles%\nodejs\node.exe"
  set "NPM=%ProgramFiles%\nodejs\npm.cmd"
  goto :found_node
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
  set "NPM=%ProgramFiles(x86)%\nodejs\npm.cmd"
  goto :found_node
)

if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
  set "NODE=%LOCALAPPDATA%\Programs\node\node.exe"
  set "NPM=%LOCALAPPDATA%\Programs\node\npm.cmd"
  goto :found_node
)

if exist "%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe" (
  set "NODE=%LOCALAPPDATA%\Programs\cursor\resources\app\resources\helpers\node.exe"
  goto :found_node
)

echo Node.js no encontrado en PATH.
exit /b 1

:found_node
if not defined NPM (
  where npm >nul 2>&1
  if %ERRORLEVEL% equ 0 (
    for /f "delims=" %%i in ('where npm 2^>nul') do (
      if /i "%%~nxi"=="npm.cmd" (
        set "NPM=%%~fi"
        goto :done
      )
    )
  )
)

:done
if not defined NODE (
  echo Node.js no encontrado.
  exit /b 1
)

exit /b 0
