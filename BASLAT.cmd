@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 veya daha yeni bir surum gerekli: https://nodejs.org/
  pause
  exit /b 1
)
echo Tarayicida http://127.0.0.1:4173/haritalar/ adresini acin.
echo Durdurmak icin Ctrl+C kullanin.
node outputs/zerozone-haritalar/server.cjs
pause
