@echo off
REM Build script for the ML Extension (Windows)
REM This script builds both the scratch-vm (with extension) and scratch-gui

echo 🚀 Building ML Extension for Scratch...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the scratch-editor directory
    pause
    exit /b 1
)

if not exist "packages" (
    echo ❌ Error: Please run this script from the scratch-editor directory
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Build scratch-vm (includes the extension)
echo 🔧 Building scratch-vm...
cd packages\scratch-vm
call npm run build

if %errorlevel% neq 0 (
    echo ❌ Error: Failed to build scratch-vm
    pause
    exit /b 1
)

echo ✅ scratch-vm built successfully

REM Build scratch-gui
echo 🎨 Building scratch-gui...
cd ..\scratch-gui
call npm run build

if %errorlevel% neq 0 (
    echo ❌ Error: Failed to build scratch-gui
    pause
    exit /b 1
)

echo ✅ scratch-gui built successfully

REM Return to root
cd ..\..

echo.
echo 🎉 ML Extension build completed successfully!
echo.
echo To test the extension:
echo 1. Open test-ml-extension.html in your browser
echo 2. Or start the development server: cd packages\scratch-gui ^&^& npm start
echo.
echo Make sure your backend API is running and accessible!
pause
