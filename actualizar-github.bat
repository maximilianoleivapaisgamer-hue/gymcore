@echo off
chcp 65001 >nul
title turnogym - Actualizar y subir a GitHub
cd /d "%~dp0"

echo ============================================
echo   turnogym - Sincronizando con GitHub
echo   Cuenta: maximilianoleivapaisgamer-hue
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

REM --- Multi-cuenta: guarda la credencial POR repositorio (no una sola para todo github.com) ---
git config --global credential.useHttpPath true

REM --- Fija el remoto CON el usuario adelante, asi Git sabe con que cuenta subir ---
git remote get-url origin >nul 2>&1 || git remote add origin https://maximilianoleivapaisgamer-hue@github.com/maximilianoleivapaisgamer-hue/gymcore.git
git remote set-url origin https://maximilianoleivapaisgamer-hue@github.com/maximilianoleivapaisgamer-hue/gymcore.git

echo Guardando tus cambios locales...
git add -A
git commit -m "Cambios turnogym" >nul 2>&1

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
