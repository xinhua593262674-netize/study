const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { openDatabase } = require("../server/database");

const questions = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/economy-questions.json"), "utf8"));
const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/economy-knowledge.json"), "utf8"));
const textbook = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/economy-textbook.json"), "utf8"));

test("真实数据数量与年份分布完整", () => {
  assert.equal(questions.length, 397);
  assert.equal(knowledge.length, 631);
  assert.equal(textbook.length, 388);
  assert.deepEqual(
    Object.fromEntries([...new Set(questions.map((item) => item.year))].sort().map((year) => [year, questions.filter((item) => item.year === year).length])),
    { 2021: 80, 2022: 77, 2023: 80, 2024: 80, 2025: 80 },
  );
});

test("全部教材页面包含可展示正文", () => {
  assert.equal(textbook.filter((page) => !page.text.trim()).length, 0);
  assert.deepEqual(textbook.map((page) => page.page), Array.from({ length: 388 }, (_, index) => index + 1));
});

test("教材图片、公式和表格结构完整", () => {
  const blocks = textbook.flatMap((page) => page.blocks || []);
  assert.equal(textbook.filter((page) => !page.blocks?.length).length, 0);
  assert.equal(blocks.filter((block) => block.type === "image").length, 67);
  assert.ok(blocks.filter((block) => block.type === "table").length >= 90);
  assert.ok(blocks.filter((block) => block.type === "formula").length >= 250);
  assert.ok(blocks.filter((block) => block.type === "image").every((block) => block.src.startsWith("data:image/")));
});

test("全部真题包含真实题干、答案、解析和选项", () => {
  assert.equal(questions.filter((item) => item.stem.includes("来源题干待修复")).length, 0);
  assert.equal(questions.filter((item) => !item.stem || !item.answer || !item.analysis).length, 0);
  assert.equal(questions.filter((item) => item.options.length < 4).length, 0);
  assert.equal(questions.filter((item) => item.type === "单选题" && item.options.length !== 4).length, 0);
  assert.equal(questions.filter((item) => item.type === "多选题" && item.options.length !== 5).length, 0);
});

test("知识关联覆盖大多数真题且全部来源已完整解析", () => {
  const db = openDatabase(":memory:");
  assert.ok(db.prepare("SELECT COUNT(DISTINCT question_id) AS count FROM associations").get().count >= 300);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM questions WHERE source_status = '来源解析异常'").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM questions WHERE source_status != '已解析'").get().count, 0);
});
