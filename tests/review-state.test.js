const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRisks, updateSuggestion, canPublish } = require("../ui/review-state.js");

test("高置信度系统版本直接展示", () => {
  const result = evaluateRisks({
    confidence: 92,
    primaryKnowledgeCount: 1,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    validity: "仍然有效",
  });
  assert.equal(result.requiresSecondReview, false);
  assert.equal(result.targetStatus, "系统已展示");
});

test("低置信度和规则变化进入可选抽检但不阻断展示", () => {
  const result = evaluateRisks({
    confidence: 61,
    primaryKnowledgeCount: 1,
    hasMajorAiChanges: false,
    noDirectEvidence: false,
    validity: "规则变化",
  });
  assert.deepEqual(result.risks, ["低置信度", "规则变化"]);
  assert.equal(result.requiresSecondReview, false);
  assert.equal(result.targetStatus, "系统已展示·待抽检");
});

test("人工修改建议会保留修改标记", () => {
  const result = updateSuggestion({ id: "association-1" }, "修改");
  assert.equal(result.decision, "修改");
  assert.equal(result.changedByReviewer, true);
});

test("待抽检项不阻断发布，仅数据错误阻断", () => {
  assert.equal(canPublish([{ level: "blocker", resolved: false }]), true);
  assert.equal(canPublish([{ level: "warning", resolved: false }]), true);
  assert.equal(canPublish([{ level: "error", resolved: false }]), false);
});
