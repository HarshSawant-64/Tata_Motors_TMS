@echo off
echo ============================================================
echo  Tata Motors Training Management Portal - START
echo ============================================================
echo.
echo Starting backend API on http://localhost:4000
start "TMTP Backend" cmd /k "cd /d "%~dp0server" && npm run start"

timeout /t 3 /nobreak >nul

echo Starting frontend on http://localhost:5173
start "TMTP Frontend" cmd /k "cd /d "%~dp0client" && npm run dev"

timeout /t 3 /nobreak >nul
echo.
echo Opening the application in your default browser...
start "" "http://localhost:5173"

echo.
echo Two windows have opened: TMTP Backend and TMTP Frontend.
echo Keep both windows open while using the application.
echo Run stop.bat to shut everything down.
