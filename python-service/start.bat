@echo off
setlocal

set "SERVICE_NAME=RisetBot Python Service"
set "SERVICE_DIR=%~dp0"
set "RUN_DIR=%SERVICE_DIR%.run"
set "PID_FILE=%RUN_DIR%\python-service.pid"

if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"

if exist "%PID_FILE%" (
  set /p EXISTING_PID=<"%PID_FILE%"
  if defined EXISTING_PID (
    tasklist /FI "PID eq %EXISTING_PID%" | find "%EXISTING_PID%" >nul
    if %errorlevel%==0 (
      echo [%SERVICE_NAME%] sudah berjalan dengan PID %EXISTING_PID%.
      echo Gunakan stop.bat atau restart.bat bila perlu.
      exit /b 0
    )
  )
)

for /f %%I in ('powershell -NoProfile -Command "$p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','uvicorn main:app --reload --port 9000' -WorkingDirectory '%SERVICE_DIR%' -PassThru; $p.Id"') do set "NEW_PID=%%I"

if not defined NEW_PID (
  echo [%SERVICE_NAME%] gagal dijalankan.
  exit /b 1
)

echo %NEW_PID%>"%PID_FILE%"
echo [%SERVICE_NAME%] berjalan di terminal baru. PID: %NEW_PID%
