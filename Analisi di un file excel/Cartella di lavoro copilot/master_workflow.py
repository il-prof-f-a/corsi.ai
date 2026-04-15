#!/usr/bin/env python3
"""
MASTER EXECUTION SCRIPT FOR WORKBOOK ANALYSIS
This is the primary workflow orchestrator.

Usage: python master_workflow.py
This will perform all analysis steps and generate the final report.
"""

if __name__ == "__main__":
    # This section will run the complete workflow
    exec("""
import os
import sys
import hashlib
import subprocess
from pathlib import Path

# Set working directory
work_dir = r'S:\\Progetti su github\\corsi.ai\\repo di riferimento\\corsi.ai\\Analisi di un file excel\\Cartella di lavoro copilot'
os.chdir(work_dir)

print("="*80)
print("EXCEL WORKBOOK ANALYSIS - MASTER WORKFLOW")
print("="*80)

xlsx_file = "25.xlsx"
output_file = "workbook_analysis_output.txt"
analyze_script = "analyze_workbook.py"

def compute_sha256(filepath):
    '''Compute SHA256 hash of a file'''
    h = hashlib.sha256()
    try:
        with open(filepath, 'rb') as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    except FileNotFoundError:
        return f'FILE_NOT_FOUND: {filepath}'
    except Exception as e:
        return f'ERROR: {str(e)}'

# STEP 1: Hash BEFORE
print('\\n[STEP 1] Computing SHA256 hash of 25.xlsx BEFORE analysis...')
hash_before = compute_sha256(xlsx_file)
print(f'  Hash: {hash_before}')

# STEP 2: Check openpyxl
print('\\n[STEP 2] Checking if openpyxl is installed...')
openpyxl_needed = False
try:
    import openpyxl
    print(f'  openpyxl is already installed (version {openpyxl.__version__})')
except ImportError:
    print('  openpyxl NOT found - installing...')
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'install', 'openpyxl', '-q'],
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode == 0:
            print('  openpyxl installed successfully')
            openpyxl_needed = True
        else:
            print(f'  ERROR installing openpyxl: {result.stderr}')
            sys.exit(1)
    except Exception as e:
        print(f'  ERROR: {e}')
        sys.exit(1)

# STEP 3: Run analysis
print(f'\\n[STEP 3] Running {analyze_script}...')
try:
    with open(output_file, 'w', encoding='utf-8') as outf:
        result = subprocess.run(
            [sys.executable, analyze_script],
            stdout=outf,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=120
        )
    print(f'  Script completed (return code: {result.returncode})')
except Exception as e:
    print(f'  ERROR: {e}')
    sys.exit(1)

# STEP 4: Hash AFTER  
print('\\n[STEP 4] Computing SHA256 hash of 25.xlsx AFTER analysis...')
hash_after = compute_sha256(xlsx_file)
print(f'  Hash: {hash_after}')
hash_match = (hash_before == hash_after)

# STEP 5: Verify output
print(f'\\n[STEP 5] Verifying {output_file}...')
output_exists = os.path.exists(output_file)
output_size = os.path.getsize(output_file) if output_exists else 0
output_nonempty = output_size > 0

if output_exists:
    print(f'  File exists: Yes')
    print(f'  File size: {output_size} bytes')
    print(f'  File non-empty: Yes' if output_nonempty else '  File non-empty: No')
else:
    print(f'  File exists: No')

# SUMMARY
print('\\n' + '='*80)
print('FINAL STATUS REPORT')
print('='*80)
print(f'openpyxl installation needed:                     {\"Yes\" if openpyxl_needed else \"No\"}')
print(f'workbook_analysis_output.txt exists & non-empty:  {\"Yes\" if (output_exists and output_nonempty) else \"No\"}')
print(f'Workbook hash remained the same:                  {\"Yes\" if hash_match else \"No\"}')
print('='*80)

# Exit status
success = (output_exists and output_nonempty and hash_match)
if success:
    print('\\n✓ ALL CHECKS PASSED')
    sys.exit(0)
else:
    print('\\n✗ SOME CHECKS FAILED')
    sys.exit(1)
""")
