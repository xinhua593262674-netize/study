(function () {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  let toastTimer;
  const apiEnabled = location.protocol === "http:" || location.protocol === "https:";

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
      setAutosave();
      return { targetStatus: action === "退回修改" ? "待初审" : "待复审", risks: ["本地演示模式"] };
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
    if (!queue || !apiEnabled) return;
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

    $$(".unit-tab").forEach((tab) => tab.addEventListener("click", () => {
      $$(".unit-tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      toast(`正在查看：${tab.textContent.trim()}`);
    }));

    $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
      $$(".tab").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      toast(`${tab.textContent.trim()}已切换`);
    }));

    $$(".suggest-card").forEach((card) => {
      $$(".mini-btn", card).forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation();
        const action = button.textContent.replace("✓", "").trim();
        if (!["接受建议", "修改", "拒绝"].includes(action)) return;
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
    footerButtons.forEach((button) => button.addEventListener("click", () => {
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
      }
    }));
  }

  function bindSecondaryPages() {
    $$(".toolbar .btn").forEach((button) => button.addEventListener("click", () => {
      if (button.disabled) return;
      const text = button.textContent.trim();
      if (/创建发布批次/.test(text)) {
        modal("创建发布批次", "将基于经济科目 397 道真题记录与 631 条知识考点执行发布检查。", "执行发布检查", async () => {
          try {
            const check = await api("/api/releases/check");
            toast(check.canPublish ? "发布检查通过" : `发布被阻断：${check.blockers} 条来源异常`, check.canPublish ? "success" : "warn");
          } catch (error) {
            toast(`发布检查失败：${error.message}`, "error");
          }
        });
      } else if (/仅看|核心考查|一般涉及|历史失效|共同核心|主次组合|选项对比|案例场景/.test(text)) {
        button.classList.toggle("filter-active");
        toast(`${text}${button.classList.contains("filter-active") ? "筛选已启用" : "筛选已取消"}`);
      } else if (/导出/.test(text)) {
        toast(`${text}任务已创建`, "success");
      }
    }));

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
      toast(`${button.textContent.trim()}成功，变更记录已保存`, "success");
    }));

    const publish = $$("button").find((button) => button.textContent.includes("统一发布"));
    if (publish) {
      const allowed = window.ReviewState?.canPublish([
        { level: "blocker", resolved: false },
        { level: "warning", resolved: false },
      ]);
      publish.disabled = !allowed;
      publish.classList.toggle("is-disabled", !allowed);
      publish.title = allowed ? "" : "存在 2 个未处理阻断项";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindReviewWorkspace();
    bindSecondaryPages();
    hydrateReviewState();
    hydrateQuestionQueue();
    hydrateReleaseState();
    document.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowRight") $(".footer .btn:nth-child(2)")?.click();
      if (event.altKey && event.key === "Enter") $(".footer .btn.primary")?.click();
    });
  });
})();
