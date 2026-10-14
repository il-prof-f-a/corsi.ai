@echo off
setlocal
set "CSC_PATH=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC_PATH%" set "CSC_PATH=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC_PATH%" (
  echo Non trovo il compilatore C# di .NET Framework.
  exit /b 1
)
if not exist "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe" (
  echo Compila prima ChatModelli.sln in configurazione Debug da Visual Studio.
  exit /b 1
)
"%CSC_PATH%" /nologo /target:exe /out:"%~dp0SettingsSmokeTest.exe" "%~dp0SettingsSmokeTest.cs"
if errorlevel 1 exit /b 1
"%~dp0SettingsSmokeTest.exe" "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe"
exit /b %errorlevel%
