@echo off
echo Starting development build...
echo.

REM Rename env files for development
if exist .env.development.local (
    move .env.development.local .env.development 2>nul
)

REM Start development server
npm run dev

REM Rename back after dev stops
if exist .env.development (
    move .env.development .env.development.local 2>nul
)