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
  const css = fs.readFileSync(path.join(ui, "app.css"), "utf8");
  for (const capability of ["hydrateAllQuestionDrawer", "hydratePageQuestionData", "hydrateKnowledgeTable", "updateLocalQuestion", "hydrateReleasePage", "hydrateTextbookPages", "findQuestionEvidence", "findQuestionEvidences", "scoreQuestionEvidence", "groupTextbookParagraphs", "getTextbookParagraphs", "renderTextbookPage", "renderTextbookTable", "renderTextbookMediaBlock", "typesetTextbookMath", "renderQuestionOptions"]) {
    assert.match(app, new RegExp(`function ${capability}`), `缺少 ${capability}`);
  }
  for (const capability of ["textbook-page:selected", "textbook-evidence:selected", "textbook-evidence:visible"]) {
    assert.match(app, new RegExp(capability), `缺少教材真题联动事件 ${capability}`);
  }
  for (const capability of ["question-evidence-highlight", "evidence-question-count", "question-options", "evidence-confidence", "textbook-continuous", "textbook-page-section"]) {
    assert.match(css, new RegExp(capability), `缺少教材真题联动样式 ${capability}`);
  }
});

test("教材页面接入公式排版能力", () => {
  for (const page of ["textbook-preview.html", "textbook-validation.html"]) {
    const html = fs.readFileSync(path.join(ui, page), "utf8");
    assert.match(html, /MathJax/, `${page} 未接入公式排版`);
    assert.match(html, /tex-mml-chtml\.js/, `${page} 未加载公式渲染脚本`);
  }
});

test("教材预览采用连续滑动且不保留翻页按钮", () => {
  const html = fs.readFileSync(path.join(ui, "textbook-preview.html"), "utf8");
  const app = fs.readFileSync(path.join(ui, "app.js"), "utf8");
  assert.doesNotMatch(html, />上一页</);
  assert.doesNotMatch(html, />下一页</);
  assert.match(app, /IntersectionObserver/);
  assert.match(app, /findQuestionEvidences/);
});
