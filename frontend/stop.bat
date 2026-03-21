@echo off
setlocal

set "SERVICE_NAME=RisetBot Frontend"
set "SERVICE_DIR=%~dp0"
set "PID_FILE=%SERVICE_DIR%.run\frontend.pid"

if not exist "%PID_FILE%" (
  echo [%SERVICE_NAME%] tidak ditemukan PID file. Kemungkinan service belum berjalan.
  exit /b 0
)

set /p TARGET_PID=<"%PID_FILE%"
if not defined TARGET_PID (
  echo [%SERVICE_NAME%] PID file kosong.
  del "%PID_FILE%" >nul 2>&1
  exit /b 1
)

tasklist /FI "PID eq %TARGET_PID%" | find "%TARGET_PID%" >nul
if not %errorlevel%==0 (
  echo [%SERVICE_NAME%] proses dengan PID %TARGET_PID% tidak aktif.
  del "%PID_FILE%" >nul 2>&1
  exit /b 0
)

taskkill /PID %TARGET_PID% /T /F >nul
if %errorlevel%==0 (
  echo [%SERVICE_NAME%] berhasil dihentikan. PID: %TARGET_PID%
  del "%PID_FILE%" >nul 2>&1
  exit /b 0
)

echo [%SERVICE_NAME%] gagal menghentikan proses PID %TARGET_PID%.
exit /b 1
