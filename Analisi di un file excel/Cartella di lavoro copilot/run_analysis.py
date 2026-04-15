#!/usr/bin/env python
import os
import sys
import hashlib
import subprocess

# Path to workbook
xlsx_path = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot\25.xlsx"
output_path = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot\workbook_analysis_output.txt"
script_path = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot\analyze_workbook.py"

# Step 1: Compute hash before
def compute_hash(filepath):
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

print("Step 1: Computing hash of 25.xlsx before running analysis...")
hash_before = compute_hash(xlsx_path)
print(f"  Hash before: {hash_before}")

# Step 2: Check if openpyxl is installed
print("\nStep 2: Checking openpyxl dependency...")
try:
    import openpyxl
    print(f"  openpyxl already installed (version: {openpyxl.__version__})")
    dependency_installed = False
except ImportError:
    print("  openpyxl NOT found, installing...")
    result = subprocess.run([sys.executable, "-m", "pip", "install", "openpyxl"], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print("  Successfully installed openpyxl")
        dependency_installed = True
    else:
        print(f"  ERROR: Failed to install openpyxl: {result.stderr}")
        sys.exit(1)

# Step 3: Run analyze_workbook.py and capture output
print("\nStep 3: Running analyze_workbook.py...")
with open(output_path, 'w', encoding='utf-8') as outfile:
    result = subprocess.run([sys.executable, script_path], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        outfile.write(result.stdout)
        print(f"  Analysis completed successfully")
        print(f"  Output written to: {output_path}")
    else:
        print(f"  ERROR running script: {result.stderr}")
        sys.exit(1)

# Step 4: Verify output file
print("\nStep 4: Verifying output file...")
if os.path.exists(output_path):
    file_size = os.path.getsize(output_path)
    if file_size > 0:
        print(f"  Output file exists and is non-empty ({file_size} bytes)")
        output_ok = True
    else:
        print(f"  ERROR: Output file is empty")
        output_ok = False
else:
    print(f"  ERROR: Output file does not exist")
    output_ok = False

# Step 5: Verify workbook wasn't changed
print("\nStep 5: Verifying 25.xlsx was not modified...")
hash_after = compute_hash(xlsx_path)
if hash_before == hash_after:
    print(f"  Hash after:  {hash_after}")
    print(f"  ✓ Workbook unchanged (hash match)")
    workbook_unchanged = True
else:
    print(f"  ERROR: Hash mismatch!")
    print(f"  Before: {hash_before}")
    print(f"  After:  {hash_after}")
    workbook_unchanged = False

# Final summary
print("\n" + "="*70)
print("FINAL STATUS SUMMARY:")
print(f"  Dependency installation needed: {'Yes' if dependency_installed else 'No'}")
print(f"  Output file exists and non-empty: {'Yes' if output_ok else 'No'}")
print(f"  Workbook remained unchanged: {'Yes' if workbook_unchanged else 'No'}")
print("="*70)

if output_ok and workbook_unchanged:
    print("\n✓ All checks passed")
    sys.exit(0)
else:
    print("\n✗ Some checks failed")
    sys.exit(1)
