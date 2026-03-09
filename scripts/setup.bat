@echo off
echo ╔══════════════════════════════════════════════════════╗
echo ║  AI Avatar Platform — Automated Setup               ║
echo ║  India Innovates 2026                               ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js not found. Installing via winget...
    winget install --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    echo [✓] Node.js installed. Please restart this script.
    pause
    exit /b
)
echo [✓] Node.js found: 
node --version

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Python not found. Installing via winget...
    winget install --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements
    echo [✓] Python installed. Please restart this script.
    pause
    exit /b
)
echo [✓] Python found:
python --version

:: Check Ollama
where ollama >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [!] Ollama not found. Installing via winget...
    winget install --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
    echo [✓] Ollama installed. Restart terminal and re-run setup.
    pause
    exit /b
)
echo [✓] Ollama found

:: Pull llama3 model
echo.
echo [*] Pulling llama3 model (this may take a while)...
ollama pull llama3
echo [✓] llama3 model ready

:: Install Node dependencies
echo.
echo [*] Installing Node.js dependencies...

cd /d "%~dp0..\services\translation-service"
call npm install

cd /d "%~dp0..\services\llm-service"
call npm install

cd /d "%~dp0..\services\avatar-service"
call npm install

cd /d "%~dp0..\backend\gateway-api"
call npm install

cd /d "%~dp0..\frontend\web-client"
call npm install

echo [✓] Node dependencies installed

:: Install Python dependencies
echo.
echo [*] Installing Python dependencies...

cd /d "%~dp0..\services\stt-service"
pip install -r requirements.txt

cd /d "%~dp0..\services\tts-service"
pip install -r requirements.txt

echo [✓] Python dependencies installed

:: Done
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  Setup Complete!                                    ║
echo ║                                                     ║
echo ║  Start the platform:                               ║
echo ║    cd ai-avatar-platform                           ║
echo ║    node scripts\start-all.js                       ║
echo ║                                                     ║
echo ║  Then open: http://localhost:5173                   ║
echo ╚══════════════════════════════════════════════════════╝
pause
