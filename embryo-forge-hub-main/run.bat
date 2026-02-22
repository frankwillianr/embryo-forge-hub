@echo off
title Embryo Forge Hub - Servidor
cd /d "%~dp0"
echo Iniciando o projeto em: %CD%
echo.
echo Quando aparecer "Local: http://localhost:..." abra esse endereco no navegador.
echo.
call npm run dev
pause
