@echo off
title Embryo Forge Hub - Servidor
cd /d "%~dp0embryo-forge-hub-main"
echo Iniciando o projeto na pasta: %CD%
echo.
call npm run dev
pause
