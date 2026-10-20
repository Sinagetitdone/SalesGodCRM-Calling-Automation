@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 from https://nodejs.org/en/download and reopen this file.
  pause
  exit /b 1
)
node "tools\distribution\launcher.mjs" configure
set "bridge_exit=%errorlevel%"
if not "%bridge_exit%"=="0" pause
exit /b %bridge_exit%
