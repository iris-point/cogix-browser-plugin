@echo off
echo Chrome Extension CRX Creator
echo =============================
echo.

REM Try to find Chrome
set CHROME_PATH=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_PATH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else (
    echo ERROR: Chrome not found in standard locations
    echo Please install Chrome or edit this script with your Chrome path
    pause
    exit /b 1
)

echo Found Chrome at: %CHROME_PATH%
echo.

REM Check if build exists
if not exist "build\chrome-mv3-prod" (
    echo ERROR: Production build not found
    echo Please run 'npm run build' first
    pause
    exit /b 1
)

REM Create CRX
echo Creating CRX file...
echo.

REM Check if key exists
if exist "key.pem" (
    echo Using existing key file for consistent extension ID
    "%CHROME_PATH%" --pack-extension="%CD%\build\chrome-mv3-prod" --pack-extension-key="%CD%\key.pem"
) else (
    echo Creating new key file (will be saved as key.pem)
    "%CHROME_PATH%" --pack-extension="%CD%\build\chrome-mv3-prod"
    if exist "build\chrome-mv3-prod.pem" (
        move "build\chrome-mv3-prod.pem" "key.pem" >nul
        echo Key file saved as key.pem - KEEP THIS FILE SAFE!
    )
)

REM Check if CRX was created
if exist "build\chrome-mv3-prod.crx" (
    REM Rename to friendly name
    move "build\chrome-mv3-prod.crx" "cogix-eye-tracking.crx" >nul 2>&1
    echo.
    echo ======================================
    echo SUCCESS! CRX file created:
    echo cogix-eye-tracking.crx
    echo ======================================
    echo.
    echo Installation:
    echo 1. Open Chrome: chrome://extensions/
    echo 2. Enable Developer mode
    echo 3. Drag cogix-eye-tracking.crx onto the page
    echo.
) else (
    echo.
    echo ERROR: CRX file was not created
    echo Try running this script as Administrator
    echo.
)

pause