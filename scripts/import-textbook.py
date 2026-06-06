import json
import os
import re
import unicodedata
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "data", "economy-textbook.json")
SOURCE_DIR = os.environ.get("ECONOMY_SOURCE_DIR")
if not SOURCE_DIR:
    raise RuntimeError("请设置 ECONOMY_SOURCE_DIR，指向经济科目原始资料目录")

source = os.path.join(SOURCE_DIR, "2026-建设工程经济.pdf")
pages = []
for index, page in enumerate(PdfReader(source).pages, 1):
    text = unicodedata.normalize("NFKC", page.extract_text() or "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    pages.append({"page": index, "text": text, "sourceStatus": "已解析" if text else "无可提取文本"})

with open(OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(pages, handle, ensure_ascii=False, indent=2)
print(f"已导入教材 {len(pages)} 页")
