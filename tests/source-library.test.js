const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../ui/source-content");
const documents = ["questions-2021", "questions-2022", "questions-2023", "questions-2024", "questions-2025", "textbook-2026"];
const sourceLibraryAvailable = fs.existsSync(root);

test("完整资料库包含教材与五年真题", { skip: !sourceLibraryAvailable }, () => {
  for (const document of documents) {
    const file = path.join(root, `${document}.html`);
    assert.ok(fs.existsSync(file), `${document} 不存在`);
    assert.ok(fs.statSync(file).size > 50_000, `${document} 内容不完整`);
  }
});

test("完整资料库中的全部图片引用有效", { skip: !sourceLibraryAvailable }, () => {
  for (const document of documents) {
    const html = fs.readFileSync(path.join(root, `${document}.html`), "utf8");
    for (const match of html.matchAll(/<img src="([^"]+)"/g)) {
      const image = path.join(root, decodeURIComponent(match[1]));
      assert.ok(fs.existsSync(image), `${document} 图片不存在：${image}`);
    }
  }
});

test("完整资料库保留表格与图片", { skip: !sourceLibraryAvailable }, () => {
  const textbook = fs.readFileSync(path.join(root, "textbook-2026.html"), "utf8");
  assert.ok((textbook.match(/<img /g) || []).length >= 67);
  assert.ok((textbook.match(/<table>/g) || []).length > 50);
});
