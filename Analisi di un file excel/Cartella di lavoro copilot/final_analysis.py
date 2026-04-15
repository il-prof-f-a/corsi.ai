#!/usr/bin/env python3
"""
Execute the full workbook analysis workflow
"""
import os
import sys
import hashlib
import subprocess

# Ensure we're in the right directory
work_dir = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"
os.chdir(work_dir)

xlsx_path = "25.xlsx"
output_path = "workbook_analysis_output.txt"
script_path = "analyze_workbook.py"

def compute_hash(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

print("="*70)
print("WORKBOOK ANALYSIS WORKFLOW")
print("="*70)

# Step 1
print("\n[Step 1] Computing hash of 25.xlsx before running analysis...")
hash_before = compute_hash(xlsx_path)
print(f"  Hash before: {hash_before}")

# Step 2
print("\n[Step 2] Checking openpyxl dependency...")
dependency_installed = False
try:
    import openpyxl
    print(f"  ✓ openpyxl already installed (version: {openpyxl.__version__})")
except ImportError:
    print("  ✗ openpyxl NOT found, installing...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "openpyxl", "-q"], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print("  ✓ Successfully installed openpyxl")
        dependency_installed = True
    else:
        print(f"  ✗ ERROR: Failed to install openpyxl")
        print(result.stderr)
        sys.exit(1)

# Step 3
print("\n[Step 3] Running analyze_workbook.py...")
print("  (capturing output to workbook_analysis_output.txt)")
try:
    with open(output_path, 'w', encoding='utf-8') as outfile:
        result = subprocess.run([sys.executable, script_path], 
                              stdout=outfile,
                              stderr=subprocess.STDOUT,
                              text=True,
                              timeout=60)
    if result.returncode == 0:
        print(f"  ✓ Analysis completed successfully")
    else:
        print(f"  ⚠ Analysis completed with return code: {result.returncode}")
except Exception as e:
    print(f"  ✗ ERROR running script: {e}")
    sys.exit(1)

# Step 4
print("\n[Step 4] Verifying output file...")
if os.path.exists(output_path):
    file_size = os.path.getsize(output_path)
    if file_size > 0:
        print(f"  ✓ Output file exists and is non-empty ({file_size} bytes)")
        output_ok = True
    else:
        print(f"  ✗ ERROR: Output file is empty")
        output_ok = False
else:
    print(f"  ✗ ERROR: Output file does not exist")
    output_ok = False

# Step 5
print("\n[Step 5] Verifying 25.xlsx was not modified...")
hash_after = compute_hash(xlsx_path)
if hash_before == hash_after:
    print(f"  Hash after:  {hash_after}")
    print(f"  ✓ Workbook unchanged (hash match)")
    workbook_unchanged = True
else:
    print(f"  ✗ ERROR: Hash mismatch!")
    print(f"  Before: {hash_before}")
    print(f"  After:  {hash_after}")
    workbook_unchanged = False

# Final summary
print("\n" + "="*70)
print("FINAL STATUS SUMMARY:")
print("="*70)
print(f"Dependency installation needed:     {'Yes' if dependency_installed else 'No'}")
print(f"Output file exists and non-empty:   {'Yes' if output_ok else 'No'}")
print(f"Workbook remained unchanged:        {'Yes' if workbook_unchanged else 'No'}")
print("="*70)

if output_ok and workbook_unchanged:
    print("\n✓ All checks PASSED")
else:
    print("\n✗ Some checks FAILED")
    sys.exit(1)
