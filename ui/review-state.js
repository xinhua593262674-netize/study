(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ReviewState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const REVIEW_THRESHOLD = 65;

  function evaluateRisks(input) {
    const risks = [];
    if (Number(input.confidence) < REVIEW_THRESHOLD) risks.push("低置信度");
    if (Number(input.primaryKnowledgeCount) > 1) risks.push("多个主要知识点");
    if (input.hasMajorAiChanges) risks.push("人工大幅修改 AI 建议");
    if (input.noDirectEvidence) risks.push("无直接教材依据");
    if (["规则变化", "内容删除", "无法映射"].includes(input.validity)) {
      risks.push(input.validity);
    }
    return {
      risks,
      requiresSecondReview: risks.length > 0,
      targetStatus: risks.length > 0 ? "待复审" : "待发布",
    };
  }

  function updateSuggestion(current, action) {
    if (!["接受", "拒绝", "修改"].includes(action)) {
      throw new Error("不支持的建议处理动作");
    }
    return {
      ...current,
      decision: action,
      changedByReviewer: action === "修改",
    };
  }

  function canPublish(checks) {
    return !checks.some((check) => check.level === "blocker" && !check.resolved);
  }

  return { REVIEW_THRESHOLD, evaluateRisks, updateSuggestion, canPublish };
});
