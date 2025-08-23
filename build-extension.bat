@echo off
echo ========================================
echo    Cogix Browser Extension Builder
echo ========================================
echo.

REM Check if node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/4] Generating icons...
call npm run generate:icons
REM Icon generation might fail if canvas is not installed, but we can continue

echo.
echo [3/4] Building extension...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo.
echo [4/4] Build complete!
echo.
echo ========================================
echo    Extension built successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Open Chrome and go to: chrome://extensions/
echo 2. Enable "Developer mode" (top right)
echo 3. Click "Load unpacked"
echo 4. Select the "dist" folder from this directory
echo.
echo The extension is ready in: %cd%\dist
echo.
pause