@echo off
echo ========================================
echo RESTARTING CONVEX TO DEPLOY NEW CHANGES
echo ========================================
echo.

echo Step 1: Finding and stopping existing Convex processes...
tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo Found Node.js processes. Attempting to stop Convex dev server...
    for /f "tokens=2" %%i in ('netstat -ano ^| findstr :3210 ^| findstr LISTENING') do (
        echo Killing process on port 3210: %%i
        taskkill /F /PID %%i >nul 2>&1
    )
    timeout /t 2 >nul
    echo Done!
) else (
    echo No Node.js processes found.
)

echo.
echo Step 2: Starting Convex dev server...
echo This will deploy all your new quiz and certificate functions.
echo.
echo IMPORTANT: Keep this window open!
echo Press Ctrl+C to stop the server later.
echo.

cd /d F:\eca\ecastacademy
npx convex dev

pause
