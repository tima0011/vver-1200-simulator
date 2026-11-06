@echo off
rem ReactorLab: 3D models only load through a local server, not by opening index.html directly.
rem Keep this window open while using the site. Close it to stop the server.
chcp 65001 >nul
cd /d "%~dp0"
start "" "http://127.0.0.1:8766/#model3d"
python -m http.server 8766 --bind 127.0.0.1
if errorlevel 1 pause
