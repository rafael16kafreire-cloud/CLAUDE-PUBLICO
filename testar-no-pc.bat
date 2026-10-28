@echo off
chcp 65001 >nul
title ISLA - testes automaticos
cd /d "%~dp0"
echo.
echo ===== ISLA: testes automaticos no seu PC =====
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Falta o Node.js. Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)
echo [1/3] Instalando as dependencias (so na primeira vez)...
call npm ci
if errorlevel 1 ( echo Erro no npm ci & pause & exit /b 1 )
echo.
echo [2/3] Baixando o navegador de teste (so na primeira vez)...
call npx playwright install chromium
if errorlevel 1 ( echo Erro ao baixar o navegador & pause & exit /b 1 )
echo.
echo [3/3] Rodando os testes. Pode levar alguns minutos...
set GAME_HTML=dist\ilha-primordial.html
node tests\smoke.test.mjs > resultado-testes.txt 2>&1
echo.
echo ===== Terminou =====
findstr /B /C:"FALHOU" resultado-testes.txt
echo.
echo O resultado completo ficou no arquivo resultado-testes.txt (nesta mesma pasta).
echo Me envie esse arquivo aqui no chat.
echo.
pause
