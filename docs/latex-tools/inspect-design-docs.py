"""Render the two design PDFs and audit page bounds, text and destinations.

Images are review intermediates. Delete the output directory after visual QA.
Requires pypdf, pdfplumber, pypdfium2 and Pillow.
"""
import json
import math
from pathlib import Path
import sys

import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tmp/design-docs/visual"
OUT.mkdir(parents=True, exist_ok=True)
targets = [
    ("architecture", ROOT / "docs/70-architecture-design/TankStorm-Architecture-v0.40.0.pdf"),
    ("detailed", ROOT / "docs/71-detailed-design/TankStorm-Detailed-Design-v0.40.0.pdf"),
]
summary = []
for name, path in targets:
    reader = PdfReader(path)
    raster = pdfium.PdfDocument(path)
    doc_out = OUT / name
    doc_out.mkdir(exist_ok=True)
    texts = []
    issues = []
    count = len(reader.pages)
    outlines = []

    def inspect_outline(items):
        for item in items:
            if isinstance(item, list):
                inspect_outline(item)
            else:
                index = reader.get_destination_page_number(item)
                if index is None or not 0 <= index < count:
                    issues.append({"kind": "bad_outline", "title": item.title})
                outlines.append({"title": item.title, "page": index + 1 if index is not None else None})

    inspect_outline(reader.outline)
    with pdfplumber.open(path) as positioned:
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            texts.append(text)
            if not text.strip():
                issues.append({"kind": "empty_page", "page": index + 1})
            if "\ufffd" in text or "??" in text:
                issues.append({"kind": "replacement_or_unresolved", "page": index + 1})
            for char in positioned.pages[index].chars:
                if char["x0"] < -0.5 or char["x1"] > float(page.mediabox.width) + 0.5 or char["top"] < -0.5 or char["bottom"] > float(page.mediabox.height) + 0.5:
                    issues.append({"kind": "out_of_page", "page": index + 1, "text": char["text"]})
            bitmap = raster[index].render(scale=1.7)
            image = bitmap.to_pil().convert("RGB")
            image.save(doc_out / f"page-{index + 1:02}.png")
            bitmap.close()
    if "坦克风云" not in "".join(texts):
        issues.append({"kind": "missing_chinese_text"})
    if name == "detailed":
        for term in ["未破防", "单次制造", "Attack", "归队"]:
            if term not in "".join(texts):
                issues.append({"kind": "missing_expected_term", "term": term})
    (doc_out / "extracted.txt").write_text("\n\f\n".join(texts), encoding="utf-8")
    font = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 18)
    for start in range(0, count, 6):
        sheet = Image.new("RGB", (900, 1980), "#dfe6e2")
        draw = ImageDraw.Draw(sheet)
        for offset, index in enumerate(range(start, min(start + 6, count))):
            page_image = Image.open(doc_out / f"page-{index + 1:02}.png")
            page_image.thumbnail((420, 605))
            x, y = 15 + (offset % 2) * 450, 30 + (offset // 2) * 655
            sheet.paste(page_image, (x, y))
            draw.text((x, y + 610), f"{name} | PDF page {index + 1} / {count}", fill="#183630", font=font)
        sheet.save(OUT / f"{name}-contact-{start // 6 + 1:02}.png")
    summary.append({"document": name, "pages": count, "bytes": path.stat().st_size, "characters": sum(map(len, texts)), "outlines": outlines, "issues": issues})
    raster.close()
(OUT / "inspection.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps([{k: v for k, v in item.items() if k != "outlines"} for item in summary], ensure_ascii=False, indent=2))
if any(item["issues"] for item in summary):
    raise SystemExit(1)
