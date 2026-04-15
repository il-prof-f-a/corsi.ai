#!/usr/bin/env python3
"""
Direct execution script - runs all analysis steps and writes results
"""
if __name__ == "__main__":
    import os
    import sys
    import hashlib
    import subprocess
    import json
    
    # Set working directory
    work_dir = r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot"
    
    try:
        os.chdir(work_dir)
    except Exception as e:
        print(f"ERROR: Could not change directory: {e}")
        sys.exit(1)
    
    xlsx_path = "25.xlsx"
    output_file = "workbook_analysis_output.txt"
    script_path = "analyze_workbook.py"
    results_file = "analysis_results.json"
    
    def compute_hash(filepath):
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    results = {
        "openpyxl_installed": False,
        "output_file_exists": False,
        "output_file_nonempty": False,
        "hash_unchanged": False,
        "hash_before": "",
        "hash_after": ""
    }
    
    # Step 1: Get hash before
    try:
        results["hash_before"] = compute_hash(xlsx_path)
        print(f"[1] Hash BEFORE: {results['hash_before']}")
    except Exception as e:
        print(f"[1] ERROR getting hash before: {e}")
        sys.exit(1)
    
    # Step 2: Check openpyxl
    try:
        import openpyxl
        results["openpyxl_installed"] = False
        print("[2] openpyxl already installed - No installation needed")
    except ImportError:
        print("[2] openpyxl not found - Installing...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"],
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
            results["openpyxl_installed"] = True
            print("[2] openpyxl installation completed")
        except Exception as e:
            print(f"[2] ERROR installing openpyxl: {e}")
            sys.exit(1)
    
    # Step 3: Run analyze_workbook.py
    try:
        print("[3] Running analyze_workbook.py...")
        with open(output_file, 'w', encoding='utf-8') as outf:
            res = subprocess.run([sys.executable, script_path],
                               stdout=outf,
                               stderr=subprocess.STDOUT,
                               text=True,
                               timeout=60)
        print(f"[3] Script completed with return code: {res.returncode}")
    except Exception as e:
        print(f"[3] ERROR: {e}")
        sys.exit(1)
    
    # Step 4: Get hash after
    try:
        results["hash_after"] = compute_hash(xlsx_path)
        print(f"[4] Hash AFTER: {results['hash_after']}")
        results["hash_unchanged"] = (results["hash_before"] == results["hash_after"])
    except Exception as e:
        print(f"[4] ERROR getting hash after: {e}")
        sys.exit(1)
    
    # Step 5: Verify output file
    try:
        results["output_file_exists"] = os.path.exists(output_file)
        if results["output_file_exists"]:
            size = os.path.getsize(output_file)
            results["output_file_nonempty"] = size > 0
            print(f"[5] Output file exists: Yes (size: {size} bytes)")
        else:
            print("[5] Output file does not exist")
    except Exception as e:
        print(f"[5] ERROR: {e}")
    
    # Write results
    try:
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults written to {results_file}")
    except Exception as e:
        print(f"ERROR writing results: {e}")
    
    # Print summary
    print("\n" + "="*70)
    print("SUMMARY:")
    print("="*70)
    print(f"openpyxl installation needed:        {'Yes' if results['openpyxl_installed'] else 'No'}")
    print(f"Output file exists & non-empty:     {'Yes' if (results['output_file_exists'] and results['output_file_nonempty']) else 'No'}")
    print(f"Workbook hash remained unchanged:   {'Yes' if results['hash_unchanged'] else 'No'}")
    print("="*70)
    
    # Exit with appropriate code
    if results['output_file_exists'] and results['output_file_nonempty'] and results['hash_unchanged']:
        print("\n✓ All checks PASSED")
        sys.exit(0)
    else:
        print("\n✗ Some checks FAILED")
        sys.exit(1)
