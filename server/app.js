const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { openDatabase } = require("./database");
const { createService } = require("./service");

const root = path.join(__dirname, "..");
const db = openDatabase();
const service = createService(db);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("请求体过大"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
    });
  });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/api/dashboard" && req.method === "GET") return json(res, 200, service.dashboard());
  if (url.pathname === "/api/questions" && req.method === "GET") return json(res, 200, service.listQuestions());
  if (url.pathname.startsWith("/api/questions/") && req.method === "GET") {
    const question = service.getQuestion(decodeURIComponent(url.pathname.split("/").pop()));
    return json(res, question ? 200 : 404, question || { error: "题目不存在" });
  }
  if (url.pathname.match(/^\/api\/questions\/[^/]+\/reviews$/) && req.method === "POST") {
    const id = decodeURIComponent(url.pathname.split("/")[3]);
    const result = service.saveReview(id, await readBody(req));
    return json(res, result ? 201 : 404, result || { error: "题目不存在" });
  }
  if (url.pathname === "/api/knowledge" && req.method === "GET") return json(res, 200, service.listKnowledge(url.searchParams.get("limit") || 631));
  if (url.pathname === "/api/releases/check" && req.method === "GET") return json(res, 200, service.releaseCheck());
  if (url.pathname === "/api/releases" && req.method === "POST") {
    const result = service.createRelease();
    return json(res, result.created ? 201 : 409, result);
  }
  if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "接口不存在" });

  const requested = url.pathname === "/" ? "/ui/index.html" : url.pathname;
  const file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("Not found");
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

function createServer() {
  return http.createServer((req, res) => handle(req, res).catch((error) => json(res, 500, { error: error.message })));
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, "127.0.0.1", () => console.log(`教研解析平台已启动：http://127.0.0.1:${port}`));
}

module.exports = { createServer, handle };
