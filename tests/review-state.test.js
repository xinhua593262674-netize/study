const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRisks, updateSuggestion, canPublish } = require("../ui/review-state.js");

test("普通审核通过后进入待发布", () => {
  const result = evaluateRisks({
    confidence: 92,
    primaryKnowledgeCount: 1,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    validity: "仍然有效",
  });
  assert.equal(result.requiresSecondReview, false);
  assert.equal(result.targetStatus, "待发布");
});

test("低置信度和规则变化必须进入复审", () => {
  const result = evaluateRisks({
    confidence: 61,
    primaryKnowledgeCount: 1,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    validity: "规则变化",
  });
  assert.deepEqual(result.risks, ["低置信度", "规则变化"]);
  assert.equal(result.targetStatus, "待复审");
});

test("人工修改建议会保留修改标记", () => {
  const result = updateSuggestion({ id: "association-1" }, "修改");
  assert.equal(result.decision, "修改");
  assert.equal(result.changedByReviewer, true);
});

test("存在未解决阻断项时禁止发布", () => {
  assert.equal(canPublish([{ level: "blocker", resolved: false }]), false);
  assert.equal(canPublish([{ level: "warning", resolved: false }]), true);
});
