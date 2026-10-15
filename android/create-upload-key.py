#!/usr/bin/env python3
"""Create a private upload key once. Passwords never appear in command output."""

import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", required=True, type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    directory = args.directory.resolve()
    directory.mkdir(parents=True, mode=0o700, exist_ok=True)
    keystore = directory / "momentumvelo-upload.p12"
    password = directory / "store-password.txt"
    if keystore.exists() or password.exists():
        parser.exit(1, "An upload key or password already exists. Nothing was overwritten.\n")
    descriptor = os.open(password, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(secrets.token_urlsafe(36) + "\n")
    result = subprocess.run([
        "keytool", "-genkeypair", "-noprompt", "-storetype", "PKCS12",
        "-keystore", str(keystore), "-storepass:file", str(password),
        "-keypass:file", str(password), "-alias", "momentumvelo-upload",
        "-keyalg", "RSA", "-keysize", "3072", "-sigalg", "SHA256withRSA",
        "-validity", "10000", "-dname", "CN=MomentumVelo Upload, O=MomentumVelo"
    ], capture_output=True, text=True)
    if result.returncode:
        password.unlink(missing_ok=True)
        keystore.unlink(missing_ok=True)
        parser.exit(1, "Key generation failed; no password was printed.\n")
    keystore.chmod(0o600)
    print(json.dumps({"created": True, "alias": "momentumvelo-upload",
                      "keystore": str(keystore), "password_file": str(password)}))


if __name__ == "__main__":
    main()
