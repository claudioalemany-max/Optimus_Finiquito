@echo off
setlocal EnableExtensions

set "HTML="
set "REPORT="
set "FULL="
set "CALC="
set "CASE_ID="

if not exist "%~dp0..\output\last-run.txt" goto :no_last_run

for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0..\output\last-run.txt") do (
  if /i "%%a"=="html" set "HTML=%%b"
  if /i "%%a"=="report" set "REPORT=%%b"
  if /i "%%a"=="full" set "FULL=%%b"
  if /i "%%a"=="calculation" set "CALC=%%b"
  if /i "%%a"=="case_id" set "CASE_ID=%%b"
)

:no_last_run
:menu
echo.
echo ========================================
echo   Calculo completado
if defined CASE_ID echo   Caso: %CASE_ID%
echo ========================================
echo.
echo   [1] Abrir reporte HTML (navegador)
echo   [2] Abrir reporte JSON
echo   [3] Abrir calculo completo
echo   [4] Abrir carpeta output
echo   [5] Ejecutar otro caso
echo   [6] Salir
echo.
set /p OPCION="Elige una opcion (1-6): "

if "%OPCION%"=="1" goto :open_html
if "%OPCION%"=="2" goto :open_report
if "%OPCION%"=="3" goto :open_full
if "%OPCION%"=="4" goto :open_folder
if "%OPCION%"=="5" goto :run_again
if "%OPCION%"=="6" goto :exit_ok

echo Opcion no valida.
goto :menu

:open_html
if not defined HTML (
  echo No hay reporte HTML disponible.
  goto :menu
)
call "%~dp0open-browser.bat" "%HTML%"
goto :menu

:open_report
if not defined REPORT (
  echo No hay reporte JSON disponible.
  goto :menu
)
start "" "%REPORT%"
goto :menu

:open_full
if not defined FULL (
  echo No hay archivo completo disponible.
  goto :menu
)
start "" "%FULL%"
goto :menu

:open_folder
start "" "%~dp0..\output"
goto :menu

:run_again
exit /b 2

:exit_ok
exit /b 0
