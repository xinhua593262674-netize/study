const pages = [
  ["核心工作", [["按真题审核","index.html"],["复审队列","#"],["按知识点审核","#"]]],
  ["数据准备", [["教材解析验收","textbook-validation.html"],["知识体系差异","knowledge-diff.html"]]],
  ["发布与成果", [["发布管理","release.html"],["教研大宽表","knowledge-table.html"],["教材预览","textbook-preview.html"],["知识图谱","knowledge-graph.html"]]]
];
function shell(active,title,crumb,content){
  const nav=pages.map(([label,items])=>`<div class="nav-label">${label}</div>${items.map(([n,h])=>`<a class="nav-item ${n===active?'active':''}" href="${h}">${n}${n==='发布管理'?'<span class="nav-count">12</span>':''}</a>`).join('')}`).join('');
  document.body.innerHTML=`<div class="app"><aside class="sidebar"><div class="brand"><div class="logo">研</div>教研解析平台</div>${nav}<div class="side-foot"><strong>当前工作版本 ECON-2026.01</strong><span>真实数据：2026 教材及 2021—2025 真题</span></div></aside><main><header class="topbar"><div><div class="title">${title}</div><div class="crumb">${crumb}</div></div><div class="top-meta"><div class="select">一级建造师 · 建设工程经济⌄</div><div class="select">2026 版教材⌄</div><div class="tag">真实数据处理中</div></div></header>${content}</main></div>`;
  window.setTimeout(()=>document.dispatchEvent(new Event("prototype:rendered")),0);
}
