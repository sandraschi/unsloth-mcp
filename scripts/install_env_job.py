"""Environment install job - runs the official Unsloth installer.

Executed by the job worker (kind="install"). Runs:
  irm https://unsloth.ai/install.ps1 | iex
in a hidden PowerShell process with autostart skipped, streaming output to
the job log (stdout is inherited by the worker's log file). Torch is ~2.8 GB
- this can take 10-30 minutes.
"""

import subprocess
import sys

if len(sys.argv) < 2:
    print("usage: install_env_job.py <config.json>", file=sys.stderr)
    sys.exit(2)

print("Unsloth environment installer starting (downloads ~2.8 GB PyTorch)...", flush=True)
cmd = (
    "$env:UNSLOTH_SKIP_AUTOSTART='1'; "
    "irm https://unsloth.ai/install.ps1 | iex"
)
proc = subprocess.Popen(
    ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
    stdout=None,  # inherit -> worker captures into the job log live
    stderr=subprocess.STDOUT,
    creationflags=0x08000000,  # CREATE_NO_WINDOW
)
exit_code = proc.wait()
if exit_code != 0:
    print(f"FATAL: installer exited {exit_code}", flush=True)
    sys.exit(exit_code or 1)
print("installer completed", flush=True)
sys.exit(0)
