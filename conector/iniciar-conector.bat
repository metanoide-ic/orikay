@echo off
title Conector Orikay
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao foi encontrado.
  echo  Instale em https://nodejs.org e abra este arquivo de novo.
  echo.
  pause
  exit /b
)
start "" http://localhost:8787
node conector.mjs
pause
