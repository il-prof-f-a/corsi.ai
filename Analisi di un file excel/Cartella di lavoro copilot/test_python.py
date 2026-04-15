import subprocess
import sys

result = subprocess.run([sys.executable, "-c", "print('Python works')"], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
