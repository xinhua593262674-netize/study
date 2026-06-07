const test = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase } = require("../server/database");
const { createService } = require("../server/service");

function setup() {
  const db = openDatabase(":memory:");
  return { db, service: createService(db) };
}

test("经济科目数据库包含真实数据口径", () => {
  const { service } = setup();
  const dashboard = service.dashboard();
  assert.equal(dashboard.subject.name, "建设工程经济");
  assert.equal(dashboard.textbook.page_count, 388);
  assert.equal(dashboard.knowledgeCount, 631);
  assert.equal(dashboard.parsedQuestionCount, 397);
  assert.ok(dashboard.associationCount >= 300);
  assert.equal(service.listKnowledge().length, 631);
});

test("可以读取真实题目、选项和知识关联", () => {
  const { service } = setup();
  const question = service.getQuestion("econ-2025-finance-eval");
  assert.equal(question.answer, "C");
  assert.equal(question.options.length, 4);
  assert.equal(question.associations[0].knowledgeId, "300074625");
});

test("人工确认会覆盖系统版本但不依赖复审流程", () => {
  const { service } = setup();
  const result = service.saveReview("econ-2025-finance-eval", {
    action: "接受",
    confidence: 96,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    reviewer: "测试教研",
    snapshot: { selectedOption: "C" },
  });
  assert.equal(result.targetStatus, "人工已确认");
  assert.deepEqual(result.risks, []);
  const question = service.getQuestion("econ-2025-finance-eval");
  assert.equal(question.reviewStatus, "人工已确认");
  assert.equal(question.reviews[0].reviewer, "测试教研");
});

test("低置信度结果保持展示并进入可选抽检", () => {
  const { service } = setup();
  const result = service.saveReview("econ-2025-finance-eval", {
    action: "标记待抽检",
    confidence: 45,
    hasMajorAiChanges: false,
    noDirectEvidence: true,
    reviewer: "系统",
  });
  assert.equal(result.targetStatus, "系统已展示·待抽检");
  assert.deepEqual(result.risks, ["低置信度", "无直接教材依据"]);
});

test("完整 Markdown 真题允许创建发布批次", () => {
  const { service } = setup();
  const check = service.releaseCheck();
  assert.equal(check.canPublish, true);
  assert.equal(check.blockers, 0);
  assert.equal(service.createRelease().created, true);
});
