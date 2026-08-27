@echo off
echo ============================================================
echo  Tata Motors Training Management Portal - STOP
echo ============================================================
echo.
echo Closing the TMTP Backend and TMTP Frontend windows...

taskkill /FI "WINDOWTITLE eq TMTP Backend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq TMTP Frontend*" /T /F >nul 2>nul

echo.
echo If any Node processes for this app are still running, you can
echo close them manually from Task Manager (look for node.exe).
echo.
echo Done.
pause
