import sys
import os

# Add the working directory to path
work_dir = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"
os.chdir(work_dir)
sys.path.insert(0, work_dir)

# Now execute the standalone executor
exec(open('standalone_executor.py').read())
