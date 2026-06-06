const sample = {
  id: "econ-2025-finance-eval",
  year: 2025,
  type: "单选题",
  stem: "下列方案经济效果评价内容中，属于财务评价的是（ ）。",
  answer: "C",
  analysis: "方案财务评价主要侧重盈利能力、偿债能力以及财务可持续能力；经济效率、宏观经济合理性和社会影响属于经济分析。",
  sourcePage: "P.2 / 25",
  sourceStatus: "来源解析异常",
  reviewStatus: "待初审",
  options: [
    { label: "A", content: "经济效率分析", isCorrect: 0 },
    { label: "B", content: "宏观经济合理性分析", isCorrect: 0 },
    { label: "C", content: "偿债能力分析", isCorrect: 1 },
    { label: "D", content: "社会影响分析", isCorrect: 0 },
  ],
  associations: [{
    id: "assoc-finance-eval",
    role: "主要知识点",
    confidence: 0.96,
    evidence: "方案财务评价的内容主要侧重于盈利能力、偿债能力以及财务可持续能力三方面的评价分析。",
    evidencePage: "教材 P.16—17",
    knowledgeId: "300074625",
    title: "2.1.1.2 财务评价的内容",
    path: "第1篇工程经济 › 第2章经济效果评价 › 2.1经济效果评价内容",
  }],
  reviews: [],
};

const questions = [sample];
const knowledge = [{
  id: "demo-knowledge",
  path: "第1篇工程经济 › 第2章经济效果评价 › 2.1经济效果评价内容",
  title: "财务评价的内容",
  accuracy: 0.872,
  score: 2,
  frequency: 1,
  questionCount: 1,
}];

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

module.exports = function handler(req, res) {
  const url = new URL(req.url, "https://local.invalid");
  const route = url.pathname.replace(/^\/api/, "");
  if (req.method === "GET" && route === "/dashboard") {
    return send(res, 200, {
      subject: { id: "economy", name: "建设工程经济", exam: "一级建造师" },
      textbook: { id: "economy-2026", name: "2026 版《建设工程经济》", page_count: 388, chapter_count: 20, status: "待验收" },
      knowledgeCount: 631,
      parsedQuestionCount: 397,
      associationCount: 200,
      reviewCount: 0,
    });
  }
  if (req.method === "GET" && route === "/questions") {
    return send(res, 200, questions.map(({ id, year, type, stem, answer, sourcePage, sourceStatus, reviewStatus }) => ({
      id, year, type, stem, answer, sourcePage, sourceStatus, reviewStatus,
    })));
  }
  if (req.method === "GET" && route.startsWith("/questions/")) {
    const id = decodeURIComponent(route.split("/")[2]);
    const question = questions.find((item) => item.id === id);
    return send(res, question ? 200 : 404, question || { error: "题目不存在" });
  }
  if (req.method === "POST" && route.match(/^\/questions\/[^/]+\/reviews$/)) {
    const id = decodeURIComponent(route.split("/")[2]);
    const question = questions.find((item) => item.id === id);
    if (!question) return send(res, 404, { error: "题目不存在" });
    return send(res, 201, {
      questionId: id,
      action: req.body?.action || "保存审核",
      targetStatus: "待复审",
      risks: ["来源解析异常", "在线预览模式不持久化审核记录"],
      createdAt: new Date().toISOString(),
    });
  }
  if (req.method === "GET" && route === "/knowledge") {
    return send(res, 200, knowledge.slice(0, Number(url.searchParams.get("limit") || 50)).map((item) => ({
      id: String(item["考点ID"]),
      path: [item["一级知识点"], item["二级知识点"], item["三级知识点"], item["四级知识点"]].filter(Boolean).join(" › "),
      title: item["五级知识点"] || item["四级知识点"],
      accuracy: item["客观题正确率"],
      score: item["分值"],
      frequency: Number(item["考频"] || 0),
      questionCount: Number(item["总题数"] || 0),
    })));
  }
  if (req.method === "GET" && route === "/releases/check") {
    return send(res, 200, {
      version: "ECON-2026.01",
      blockers: 397,
      canPublish: false,
      questionCount: 397,
      knowledgeCount: 631,
      checks: [{ name: "真题来源解析", level: "blocker", detail: "397 个本地数据样本存在字体编码异常" }],
    });
  }
  return send(res, 404, { error: "接口不存在" });
};
