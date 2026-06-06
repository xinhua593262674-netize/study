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

test("完整真题审核动作会持久化并进入待发布", () => {
  const { service } = setup();
  const result = service.saveReview("econ-2025-finance-eval", {
    action: "提交复审",
    confidence: 96,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    reviewer: "测试教研",
    snapshot: { selectedOption: "C" },
  });
  assert.equal(result.targetStatus, "待发布");
  assert.deepEqual(result.risks, []);
  const question = service.getQuestion("econ-2025-finance-eval");
  assert.equal(question.reviewStatus, "待发布");
  assert.equal(question.reviews[0].reviewer, "测试教研");
});

test("部分数字缺失真题必须进入复审", () => {
  const { db, service } = setup();
  const question = db.prepare("SELECT id FROM questions WHERE source_status = '部分数字缺失' LIMIT 1").get();
  const result = service.saveReview(question.id, {
    action: "提交复审",
    confidence: 96,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    reviewer: "测试教研",
  });
  assert.equal(result.targetStatus, "待复审");
  assert.deepEqual(result.risks, ["部分数字缺失"]);
});

test("部分数字缺失会阻断发布", () => {
  const { service } = setup();
  const check = service.releaseCheck();
  assert.equal(check.canPublish, false);
  assert.equal(check.blockers, 139);
  assert.equal(service.createRelease().created, false);
});
