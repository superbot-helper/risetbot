@echo off
setlocal

set "ROOT_DIR=%~dp0.."
set "VENDOR_DIR=%ROOT_DIR%\.vendor"
set "PAGEINDEX_DIR=%VENDOR_DIR%\PageIndex"

if not exist "%VENDOR_DIR%" mkdir "%VENDOR_DIR%"

if exist "%PAGEINDEX_DIR%\pageindex\__init__.py" (
  echo [PageIndex Setup] Repo sudah tersedia di "%PAGEINDEX_DIR%".
  exit /b 0
)

git --version >nul 2>&1
if errorlevel 1 (
  echo [PageIndex Setup] Git tidak ditemukan. Install Git terlebih dahulu.
  exit /b 1
)

echo [PageIndex Setup] Cloning VectifyAI/PageIndex ...
git clone https://github.com/VectifyAI/PageIndex.git "%PAGEINDEX_DIR%"
if errorlevel 1 (
  echo [PageIndex Setup] Gagal clone repository PageIndex.
  exit /b 1
)

echo [PageIndex Setup] Install dependency PageIndex ...
python -m pip install -r "%PAGEINDEX_DIR%\requirements.txt"
if errorlevel 1 (
  echo [PageIndex Setup] Gagal install dependency PageIndex.
  exit /b 1
)

echo [PageIndex Setup] Selesai. Self-hosted PageIndex siap digunakan.
