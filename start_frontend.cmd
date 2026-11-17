@echo off
setlocal
set "ROOT=%~dp0"
set "NODEJS=%ProgramFiles%\nodejs\npm.cmd"
if not exist "%NODEJS%" (
    echo Node.js not found in %ProgramFiles%\nodejs
    echo Install Node.js LTS, then run this script again.
    pause
    exit /b 1
)
cd /d "%ROOT%frontend"
call "%NODEJS%" install
call "%NODEJS%" run dev -- --host 0.0.0.0
endlocal
