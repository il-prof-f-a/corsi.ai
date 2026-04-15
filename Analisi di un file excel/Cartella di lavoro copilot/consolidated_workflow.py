#!/usr/bin/env python3
"""
This script consolidates the workbook analysis into a single executable file
that can be run independently and generates the report.
"""

import os
import sys
import hashlib
import subprocess
from pathlib import Path

def main():
    # Set up paths
    script_dir = Path(__file__).parent
    os.chdir(str(script_dir))
    
    xlsx_file = "25.xlsx"
    output_file = "workbook_analysis_output.txt"
    analyze_script = "analyze_workbook.py"
    
    print("="*80)
    print("EXCEL WORKBOOK ANALYSIS - COMPREHENSIVE WORKFLOW")
    print("="*80)
    
    # Helper function
    def get_file_hash(filepath):
        """Compute SHA256 hash of a file"""
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(65536)  # 64KB chunks
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    
    # STEP 1: Get hash BEFORE
    print("\n[STEP 1] Computing SHA256 hash of 25.xlsx BEFORE analysis...")
    try:
        hash_before = get_file_hash(xlsx_file)
        print(f"  ✓ Hash: {hash_before}")
    except FileNotFoundError:
        print(f"  ✗ ERROR: File not found: {xlsx_file}")
        return False
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        return False
    
    # STEP 2: Check/install openpyxl
    print("\n[STEP 2] Checking Python module: openpyxl")
    openpyxl_installed = False
    try:
        import openpyxl
        print(f"  ✓ openpyxl is already installed")
        print(f"    Version: {openpyxl.__version__}")
        openpyxl_installed = False
    except ImportError:
        print("  ✗ openpyxl not found - installing...")
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", "openpyxl"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            print("  ✓ openpyxl installed successfully")
            openpyxl_installed = True
        except Exception as e:
            print(f"  ✗ ERROR installing openpyxl: {e}")
            return False
    
    # STEP 3: Run analyze_workbook.py
    print(f"\n[STEP 3] Running {analyze_script}...")
    print(f"  Output will be captured to: {output_file}")
    try:
        with open(output_file, "w", encoding="utf-8") as outf:
            result = subprocess.run(
                [sys.executable, analyze_script],
                stdout=outf,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=120
            )
        if result.returncode == 0:
            print(f"  ✓ Script completed successfully (return code: 0)")
        else:
            print(f"  ⚠ Script completed with return code: {result.returncode}")
    except subprocess.TimeoutExpired:
        print(f"  ✗ ERROR: Script execution timed out")
        return False
    except Exception as e:
        print(f"  ✗ ERROR executing script: {e}")
        return False
    
    # STEP 4: Get hash AFTER
    print("\n[STEP 4] Computing SHA256 hash of 25.xlsx AFTER analysis...")
    try:
        hash_after = get_file_hash(xlsx_file)
        print(f"  ✓ Hash: {hash_after}")
        hash_unchanged = (hash_before == hash_after)
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
        return False
    
    # STEP 5: Verify output file
    print(f"\n[STEP 5] Verifying {output_file}...")
    output_exists = False
    output_nonempty = False
    try:
        if os.path.exists(output_file):
            size = os.path.getsize(output_file)
            output_exists = True
            output_nonempty = (size > 0)
            print(f"  ✓ File exists: Yes")
            print(f"  ✓ File size: {size:,} bytes")
            if output_nonempty:
                print(f"  ✓ File is non-empty: Yes")
            else:
                print(f"  ✗ File is non-empty: No (empty file)")
        else:
            print(f"  ✗ File does not exist")
            output_exists = False
    except Exception as e:
        print(f"  ✗ ERROR: {e}")
    
    # SUMMARY
    print("\n" + "="*80)
    print("FINAL STATUS REPORT")
    print("="*80)
    
    result_1 = "Yes" if openpyxl_installed else "No"
    result_2 = "Yes" if (output_exists and output_nonempty) else "No"
    result_3 = "Yes" if hash_unchanged else "No"
    
    print(f"  openpyxl installation needed:            {result_1}")
    print(f"  workbook_analysis_output.txt exists & non-empty: {result_2}")
    print(f"  Workbook hash remained the same:        {result_3}")
    
    print("="*80)
    
    # Overall status
    all_ok = (output_exists and output_nonempty and hash_unchanged)
    if all_ok:
        print("\n✓ ALL CHECKS PASSED")
        return True
    else:
        print("\n✗ SOME CHECKS FAILED")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
