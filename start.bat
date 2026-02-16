@echo off
title SD Prompt Builder
cd /d "%~dp0"
echo ========================================
echo   SD Prompt Builder 起動中...
echo ========================================
echo.
echo   サーバー: http://localhost:3001
echo   クライアント: http://localhost:5173
echo.
echo   ブラウザで http://localhost:5173 を開いてください
echo   終了するにはこのウィンドウを閉じてください
echo ========================================
echo.
npm run dev
