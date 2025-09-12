@echo off
echo Updating Eye Tracking Core to Latest Version...
echo.

echo Step 1: Checking current version...
call npm list @iris-point/eye-tracking-core

echo.
echo Step 2: Updating to latest version...
call npm install @iris-point/eye-tracking-core@latest
if %errorlevel% neq 0 (
    echo Failed to update eye-tracking-core
    pause
    exit /b 1
)

echo.
echo Step 3: Checking updated version...
call npm list @iris-point/eye-tracking-core

echo.
echo Step 4: Rebuilding extension...
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build extension
    pause
    exit /b 1
)

echo.
echo ✅ Update completed successfully!
echo.
echo Next steps:
echo 1. Go to chrome://extensions/
echo 2. Remove old version if installed
echo 3. Click "Load unpacked" and select the 'build' folder
echo 4. Test the eye tracking functionality
echo.

echo Opening Chrome extensions page...
start chrome://extensions/

pause
