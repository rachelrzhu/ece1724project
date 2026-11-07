@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node

node "%~dp0scripts\setup.mjs" %*
set "SETUP_EXIT_CODE=%ERRORLEVEL%"
if not "%SETUP_EXIT_CODE%"=="0" pause
exit /b %SETUP_EXIT_CODE%

:missing_node
echo Install Node.js version 24 from https://nodejs.org/en/download first.
echo Then close and reopen your terminal and run this file again.
pause
exit /b 1
