@echo off
echo ========================================
echo   Cogix Extension Debug Mode
echo ========================================
echo.

echo Starting development build with watch mode...
echo.

REM Build once with dev config
echo [1/3] Building development version...
call npm run dev:build
if %errorlevel% neq 0 (
    echo ERROR: Failed to build development version
    pause
    exit /b 1
)

echo.
echo [2/3] Development build complete!
echo.
echo ========================================
echo   Extension ready for debugging!
echo ========================================
echo.
echo Load the extension in Chrome:
echo 1. Open chrome://extensions/
echo 2. Enable "Developer mode" (top right)
echo 3. Click "Load unpacked"
echo 4. Select: %cd%\dist-dev
echo.
echo ========================================
echo   Starting watch mode...
echo ========================================
echo.
echo The extension will auto-rebuild when you make changes.
echo Press Ctrl+C to stop watching.
echo.

REM Start watch mode
call npm run dev:watch