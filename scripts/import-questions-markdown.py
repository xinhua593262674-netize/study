import glob
import json
import os
import re
import unicodedata

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
    value = unicodedata.normalize("NFKC", value)
    value = re.sub(r"https://master\.haixue\.com/printPage\s*\n?\d*/?\d*", "", value)
    value = re.sub(r"\n---\n", "\n", value)
    return re.sub(r"\s+", " ", value).strip()


def sequential_blocks(text, pattern):
    matches = list(re.finditer(pattern, text, re.M))
    selected = []
    expected = 1
    for match in matches:
        if int(match.group(1)) == expected:
            selected.append(match)
            expected += 1
    return [(match, text[match.end(): selected[index + 1].start() if index + 1 < len(selected) else len(text)]) for index, match in enumerate(selected)]


records = []
for filename in sorted(glob.glob(os.path.join(SOURCE_DIR, "*真题", "*.md"))):
    year = int(os.path.basename(filename)[:4])
    text = open(filename, encoding="utf-8").read()
    split = re.split(rf"(?m)^#?\s*{year}年.*?答案及解析\s*$", text, maxsplit=1)
    if len(split) != 2:
        raise RuntimeError(f"{filename} 未找到答案及解析分隔标题")
    question_part, answer_part = split
    question_blocks = sequential_blocks(question_part, r"^(\d+)、")
    answer_blocks = sequential_blocks(answer_part, r"^(?:#{1,4}\s*)?(\d+)、正确答案：([A-E]+)\s*$")
    if len(question_blocks) != len(answer_blocks):
        raise RuntimeError(f"{year} 年题目 {len(question_blocks)} 与答案 {len(answer_blocks)} 数量不一致")

    for index, ((_, question_body), (answer_match, answer_body)) in enumerate(zip(question_blocks, answer_blocks), 1):
        option_matches = list(re.finditer(r"(?m)^([A-E])、", question_body))
        stem = clean(question_body[:option_matches[0].start()] if option_matches else question_body)
        options = []
        answer = answer_match.group(2)
        for position, option_match in enumerate(option_matches):
            end = option_matches[position + 1].start() if position + 1 < len(option_matches) else len(question_body)
            options.append({
                "label": option_match.group(1),
                "content": clean(question_body[option_match.end():end]),
                "isCorrect": option_match.group(1) in answer,
            })
        analysis_match = re.search(r"试题解析：(.*?)(?:\n关联考点：|\Z)", answer_body, re.S)
        knowledge_match = re.search(r"关联考点：(.*?)(?:\n|\Z)", answer_body, re.S)
        analysis = clean(analysis_match.group(1)) if analysis_match else "原文件未提供试题解析"
        knowledge = clean(knowledge_match.group(1)) if knowledge_match else "待人工关联"
        question_id = next((alias for key, alias in ALIASES.items() if key in knowledge and alias.startswith(f"econ-{year}")), f"econ-{year}-{index:03d}")
        records.append({
            "id": question_id,
            "year": year,
            "type": "多选题" if len(answer) > 1 else "单选题",
            "stem": stem,
            "options": options,
            "answer": answer,
            "analysis": analysis,
            "knowledge": knowledge,
            "sourceFile": filename,
            "sourceStatus": "已解析",
            "reviewStatus": "待初审",
        })

with open(OUTPUT, "w", encoding="utf-8") as handle:
    json.dump(records, handle, ensure_ascii=False, indent=2)
print(f"已从 Markdown 导入 {len(records)} 条完整真题")
