import base64
import json
import mimetypes
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data" / "economy-textbook.json"
SOURCE_DIR = Path(os.environ.get("ECONOMY_SOURCE_DIR", ""))
if not SOURCE_DIR:
    raise RuntimeError("请设置 ECONOMY_SOURCE_DIR，指向经济科目原始资料目录")

source_folder = SOURCE_DIR / "2026-建设工程经济"
source_md = next(source_folder.glob("*.md"))
assets = source_folder / "assets"


def image_data_url(relative_path):
    path = source_folder / relative_path
    mime = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def parse_table(lines):
    rows = []
    for index, line in enumerate(lines):
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if index == 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)
    return {"type": "table", "headers": rows[0] if rows else [], "rows": rows[1:]}


def clean_plain_text(value):
    value = re.sub(r"!\[[^\]]*]\([^)]*\)", "", value)
    value = re.sub(r"[#*_`$]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_page(markdown):
    lines = markdown.splitlines()
    blocks = []
    plain = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        heading = re.match(r"^(#{1,6})\s+(.+)$", line)
        image = re.match(r"^!\[([^\]]*)]\(([^)]+)\)$", line)
        if heading:
            text = heading.group(2).strip()
            blocks.append({"type": "heading", "level": len(heading.group(1)), "text": text})
            plain.append(text)
            index += 1
            continue
        if image:
            relative_path = image.group(2)
            blocks.append({
                "type": "image",
                "alt": image.group(1) or Path(relative_path).name,
                "src": image_data_url(relative_path),
            })
            index += 1
            continue
        if line == "$$":
            formula = []
            index += 1
            while index < len(lines) and lines[index].strip() != "$$":
                formula.append(lines[index].strip())
                index += 1
            blocks.append({"type": "formula", "latex": "\n".join(formula).strip()})
            index += 1
            continue
        if line.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            table = parse_table(table_lines)
            blocks.append(table)
            plain.extend(table["headers"])
            for row in table["rows"]:
                plain.extend(row)
            continue
        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip():
            candidate = lines[index].strip()
            if candidate.startswith("#") or candidate.startswith("|") or candidate == "$$" or re.match(r"^!\[", candidate):
                break
            paragraph.append(candidate)
            index += 1
        text = "".join(paragraph)
        blocks.append({"type": "paragraph", "text": text})
        plain.append(text)
    return blocks, "\n".join(clean_plain_text(item) for item in plain if clean_plain_text(item))


markdown = source_md.read_text(encoding="utf-8")
markdown_pages = re.split(r"(?m)^---\s*$", markdown)
if len(markdown_pages) != 388:
    raise RuntimeError(f"教材 Markdown 分页异常：期望 388 页，实际 {len(markdown_pages)} 页")

pages = []
for page_number, markdown_page in enumerate(markdown_pages, 1):
    blocks, text = parse_page(markdown_page)
    pages.append({
        "page": page_number,
        "text": text,
        "blocks": blocks,
        "sourceStatus": "已解析" if blocks else "无可提取内容",
    })

OUTPUT.write_text(json.dumps(pages, ensure_ascii=False, indent=2), encoding="utf-8")
image_count = sum(block["type"] == "image" for page in pages for block in page["blocks"])
table_count = sum(block["type"] == "table" for page in pages for block in page["blocks"])
formula_count = sum(block["type"] == "formula" for page in pages for block in page["blocks"])
print(f"已导入教材 {len(pages)} 页、{image_count} 张图片、{table_count} 个表格、{formula_count} 个公式")
