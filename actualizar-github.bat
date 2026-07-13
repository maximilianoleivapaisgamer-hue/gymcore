@echo off
chcp 65001 >nul
title GymCore - Actualizar y subir a GitHub
cd /d "%~dp0"

echo ============================================
echo   GymCore - Sincronizando con GitHub
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No tenes Git instalado en Windows.
  echo Instalalo desde https://git-scm.com/download/win
  echo y despues volve a hacer doble clic en este archivo.
  echo.
  pause
  exit /b
)

git rev-parse --git-dir >nul 2>&1 || git init
git branch -M main >nul 2>&1
git remote get-url origin >nul 2>&1 || git remote add origin https://github.com/maximilianoleivapaisgamer-hue/gymcore.git

echo Guardando tus cambios locales...
git add -A
git commit -m "Cambios GymCore" >nul 2>&1

echo Bajando lo que hay en GitHub (landing, etc.)...
git pull origin main --no-edit

echo Subiendo todo a GitHub...
git push origin main

echo.
if errorlevel 1 (
  echo [!] Algo fallo. Copiame el texto de arriba y lo resolvemos.
) else (
  echo ============================================
  echo   LISTO! Ya esta todo en GitHub.
  echo ============================================
)
echo.
pause
