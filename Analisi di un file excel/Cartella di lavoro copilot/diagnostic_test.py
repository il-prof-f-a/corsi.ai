#!/usr/bin/env python3
"""
Simulated execution - test if openpyxl can be imported
"""
import sys
import os

os.chdir(r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot")

# Test 1: Check if 25.xlsx exists
print("TEST 1: Checking if 25.xlsx exists...")
if os.path.exists("25.xlsx"):
    print("  ✓ 25.xlsx found")
    size = os.path.getsize("25.xlsx")
    print(f"  File size: {size} bytes")
else:
    print("  ✗ 25.xlsx NOT found")

# Test 2: Check if analyze_workbook.py exists
print("\nTEST 2: Checking if analyze_workbook.py exists...")
if os.path.exists("analyze_workbook.py"):
    print("  ✓ analyze_workbook.py found")
else:
    print("  ✗ analyze_workbook.py NOT found")

# Test 3: Try to import openpyxl
print("\nTEST 3: Trying to import openpyxl...")
try:
    import openpyxl
    print(f"  ✓ openpyxl is installed (version {openpyxl.__version__})")
except ImportError:
    print("  ✗ openpyxl is NOT installed - would need to install")

# Test 4: Try to compute hash of 25.xlsx
print("\nTEST 4: Computing SHA256 hash of 25.xlsx...")
try:
    import hashlib
    h = hashlib.sha256()
    with open("25.xlsx", "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    hash_val = h.hexdigest()
    print(f"  ✓ Hash computed: {hash_val[:32]}...")
except Exception as e:
    print(f"  ✗ Error: {e}")

print("\nAll tests completed.")
