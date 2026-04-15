#!/usr/bin/env python3
"""
Simple wrapper that executes run_analysis.py via os.system and captures output
"""

import os
import sys
import subprocess

os.chdir(r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot")

# Run the analysis script
result = subprocess.run([sys.executable, "run_analysis.py"], capture_output=False, text=True)
sys.exit(result.returncode)
