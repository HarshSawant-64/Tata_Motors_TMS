@echo off
setlocal
echo ============================================================
echo  Tata Motors Training Management Portal - SETUP
echo ============================================================
echo.
echo This will install dependencies for the server and client,
echo generate the Prisma client, create the SQLite database,
echo and seed it with a default admin user and sample data.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found on this machine.
    echo Please install Node.js v22.x from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

echo [1/5] Installing SERVER dependencies...
cd /d "%~dp0server"
call npm install
if errorlevel 1 (
    echo [ERROR] Server dependency installation failed.
    pause
    exit /b 1
)

echo.
echo [2/5] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [3/5] Creating / migrating the SQLite database...
call npx prisma migrate deploy
if errorlevel 1 (
    echo Migration deploy found nothing to deploy, creating initial migration...
    call npx prisma migrate dev --name init
)

echo.
echo [4/5] Seeding the database with the default admin user and sample data...
call npm run seed
if errorlevel 1 (
    echo [ERROR] Database seeding failed.
    pause
    exit /b 1
)

echo.
echo [5/5] Installing CLIENT dependencies...
cd /d "%~dp0client"
call npm install
if errorlevel 1 (
    echo [ERROR] Client dependency installation failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Setup complete.
echo  Default login:  admin / admin123
echo  Run start.bat to launch the application.
echo ============================================================
pause
