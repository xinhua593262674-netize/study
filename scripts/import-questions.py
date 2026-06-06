import glob
import json
import os
import re
import unicodedata
from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "data", "economy-questions.json")
SOURCE_DIR = os.environ.get("ECONOMY_SOURCE_DIR")
if not SOURCE_DIR:
    raise RuntimeError("请设置 ECONOMY_SOURCE_DIR，指向经济科目原始资料目录")
ALIASES = {
    "财务评价的内容": "econ-2025-finance-eval",
    "设备的经济寿命": "econ-2025-equipment-life",
    "现金流量图和现金流量表": "econ-2025-cash-flow",
    "采用成本分析模式确定最佳现金持有量": "econ-2024-cash-holding",
    "现金管理的方法": "econ-2023-cash-management",
    "会计等式的形式": "econ-2021-accounting-elements",
}


def clean(value):
    value = unicodedata.normalize("NFKC", value).replace("\x00", "□")
    return re.sub(r"\s+", " ", value).strip()

def parse_question(chunk):
    chunk = re.sub(r"https://master\.haixue\.com/printPage\s*\d+/\d+", "", chunk)
    chunk = unicodedata.normalize("NFKC", chunk).replace("\x00", "□")
    option_matches = list(re.finditer(r"(?m)^\s*([A-D])、", chunk))
    stem = clean(chunk[:option_matches[0].start()]) if option_matches else clean(chunk)
    options = []
    for position, match in enumerate(option_matches):
        end = option_matches[position + 1].start() if position + 1 < len(option_matches) else len(chunk)
        options.append({"label": match.group(1), "content": clean(chunk[match.end():end])})
    return stem, options


records = []
for filename in sorted(glob.glob(os.path.join(SOURCE_DIR, "*真题.pdf"))):
    year = int(os.path.basename(filename)[:4])
    text = "\n".join(page.extract_text() or "" for page in PdfReader(filename).pages)
    answer_chunks = text.split("正确答案：")[1:]
    question_chunks = re.split(r"\n\x00+、", text.split("正确答案：")[0])[1:]
    question_chunks = [chunk for chunk in question_chunks if clean(chunk)]
    for index, chunk in enumerate(answer_chunks, 1):
        answer = clean(chunk.splitlines()[0]).replace(" ", "")
        analysis_match = re.search(r"试题解析：(.*?)(?:关联考点：|https://|\Z)", chunk, re.S)
        point_match = re.search(r"关联考点：(.*?)(?:https://|\n.*?正确答案：|\Z)", chunk, re.S)
        analysis = clean(analysis_match.group(1)) if analysis_match else "原文件未提供可解析的试题解析"
        knowledge = clean(point_match.group(1)) if point_match else "待人工关联"
        normalized = re.sub(r"^[?.\d]+", "", knowledge).strip()
        question_id = next((alias for key, alias in ALIASES.items() if key in normalized and alias.startswith(f"econ-{year}")), f"econ-{year}-{index:03d}")
        stem, options = parse_question(question_chunks[index - 1]) if index <= len(question_chunks) else ("来源题干待修复", [])
        records.append({
            "id": question_id,
            "year": year,
            "type": "多选题" if len(answer) > 1 else "单选题",
            "stem": stem,
            "options": [{**option, "isCorrect": option["label"] in answer} for option in options],
            "answer": answer,
            "analysis": analysis,
            "knowledge": normalized or "待人工关联",
            "sourceFile": filename,
            "sourceStatus": "部分数字缺失" if "□" in stem + "".join(option["content"] for option in options) else "已解析",
            "reviewStatus": "待初审",
        })

with open(OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(records, handle, ensure_ascii=False, indent=2)
print(f"已导入 {len(records)} 条真题解析记录")
