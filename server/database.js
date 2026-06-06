const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const defaultPath = path.join(__dirname, "..", "data", "research.db");

function openDatabase(filename = defaultPath) {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000");
  migrate(db);
  seed(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      exam TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS textbook_versions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      name TEXT NOT NULL,
      page_count INTEGER NOT NULL,
      chapter_count INTEGER NOT NULL,
      source_file TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_nodes (
      id TEXT PRIMARY KEY,
      textbook_version_id TEXT NOT NULL REFERENCES textbook_versions(id),
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      accuracy REAL,
      score REAL,
      frequency INTEGER NOT NULL DEFAULT 0,
      question_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      year INTEGER NOT NULL,
      type TEXT NOT NULL,
      stem TEXT NOT NULL,
      answer TEXT NOT NULL,
      analysis TEXT NOT NULL,
      source_page TEXT NOT NULL,
      source_status TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT '待初审'
    );
    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id),
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      is_correct INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS associations (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id),
      knowledge_node_id TEXT NOT NULL REFERENCES knowledge_nodes(id),
      role TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence TEXT NOT NULL,
      evidence_page TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id TEXT NOT NULL REFERENCES questions(id),
      action TEXT NOT NULL,
      target_status TEXT NOT NULL,
      risks TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS release_batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      blocker_count INTEGER NOT NULL,
      question_count INTEGER NOT NULL,
      knowledge_count INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS import_state (
      name TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL
    );
  `);
}

function seed(db) {
  const exists = db.prepare("SELECT COUNT(*) AS count FROM subjects").get().count;
  if (exists) return;

  db.prepare("INSERT INTO subjects VALUES (?, ?, ?)").run("economy", "建设工程经济", "一级建造师");
  db.prepare("INSERT INTO textbook_versions VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "economy-2026",
    "economy",
    "2026 版《建设工程经济》",
    388,
    20,
    process.env.ECONOMY_TEXTBOOK_FILE || "本地经济科目资料/2026-建设工程经济.pdf",
    "待验收"
  );

  const fallbackKnowledge = [
    ["300074129", "第1篇工程经济 › 第1章资金时间价值计算及应用 › 1.1利息的计算 › 1.1.2利息的计算方法", "1.1.2.1 单利计算", 0.7796833333, 12, 6, 6],
    ["300074623", "第1篇工程经济 › 第1章资金时间价值计算及应用 › 1.1利息的计算 › 1.1.2利息的计算方法", "1.1.2.2 复利计算", 0.7615333333, 6, 3, 3],
    ["300074760", "第1篇工程经济 › 第1章资金时间价值计算及应用 › 1.2名义利率与有效利率计算", "1.2.2.2 年有效利率的计算", 0.7103222222, 20, 8, 9],
    ["300074131", "第1篇工程经济 › 第1章资金时间价值计算及应用 › 1.3资金等值计算及应用", "1.3.1.0 资金时间价值的影响因素", 0.75245, 12, 4, 4],
    ["300074625", "第1篇工程经济 › 第2章经济效果评价 › 2.1经济效果评价内容 › 2.1.1经济效果评价的分类和内容", "2.1.1.2 财务评价的内容", 0.872, 2, 1, 1],
    ["300074136", "第1篇工程经济 › 第2章经济效果评价 › 2.2经济效果评价指标体系", "2.2.1.0 方案的比选", 0.6495, 14, 4, 4],
    ["300080416", "第3篇工程计价 › 第20章工程计价数字化与智能化 › 20.3大数据在工程计价中的应用", "20.3.1.3 分类", null, null, 0, 0],
    ["300080417", "第3篇工程计价 › 第20章工程计价数字化与智能化 › 20.3大数据在工程计价中的应用", "20.3.1.4 生存周期模型", null, null, 0, 0]
  ];
  const insertKnowledge = db.prepare("INSERT INTO knowledge_nodes VALUES (?, 'economy-2026', ?, ?, ?, ?, ?, ?)");
  const knowledgeFile = path.join(__dirname, "..", "data", "economy-knowledge.json");
  const knowledge = fs.existsSync(knowledgeFile)
    ? JSON.parse(fs.readFileSync(knowledgeFile, "utf8")).map((item) => [
        String(item["考点ID"]),
        [item["一级知识点"], item["二级知识点"], item["三级知识点"], item["四级知识点"]].filter(Boolean).join(" › "),
        item["五级知识点"] || item["四级知识点"] || item["三级知识点"],
        item["客观题正确率"],
        item["分值"] === "null" ? null : item["分值"],
        Number(item["考频"] || 0),
        Number(item["总题数"] || 0),
      ])
    : fallbackKnowledge;
  for (const row of knowledge) insertKnowledge.run(...row);

  const fallbackQuestions = [
    ["econ-2025-finance-eval", 2025, "单选题", "下列方案经济效果评价内容中，属于财务评价的是（ ）。", "C", "方案财务评价主要侧重盈利能力、偿债能力以及财务可持续能力；经济效率、宏观经济合理性和社会影响属于经济分析。", "P.2 / 25", "来源解析异常", "待初审"],
    ["econ-2025-equipment-life", 2025, "单选题", "关于设备寿命的说法，正确的是（ ）。", "B", "经济寿命是指设备从全新投入使用开始，到年平均使用成本最低的使用年限。", "P.2 / 25", "来源解析异常", "待初审"],
    ["econ-2025-cash-flow", 2025, "多选题", "绘制现金流量图必需的要素有（ ）。", "BCD", "现金流量图三要素为大小、方向和作用点。", "P.13 / 25", "来源解析异常", "待初审"],
    ["econ-2024-cash-holding", 2024, "多选题", "采用成本分析法确定最佳现金持有量时，应考虑的成本有（ ）。", "ACD", "成本分析法通常考虑管理成本、机会成本和短缺成本。", "P.27 / 27", "来源解析异常", "待初审"],
    ["econ-2023-cash-management", 2023, "多选题", "现金管理可以采用的方法有（ ）。", "ABCD", "现金管理方法包括现金流量同步、使用现金浮游量、加速收款和推迟应付款支付。", "P.24 / 25", "来源解析异常", "待初审"],
    ["econ-2021-accounting-elements", 2021, "多选题", "下列会计要素中，属于静态会计要素的有（ ）。", "BDE", "资产、负债和所有者权益属于静态会计要素。", "P.27 / 28", "来源解析异常", "待初审"]
  ];
  const insertQuestion = db.prepare("INSERT INTO questions VALUES (?, 'economy', ?, ?, ?, ?, ?, ?, ?, ?)");
  const questionFile = path.join(__dirname, "..", "data", "economy-questions.json");
  const questions = fs.existsSync(questionFile)
    ? JSON.parse(fs.readFileSync(questionFile, "utf8")).map((item) => [
        item.id, item.year, item.type, item.stem, item.answer, item.analysis,
        path.basename(item.sourceFile), item.sourceStatus, item.reviewStatus,
      ])
    : fallbackQuestions;
  for (const row of questions) insertQuestion.run(...row);

  const sample = fallbackQuestions[0];
  db.prepare(`
    UPDATE questions SET stem = ?, answer = ?, analysis = ?, source_page = ?
    WHERE id = 'econ-2025-finance-eval'
  `).run(sample[3], sample[4], sample[5], sample[6]);

  const options = [
    ["eval-a", "econ-2025-finance-eval", "A", "经济效率分析", 0],
    ["eval-b", "econ-2025-finance-eval", "B", "宏观经济合理性分析", 0],
    ["eval-c", "econ-2025-finance-eval", "C", "偿债能力分析", 1],
    ["eval-d", "econ-2025-finance-eval", "D", "社会影响分析", 0]
  ];
  const insertOption = db.prepare("INSERT INTO options VALUES (?, ?, ?, ?, ?)");
  for (const row of options) insertOption.run(...row);

  db.prepare("INSERT INTO associations VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "assoc-finance-eval",
    "econ-2025-finance-eval",
    "300074625",
    "主要知识点",
    0.96,
    "方案财务评价的内容主要侧重于盈利能力、偿债能力以及财务可持续能力三方面的评价分析。",
    "教材 P.16—17"
  );
  synchronizeAssociations(db);
}

function synchronizeAssociations(db) {
  const questionFile = path.join(__dirname, "..", "data", "economy-questions.json");
  if (!fs.existsSync(questionFile)) return;
  db.prepare("DELETE FROM associations WHERE id LIKE 'auto-%'").run();
  const questions = JSON.parse(fs.readFileSync(questionFile, "utf8"));
  const knowledgeNodes = db.prepare("SELECT id, title, path, frequency FROM knowledge_nodes").all();
  const questionExists = db.prepare("SELECT id FROM questions WHERE id = ?");
  const insert = db.prepare(`
    INSERT OR IGNORE INTO associations
      (id, question_id, knowledge_node_id, role, confidence, evidence, evidence_page)
    VALUES (?, ?, ?, '主要知识点', ?, ?, '待补充精确教材页码')
  `);
  const normalize = (value) => String(value || "")
    .replace(/^[?.\d]+/, "")
    .replace(/[（）()、，,：:\s]/g, "")
    .replace(/的|和|与|及/g, "")
    .trim();
  for (const question of questions) {
    if (!questionExists.get(question.id) || !question.knowledge || question.knowledge === "待人工关联") continue;
    const normalized = normalize(question.knowledge);
    const candidates = knowledgeNodes
      .map((node) => {
        const title = normalize(node.title);
        const path = normalize(node.path);
        let score = 0;
        if (title === normalized) score = 1;
        else if (title.includes(normalized) || normalized.includes(title)) score = 0.9;
        else if (path.includes(normalized)) score = 0.78;
        return { ...node, score };
      })
      .filter((node) => node.score > 0)
      .sort((a, b) => b.score - a.score || b.frequency - a.frequency);
    const knowledge = candidates[0];
    if (!knowledge) continue;
    insert.run(
      `auto-${question.id}-${knowledge.id}`,
      question.id,
      knowledge.id,
      knowledge.score,
      `真题解析关联考点：${question.knowledge}`
    );
  }
}

module.exports = { openDatabase, synchronizeAssociations };
