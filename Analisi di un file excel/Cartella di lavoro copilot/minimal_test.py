#!/usr/bin/env python3
"""
MINIMAL TEST - Just to verify basic setup
This will be the simplest possible execution path
"""

import os
import sys

# Change directory
os.chdir(r"S:\Progetti su github\corsi.ai\repo di riferimento\corsi.ai\Analisi di un file excel\Cartella di lavoro copilot")

# Test if we can at least import what we need
print("Minimal Test Suite")
print("=" * 60)

# Test 1: Can we find the files?
print("\n1. File Existence Check:")
files_needed = ["25.xlsx", "analyze_workbook.py"]
for f in files_needed:
    exists = os.path.exists(f)
    status = "✓" if exists else "✗"
    print(f"   {status} {f}")

# Test 2: Can we import hashlib?
print("\n2. Module Import Check:")
try:
    import hashlib
    print(f"   ✓ hashlib")
except ImportError as e:
    print(f"   ✗ hashlib: {e}")

try:
    import subprocess
    print(f"   ✓ subprocess")
except ImportError as e:
    print(f"   ✗ subprocess: {e}")

# Test 3: Is openpyxl available?
print("\n3. openpyxl Status:")
try:
    import openpyxl
    print(f"   ✓ openpyxl (v{openpyxl.__version__}) - Installation needed: NO")
    openpyxl_installed = True
except ImportError:
    print(f"   ✗ openpyxl not found - Installation needed: YES")
    openpyxl_installed = False

# Summary
print("\n" + "=" * 60)
print("Summary:")
print(f"  Files present: {'YES' if all(os.path.exists(f) for f in files_needed) else 'NO'}")
print(f"  openpyxl available: {'NO (needs install)' if not openpyxl_installed else 'YES'}")
print("=" * 60)

print("\nTo run the full analysis, execute: python master_workflow.py")
