@echo off
echo ========================================
echo Nexus of Mind - Starting Servers
echo ========================================
echo.

echo Starting AI Backend (port 8010)...
start "Nexus AI Backend" cmd /k "cd server && python start_server.py"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

echo Starting Game Client (port 3000)...
start "Nexus Game Client" cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo Servers starting in separate windows.
echo.
echo AI Backend:   http://localhost:8010
echo Game Client:  http://localhost:3010
echo ========================================
