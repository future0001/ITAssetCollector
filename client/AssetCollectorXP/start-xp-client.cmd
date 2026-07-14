@echo off
setlocal

set "EXE="
for %%F in ("%~dp0*-XP.exe") do set "EXE=%%~fF"

if not exist "%EXE%" (
  echo XP client executable was not found in this folder.
  echo Please keep this launcher and the *-XP.exe file in the same folder.
  pause
  exit /b 2
)

reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Install >nul 2>nul
if errorlevel 1 (
  echo This XP client requires Microsoft .NET Framework 4 Full.
  echo.
  echo Install .NET Framework 4 Full on Windows XP SP3 first,
  echo then run this launcher again.
  echo.
  echo Suggested installer filename: dotNetFx40_Full_x86_x64.exe
  pause
  exit /b 1
)

start "" "%EXE%"
