#!/usr/bin/env python3
"""Check this build's native launch on an isolated Android CI emulator."""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path


PACKAGE = "app.momentumvelo"
ACTIVITY = PACKAGE + "/.LauncherActivity"
BROWSER = "com.android.chrome"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    result = {
        "package": PACKAGE,
        "native_launches": [],
        "passed": False,
        "web_content_verified": False,
        "authentication_verified": False,
        "play_signing_verified": False,
    }
    adb = shutil.which("adb")
    if not adb:
        raise RuntimeError("Android platform-tools are required")

    def run(*command, binary=False, check=True, timeout=30):
        completed = subprocess.run(
            command, capture_output=True, text=not binary, timeout=timeout
        )
        if check and completed.returncode:
            raise RuntimeError("Android test command failed: " + command[0])
        return completed.stdout

    devices = run(adb, "devices").splitlines()[1:]
    connected = [line.split()[0] for line in devices if line.split()[1:] == ["device"]]
    # Never install, stop apps or capture the screen on someone's physical phone.
    if len(connected) != 1 or not connected[0].startswith("emulator-"):
        raise RuntimeError("Exactly one isolated emulator is required")
    serial = connected[0]

    def device(*command, **kwargs):
        return run(adb, "-s", serial, *command, **kwargs)

    if device("shell", "getprop", "ro.kernel.qemu").strip() != "1":
        raise RuntimeError("The connected device is not an emulator")
    if device("shell", "getprop", "sys.boot_completed").strip() != "1":
        raise RuntimeError("The emulator has not completed boot")
    apks = sorted(args.artifact_dir.rglob("app-debug.apk"))
    if len(apks) != 1:
        raise RuntimeError("Exactly one debug APK from this workflow is required")
    apk = apks[0].resolve()
    if not apk.is_relative_to(args.artifact_dir.resolve()):
        raise RuntimeError("The APK must belong to the workflow artifact")

    result["apk_sha256"] = hashlib.sha256(apk.read_bytes()).hexdigest()
    result["api"] = device("shell", "getprop", "ro.build.version.sdk").strip()
    result["abi"] = device("shell", "getprop", "ro.product.cpu.abi").strip()
    if result["api"] != "36":
        raise RuntimeError("This check requires the configured API 36 emulator")
    if not device("shell", "pm", "path", BROWSER).strip().startswith("package:"):
        raise RuntimeError("The Google Play emulator image must provide Chrome")
    installed = device("install", "-r", "-t", str(apk), timeout=60)
    if "Success" not in installed:
        raise RuntimeError("Android did not confirm APK installation")

    try:
        device("logcat", "-c")
        for number in range(1, 4):
            device("shell", "am", "force-stop", PACKAGE)
            launched = device("shell", "am", "start", "-W", "-n", ACTIVITY)
            (args.output / f"launch-{number}.txt").write_text(launched)
            if not re.search(r"^Status:\s*ok\s*$", launched, re.MULTILINE):
                raise RuntimeError("Activity Manager did not confirm native launch")
            if re.search(r"Error:|Exception", launched):
                raise RuntimeError("Activity Manager reported a launch error")

            activity = ""
            deadline = time.monotonic() + 20
            while time.monotonic() < deadline:
                activity = device("shell", "dumpsys", "activity", "activities")
                if re.search(r"(?:mResumedActivity|topResumedActivity).*com\.android\.chrome/", activity):
                    break
                time.sleep(0.5)
            else:
                (args.output / f"activities-{number}.txt").write_text(activity)
                raise RuntimeError("The launch did not hand control to Chrome")

            # Observe after the handoff as well: a late native exception still fails.
            time.sleep(2)
            runtime = device("logcat", "-d", "-v", "brief", "AndroidRuntime:E", "*:S")
            (args.output / "android-runtime.txt").write_text(runtime)
            for block in runtime.split("FATAL EXCEPTION:")[1:]:
                if re.search(r"Process:\s*app\.momentumvelo(?:,|\s)", block):
                    raise RuntimeError("MomentumVelo crashed after native launch")
            exits = device("shell", "dumpsys", "activity", "exit-info", PACKAGE)
            (args.output / "process-exit-info.txt").write_text(exits)
            if re.search(r"reason=\s*[456]\b", exits):
                raise RuntimeError("Android recorded a crash or ANR for MomentumVelo")

            component = re.search(r"(?:mResumedActivity|topResumedActivity)[^\n]*", activity)
            result["native_launches"].append({
                "number": number,
                "activity_manager": "ok",
                "browser_handoff": True,
                "browser_first_run": "FirstRun" in (component.group(0) if component else ""),
            })
            (args.output / f"startup-{number}.png").write_bytes(
                device("exec-out", "screencap", "-p", binary=True)
            )
            device("shell", "input", "keyevent", "KEYCODE_HOME")
        result["passed"] = True
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        result["failure"] = str(error)
        raise
    finally:
        (args.output / "native-startup.json").write_text(json.dumps(result, indent=2))
        print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print("Native startup check failed: " + str(error), file=sys.stderr)
        sys.exit(1)
