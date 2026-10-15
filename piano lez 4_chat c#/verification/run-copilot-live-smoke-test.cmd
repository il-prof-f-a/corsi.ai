@echo off
setlocal
set "CSC_PATH=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC_PATH%" set "CSC_PATH=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC_PATH%" (
  echo Non trovo il compilatore C# di .NET Framework.
  exit /b 1
)
if not exist "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe" (
  echo Compila prima ChatModelli.csproj in configurazione Debug.
  exit /b 1
)
set "TEST_EXE=%~dp0..\ChatModelli\bin\Debug\ChatModelliCopilotLiveSmokeTest.exe"
"%CSC_PATH%" /nologo /target:exe /out:"%TEST_EXE%" "%~dp0CopilotLiveSmokeTest.cs"
if errorlevel 1 exit /b 1
if exist "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe.config" copy /y "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe.config" "%TEST_EXE%.config" >nul
if errorlevel 1 exit /b 1
"%TEST_EXE%" "%~dp0..\ChatModelli\bin\Debug\ChatModelli.exe"
exit /b %errorlevel%
