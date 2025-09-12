@echo off
echo Building Cogix Browser Plugin for Testing...
echo.

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Building extension...
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build extension
    pause
    exit /b 1
)

echo.
echo Step 3: Build completed successfully!
echo.
echo Next steps:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable "Developer mode" in the top right
echo 3. Click "Load unpacked" and select the 'build' folder
echo 4. Open the test page: test-integration.html
echo 5. Start the eye tracking SDK
echo 6. Use the extension popup to connect and calibrate
echo 7. Test recording functionality
echo.

echo Opening test page...
start test-integration.html

echo.
echo Build process complete!
pause
