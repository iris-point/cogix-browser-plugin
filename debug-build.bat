@echo off
echo Debug Build for Cogix Browser Plugin...
echo.

echo Step 1: Cleaning previous build...
if exist build rmdir /s /q build
if exist .plasmo rmdir /s /q .plasmo

echo.
echo Step 2: Installing/updating dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 3: Building with debug info...
set NODE_ENV=development
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build extension
    pause
    exit /b 1
)

echo.
echo Step 4: Debug build completed!
echo.
echo To test:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable "Developer mode"
echo 3. Remove old extension if installed
echo 4. Click "Load unpacked" and select the 'build' folder
echo 5. Open browser DevTools (F12) to see debug logs
echo 6. Test the eye tracking connection
echo.

echo Opening Chrome extensions page...
start chrome://extensions/

echo.
echo Build complete! Check console for debug information.
pause
