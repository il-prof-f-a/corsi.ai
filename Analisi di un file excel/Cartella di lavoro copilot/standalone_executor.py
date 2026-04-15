#!/usr/bin/env python3
"""
Standalone analysis executor with logging to file
Run this script with: python3 standalone_executor.py

This script:
1. Computes SHA256 hash of 25.xlsx BEFORE analysis
2. Checks if openpyxl is installed (and installs if needed)
3. Runs analyze_workbook.py with output to workbook_analysis_output.txt
4. Computes SHA256 hash of 25.xlsx AFTER analysis
5. Verifies the output file exists and is non-empty

All operations are logged to execution_log.txt
"""

def run_analysis():
    import os
    import sys
    import hashlib
    import subprocess
    from datetime import datetime
    
    # Log file for all output
    log_file = "execution_log.txt"
    
    def log_message(msg):
        """Print to console and log file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {msg}"
        print(log_entry)
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(log_entry + "\n")
    
    # Clear previous log
    if os.path.exists(log_file):
        os.remove(log_file)
    
    log_message("="*80)
    log_message("WORKBOOK ANALYSIS WORKFLOW STARTED")
    log_message("="*80)
    
    # Change to working directory
    work_dir = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"
    try:
        os.chdir(work_dir)
        log_message(f"Working directory: {os.getcwd()}")
    except Exception as e:
        log_message(f"ERROR: Could not change directory: {e}")
        return False
    
    xlsx_file = "25.xlsx"
    output_file = "workbook_analysis_output.txt"
    analyze_script = "analyze_workbook.py"
    
    def compute_hash(filepath):
        """SHA256 hash"""
        h = hashlib.sha256()
        with open(filepath, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    
    # STEP 1
    log_message("")
    log_message("[STEP 1] Computing SHA256 hash BEFORE analysis...")
    try:
        hash_before = compute_hash(xlsx_file)
        log_message(f"  Hash before: {hash_before}")
    except Exception as e:
        log_message(f"  ERROR: {e}")
        return False
    
    # STEP 2
    log_message("")
    log_message("[STEP 2] Checking openpyxl module...")
    openpyxl_needed = False
    try:
        import openpyxl
        log_message(f"  openpyxl already installed (v{openpyxl.__version__})")
        openpyxl_needed = False
    except ImportError:
        log_message("  openpyxl NOT found - installing...")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "openpyxl"],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode == 0:
                log_message("  Installation successful")
                openpyxl_needed = True
            else:
                log_message(f"  Installation failed: {result.stderr}")
                return False
        except Exception as e:
            log_message(f"  ERROR: {e}")
            return False
    
    # STEP 3
    log_message("")
    log_message("[STEP 3] Running analyze_workbook.py...")
    try:
        with open(output_file, "w", encoding="utf-8") as outf:
            result = subprocess.run(
                [sys.executable, analyze_script],
                stdout=outf,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=120
            )
        log_message(f"  Script completed (return code: {result.returncode})")
    except Exception as e:
        log_message(f"  ERROR: {e}")
        return False
    
    # STEP 4
    log_message("")
    log_message("[STEP 4] Computing SHA256 hash AFTER analysis...")
    try:
        hash_after = compute_hash(xlsx_file)
        log_message(f"  Hash after: {hash_after}")
        hash_unchanged = (hash_before == hash_after)
        if hash_unchanged:
            log_message("  ✓ Hash unchanged - file was not modified")
        else:
            log_message("  ✗ WARNING: Hash changed - file was modified!")
    except Exception as e:
        log_message(f"  ERROR: {e}")
        return False
    
    # STEP 5
    log_message("")
    log_message("[STEP 5] Verifying output file...")
    output_ok = False
    try:
        if os.path.exists(output_file):
            size = os.path.getsize(output_file)
            if size > 0:
                log_message(f"  ✓ Output file exists and non-empty ({size} bytes)")
                output_ok = True
            else:
                log_message(f"  ✗ Output file is empty")
        else:
            log_message(f"  ✗ Output file does not exist")
    except Exception as e:
        log_message(f"  ERROR: {e}")
    
    # SUMMARY
    log_message("")
    log_message("="*80)
    log_message("FINAL STATUS REPORT")
    log_message("="*80)
    log_message(f"openpyxl installation needed:         {'Yes' if openpyxl_needed else 'No'}")
    log_message(f"Output file exists & non-empty:       {'Yes' if output_ok else 'No'}")
    log_message(f"Workbook hash remained same:          {'Yes' if hash_unchanged else 'No'}")
    log_message("="*80)
    
    return output_ok and hash_unchanged

if __name__ == "__main__":
    import sys
    success = run_analysis()
    sys.exit(0 if success else 1)
