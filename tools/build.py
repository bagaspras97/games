#!/usr/bin/env python3
"""Build upload-ready zips for each portal.

    python3 tools/build.py            # all platforms
    python3 tools/build.py crazygames # just one

Each zip contains index.html + src/ with window.PUFFY_PLATFORM set, so the game
loads the right SDK without any URL parameter. Output: release/puffy-<platform>.zip
"""
import shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLATFORMS = ["crazygames", "poki", "youtube", "facebook", "local"]
MARKER = '<script type="module" src="src/game.js"></script>'


def build(platform: str) -> Path:
    out_dir = ROOT / "dist" / platform
    if out_dir.exists():
        shutil.rmtree(out_dir)
    shutil.copytree(ROOT / "src", out_dir / "src")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert MARKER in html, "index.html changed: update MARKER in tools/build.py"
    html = html.replace(MARKER, f'<script>window.PUFFY_PLATFORM = "{platform}";</script>\n  {MARKER}')
    (out_dir / "index.html").write_text(html, encoding="utf-8")

    zip_path = ROOT / "release" / f"puffy-{platform}.zip"
    zip_path.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(out_dir.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(out_dir).as_posix())
    return zip_path


if __name__ == "__main__":
    for p in sys.argv[1:] or PLATFORMS:
        if p not in PLATFORMS:
            sys.exit(f"unknown platform {p!r}; choose from {PLATFORMS}")
        zp = build(p)
        print(f"{p:11s} -> {zp.relative_to(ROOT)}  ({zp.stat().st_size / 1024:.0f} KB)")
