@echo off  
cd /d D:\Projects\boro  
call npx electron-builder --win --x64 > build_win.log 2>&1  
echo DONE >> build_win.log 
