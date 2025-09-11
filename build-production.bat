@echo off
echo Building production version...
echo.

REM Ensure development env is not loaded
if exist .env.development (
    echo Moving .env.development to .env.development.local
    move .env.development .env.development.local 2>nul
)

REM Build production package
echo Building extension...
call npm run build

echo.
echo Creating ZIP package...
call npm run package

echo.
echo Creating CRX file...
call npm run package:crx

echo.
echo ===============================
echo Production build complete!
echo ===============================
echo.
echo Files created:
echo - Unpacked: build\chrome-mv3-prod\
echo - ZIP: build\chrome-mv3-prod.zip
echo - CRX: cogix-eye-tracking.crx
echo.
echo Extension ID: ibpjidejooohhmkcpigmhnafnmkfbfmi
echo.
pause