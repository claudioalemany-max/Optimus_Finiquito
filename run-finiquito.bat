@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Chile Labor Termination — Navegador

call "%~dp0scripts\find-node.bat"
if errorlevel 1 (
  echo.
  echo Instala Node.js desde https://nodejs.org/
  pause
  exit /b 1
)

if not defined NODE (
  echo No se detecto Node.js.
  pause
  exit /b 1
)

if not exist "node_modules\typescript\lib\tsc.js" (
  echo Instalando dependencias...
  if defined NPM (
    call "%NPM%" install
  ) else (
    echo Instala Node.js LTS completo con npm.
    pause
    exit /b 1
  )
)

echo Compilando...
"%NODE%" "%~dp0node_modules\typescript\lib\tsc.js" -p "%~dp0tsconfig.json"
if errorlevel 1 (
  echo Error al compilar.
  pause
  exit /b 1
)

echo.
echo Iniciando aplicacion web...
echo URL: http://127.0.0.1:3847/
echo.
echo El navegador se abrira automaticamente cuando el servidor este listo.
echo Cierra esta ventana para detener el servidor.
echo.

rem Cerrar servidor antiguo si no expone la API unificada
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-fresh-server.ps1"

rem Abrir navegador en segundo plano (metodo nativo de Windows)
start "FiniquitoBrowser" /min cmd /c "call "%~dp0scripts\wait-and-open-browser.bat" "http://127.0.0.1:3847/""

"%NODE%" "%~dp0dist\cli\serve.js"
set "SERVE_EXIT=%ERRORLEVEL%"

if %SERVE_EXIT% neq 0 (
  echo.
  echo El servidor termino con error.
  call "%~dp0scripts\open-browser.bat" "http://127.0.0.1:3847/"
  pause
  exit /b %SERVE_EXIT%
)
