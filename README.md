# 教研解析项目

本目录用于沉淀教研解析平台的产品、设计与开发资料。

## 当前共识

- 服务对象：一级建造师教研人员。
- 第一期开工范围：一个科目、最新版教材、可获取的全部历史真题。
- 核心产品：以按真题审核为主流程的教研关联审核工作台。
- 知识体系：以教材标题树为准，层级为篇、章、节、目、条、知识点、子知识点。
- 大宽表：最新版知识体系的每个叶子节点占一行。
- 正式数据：AI 建议必须经教研审核，并通过批次发布后进入成果端。
- 成果端：教研大宽表、教材预览、知识图谱。

## 文档入口

1. [产品需求文档](docs/PRD-v0.1.md)：产品范围、业务规则、审核发布流程与验收框架。
2. [领域模型](docs/DOMAIN-MODEL-v0.1.md)：核心实体、状态流与数据约束。
3. [UI 与开发交接清单](docs/UI-DEV-HANDOFF-v0.1.md)：页面优先级、核心能力、里程碑和验收用例。
4. [UI 设计文档](docs/UI-DESIGN-v0.1.md)：信息架构、页面布局、视觉规范与开发交接说明。
5. [多页面高保真设计稿](ui/index.html)：包含首期核心页面，可通过左侧导航切换查看。
6. [经济科目真实数据来源](docs/ECONOMY-DATA-SOURCES.md)：当前接入范围、来源文件和数据质量说明。
7. [开发状态](docs/DEVELOPMENT-STATUS.md)：已完成功能、当前限制和下一开发阶段。

## UI 设计稿页面

1. [按真题审核工作台](ui/index.html)：逐题、逐选项审核知识点与教材依据。
2. [教材解析验收](ui/textbook-validation.html)：原版教材与结构化解析结果对照验收。
3. [知识体系差异](ui/knowledge-diff.html)：处理知识体系表格与教材标题树差异。
4. [发布管理](ui/release.html)：查看待发布数据、发布前检查与发布批次。
5. [教研大宽表](ui/knowledge-table.html)：按最新版叶子知识节点查看教材与真题关联。
6. [教材预览](ui/textbook-preview.html)：阅读教材并查看正式发布的考查标注。
7. [知识图谱分析](ui/knowledge-graph.html)：分析跨章节关系与知识组合考查。
8. 本机原始资料库：运行 `npm run generate:sources` 后打开 `ui/source-documents.html`，完整展示教材与历年真题并保留图片、表格、公式和答案解析；原始资料不上传公开仓库。

## 下一步输入

启动 UI 与开发前，需要准备：

- 第一期开工科目名称及最新版教材版本。
- 最新版教材原版文件。
- 已有知识体系表格。
- 历史真题原始资料。
- 一组代表性客观题和案例题标准样例。

## 运行交互原型

本项目当前提供可持久化的本地业务 MVP，已支持经济科目真实数据查询、逐项审核、审核记录保存、风险判定和发布阻断。

```bash
npm run serve
```

浏览器访问 `http://127.0.0.1:8000/ui/`。服务启动时会自动创建 `data/research.db` SQLite 数据库。

重新从原始资料生成全量数据：

```bash
export ECONOMY_SOURCE_DIR="/path/to/经济科目资料"
npm run import:knowledge
npm run import:questions
npm run import:textbook
npm run import:associations
npm run generate:sources
```

核心接口：

- `GET /api/dashboard`：经济科目数据概览。
- `GET /api/questions`：真题列表。
- `GET /api/questions/:id`：题目、选项、关联与审核记录。
- `POST /api/questions/:id/reviews`：保存审核动作与快照。
- `GET /api/knowledge`：知识考点列表。
- `GET /api/releases/check`：发布前检查。

运行业务规则测试：

```bash
npm test
```
