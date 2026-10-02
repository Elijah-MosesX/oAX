"""Install the pinned Clicky reference source, without executing upstream code."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import urllib.request
import zipfile

COMMIT = "a80fa80721a8aebe51a170a7780705024ebc6e46"
SHA256 = "a629892821a7f85122de86cc2a36738f2db7a2befe349e9259ef1f1c7272171b"
URL = f"https://codeload.github.com/farzaa/clicky/zip/{COMMIT}"


def install():
    workspace = Path(__file__).resolve().parent.parent
    cache = workspace / ".tools" / "clicky"
    cache.mkdir(parents=True, exist_ok=True)
    if cache.resolve() != cache or any(p.is_symlink() for p in [cache, cache.parent]):
        raise ValueError("Redirected tool directory")
    archive = cache / "source.zip"
    if archive.is_symlink():
        raise ValueError("Redirected archive")
    if not archive.exists():
        with urllib.request.urlopen(URL, timeout=60) as response:
            data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != SHA256:
            raise ValueError("Archive checksum mismatch")
        with archive.open("xb") as stream:
            stream.write(data)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
        raise ValueError("Archive checksum mismatch")
    destination = cache / COMMIT
    destination.mkdir(exist_ok=True)
    if destination.resolve() != destination:
        raise ValueError("Redirected installation")
    hashes = {}
    with zipfile.ZipFile(archive) as source:
        entries = source.infolist()
        if len(entries) > 2000 or sum(e.file_size for e in entries) > 128 * 1024 * 1024:
            raise ValueError("Archive budget exceeded")
        for entry in entries:
            parts = PurePosixPath(entry.filename).parts
            if not parts or parts[0] != f"clicky-{COMMIT}" or any(
                p in ("..", ".") or ":" in p or "\\" in p for p in parts
            ):
                raise ValueError("Invalid archive path")
            target = destination.joinpath(*parts)
            if not target.resolve().is_relative_to(destination) or target.is_symlink():
                raise ValueError("Redirected source path")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            data = source.read(entry)
            # Preserve upstream symlink descriptions as inert text, never OS links.
            # No upstream scripts, worker, analytics or model clients are executed.
            mode = entry.external_attr >> 16
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                if target.read_bytes() != data:
                    raise ValueError(f"Installed source changed: {entry.filename}")
            else:
                with target.open("xb") as stream:
                    stream.write(data)
            hashes[entry.filename] = {
                "sha256": hashlib.sha256(data).hexdigest(),
                "upstreamSymlink": stat.S_ISLNK(mode),
            }
    record = {
        "repository": "https://github.com/farzaa/clicky",
        "commit": COMMIT,
        "archiveSha256": SHA256,
        "source": str(destination / f"clicky-{COMMIT}"),
        "mode": "reference-source-only",
        "files": hashes,
    }
    record_path = cache / "installation.json"
    if record_path.is_symlink() or record_path.resolve() != record_path:
        raise ValueError("Redirected installation record")
    record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(hashes)} Clicky source files at {record['source']}")
    print("Native application requires macOS 14.2+ and Xcode; no upstream service started.")


if __name__ == "__main__":
    install()
