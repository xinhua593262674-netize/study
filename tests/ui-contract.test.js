const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ui = path.join(__dirname, "../ui");
const pages = [
  "index.html",
  "textbook-validation.html",
  "knowledge-diff.html",
  "release.html",
  "knowledge-table.html",
  "textbook-preview.html",
  "knowledge-graph.html",
];

test("全部业务页面接入共享真实数据脚本", () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(ui, page), "utf8");
    assert.match(html, /app\.js/, `${page} 未接入共享真实数据脚本`);
  }
});

test("前端包含全量题库、完整知识表和本地审核流转能力", () => {
  const app = fs.readFileSync(path.join(ui, "app.js"), "utf8");
  for (const capability of ["hydrateAllQuestionDrawer", "hydratePageQuestionData", "hydrateKnowledgeTable", "updateLocalQuestion", "hydrateReleasePage", "hydrateTextbookPages"]) {
    assert.match(app, new RegExp(`function ${capability}`), `缺少 ${capability}`);
  }
});
