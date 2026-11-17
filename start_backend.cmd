@echo off
setlocal
set "ROOT=%~dp0"
set "PYTHON=%ROOT%.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo Virtual environment not found at %ROOT%.venv\Scripts\python.exe
    echo Creating it now...
    py -3 -m venv "%ROOT%.venv"
    if errorlevel 1 (
        echo Failed to create Python virtual environment.
        pause
        exit /b 1
    )
    set "PYTHON=%ROOT%.venv\Scripts\python.exe"
)
cd /d "%ROOT%backend"
"%PYTHON%" -m pip install --quiet -r requirements.txt
"%PYTHON%" run.py
endlocal
