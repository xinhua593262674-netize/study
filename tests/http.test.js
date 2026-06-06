const test = require("node:test");
const assert = require("node:assert/strict");
const { handle } = require("../server/app");

async function request(url, method = "GET") {
  let status;
  let body = "";
  const req = { url, method };
  const res = {
    writeHead(value) { status = value; },
    end(value = "") { body += value; },
  };
  await handle(req, res);
  return { status, body: JSON.parse(body) };
}

test("HTTP 路由可以查询经济科目概览和题目", async () => {
  const dashboard = await request("/api/dashboard");
  const question = await request("/api/questions/econ-2025-finance-eval");
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.knowledgeCount, 631);
  assert.equal(dashboard.body.parsedQuestionCount, 397);
  assert.equal(question.body.answer, "C");
  assert.equal(question.body.options.length, 4);
});

test("HTTP 路由返回真实发布阻断状态", async () => {
  const release = await request("/api/releases/check");
  assert.equal(release.status, 200);
  assert.equal(release.body.canPublish, false);
  assert.equal(release.body.blockers, 139);
});

test("HTTP 路由默认返回全部知识考点", async () => {
  const knowledge = await request("/api/knowledge");
  assert.equal(knowledge.status, 200);
  assert.equal(knowledge.body.length, 631);
});
