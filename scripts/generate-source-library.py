import html
import os
import re
import shutil
from pathlib import Path

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(os.environ.get("ECONOMY_SOURCE_DIR", ""))
OUTPUT = ROOT / "ui" / "source-content"

if not SOURCE_DIR.exists():
    raise RuntimeError("请设置 ECONOMY_SOURCE_DIR，指向经济科目原始资料目录")

documents = [
    (f"{year}年 一级建造师《建设工程经济》真题", f"{year} 年真题")
    for year in range(2021, 2026)
] + [("2026-建设工程经济", "2026 版教材")]

md = MarkdownIt("commonmark", {"html": True}).enable("table")
OUTPUT.mkdir(parents=True, exist_ok=True)

style = """
*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#243049;font:16px/1.85 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.top{position:sticky;top:0;z-index:5;padding:12px 24px;background:#17213a;color:#fff;display:flex;align-items:center;gap:16px}.top a{color:#cdd7ee;text-decoration:none}.top b{margin-right:auto}
article{max-width:1040px;margin:24px auto;padding:42px 58px;background:#fff;box-shadow:0 4px 24px #23304a18;border-radius:8px}h1{font-size:30px;border-bottom:2px solid #3159d9;padding-bottom:14px}h2{margin-top:40px;border-left:4px solid #3159d9;padding-left:12px}h3{margin-top:28px;color:#31466f}h4{margin-top:22px}img{display:block;max-width:100%;height:auto;margin:20px auto}table{width:100%;border-collapse:collapse;margin:20px 0;font-size:14px}th,td{border:1px solid #ccd4e2;padding:8px 10px;text-align:left}th{background:#eef2fa}hr{border:0;border-top:1px solid #dfe4ed;margin:34px 0}blockquote{margin:18px 0;padding:10px 16px;background:#f4f6fa;border-left:4px solid #9badde}p{white-space:normal}.math{overflow:auto}
@media(max-width:900px){article{margin:0;padding:22px;border-radius:0}.top{padding:10px 14px}}
"""

cards = []
for folder_name, title in documents:
    source_folder = SOURCE_DIR / folder_name
    source_md = next(source_folder.glob("*.md"))
    slug = "textbook-2026" if folder_name.startswith("2026") else f"questions-{folder_name[:4]}"
    asset_output = OUTPUT / f"{slug}-assets"
    if asset_output.exists():
        shutil.rmtree(asset_output)
    source_assets = source_folder / "assets"
    if source_assets.exists():
        shutil.copytree(source_assets, asset_output)

    markdown = source_md.read_text(encoding="utf-8")
    markdown = re.sub(r"https://master\.haixue\.com/printPage\s*\n?\d*/?\d*", "", markdown)
    markdown = markdown.replace("(assets/", f"({slug}-assets/")
    content = md.render(markdown)
    output_file = OUTPUT / f"{slug}.html"
    output_file.write_text(
        f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>{html.escape(title)}</title><style>{style}</style></head>'
        f'<body><nav class="top"><b>{html.escape(title)}</b><a href="../source-documents.html">资料目录</a><a href="#" onclick="window.print();return false">打印</a></nav><article>{content}</article></body></html>',
        encoding="utf-8",
    )
    image_count = len(list(source_assets.glob("*"))) if source_assets.exists() else 0
    cards.append((title, output_file.name, image_count, len(markdown)))

card_html = "".join(
    f'<a class="source-card" href="source-content/{filename}"><b>{html.escape(title)}</b><span>完整正文 · {image_count} 张图片 · {size:,} 字符</span></a>'
    for title, filename, image_count, size in cards
)
(ROOT / "ui" / "source-documents.html").write_text(
    f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>原始资料库</title><link rel="stylesheet" href="secondary.css"><link rel="stylesheet" href="app.css"></head><body><script src="page-shell.js"></script><script>'
    f'shell("原始资料库","原始资料库","完整教材与历年真题 / 保留图片、表格、公式和解析",`<div class="page"><div class="card"><div class="card-head">完整资料文件 <span class="push badge g">Markdown 原文优先</span></div><div class="source-grid">{card_html}</div></div></div>`);'
    f'</script><script src="review-state.js"></script><script src="app.js"></script></body></html>',
    encoding="utf-8",
)
print(f"已生成 {len(cards)} 份完整资料网页")
