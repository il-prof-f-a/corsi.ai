@echo off
REM Change to working directory
cd /d "S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"

REM Run the main workflow
python standalone_executor.py

REM Pause to see output
echo.
echo Analysis complete. Results logged to execution_log.txt
echo Output written to workbook_analysis_output.txt
pause
