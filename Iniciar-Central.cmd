@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado no PATH.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

echo Iniciando frontend + API e abrindo o navegador...
echo.
call npm run dev:open

if errorlevel 1 (
  echo.
  echo O processo foi encerrado com erro.
  pause
)
