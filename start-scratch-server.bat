@echo off
echo 🚀 Starting Scratch Editor Server...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo 💡 Please install Python from https://python.org
    echo.
    pause
    exit /b 1
)

echo ✅ Python found
echo 📁 Current directory: %CD%
echo 🌐 Starting server on port 8080...
echo.

REM Start the Python server
python serve-scratch.py

echo.
echo 🛑 Server stopped
pause
