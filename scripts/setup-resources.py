"""Install checksum-pinned optional authoring resources, never their hooks/services."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile

RESOURCES = {
    "hyperframes-browser": ("chrome-headless-shell-win64", "5d7df999a6e4a65a1b16b25b61064f7337b8aa8ee2ed1b4e07bfdd24f6e4275e"),
    "hyperframes": ("hyperframes-main", "41ddb38678274e8e883776a53ada6a338e9f9a6d9ea7d742046711afa4574a77"),
    "ponytail": ("ponytail-main", "b48bf3e09182b0c9b4ddeb7c3c520918c173ec73e8756285cf794cbac84d38f0"),
    "openmontage": ("OpenMontage-main", "bacf55796fc6166a5951ed356cbeaa83ca74ae868bd10d73105547432c4d725e"),
}


def install(name, archive):
    root, checksum = RESOURCES[name]
    if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
        raise ValueError("Resource archive checksum mismatch")
    tools = Path(__file__).resolve().parent.parent / ".tools"
    destination = tools / name / checksum[:12]
    if destination.resolve() != destination:
        raise ValueError("Redirected resource directory")
    hashes = {}
    with zipfile.ZipFile(archive) as source:
        entries = source.infolist()
        if len(entries) > (11000 if name == "hyperframes" else 5000) or sum(e.file_size for e in entries) > 1024**3:
            raise ValueError("Resource archive budget exceeded")
        for entry in entries:
            # Hyperframes includes duplicate skill-discovery symlinks. Never materialize them.
            if name == "hyperframes" and stat.S_ISLNK(entry.external_attr >> 16):
                continue
            parts = PurePosixPath(entry.filename).parts
            if not parts or parts[0] != root or any(
                p in ("..", ".") or ":" in p or "\\" in p for p in parts
            ) or stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError("Invalid resource archive path")
            target = destination.joinpath(*parts)
            if target.resolve() != target or not target.is_relative_to(destination):
                raise ValueError("Redirected resource file")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            data = source.read(entry)
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                if target.read_bytes() != data:
                    raise ValueError(f"Existing resource changed: {entry.filename}")
            else:
                with target.open("xb") as stream:
                    stream.write(data)
            hashes[entry.filename] = hashlib.sha256(data).hexdigest()
    receipt = destination / "installation.json"
    if receipt.resolve() != receipt:
        raise ValueError("Redirected receipt")
    receipt.write_text(json.dumps({"archiveSha256": checksum, "files": hashes}, indent=2) + "\n", encoding="utf8")
    print(f"Verified {len(hashes)} files: {destination / root}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", choices=RESOURCES)
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    install(args.name, args.archive)
