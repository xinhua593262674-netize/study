const pages = [
  ["核心工作", [["真题工作台","index.html"],["待抽检","index.html?view=review"],["知识点查看","knowledge-table.html?mode=review"]]],
  ["数据准备", [["教材解析验收","textbook-validation.html"],["知识体系差异","knowledge-diff.html"]]],
  ["发布与成果", [["发布管理","release.html"],["教研大宽表","knowledge-table.html"],["教材预览","textbook-preview.html"],["知识图谱","knowledge-graph.html"]]]
];
function shell(active,title,crumb,content){
  const nav=pages.map(([label,items])=>`<div class="nav-label">${label}</div>${items.map(([n,h])=>`<a class="nav-item ${n===active?'active':''}" href="${h}">${n}${n==='发布管理'?'<span class="nav-count">12</span>':''}</a>`).join('')}`).join('');
  document.body.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="logo">研</div>教研解析平台</div>${nav}<div class="side-foot"><strong>当前工作版本 ECON-2026.01</strong><span>真实数据：2026 教材及 2021—2025 真题</span></div></aside><main><header class="topbar"><div><div class="title">${title}</div><div class="crumb">${crumb}</div></div><div class="top-meta"><button class="btn local-data-btn">加载本机真实数据</button><input class="local-data-input" type="file" accept=".json" multiple hidden><div class="select">一级建造师 · 建设工程经济⌄</div><div class="select">2026 版教材⌄</div><div class="tag">真实数据处理中</div></div></header>${content}</main></div>
  <button class="all-questions-trigger" type="button"><b>397</b><span>全部真题</span></button><div class="question-drawer-backdrop"></div>
  <aside class="question-drawer" aria-label="全部真实真题"><div class="question-drawer-head"><div><b>经济科目全部真实真题</b><span class="drawer-count">等待加载本机数据</span></div><button class="drawer-close" type="button">×</button></div><div class="question-drawer-filters"><input class="drawer-search" placeholder="搜索题干、解析、考点"><select class="drawer-year"><option value="">全部年份</option></select><select class="drawer-type"><option value="">全部题型</option></select></div><div class="question-drawer-body"><div class="drawer-list"></div><div class="drawer-detail"><div class="drawer-empty"><b>请先加载本机真实数据</b><p>只需加载一次，所有页面都会自动读取。</p></div></div></div></aside>`;
  window.setTimeout(()=>document.dispatchEvent(new Event("prototype:rendered")),0);
}
