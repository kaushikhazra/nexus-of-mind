@echo off
echo ========================================
echo Nexus of Mind - Installation
echo ========================================
echo.

echo [1/2] Installing Python requirements...
cd server
pip install -r ../requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Failed to install Python requirements
    pause
    exit /b 1
)
cd ..
echo Python requirements installed successfully.
echo.

echo [2/2] Installing npm packages...
cd client
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install npm packages
    pause
    exit /b 1
)
cd ..
echo npm packages installed successfully.
echo.

echo ========================================
echo Installation complete!
echo Run start.bat to launch the game.
echo ========================================
pause
