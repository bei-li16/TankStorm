"""Fetch pinned official Godot editor and only the Windows entries of its template ZIP.

Run from repository root. HTTP ranges avoid downloading other platforms' templates.
Python's ZIP reader verifies the CRC of every extracted member.
"""
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

VERSION = "4.6.2-stable"
BASE = f"https://github.com/godotengine/godot-builds/releases/download/{VERSION}/"
ROOT = Path(__file__).resolve().parent.parent / ".tools"


class RemoteZip(io.RawIOBase):
    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0

    def seekable(self):
        return True

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos

    def tell(self):
        return self.pos

    def read(self, size=-1):
        size = self.size - self.pos if size < 0 else min(size, self.size - self.pos)
        if size <= 0:
            return b""
        request = urllib.request.Request(
            self.url + "?range=" + str(self.pos),
            headers={"Range": f"bytes={self.pos}-{self.pos+size-1}"},
        )
        with urllib.request.urlopen(request, timeout=180) as response:
            if response.status != 206:
                raise RuntimeError("Download server did not honor the requested byte range")
            data = response.read()
        self.pos += len(data)
        return data


def main():
    ROOT.mkdir(exist_ok=True)
    editor_name = f"Godot_v{VERSION}_win64.exe.zip"
    editor = ROOT / "godot.zip"
    if not editor.exists():
        urllib.request.urlretrieve(BASE + editor_name, editor)
    sums = urllib.request.urlopen(BASE + "SHA512-SUMS.txt").read().decode()
    expected = next(line.split()[0] for line in sums.splitlines() if line.endswith(editor_name))
    if hashlib.sha512(editor.read_bytes()).hexdigest() != expected:
        raise RuntimeError("Godot editor SHA-512 checksum mismatch")
    with zipfile.ZipFile(editor) as archive:
        for entry in archive.infolist():
            if entry.filename.endswith(".exe"):
                target = ROOT / "godot" / Path(entry.filename).name
                target.parent.mkdir(exist_ok=True)
                target.write_bytes(archive.read(entry))
    names = ["windows_debug_x86_64.exe", "windows_release_x86_64.exe"]
    if all((ROOT / "templates" / n).exists() for n in names):
        print("Godot Windows toolchain ready (cached).")
        return
    # Size is pinned to this immutable release; no GitHub API quota is required.
    template_url = BASE + f"Godot_v{VERSION}_export_templates.tpz"
    with zipfile.ZipFile(RemoteZip(template_url, 1251900388)) as archive:
        for name in ["windows_debug_x86_64.exe", "windows_release_x86_64.exe"]:
            target = ROOT / "templates" / name
            target.parent.mkdir(exist_ok=True)
            if not target.exists():
                target.write_bytes(archive.read("templates/" + name))
            print(target)
    print("Godot Windows toolchain ready.")


if __name__ == "__main__":
    main()
