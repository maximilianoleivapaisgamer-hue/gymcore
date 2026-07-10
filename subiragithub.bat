@echo off
chcp 65001 >nul
title GymCore - Subir a GitHub
cd /d "%~dp0"

echo ============================================
echo   GymCore - Subiendo el proyecto a GitHub
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No tenes Git instalado en Windows.
  echo Instalalo desde https://git-scm.com/download/win  ^(Next, Next, Install^)
  echo y despues volve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b
)

git rev-parse --git-dir >nul 2>&1 || git init
git add -A
git commit -m "GymCore: primera version" >nul 2>&1
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin https://github.com/maximilianoleivapaisgamer-hue/gymcore.git

echo Subiendo... (si se abre una ventana de GitHub, aprueba el acceso)
echo.
git push -u origin main

echo.
if errorlevel 1 (
  echo [!] Algo fallo. Copiame el texto de arriba y lo resolvemos.
) else (
  echo ============================================
  echo   LISTO! El codigo ya esta en GitHub.
  echo   Volve al chat y escribime: listo
  echo ============================================
)
echo.
pause
