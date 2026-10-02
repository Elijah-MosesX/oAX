"""Install the reviewed pinned source and frozen wheel-only dependencies locally."""

import hashlib
import json
import os
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

COMMIT = "1231850a0bf1a0c0341fe408ef1668dbbfdfac46"
SHA256 = "61e3edab5be79a857647660bd24e60127b9a5881d71cf81f2c7d98bd99202b9d"
UV = "0.12.22"
if sys.version_info < (3, 12):
    raise RuntimeError(
        "Jev requires Python 3.12 or newer; verified oAX setup uses 3.12"
    )
root = Path(__file__).resolve().parent.parent
tools = root / ".tools"
tools.mkdir(exist_ok=True)
if tools.is_symlink() or tools.resolve() != tools:
    raise RuntimeError("Tools directory must be workspace-local")
archive = tools / "jev-source" / "upstream.zip"
archive.parent.mkdir(exist_ok=True)
if archive.parent.is_symlink() or archive.parent.resolve() != archive.parent:
    raise RuntimeError("Archive directory is redirected")
if not archive.exists():
    with urllib.request.urlopen(
        f"https://codeload.github.com/browser-use/jev-ultrafast/zip/{COMMIT}",
        timeout=60,
    ) as response:
        data = response.read(16 * 1024 * 1024 + 1)
    if len(data) > 16 * 1024 * 1024:
        raise RuntimeError("Source archive exceeded budget")
    archive.write_bytes(data)
if hashlib.sha256(archive.read_bytes()).hexdigest() != SHA256:
    raise RuntimeError("Pinned source checksum mismatch")
source = tools / "jev-source" / COMMIT
if not source.exists():
    source.mkdir()
    with zipfile.ZipFile(archive) as package:
        total = 0
        for entry in package.infolist():
            relative = Path(*Path(entry.filename).parts[1:])
            target = source / relative
            total += entry.file_size
            if (
                relative.is_absolute()
                or ".." in relative.parts
                or total > 40 * 1024 * 1024
            ):
                raise RuntimeError("Invalid source archive")
            if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise RuntimeError("Source archive symlink denied")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(package.read(entry))
if source.is_symlink() or source.resolve() != source:
    raise RuntimeError("Source directory is redirected")
# Verify existing extracts as well; never bless modified source or lockfiles.
with zipfile.ZipFile(archive) as package:
    for entry in package.infolist():
        relative = Path(*Path(entry.filename).parts[1:])
        if entry.is_dir() or not (
            relative.suffix in {".py", ".js"}
            or relative.name in {"uv.lock", "pyproject.toml"}
        ):
            continue
        target = source / relative
        if (
            not target.resolve().is_relative_to(source)
            or target.is_symlink()
            or target.read_bytes() != package.read(entry)
        ):
            raise RuntimeError("Extracted source or frozen dependency lock changed")
uv_target = tools / "uv-install"
for local in (uv_target, tools / "uv-cache", source / ".venv"):
    if local.is_symlink() or (local.exists() and local.resolve() != local):
        raise RuntimeError("Installation directories must not be redirected")
env = {
    **os.environ,
    "UV_CACHE_DIR": str(tools / "uv-cache"),
    "UV_PYTHON_DOWNLOADS": "never",
}
if not (uv_target / "uv").exists():
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--only-binary=:all:",
            "--target",
            str(uv_target),
            f"uv=={UV}",
        ],
        check=True,
        env=env,
    )
uv_python = [sys.executable, "-m", "uv"]
env["PYTHONPATH"] = str(uv_target)
subprocess.run(
    [
        *uv_python,
        "sync",
        "--frozen",
        "--no-build",
        "--no-install-project",
        "--python",
        sys.executable,
    ],
    cwd=source,
    env=env,
    check=True,
)
python = source / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
site = subprocess.check_output(
    [str(python), "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"],
    text=True,
).strip()
# Install the reviewed source as an importable path without an unpinned build backend.
(Path(site) / "oax-jev-source.pth").write_text(str(source) + "\n", encoding="utf-8")
hashes = {
    str(file.relative_to(source)).replace("\\", "/"): hashlib.sha256(
        file.read_bytes()
    ).hexdigest()
    for file in (source / "jev_ultrafast").rglob("*")
    if file.suffix in {".py", ".js"}
}
descriptor = {
    "version": "0.1",
    "commit": COMMIT,
    "archiveSha256": SHA256,
    "uv": UV,
    "python": str(python),
    "source": str(source),
    "hashes": hashes,
}
(tools / "jev-install.json").write_text(
    json.dumps(descriptor, indent=2) + "\n", encoding="utf-8"
)
print(
    "Pinned Jev source and frozen dependencies installed. No browser daemon or model request started."
)
