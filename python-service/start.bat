@echo off
setlocal EnableDelayedExpansion

set "SERVICE_NAME=RisetBot Python Service"
set "SERVICE_DIR=%~dp0"
set "RUN_DIR=%SERVICE_DIR%.run"
set "PID_FILE=%RUN_DIR%\python-service.pid"
set "UPLOAD_DIR=%SERVICE_DIR%uploads"
set "REPORT_DIR=%SERVICE_DIR%reports"
set "TEMPLATE_DIR=%SERVICE_DIR%templates"
set "VENV_PYTHON=%SERVICE_DIR%\.venv\Scripts\python.exe"
set "ROOT_VENV_PYTHON=%SERVICE_DIR%..\.venv\Scripts\python.exe"
set "PYTHON_EXE="
set "PYTHON_ARGS="

if not exist "%RUN_DIR%" mkdir "%RUN_DIR%"

if exist "%VENV_PYTHON%" (
  set "PYTHON_EXE=%VENV_PYTHON%"
) else (
  where py >nul 2>&1
  if not errorlevel 1 (
    set "PYTHON_EXE=py"
    set "PYTHON_ARGS=-3.11"
  ) else (
    where python >nul 2>&1
    if not errorlevel 1 (
      set "PYTHON_EXE=python"
    ) else (
      if exist "%ROOT_VENV_PYTHON%" (
        set "PYTHON_EXE=%ROOT_VENV_PYTHON%"
      )
    )
  )
)

if not defined PYTHON_EXE (
  echo [%SERVICE_NAME%] Python tidak ditemukan.
  echo Install Python atau siapkan virtual environment di "%SERVICE_DIR%\.venv".
  exit /b 1
)

"%PYTHON_EXE%" %PYTHON_ARGS% -c "import fitz, paddleocr" >nul 2>&1
if errorlevel 1 (
  echo [%SERVICE_NAME%] Dependency OCR belum lengkap pada interpreter aktif.
  echo Jalankan: "%PYTHON_EXE%" %PYTHON_ARGS% -m pip install -r "%SERVICE_DIR%requirements.txt"
  exit /b 1
)

if exist "%PID_FILE%" (
  set /p EXISTING_PID=<"%PID_FILE%"
  findstr /R "^[0-9][0-9]*$" "%PID_FILE%" >nul
  if errorlevel 1 set "EXISTING_PID="
  if defined EXISTING_PID if not "!EXISTING_PID!"=="" (
    tasklist /FI "PID eq !EXISTING_PID!" | findstr /R /C:"[ ]!EXISTING_PID![ ]" >nul
    if not errorlevel 1 (
      echo [%SERVICE_NAME%] sudah berjalan dengan PID !EXISTING_PID!.
      echo Gunakan stop.bat atau restart.bat bila perlu.
      exit /b 0
    )
  )
)

for /f %%I in ('powershell -NoProfile -Command "$args = @(); if ('%PYTHON_ARGS%' -ne '') { $args += '%PYTHON_ARGS%' }; $args += @('-m','uvicorn','main:app','--reload','--port','9000'); $p = Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList $args -WorkingDirectory '%SERVICE_DIR%' -PassThru; $p.Id"') do set "NEW_PID=%%I"

if not defined NEW_PID (
  echo [%SERVICE_NAME%] gagal dijalankan.
  echo Pastikan dependency sudah terpasang: pip install -r requirements.txt
  exit /b 1
)

echo !NEW_PID!>"%PID_FILE%"
echo [%SERVICE_NAME%] berjalan di terminal baru. PID: !NEW_PID!
