(function () {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  let toastTimer;
  const apiEnabled = (location.protocol === "http:" || location.protocol === "https:")
    && !location.hostname.endsWith("github.io");

  async function api(path, options = {}) {
    if (!apiEnabled) return null;
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || "请求失败");
      error.result = result;
      throw error;
    }
    return result;
  }

  function getLocalData() {
    try {
      return JSON.parse(localStorage.getItem("economy-real-data") || "null");
    } catch {
      return null;
    }
  }

  function saveLocalData(data) {
    localStorage.setItem("economy-real-data", JSON.stringify(data));
  }

  function updateLocalQuestion(questionId, action, snapshot = {}) {
    const data = getLocalData();
    if (!data?.questions?.length) return null;
    const question = data.questions.find((item) => item.id === questionId);
    if (!question) return null;
    const targetStatus = action === "退回修改" ? "待初审" : action === "提交复审" ? "待复审" : question.reviewStatus || "待初审";
    question.reviewStatus = targetStatus;
    question.reviews = question.reviews || [];
    question.reviews.unshift({ action, targetStatus, snapshot, reviewer: "教研人员", createdAt: new Date().toISOString() });
    saveLocalData(data);
    return { questionId, action, targetStatus, risks: question.sourceStatus === "部分数字缺失" ? ["部分数字缺失"] : [] };
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    })[char]);
  }

  function normalizeEvidenceText(value) {
    return String(value || "")
      .replace(/^[\d.]+/, "")
      .replace(/[、，,。；;：:（）()\s]/g, "")
      .toLowerCase();
  }

  function getEvidenceTerms(value) {
    return String(value || "")
      .split(/[、，,；;]/)
      .map(normalizeEvidenceText)
      .filter((term) => term.length >= 3);
  }

  function questionMatchesParagraph(question, paragraph) {
    const normalizedParagraph = normalizeEvidenceText(paragraph);
    return getEvidenceTerms(question?.knowledge).some((term) => normalizedParagraph.includes(term));
  }

  function findQuestionEvidence(question, textbookPages) {
    for (const page of textbookPages) {
      const paragraphs = String(page.text || "").split(/\n+/).filter(Boolean);
      const paragraphIndices = paragraphs.map((paragraph, index) => (
        questionMatchesParagraph(question, paragraph) ? index : -1
      )).filter((index) => index >= 0);
      if (paragraphIndices.length) return { page, paragraphs, paragraphIndices };
    }
    return null;
  }

  function normalizeLocalQuestion(item, index) {
    return {
      id: item.id || `local-${index}`,
      year: item.year || "未知",
      type: item.type || "待识别",
      stem: item.stem || `来源题干待修复（关联考点：${item.knowledge || "待人工关联"}）`,
      answer: item.answer || "待确认",
      analysis: item.analysis || "暂无解析",
      sourcePage: item.sourcePage || (item.sourceFile ? item.sourceFile.split("/").pop() : "本机真实数据"),
      sourceStatus: item.sourceStatus || "本机真实数据",
      reviewStatus: item.reviewStatus || "待初审",
      options: item.options || [],
      associations: item.associations?.length ? item.associations : item.knowledge ? [{
        title: item.knowledge,
        path: "真实真题解析提供的关联考点，待匹配知识体系节点",
        evidence: `真题解析关联考点：${item.knowledge}`,
      }] : [],
      reviews: item.reviews || [],
    };
  }

  function hydrateAllQuestionDrawer() {
    const drawer = $(".question-drawer");
    if (!drawer) return;
    const data = getLocalData();
    const questions = data?.questions?.map(normalizeLocalQuestion) || [];
    const knowledge = data?.knowledge || [];
    const triggerCount = $(".all-questions-trigger b");
    if (triggerCount) triggerCount.textContent = questions.length || 397;
    $(".drawer-count").textContent = questions.length
      ? `${questions.length} 道真题 · ${knowledge.length} 个知识考点 · 全站共享`
      : "请点击顶部“加载本机真实数据”";
    if (!questions.length) return;

    const year = $(".drawer-year");
    const type = $(".drawer-type");
    if (year.options.length === 1) {
      [...new Set(questions.map((item) => item.year))].sort((a, b) => b - a).forEach((value) => year.add(new Option(`${value} 年`, value)));
      [...new Set(questions.map((item) => item.type))].sort().forEach((value) => type.add(new Option(value, value)));
    }

    function showQuestion(question, index) {
      const raw = data.questions[index] || {};
      $(".drawer-detail").innerHTML = `<div class="drawer-detail-content">
        <div class="drawer-meta"><span class="badge b">${escapeHtml(question.year)} 年</span><span class="badge">${escapeHtml(question.type)}</span><span class="badge a">${escapeHtml(question.sourceStatus)}</span><span class="badge g">第 ${index + 1} / ${questions.length} 题</span></div>
        <h2>${escapeHtml(question.stem)}</h2>
        <p><b>关联考点：</b>${escapeHtml(raw.knowledge || "待人工关联")}</p>
        <p><b>正确答案：</b><span class="blue">${escapeHtml(question.answer)}</span></p>
        <div class="analysis"><b>真题解析</b><br>${escapeHtml(question.analysis)}</div>
        <p class="muted">来源：${escapeHtml(question.sourcePage)}</p>
      </div>`;
      $$(".drawer-question").forEach((item) => item.classList.toggle("active", Number(item.dataset.index) === index));
      document.dispatchEvent(new CustomEvent("real-question:selected", { detail: { question, raw, index, total: questions.length } }));
    }

    function renderList() {
      const keyword = $(".drawer-search").value.trim().toLowerCase();
      const selectedYear = year.value;
      const selectedType = type.value;
      const matches = questions.map((question, index) => ({ question, index })).filter(({ question, index }) => {
        const raw = data.questions[index] || {};
        const content = `${question.stem} ${question.analysis} ${raw.knowledge || ""}`.toLowerCase();
        return (!keyword || content.includes(keyword))
          && (!selectedYear || String(question.year) === selectedYear)
          && (!selectedType || question.type === selectedType);
      });
      $(".drawer-count").textContent = `${matches.length} / ${questions.length} 道真题 · ${knowledge.length} 个知识考点`;
      $(".drawer-list").innerHTML = matches.length ? matches.map(({ question, index }) => `<div class="drawer-question" data-index="${index}">
        <div class="drawer-question-top"><b>${escapeHtml(question.year)} · ${escapeHtml(question.type)}</b><span class="badge">${escapeHtml(question.answer)}</span></div>
        <p>${escapeHtml(question.stem)}</p>
      </div>`).join("") : `<div class="drawer-empty">没有符合条件的真题</div>`;
      $$(".drawer-question").forEach((item) => item.addEventListener("click", () => {
        const index = Number(item.dataset.index);
        showQuestion(questions[index], index);
      }));
      if (matches.length) showQuestion(matches[0].question, matches[0].index);
    }

    renderList();
    $(".drawer-search").oninput = renderList;
    year.onchange = renderList;
    type.onchange = renderList;
  }

  function ensureAllQuestionDrawer() {
    if ($(".question-drawer")) return;
    document.body.insertAdjacentHTML("beforeend", `<button class="all-questions-trigger" type="button"><b>397</b><span>全部真题</span></button><div class="question-drawer-backdrop"></div>
      <aside class="question-drawer" aria-label="全部真实真题"><div class="question-drawer-head"><div><b>经济科目全部真实真题</b><span class="drawer-count">等待加载本机数据</span></div><button class="drawer-close" type="button">×</button></div><div class="question-drawer-filters"><input class="drawer-search" placeholder="搜索题干、解析、考点"><select class="drawer-year"><option value="">全部年份</option></select><select class="drawer-type"><option value="">全部题型</option></select></div><div class="question-drawer-body"><div class="drawer-list"></div><div class="drawer-detail"><div class="drawer-empty"><b>请先加载本机真实数据</b><p>只需加载一次，所有页面都会自动读取。</p></div></div></div></aside>`);
  }

  function bindAllQuestionDrawer() {
    const drawer = $(".question-drawer");
    if (!drawer) return;
    const backdrop = $(".question-drawer-backdrop");
    const trigger = $(".all-questions-trigger");
    const closeButton = $(".drawer-close");
    const open = () => {
      drawer.classList.add("open");
      backdrop.classList.add("open");
      hydrateAllQuestionDrawer();
    };
    const close = () => {
      drawer.classList.remove("open");
      backdrop.classList.remove("open");
    };
    markBound(trigger);
    markBound(closeButton);
    trigger.onclick = open;
    closeButton.onclick = close;
    backdrop.onclick = close;
  }

  function hydratePageQuestionData() {
    const page = $(".page");
    if (!page || $(".queue")) return;
    const data = getLocalData();
    const questions = data?.questions?.map(normalizeLocalQuestion) || [];
    const textbookPages = data?.textbook || [];
    if (!questions.length) return;

    function renderPreviewQuestion(question, raw, index) {
      if (document.title !== "教材预览") return false;
      const evidence = findQuestionEvidence(raw, textbookPages);
      const doc = $(".doc");
      if (!evidence) {
        doc.innerHTML = `<h2>${escapeHtml(question.year)} 年 · ${escapeHtml(question.type)}</h2>
          <h3>${escapeHtml(raw.knowledge || "待人工关联考点")}</h3>
          <p><span class="highlight">${escapeHtml(question.stem)}</span></p>
          <p class="muted">未在教材正文中找到精确匹配段落，已标记为待人工定位。</p>`;
        toast("该真题暂未定位到教材精确段落", "warn");
        return true;
      }
      doc.innerHTML = `<h2>2026 版《建设工程经济》</h2><h3>教材第 ${evidence.page.page} 页 · ${escapeHtml(raw.knowledge)}</h3>${evidence.paragraphs.map((text, paragraphIndex) => {
        return `<p${evidence.paragraphIndices.includes(paragraphIndex) ? ' class="question-evidence-highlight"' : ""}>${escapeHtml(text)}</p>`;
      }).join("")}`;
      document.body.dataset.textbookPage = String(evidence.page.page);
      const pageButton = $$("button").find((button) => /P\.\d+\s*\/\s*\d+/.test(button.textContent));
      if (pageButton) pageButton.textContent = `P.${evidence.page.page} / ${textbookPages.length}`;
      toast(`已定位教材第 ${evidence.page.page} 页并高亮考查段落`, "success");
      return true;
    }

    function selectQuestion(scope, index) {
      const question = questions[index];
      const raw = data.questions[index] || {};
      $$(".page-question-row", scope).forEach((item) => item.classList.toggle("is-selected", Number(item.dataset.index) === index));
      if (!renderPreviewQuestion(question, raw, index)) {
        modal(`${question.year} 年 · ${question.type}`, `<p><b>${escapeHtml(question.stem)}</b></p><p><b>关联考点：</b>${escapeHtml(raw.knowledge || "待人工关联")}</p><p><b>答案：</b>${escapeHtml(question.answer)}</p><p>${escapeHtml(question.analysis)}</p>`, "关闭");
      }
    }

    function bindRows(scope) {
      $$(".page-question-row", scope).forEach((row) => row.addEventListener("click", () => {
        const index = Number(row.dataset.index);
        selectQuestion(scope, index);
      }));
    }

    function renderTable(section, keyword = "") {
      const matches = questions.map((question, index) => ({ question, index })).filter(({ question, index }) =>
        !keyword || `${question.stem} ${question.analysis} ${data.questions[index]?.knowledge || ""}`.toLowerCase().includes(keyword)
      );
      $(".page-question-count", section).textContent = `${matches.length} / ${questions.length} 道`;
      $("tbody", section).innerHTML = matches.map(({ question, index }) => `<tr class="page-question-row" data-index="${index}"><td>${index + 1}</td><td>${escapeHtml(question.year)}</td><td>${escapeHtml(question.type)}</td><td>${escapeHtml(question.stem)}</td><td>${escapeHtml(data.questions[index]?.knowledge || "待关联")}</td><td>${escapeHtml(question.answer)}</td><td><span class="badge a">${escapeHtml(question.sourceStatus)}</span></td></tr>`).join("");
      bindRows(section);
    }

    if (document.title === "教材预览") {
      const aside = $(".split-right aside.card");
      function renderPreviewList(indices, label = "当前教材页关联真题") {
        aside.innerHTML = `<div class="card-head">${label} <span class="push badge b page-question-count">${indices.length} 道</span></div><div class="page-question-search-wrap"><input class="page-question-search" placeholder="搜索当前页真题、解析、考点"></div><div class="preview-question-list">${indices.length ? indices.map((index) => {
          const question = questions[index];
          return `<div class="issue page-question-row" data-index="${index}"><span class="badge g">${escapeHtml(question.year)} 年 · ${escapeHtml(question.type)}</span><strong>${escapeHtml(data.questions[index]?.knowledge || "待人工关联")}</strong><p>${escapeHtml(question.stem)}</p></div>`;
        }).join("") : `<div class="drawer-empty"><b>当前教材页暂无关联真题</b><p>切换教材页或继续补充知识关联。</p></div>`}</div>`;
        const search = $(".page-question-search", aside);
        search.addEventListener("input", () => {
          const keyword = search.value.trim().toLowerCase();
          let visible = 0;
          $$(".page-question-row", aside).forEach((row) => {
            const show = !keyword || row.textContent.toLowerCase().includes(keyword);
            row.classList.toggle("is-hidden", !show);
            if (show) visible += 1;
          });
          $(".page-question-count", aside).textContent = `${visible} / ${indices.length} 道`;
        });
        bindRows(aside);
      }
      renderPreviewList([]);
      document.body.renderPreviewQuestionList = renderPreviewList;
      document.body.selectPreviewQuestion = (index) => selectQuestion(aside, index);
      if (!document.body.dataset.previewLinkBound) {
        document.body.dataset.previewLinkBound = "true";
        document.addEventListener("textbook-page:selected", (event) => {
          document.body.renderPreviewQuestionList(event.detail.questionIndices, `教材第 ${event.detail.page} 页关联真题`);
        });
        document.addEventListener("textbook-evidence:selected", (event) => {
          document.body.selectPreviewQuestion(event.detail.questionIndex);
        });
        document.addEventListener("real-question:selected", (event) => {
          document.body.selectPreviewQuestion(event.detail.index);
        });
      }
      return;
    }

    let section = $(".page-question-data");
    if (!section) {
      section = document.createElement("section");
      section.className = "card page-question-data";
      section.innerHTML = `<div class="card-head">全部真实真题数据 <span class="push badge b page-question-count">${questions.length} 道</span></div><div class="page-question-search-wrap"><input class="page-question-search" placeholder="搜索题干、解析、考点"></div><div class="table-wrap page-question-table"><table><thead><tr><th>序号</th><th>年份</th><th>题型</th><th>真题内容</th><th>关联考点</th><th>答案</th><th>来源状态</th></tr></thead><tbody></tbody></table></div>`;
      page.appendChild(section);
    }
    renderTable(section);
    $(".page-question-search", section).oninput = (event) => renderTable(section, event.target.value.trim().toLowerCase());
  }

  function hydrateKnowledgeTable() {
    if (document.title !== "教研大宽表") return;
    const knowledge = getLocalData()?.knowledge || [];
    const tbody = $("tbody");
    if (!knowledge.length || !tbody) return;
    tbody.innerHTML = knowledge.map((item) => {
      const title = item["六级知识点"] || item["五级知识点"] || item["四级知识点"] || item["三级知识点"] || "未命名考点";
      const accuracy = item["客观题正确率"] == null ? "—" : `${(Number(item["客观题正确率"]) * 100).toFixed(2)}%`;
      return `<tr><td>${escapeHtml(title)}</td><td>${escapeHtml(item["考点ID"])}</td><td>${accuracy}</td><td>${escapeHtml(item["分值"] === "null" ? "—" : item["分值"])}</td><td>${Number(item["考频"] || 0)}</td><td>${Number(item["总题数"] || 0)}</td><td>${Number(item["单选题数量"] || 0)}</td><td>${Number(item["不定向题数量"] || 0)}</td><td><span class="badge g">真实数据</span></td></tr>`;
    }).join("");
  }

  function hydrateReleasePage() {
    if (document.title !== "发布管理") return;
    const questions = getLocalData()?.questions || [];
    if (!questions.length) return;
    const partial = questions.filter((item) => item.sourceStatus !== "已解析").length;
    const statuses = questions.reduce((result, item) => {
      const status = item.reviewStatus || "待初审";
      result[status] = (result[status] || 0) + 1;
      return result;
    }, {});
    const metrics = $$(".metric b");
    if (metrics[0]) metrics[0].textContent = questions.length;
    if (metrics[3]) metrics[3].textContent = partial;
    const fail = $(".check.fail");
    if (fail) fail.innerHTML = `<i>×</i><div><b>${partial} 道题存在部分数字缺失</b><br><span class="muted">待初审 ${statuses["待初审"] || 0} · 待复审 ${statuses["待复审"] || 0} · 待发布 ${statuses["待发布"] || 0}</span></div>`;
  }

  function hydrateTextbookPages() {
    if (!["教材预览", "教材解析验收"].includes(document.title)) return;
    const pages = getLocalData()?.textbook || [];
    const rawQuestions = getLocalData()?.questions || [];
    const doc = $(".doc");
    if (!pages.length || !doc) return;
    const initial = document.title === "教材解析验收" ? 16 : Number(document.body.dataset.textbookPage || 1);

    function renderPage(pageNumber) {
      const page = pages[Math.max(0, Math.min(pages.length - 1, pageNumber - 1))];
      document.body.dataset.textbookPage = String(page.page);
      const paragraphs = page.text.split(/\n+/).filter(Boolean);
      const pageQuestionIndices = [];
      const renderedParagraphs = paragraphs.map((text) => {
        const indices = rawQuestions.map((question, index) => ({ question, index })).filter(({ question }) => {
          return questionMatchesParagraph(question, text);
        }).map(({ index }) => index);
        indices.forEach((index) => {
          if (!pageQuestionIndices.includes(index)) pageQuestionIndices.push(index);
        });
        return `<p${indices.length ? ` class="question-evidence-highlight textbook-evidence" data-question-index="${indices[0]}"` : ""}>${escapeHtml(text)}${indices.length ? `<span class="evidence-question-count">关联 ${indices.length} 道真题</span>` : ""}</p>`;
      }).join("");
      doc.innerHTML = `<h2>2026 版《建设工程经济》</h2><h3>教材第 ${page.page} 页</h3>${renderedParagraphs}`;
      const pageButton = $$("button").find((button) => /P\.\d+\s*\/\s*\d+/.test(button.textContent));
      if (pageButton) pageButton.textContent = `P.${page.page} / ${pages.length}`;
      const pageLabel = $$(".card-head .push").find((item) => /P\.\d+\s*\/\s*\d+/.test(item.textContent));
      if (pageLabel) pageLabel.textContent = `P.${page.page} / ${pages.length}　−　100%　＋`;
      $$(".textbook-evidence", doc).forEach((paragraph) => paragraph.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("textbook-evidence:selected", { detail: { questionIndex: Number(paragraph.dataset.questionIndex) } }));
      }));
      document.dispatchEvent(new CustomEvent("textbook-page:selected", { detail: { page: page.page, questionIndices: pageQuestionIndices } }));
    }

    const previous = $$("button").find((button) => button.textContent.trim() === "上一页");
    const next = $$("button").find((button) => button.textContent.trim() === "下一页");
    if (previous && next) {
      [previous, next].forEach(markBound);
      previous.onclick = () => renderPage(Number(document.body.dataset.textbookPage || 1) - 1);
      next.onclick = () => renderPage(Number(document.body.dataset.textbookPage || 1) + 1);
    }
    renderPage(initial);
  }

  function bindLocalDataImport() {
    const button = $(".local-data-btn");
    const input = $(".local-data-input");
    if (!button || !input) return;
    markBound(button);
    const existing = getLocalData();
    const legacy = existing?.questions?.length && existing.version !== "markdown-complete-v1";
    if (legacy) {
      button.textContent = "数据版本过旧，请重新加载";
      button.classList.add("warn");
      setTimeout(() => toast("当前浏览器缓存的是旧版占位数据，请重新选择更新后的两个 JSON 文件", "warn"), 300);
    } else if (existing) {
      button.textContent = `已加载 ${existing.questions?.length || 0} 题 / ${existing.textbook?.length || 0} 页`;
    }
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", async () => {
      const existingData = getLocalData() || {};
      const loaded = { version: "markdown-complete-v1", questions: existingData.questions || [], knowledge: existingData.knowledge || [], textbook: existingData.textbook || [] };
      for (const file of input.files) {
        const records = JSON.parse(await file.text());
        if (!Array.isArray(records)) continue;
        if (records[0]?.["考点ID"]) loaded.knowledge = records;
        else if (records[0]?.page && records[0]?.text) loaded.textbook = records;
        else loaded.questions = records;
      }
      saveLocalData(loaded);
      button.textContent = `已加载 ${loaded.questions.length} 题 / ${loaded.textbook.length} 页`;
      toast(`真实数据已加载：${loaded.questions.length} 题、${loaded.knowledge.length} 个考点、${loaded.textbook.length} 页教材`, "success");
      if ($(".queue")) renderLocalQueue(loaded.questions);
      hydrateAllQuestionDrawer();
      hydratePageQuestionData();
      hydrateKnowledgeTable();
      hydrateReleasePage();
      hydrateTextbookPages();
    });
  }

  function renderLocalQueue(records) {
    const queue = $(".queue");
    if (!queue) return;
    if (!records.length) {
      queue.innerHTML = `<div class="analysis-box"><b>当前队列暂无数据</b><br>完成审核动作后，对应题目会进入此队列。</div>`;
      return;
    }
    const questions = records.map(normalizeLocalQuestion);
    const count = $(".panel-head .head-count");
    if (count) count.textContent = `${questions.length} 道真实题目`;
    queue.innerHTML = questions.map((question, index) => `
      <div class="q-item ${index === 0 ? "active" : ""}" data-local-index="${index}">
        <div class="q-top"><span class="q-num">${question.year} · ${question.type}</span><span class="badge blue">${question.reviewStatus}</span></div>
        <div class="q-text">${question.stem}</div>
        <div class="q-foot"><span>答案 ${question.answer}</span><span class="badge amber">${question.sourceStatus}</span></div>
      </div>`).join("");
    renderQuestion(questions[0]);
    $$(".q-item", queue).forEach((item) => item.addEventListener("click", () => {
      $$(".q-item", queue).forEach((q) => q.classList.remove("active"));
      item.classList.add("active");
      renderQuestion(questions[Number(item.dataset.localIndex)]);
    }));
  }

  function toast(message, type = "") {
    clearTimeout(toastTimer);
    $(".toast")?.remove();
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 2400);
  }

  function modal(title, body, actionLabel, onConfirm) {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3>${title}</h3><div class="modal-body">${body}</div><div class="modal-actions"><button class="btn cancel">取消</button><button class="btn primary confirm">${actionLabel}</button></div></div>`;
    document.body.appendChild(wrap);
    $(".cancel", wrap).onclick = () => wrap.remove();
    $(".confirm", wrap).onclick = () => {
      onConfirm?.();
      wrap.remove();
    };
  }

  function markBound(element) {
    if (element) element.dataset.bound = "true";
    return element;
  }

  function downloadText(filename, content, type = "text/plain;charset=utf-8") {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function tableCsv() {
    return $$("table tr").filter((row) => row.style.display !== "none").map((row) =>
      $$("th,td", row).map((cell) => `"${cell.textContent.trim().replaceAll('"', '""')}"`).join(",")
    ).join("\n");
  }

  function setAutosave() {
    const el = $(".autosave");
    if (!el) return;
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    el.textContent = `已自动暂存 · ${now}`;
    localStorage.setItem("research-review-last-save", new Date().toISOString());
  }

  async function saveReview(action, snapshot = {}) {
    const questionId = document.body.dataset.questionId;
    if (!questionId || !apiEnabled) {
      const saved = updateLocalQuestion(questionId, action, snapshot);
      setAutosave();
      const activeStatus = $(".q-item.active .q-top .badge");
      if (activeStatus && saved) activeStatus.textContent = saved.targetStatus;
      const detailStatus = $(".question-meta .badge.green");
      if (detailStatus && saved) detailStatus.textContent = saved.targetStatus;
      hydrateReleasePage();
      return saved || { targetStatus: action === "退回修改" ? "待初审" : "待复审", risks: ["本地演示模式"] };
    }
    return api(`/api/questions/${encodeURIComponent(questionId)}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        action,
        confidence: 96,
        hasMajorAiChanges: action === "修改",
        noDirectEvidence: false,
        reviewer: "教研人员",
        snapshot,
      }),
    });
  }

  async function hydrateReviewState() {
    const questionId = document.body.dataset.questionId;
    if (!questionId || !apiEnabled) return;
    try {
      const question = await api(`/api/questions/${encodeURIComponent(questionId)}`);
      const status = $(".question-meta .badge.green");
      if (status) status.textContent = question.reviewStatus;
      if (question.reviews.length) {
        const latest = question.reviews[0];
        const autosave = $(".autosave");
        if (autosave) autosave.textContent = `最近审核：${latest.action} · ${new Date(latest.createdAt).toLocaleString("zh-CN")}`;
      }
    } catch (error) {
      toast(`读取审核状态失败：${error.message}`, "error");
    }
  }

  function renderQuestion(question) {
    document.body.dataset.questionId = question.id;
    const questionText = $(".question");
    if (questionText) questionText.textContent = question.stem;
    const meta = $(".question-meta");
    if (meta) {
      meta.innerHTML = `<span class="badge gray">${question.type}</span><span class="badge gray">${question.year} 年真题</span><span class="badge green">${question.reviewStatus}</span><span class="source">${question.sourcePage}</span>`;
    }
    const analysis = $(".analysis-box");
    if (analysis) analysis.innerHTML = `<b>正确答案：${question.answer || "待确认"}</b><br><b>真题解析：</b>${question.analysis}`;
    const options = $(".options");
    if (options) {
      options.innerHTML = question.options.length
        ? question.options.map((option) => `<div class="option ${option.isCorrect ? "correct" : "wrong"}"><div class="letter">${option.label}</div><div><div class="option-text">${option.content}</div><div class="option-notes"><span class="badge ${option.isCorrect ? "green" : "amber"}">${option.isCorrect ? "正确选项" : "错误选项"}</span></div></div><span class="badge gray">待审核</span></div>`).join("")
        : `<div class="analysis-box"><b>题目结构待修复</b><br>当前记录已保留答案、解析和关联考点，但题干题号、数字及选项尚未从源 PDF 可靠恢复。</div>`;
    }
    const primary = question.associations[0];
    const suggestion = $(".suggest-card .suggest-title");
    const path = $(".suggest-card .path");
    const evidence = $(".evidence .quote");
    if (suggestion) suggestion.textContent = primary?.title || "待人工关联知识点";
    if (path) path.textContent = primary?.path || "源真题已提供关联考点名称，待匹配知识体系 ID";
    if (evidence) evidence.textContent = primary?.evidence || "待补充精确教材依据";
    bindOptionClicks();
  }

  function bindOptionClicks() {
    const options = $$(".option");
    options.forEach((option) => option.addEventListener("click", () => {
      options.forEach((item) => item.classList.remove("active"));
      option.classList.add("active");
      const letter = $(".letter", option)?.textContent.trim();
      const firstTab = $(".unit-tab");
      if (firstTab) firstTab.textContent = `${letter} 选项`;
      toast(`已切换到 ${letter} 选项审核`);
    }));
  }

  async function hydrateQuestionQueue() {
    const queue = $(".queue");
    if (!queue) return;
    const local = getLocalData();
    if (local?.questions?.length) {
      const view = new URLSearchParams(location.search).get("view");
      const questions = view === "review"
        ? local.questions.filter((item) => item.reviewStatus === "待复审")
        : local.questions;
      return renderLocalQueue(questions);
    }
    if (!apiEnabled) return;
    try {
      const questions = await api("/api/questions");
      const count = $(".panel-head .head-count");
      if (count) count.textContent = `${questions.length} 道`;
      queue.innerHTML = questions.map((question, index) => `
        <div class="q-item ${index === 0 ? "active" : ""}" data-id="${question.id}">
          <div class="q-top"><span class="q-num">${question.year} · ${question.type}</span><span class="badge blue">${question.reviewStatus}</span></div>
          <div class="q-text">${question.stem}</div>
          <div class="q-foot"><span>答案 ${question.answer || "待确认"}</span><span class="badge ${question.sourceStatus === "来源解析异常" ? "amber" : "green"}">${question.sourceStatus}</span></div>
        </div>`).join("");
      $$(".q-item", queue).forEach((item) => item.addEventListener("click", async () => {
        $$(".q-item", queue).forEach((q) => q.classList.remove("active"));
        item.classList.add("active");
        try {
          renderQuestion(await api(`/api/questions/${encodeURIComponent(item.dataset.id)}`));
          setAutosave();
        } catch (error) {
          toast(`题目加载失败：${error.message}`, "error");
        }
      }));
    } catch (error) {
      toast(`题目队列加载失败：${error.message}`, "error");
    }
  }

  async function hydrateReleaseState() {
    const publish = $$("button").find((button) => button.textContent.includes("统一发布"));
    if (!publish || !apiEnabled) return;
    try {
      const check = await api("/api/releases/check");
      publish.disabled = !check.canPublish;
      publish.classList.toggle("is-disabled", !check.canPublish);
      publish.title = check.canPublish ? "" : `存在 ${check.blockers} 条来源解析异常记录`;
    } catch (error) {
      toast(`读取发布检查失败：${error.message}`, "error");
    }
  }

  function bindReviewWorkspace() {
    const options = $$(".option");
    if (!options.length) return;

    bindOptionClicks();

    $$(".q-item").forEach((item) => item.addEventListener("click", () => {
      $$(".q-item").forEach((q) => q.classList.remove("active"));
      item.classList.add("active");
      setAutosave();
      toast(`已加载 ${$(".q-num", item)?.textContent.trim()}`);
    }));

    $$(".unit-tab").forEach((tab) => {
      markBound(tab);
      tab.addEventListener("click", () => {
      $$(".unit-tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      toast(`正在查看：${tab.textContent.trim()}`);
      });
    });

    $$(".tab").forEach((tab) => {
      markBound(tab);
      tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      toast(`${tab.textContent.trim()}已切换`);
      });
    });

    $$(".suggest-card").forEach((card) => {
      $$(".mini-btn", card).forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation();
        markBound(button);
        const action = button.textContent.replace("✓", "").trim();
        if (!["接受建议", "修改", "拒绝"].includes(action)) {
          if (action === "查看来源") modal("真实数据来源", "来源为 2021—2025 年经济科目真题解析文件，公开页面不直接上传原始私有文件。", "我知道了");
          else toast(`${action}已执行`);
          return;
        }
        const decision = action.replace("建议", "");
        card.dataset.decision = decision;
        const existing = $(".status-note", card);
        existing?.remove();
        const note = document.createElement("span");
        note.className = `status-note ${decision === "修改" ? "warn" : ""}`;
        note.textContent = `人工${decision}`;
        $(".suggest-top", card)?.appendChild(note);
        saveReview(decision, { suggestion: $(".suggest-title", card)?.textContent.trim() })
          .then(() => toast(`AI 建议已${decision}并保存`, decision === "拒绝" ? "warn" : "success"))
          .catch((error) => toast(`保存失败：${error.message}`, "error"));
        setAutosave();
      }));
    });

    const footerButtons = $$(".footer .btn");
    footerButtons.forEach((button) => {
      markBound(button);
      button.addEventListener("click", () => {
      const action = button.textContent.trim();
      if (action.includes("提交复审")) {
        const result = window.ReviewState?.evaluateRisks({
          confidence: 61,
          primaryKnowledgeCount: 1,
          hasMajorAiChanges: true,
          noDirectEvidence: false,
          validity: "仍然有效",
        });
        modal("提交复审确认", `检测到 <b>${result.risks.join("、")}</b>，提交后将进入复审队列。`, "确认提交", async () => {
          try {
            const saved = await saveReview("提交复审", { selectedOption: $(".option.active .letter")?.textContent.trim() });
            toast(`已保存，状态：${saved.targetStatus}`, "success");
            setAutosave();
          } catch (error) {
            toast(`提交失败：${error.message}`, "error");
          }
        });
      } else if (action.includes("退回修改")) {
        modal("退回修改", "将保留当前审核记录，并把此题退回待初审队列。", "确认退回", async () => {
          try {
            await saveReview("退回修改");
            toast("已退回修改并保存", "warn");
          } catch (error) {
            toast(`退回失败：${error.message}`, "error");
          }
        });
      } else {
        setAutosave();
        toast(`${action}完成`, "success");
        if (action.includes("上一题") || action.includes("下一题")) {
          const items = $$(".q-item");
          const current = items.findIndex((item) => item.classList.contains("active"));
          const offset = action.includes("上一题") ? -1 : 1;
          items[Math.max(0, Math.min(items.length - 1, current + offset))]?.click();
        }
      }
      });
    });
  }

  function bindSecondaryPages() {
    $$(".toolbar .btn").forEach((button) => button.addEventListener("click", () => {
      markBound(button);
      if (button.disabled) return;
      const text = button.textContent.trim();
      if (/创建发布批次/.test(text)) {
        modal("创建发布批次", "将基于经济科目 397 道真题记录与 631 条知识考点执行发布检查。", "执行发布检查", async () => {
          try {
            const check = await api("/api/releases/check");
            if (!check) {
              toast("发布检查完成：发现 5 个源文件阻断项", "warn");
              return;
            }
            toast(check.canPublish ? "发布检查通过" : `发布被阻断：${check.blockers} 条来源异常`, check.canPublish ? "success" : "warn");
          } catch (error) {
            toast(`发布检查失败：${error.message}`, "error");
          }
        });
      } else if (/目录/.test(text)) {
        modal("教材目录", "当前定位：第 1 篇 工程经济 / 第 2 章 经济效果评价 / 2.1.1.2 财务评价的内容。", "定位当前章节", () => toast("已定位第 2 章", "success"));
      } else if (/上一页|下一页|P\.\d+\s*\/\s*388/.test(text)) {
        const pageButton = $$("button").find((item) => /P\.\d+\s*\/\s*388/.test(item.textContent));
        const current = Number(pageButton?.textContent.match(/\d+/)?.[0] || 16);
        const next = text.includes("上一页") ? Math.max(1, current - 1) : text.includes("下一页") ? Math.min(388, current + 1) : current;
        if (pageButton) pageButton.textContent = `P.${next} / 388`;
        toast(`已定位教材第 ${next} 页`);
      } else if (/定位 P\.\d+/.test(text)) {
        toast(`${text.replace("定位 ", "")} 已在原版教材中高亮`, "success");
      } else if (/第 \d+ 章|标题树筛选|考查年份|题型|局部图谱/.test(text)) {
        modal(text.replace("⌄", ""), "演示版已加载经济科目真实数据，可继续选择筛选条件。", "应用当前条件", () => {
          button.classList.add("filter-active");
          toast("筛选条件已应用", "success");
        });
      } else if (/仅看|核心考查|一般涉及|历史失效|共同核心|主次组合|选项对比|案例场景/.test(text)) {
        button.classList.toggle("filter-active");
        if (/仅看未考查节点/.test(text)) {
          $$("tbody tr").forEach((row) => {
            const cells = $$("td", row);
            row.style.display = button.classList.contains("filter-active") && cells.length && cells[5]?.textContent.trim() !== "0" ? "none" : "";
          });
        }
        toast(`${text}${button.classList.contains("filter-active") ? "筛选已启用" : "筛选已取消"}`);
      } else if (/导出/.test(text)) {
        const csv = $("table") ? tableCsv() : `检查项,状态\n真实题目,397\n知识考点,631\n教材页面,388\n来源阻断项,5`;
        downloadText(`${text.replace(/\s/g, "-")}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
        toast(`${text}已下载`, "success");
      } else if (/全部考点|2025 新考点|名称差异|待定位|待发布数据|知识考点|关系强度/.test(text)) {
        button.classList.toggle("filter-active");
        toast(`已切换：${text}`);
      } else if (/完成本章验收|提交差异修正/.test(text)) {
        modal(text, "当前修改记录将保存到工作版本 ECON-2026.01。", "确认提交", () => toast(`${text}成功`, "success"));
      }
    }));

    const search = $(".toolbar input");
    if (search && $("table")) {
      search.addEventListener("input", () => {
        const keyword = search.value.trim().toLowerCase();
        $$("tbody tr").forEach((row) => {
          row.style.display = !keyword || row.textContent.toLowerCase().includes(keyword) ? "" : "none";
        });
      });
    }

    $$(".issue,.release-item,.node,tbody tr").forEach((item) => item.addEventListener("click", () => {
      const parent = item.parentElement;
      $$(":scope > .issue,:scope > .release-item,:scope > .node,:scope > tr", parent).forEach((el) => el.classList.remove("is-selected"));
      item.classList.add("is-selected");
      toast("已更新当前查看项");
    }));

    $$(".highlight,[style*='border-bottom:2px dashed']").forEach((mark) => mark.addEventListener("click", () => {
      toast("已定位该教材原文的关联真题");
    }));

    $$(".card-body .btn.primary").forEach((button) => button.addEventListener("click", () => {
      markBound(button);
      toast(`${button.textContent.trim()}成功，变更记录已保存`, "success");
    }));

    $$(".tree .l3").forEach((item) => item.addEventListener("click", () => {
      $$(".tree .l3").forEach((node) => node.classList.remove("active"));
      item.classList.add("active");
      toast(`已选择：${item.textContent.trim()}`);
    }));

    $$("button").filter((button) => /处理阻断项|统一发布/.test(button.textContent)).forEach((button) => {
      markBound(button);
      button.addEventListener("click", () => {
        modal("发布阻断说明", "当前有 5 份真题源 PDF 存在字体编码缺失。题干语义、答案和解析可用，但正式发布前需要人工恢复题号及部分数字。", "查看待处理数据", () => {
          location.href = "index.html?view=review";
        });
      });
    });

    const publish = $$("button").find((button) => button.textContent.includes("统一发布"));
    if (publish) {
      const allowed = window.ReviewState?.canPublish([
        { level: "blocker", resolved: false },
        { level: "warning", resolved: false },
      ]);
      publish.classList.toggle("is-disabled", !allowed);
      publish.title = allowed ? "" : "存在 2 个未处理阻断项";
    }
  }

  function bindFallbackButtons() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.dataset.bound === "true" || button.closest(".modal")) return;
      markBound(button);
      const text = button.textContent.trim() || "当前操作";
      if (/修改|修正解析|编辑解析/.test(text)) {
        modal(text, "已进入人工修改模式。演示版会在当前浏览器中保存操作记录。", "保存修改", () => toast(`${text}已保存`, "success"));
      } else if (/拒绝/.test(text)) {
        toast("已拒绝当前建议", "warn");
      } else if (/查看来源/.test(text)) {
        modal("真实数据来源", "来源为 2021—2025 年经济科目真题解析文件，公开页面不直接上传原始私有文件。", "我知道了");
      } else {
        toast(`${text}已执行`);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    ensureAllQuestionDrawer();
    bindReviewWorkspace();
    bindSecondaryPages();
    bindLocalDataImport();
    hydrateReviewState();
    hydrateQuestionQueue();
    hydrateReleaseState();
    bindAllQuestionDrawer();
    hydrateAllQuestionDrawer();
    hydratePageQuestionData();
    hydrateKnowledgeTable();
    hydrateReleasePage();
    hydrateTextbookPages();
    bindFallbackButtons();
    document.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowRight") $(".footer .btn:nth-child(2)")?.click();
      if (event.altKey && event.key === "Enter") $(".footer .btn.primary")?.click();
    });
  });
})();
