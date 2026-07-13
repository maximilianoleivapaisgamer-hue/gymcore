@echo off
chcp 65001 >nul
title GymCore - Sincronizar carpeta con GitHub
cd /d "%~dp0"

echo ============================================
echo   Dejar tu carpeta IDENTICA a GitHub
echo ============================================
echo.
echo Esto baja todo lo que falta y deja la carpeta completa y al dia.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No tenes Git instalado. Bajalo de https://git-scm.com/download/win
  pause
  exit /b
)

git rev-parse --git-dir >nul 2>&1 || git init
git remote get-url origin >nul 2>&1 || git remote add origin https://github.com/maximilianoleivapaisgamer-hue/gymcore.git

echo Bajando lo ultimo de GitHub...
git fetch origin
git reset --hard origin/main

echo.
echo ============================================
echo   LISTO! Tu carpeta quedo igual a GitHub.
echo   Volve al chat y escribime: listo
echo ============================================
echo.
pause
