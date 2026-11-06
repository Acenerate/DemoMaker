@echo off
rem Starts the walkthrough admin and opens it in your browser. Close this window to stop it.
cd /d "%~dp0"
node tools\admin\server.js
pause
