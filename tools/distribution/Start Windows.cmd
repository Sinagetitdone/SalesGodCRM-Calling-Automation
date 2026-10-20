@echo off
setlocal
cd /d "%~dp0"
call "tools\distribution\ensure-node-windows.cmd"
if errorlevel 1 (
  pause
  exit /b 1
)
node "tools\distribution\launcher.mjs" start
set "bridge_exit=%errorlevel%"
if not "%bridge_exit%"=="0" pause
exit /b %bridge_exit%
