@echo off
title Interview Simulator
cd /d "%~dp0backend"

if not exist ".env" (
    echo.
    echo  [ERROR] .env not found.
    echo  Please copy .env.example to backend\.env and fill in your ANTHROPIC_API_KEY.
    echo.
    pause
    exit /b 1
)

if not exist "venv" (
    echo  Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo  Installing dependencies...
pip install -r requirements.txt -q

echo.
echo  ================================================
echo   Interview Simulator running at:
echo   http://localhost:8000
echo  ================================================
echo   Press Ctrl+C to stop
echo.

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
