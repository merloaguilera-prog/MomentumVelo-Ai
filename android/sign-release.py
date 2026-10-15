#!/usr/bin/env python3
"""Sign an Android App Bundle without printing or committing signing secrets."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile


def run_java(command, **kwargs):
    result = subprocess.run(command, capture_output=True, text=True,
                            env={**os.environ, "LC_ALL": "C"}, **kwargs)
    if result.returncode:
        # Tool output can contain local paths or credential diagnostics.
        raise RuntimeError(f"{Path(command[0]).name} failed (exit {result.returncode}).")
    return result.stdout + result.stderr


def validate_bundle(path):
    with zipfile.ZipFile(path) as bundle:
        names = bundle.namelist()
        if "BundleConfig.pb" not in names or "base/manifest/AndroidManifest.xml" not in names:
            raise ValueError("The input is not an Android App Bundle.")
        if bundle.testzip():
            raise ValueError("The input bundle is damaged.")
        if any(name.upper().startswith("META-INF/") and
               name.upper().endswith((".SF", ".RSA", ".DSA", ".EC")) for name in names):
            raise ValueError("The input is already signed; build a fresh unsigned bundle.")


def sign(bundle, keystore, password_file, alias, output):
    bundle, keystore, password_file, output = map(Path, (bundle, keystore, password_file, output))
    validate_bundle(bundle)
    if not keystore.is_file() or not password_file.is_file():
        raise ValueError("A private keystore and password file are required.")
    output.mkdir(parents=True, exist_ok=True)
    signed = output / "MomentumVelo-1.0.0-play.aab"
    certificate = output / "upload-certificate.pem"
    manifest = output / "verification.json"
    if any(path.exists() for path in (signed, certificate, manifest)):
        raise ValueError("The output already exists; use a new directory.")

    # Stage all files before exposing a signed deliverable.
    with tempfile.TemporaryDirectory(prefix="momentumvelo-sign-") as temporary:
        stage = Path(temporary)
        staged_bundle = stage / signed.name
        shutil.copyfile(bundle, staged_bundle)
        run_java(["jarsigner", "-keystore", str(keystore.resolve()), "-storepass:file",
                  str(password_file.resolve()), "-keypass:file", str(password_file.resolve()),
                  "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256",
                  str(staged_bundle), alias])
        verification = run_java(["jarsigner", "-verify", str(staged_bundle)])
        if "jar verified." not in verification or "jar is unsigned" in verification:
            raise RuntimeError("The signed bundle could not be verified.")
        staged_certificate = stage / certificate.name
        run_java(["keytool", "-exportcert", "-rfc", "-keystore", str(keystore.resolve()),
                  "-storepass:file", str(password_file.resolve()), "-alias", alias,
                  "-file", str(staged_certificate)])
        der = subprocess.run(["keytool", "-exportcert", "-keystore", str(keystore.resolve()),
                              "-storepass:file", str(password_file.resolve()), "-alias", alias],
                             check=True, capture_output=True).stdout
        fingerprint = ":".join(f"{byte:02X}" for byte in hashlib.sha256(der).digest())
        data = {
            "package": "app.momentumvelo", "version_name": "1.0.0", "version_code": 1,
            "unsigned_bundle_sha256": hashlib.sha256(bundle.read_bytes()).hexdigest(),
            "signed_bundle_sha256": hashlib.sha256(staged_bundle.read_bytes()).hexdigest(),
            "upload_certificate_sha256": fingerprint,
            "signature_verified": True,
            "play_app_signing_certificate_verified": False,
            "physical_device_tested": False,
            "published_to_google_play": False,
        }
        shutil.copyfile(staged_bundle, signed)
        shutil.copyfile(staged_certificate, certificate)
        manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, type=Path)
    parser.add_argument("--keystore", required=True, type=Path)
    parser.add_argument("--password-file", required=True, type=Path)
    parser.add_argument("--alias", default="momentumvelo-upload")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = sign(args.bundle, args.keystore, args.password_file, args.alias, args.output)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, zipfile.BadZipFile) as error:
        parser.exit(1, f"Signing failed: {error}\n")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
