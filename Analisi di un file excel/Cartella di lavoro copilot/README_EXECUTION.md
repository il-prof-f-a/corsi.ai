# WORKBOOK ANALYSIS - EXECUTION GUIDE

## Overview
This directory contains scripts to analyze an Excel workbook (25.xlsx) using Python and openpyxl.

## Files Created

1. **master_workflow.py** - Main execution script (recommended)
2. **standalone_executor.py** - Alternative execution script with logging
3. **run_workflow.cmd** - Windows batch file to run the workflow
4. **analyze_workbook.py** - Original analysis script (already existed)
5. **25.xlsx** - Excel file to be analyzed

## How to Execute

### Option 1: Windows Command Prompt (Simplest)
```
cd /d "S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"
python master_workflow.py
```

### Option 2: Using Batch File
```
Double-click: run_workflow.cmd
```

### Option 3: Python Direct Execution
```
python "S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot\master_workflow.py"
```

## What the Workflow Does

1. **STEP 1**: Computes SHA256 hash of 25.xlsx BEFORE analysis
2. **STEP 2**: Checks if Python module `openpyxl` is installed
   - If not installed: Automatically installs it via pip
   - Reports: "Installation needed: Yes" or "No"
3. **STEP 3**: Runs analyze_workbook.py
   - Captures ALL stdout to: `workbook_analysis_output.txt`
   - Redirects stderr to stdout
4. **STEP 4**: Computes SHA256 hash of 25.xlsx AFTER analysis
   - Verifies: Hash should match the BEFORE hash
   - This confirms the file was not modified
5. **STEP 5**: Verifies output file
   - Checks if workbook_analysis_output.txt exists
   - Checks if file is non-empty
   - Reports file size in bytes

## Expected Output

The script will print:
```
================================================================================
EXCEL WORKBOOK ANALYSIS - MASTER WORKFLOW
================================================================================

[STEP 1] Computing SHA256 hash of 25.xlsx BEFORE analysis...
  Hash: [64-character hex string]

[STEP 2] Checking if openpyxl is installed...
  openpyxl is already installed (version X.X.X)
  or
  openpyxl installed successfully

[STEP 3] Running analyze_workbook.py...
  Script completed (return code: 0)

[STEP 4] Computing SHA256 hash of 25.xlsx AFTER analysis...
  Hash: [same 64-character hex string]

[STEP 5] Verifying workbook_analysis_output.txt...
  File exists: Yes
  File size: XXXXX bytes
  File non-empty: Yes

================================================================================
FINAL STATUS REPORT
================================================================================
openpyxl installation needed:                     [Yes/No]
workbook_analysis_output.txt exists & non-empty:  Yes
Workbook hash remained the same:                  Yes
================================================================================

✓ ALL CHECKS PASSED
```

## Output Files

After successful execution, you will have:

1. **workbook_analysis_output.txt** - Complete analysis of the Excel workbook
   - Contains detailed metadata about all sheets
   - Lists tables, merged cells, formulas
   - Analyzes column types and data patterns
   - Reports anomalies and unusual formatting

2. **execution_log.txt** (if using standalone_executor.py) - Timestamped log of all operations

## Success Criteria

The workflow is successful if ALL of the following are true:
- openpyxl installation status is correctly reported
- workbook_analysis_output.txt is created and non-empty (>0 bytes)
- SHA256 hash remains identical before and after (file not modified)

## Troubleshooting

### If openpyxl fails to install:
```
python -m pip install openpyxl
```

### If analyze_workbook.py fails:
- Verify 25.xlsx exists in the current directory
- Verify openpyxl is installed: `python -c "import openpyxl; print(openpyxl.__version__)"`
- Check file permissions

### If output file is empty:
- Run analyze_workbook.py manually to see error messages:
  ```
  python analyze_workbook.py
  ```

## Manual Execution for Testing

To test individual steps:

```python
# Test 1: Check hash
import hashlib
def get_hash(f):
    h = hashlib.sha256()
    with open(f, 'rb') as fp:
        h.update(fp.read())
    return h.hexdigest()
print(get_hash('25.xlsx'))

# Test 2: Check openpyxl
import openpyxl
print(openpyxl.__version__)

# Test 3: Run analysis
import subprocess, sys
with open('workbook_analysis_output.txt', 'w') as f:
    subprocess.run([sys.executable, 'analyze_workbook.py'], stdout=f, stderr=subprocess.STDOUT)
```

---
**Created**: Task Execution Agent
**Purpose**: Automated workbook analysis with validation
