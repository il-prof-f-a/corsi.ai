#!/usr/bin/env python3
"""
Comprehensive analysis script that:
1. Hashes 25.xlsx before analysis
2. Checks/installs openpyxl
3. Runs analyze_workbook.py with output capture
4. Hashes 25.xlsx after analysis
5. Verifies output file
"""

import hashlib
import subprocess
import sys
import os

def get_file_hash(filepath):
    """Compute SHA256 hash of a file"""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    except FileNotFoundError:
        return f"ERROR: File not found - {filepath}"
    except Exception as e:
        return f"ERROR: {str(e)}"

def main():
    workbook_path = "25.xlsx"
    output_file = "workbook_analysis_output.txt"
    
    print("="*70)
    print("WORKBOOK ANALYSIS WORKFLOW")
    print("="*70)
    
    # Step 1: Compute hash BEFORE
    print("\n[Step 1] Computing SHA256 hash of 25.xlsx BEFORE analysis...")
    before_hash = get_file_hash(workbook_path)
    print(f"         Hash: {before_hash}")
    
    # Step 2: Check if openpyxl is installed
    print("\n[Step 2] Checking if openpyxl module is installed...")
    openpyxl_needed = False
    try:
        import openpyxl
        print("         openpyxl is already installed - no installation needed")
        openpyxl_needed = False
    except ImportError:
        print("         openpyxl not found - installing now...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"])
            print("         openpyxl installation completed")
            openpyxl_needed = True
        except Exception as e:
            print(f"         ERROR installing openpyxl: {e}")
            return
    
    # Step 3: Run analyze_workbook.py and capture output
    print("\n[Step 3] Running analyze_workbook.py and capturing output...")
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            result = subprocess.run([sys.executable, "analyze_workbook.py"], 
                                  stdout=f, 
                                  stderr=subprocess.STDOUT,
                                  text=True,
                                  timeout=60)
        print(f"         Script completed with return code: {result.returncode}")
    except subprocess.TimeoutExpired:
        print("         ERROR: Script execution timed out")
        return
    except Exception as e:
        print(f"         ERROR running script: {e}")
        return
    
    # Step 4: Compute hash AFTER
    print("\n[Step 4] Computing SHA256 hash of 25.xlsx AFTER analysis...")
    after_hash = get_file_hash(workbook_path)
    print(f"         Hash: {after_hash}")
    
    # Step 5: Verify output file
    print("\n[Step 5] Verifying workbook_analysis_output.txt...")
    output_exists = os.path.exists(output_file)
    output_size = os.path.getsize(output_file) if output_exists else 0
    output_nonempty = output_size > 0
    print(f"         File exists: {output_exists}")
    print(f"         File size: {output_size} bytes")
    print(f"         File is non-empty: {output_nonempty}")
    
    # Summary Report
    print("\n" + "="*70)
    print("FINAL STATUS REPORT")
    print("="*70)
    print(f"openpyxl installation needed:              {'Yes' if openpyxl_needed else 'No'}")
    print(f"workbook_analysis_output.txt exists & non-empty: {'Yes' if (output_exists and output_nonempty) else 'No'}")
    print(f"Workbook hash remained the same:           {'Yes' if before_hash == after_hash else 'No'}")
    print("="*70)

if __name__ == "__main__":
    main()
