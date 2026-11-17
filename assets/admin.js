/* 数理天医 · 智能客服 Agent — 管理后台 */
(function () {
  'use strict';
  var TY = window.TY;
  var U = TY.utils, Store = TY.Store, Engine = TY.Engine;
  function el(id) { return document.getElementById(id); }
  function esc(v) { return U.escapeHtml(v); }
  var page = 'overview';
  var PAGE_META = {
    overview: ['数据概览', '对话量、满意度、意图分布与人工工单一览'],
    conversations: ['对话记录', '查看完整多轮对话、识别意图与满意度评价'],
    handoffs: ['人工工单', '处理自动或用户主动发起的转人工请求'],
    faq: ['知识库', '维护 FAQ 条目，直接影响检索命中与回答质量'],
    insights: ['知识洞察', '知识缺口聚类与陈旧条目，持续优化自助解答率'],
    simulate: ['机器人测试', '上线前模拟真实问题，回放意图→检索→回答→转人工全链路'],
    agents: ['坐席与快捷回复', '配置人工坐席、技能分配与标准话术'],
    audit: ['审计日志', '关键操作的可追溯记录'],
    llm: ['模型接入', '配置可选的大模型接口，启用语义意图识别与生成式回答'],
    cloud: ['云端同步', '配置 Supabase，让会话数据跨设备存储'],
    settings: ['系统设置', '客服策略与本地数据管理']
  };

  function fmtStatus(s) {
    return { active: '<span class="badge green">进行中</span>', waiting_human: '<span class="badge red">等待人工</span>', resolved: '<span class="badge gray">已解决</span>' }[s] || '<span class="badge gray">—</span>';
  }
  function slaBadge(c) {
    var s = Store.slaStatus(c);
    if (s.level === 'danger') return '<span class="badge red">' + s.label + '</span>';
    if (s.level === 'warn') return '<span class="badge" style="background:#f5e6c8;color:#8a6a2f">' + s.label + '</span>';
    return '<span class="badge green">' + s.label + '</span>';
  }
  function intentBadge(key) {
    var i = TY.INTENTS[key] || TY.INTENTS.other;
    return '<span class="badge" style="background:' + i.color + '1a;color:' + i.color + '">' + i.label + '</span>';
  }
  function stars(n) { return '<span class="stars-small">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'; }
  function fmtDuration(ms) {
    if (!ms) return '—';
    var min = Math.round(ms / 60000);
    if (min < 60) return min + ' 分钟';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' 小时' + (m ? ' ' + m + ' 分' : '');
  }
  function convTitle(id) {
    var c = Store.getConversation(id);
    return c ? c.title : '（会话已删除）';
  }
  function bar(label, value, max, color, suffix) {
    var pct = max > 0 ? Math.max(2, Math.round(value / max * 100)) : 0;
    return '<div class="bar-item"><span class="bi-label">' + esc(label) + '</span>' +
      '<span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:' + (color || 'var(--jade)') + '"></span></span>' +
      '<span class="bi-value">' + esc(String(suffix != null ? suffix : value)) + '</span></div>';
  }

  /* ---------- navigation ---------- */
  function go(name) {
    page = name;
    document.querySelectorAll('#adminNav .nav-item').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-page') === name); });
    document.querySelectorAll('section.page').forEach(function (s) { s.classList.toggle('hidden', s.getAttribute('data-page') !== name); });
    el('pageTitle').textContent = PAGE_META[name][0];
    el('pageSub').textContent = PAGE_META[name][1];
    render();
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    var s = Store.stats(), st = Store.state();
    var cards = [
      ['累计会话', s.totalConversations, '共 ' + s.totalMessages + ' 条消息', 'accent'],
      ['满意度', s.ratingCount ? s.avgRating.toFixed(2) : '—', '基于 ' + s.ratingCount + ' 条评价', 'gold'],
      ['满意率', s.ratingCount ? Math.round(s.satisfactionRate * 100) + '%' : '—', '4 星及以上占比', 'accent'],
      ['转人工率', s.totalConversations ? Math.round(s.handoffRate * 100) + '%' : '—', s.totalHandoffs + ' 个工单', 'warn'],
      ['待处理工单', s.pendingHandoffs, '需人工跟进', s.pendingHandoffs ? 'warn' : ''],
      ['知识库条目', s.totalFaqs, '共 ' + st.faqs.length + ' 条（含停用）', ''],
      ['平均首响', fmtDuration(s.avgFirstResponseMs), '用户→机器人首次回复', 'accent'],
      ['平均解决时长', fmtDuration(s.avgResolutionMs), '仅统计已解决会话', ''],
      ['NPS', s.avgNps == null ? '—' : s.avgNps.toFixed(1), s.npsCount + ' 条推荐意愿', 'gold'],
      ['合规预警', s.complianceFlags, '命中敏感表述的会话', s.complianceFlags ? 'warn' : '']
    ];
    el('statGrid').innerHTML = cards.map(function (c) {
      return '<div class="stat-card ' + c[3] + '"><div class="sc-label">' + c[0] + '</div><div class="sc-value">' + c[1] + '</div><div class="sc-foot">' + c[2] + '</div></div>';
    }).join('');

    // 满意度环图
    var rate = s.ratingCount ? s.satisfactionRate : 0;
    var C = 2 * Math.PI * 48;
    el('satisfactionDonut').innerHTML =
      '<circle cx="60" cy="60" r="48" fill="none" stroke="#eee7d8" stroke-width="13"></circle>' +
      '<circle cx="60" cy="60" r="48" fill="none" stroke="#2f6b5f" stroke-width="13" stroke-linecap="round" ' +
        'stroke-dasharray="' + (rate * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)"></circle>' +
      '<text x="60" y="57" text-anchor="middle" class="donut-center" font-size="21" fill="#24282a">' + Math.round(rate * 100) + '%</text>' +
      '<text x="60" y="76" text-anchor="middle" font-size="10" fill="#8d8d84">满意率</text>';
    el('ratingCountTag').textContent = s.ratingCount + ' 条评价';
    el('satisfactionLegend').innerHTML = [
      ['满意（4-5 星）', s.dist[3] + s.dist[4], '#2f6b5f'],
      ['一般（3 星）', s.dist[2], '#bd9a55'],
      ['不满意（1-2 星）', s.dist[0] + s.dist[1], '#b4453c']
    ].map(function (r) { return '<div class="legend-row"><i style="background:' + r[2] + '"></i><span>' + r[0] + '</span><span>' + r[1] + ' 条</span></div>'; }).join('');
    var maxDist = Math.max.apply(null, s.dist.concat([1]));
    el('ratingDist').innerHTML = [5, 4, 3, 2, 1].map(function (n) {
      return bar(n + ' 星', s.dist[n - 1], maxDist, n >= 4 ? 'var(--jade)' : (n === 3 ? 'var(--gold)' : 'var(--cinnabar)'), s.dist[n - 1] + ' 条');
    }).join('');

    // 趋势图
    var trend = s.trend, maxT = Math.max.apply(null, trend.map(function (t) { return t.conversations; }).concat([1]));
    var bw = 38, gap = (460 - 7 * bw) / 8, svg = '';
    [0, 1, 2, 3].forEach(function (i) {
      var y = 12 + i * 30;
      svg += '<line x1="0" y1="' + y + '" x2="460" y2="' + y + '" stroke="#eee7d8" stroke-width="1" stroke-dasharray="3 4"></line>';
    });
    trend.forEach(function (t, i) {
      var x = gap + i * (bw + gap), h = Math.round(t.conversations / maxT * 96);
      svg += '<rect x="' + x + '" y="' + (112 - h) + '" width="' + bw + '" height="' + Math.max(h, 2) + '" rx="4" fill="' + (i === 6 ? '#2f6b5f' : '#a9c9bc') + '"></rect>';
      if (t.conversations) svg += '<text x="' + (x + bw / 2) + '" y="' + (108 - h) + '" text-anchor="middle" font-size="11" fill="#5d625f">' + t.conversations + '</text>';
    });
    el('trendChart').innerHTML = svg;
    el('trendLabels').innerHTML = trend.map(function (t) { return '<span>' + t.label + '</span>'; }).join('');

    // 意图分布
    var intentEntries = Object.keys(s.intentCount).sort(function (a, b) { return s.intentCount[b] - s.intentCount[a]; });
    var maxI = Math.max.apply(null, intentEntries.map(function (k) { return s.intentCount[k]; }).concat([1]));
    el('intentBars').innerHTML = intentEntries.length ? intentEntries.map(function (k) {
      var i = TY.INTENTS[k] || TY.INTENTS.other;
      return bar(i.label, s.intentCount[k], maxI, i.color, s.intentCount[k] + ' 次');
    }).join('') : '<div class="empty" style="padding:16px">暂无意图数据</div>';

    // 状态 + FAQ
    el('statusBars').innerHTML = [
      bar('进行中', s.statusCount.active || 0, Math.max(s.totalConversations, 1), 'var(--jade)', (s.statusCount.active || 0) + ' 条'),
      bar('等待人工', s.statusCount.waiting_human || 0, Math.max(s.totalConversations, 1), 'var(--cinnabar)', (s.statusCount.waiting_human || 0) + ' 条'),
      bar('已解决', s.statusCount.resolved || 0, Math.max(s.totalConversations, 1), 'var(--gold)', (s.statusCount.resolved || 0) + ' 条')
    ].join('');
    var maxF = Math.max.apply(null, s.topFaqs.map(function (f) { return f.hits || 0; }).concat([1]));
    el('faqBars').innerHTML = s.topFaqs.map(function (f) {
      return bar(f.question.length > 12 ? f.question.slice(0, 12) + '…' : f.question, f.hits || 0, maxF, 'var(--blue)', (f.hits || 0) + ' 次');
    }).join('');

    var recent = Store.state().handoffs.slice(0, 5);
    el('recentHandoffs').innerHTML = recent.length ? recent.map(function (h) {
      return '<tr><td class="td-strong">' + esc(h.id.slice(-8)) + '</td><td class="td-clip">' + esc(convTitle(h.conversationId)) + '</td>' +
        '<td class="td-clip">' + esc(h.reason) + '</td><td>' + (h.status === 'pending' ? '<span class="badge red">待处理</span>' : '<span class="badge green">已处理</span>') + '</td>' +
        '<td>' + U.formatDateTime(h.createdAt) + '</td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="empty" style="padding:22px"><span class="empty-icon">✓</span>暂无人工工单</div></td></tr>';
    el('navHandoffCount').textContent = s.pendingHandoffs;
    el('navHandoffCount').classList.toggle('hidden', !s.pendingHandoffs);

    var flagged = st.conversations.filter(function (c) {
      return (c.messages || []).some(function (m) { return m.complianceFlags && m.complianceFlags.length; });
    }).slice(0, 6);
    el('complianceTag').textContent = s.complianceFlags + ' 条';
    el('complianceAlerts').innerHTML = flagged.length ? flagged.map(function (c) {
      var words = [];
      c.messages.forEach(function (m) { if (m.complianceFlags) words = words.concat(m.complianceFlags); });
      return '<div class="alert-row" data-goto-conv="' + c.id + '"><b>' + esc(c.title) + '</b>' +
        '<span>' + esc(words.slice(0, 3).join(' / ')) + '</span></div>';
    }).join('') : '<div class="empty" style="padding:18px"><span class="empty-icon">✓</span>未发现敏感表述</div>';
  }

  /* ---------- conversations ---------- */
  function renderConversations() {
    var kw = el('convFilter').value.trim().toLowerCase();
    var ik = el('convIntentFilter').value, sk = el('convStatusFilter').value;
    var list = Store.state().conversations.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).filter(function (c) {
      if (ik && c.intent !== ik) return false;
      if (sk && c.status !== sk) return false;
      if (kw && (c.title || '').toLowerCase().indexOf(kw) < 0 &&
          !(c.messages || []).some(function (m) { return String(m.content || '').toLowerCase().indexOf(kw) >= 0; })) return false;
      return true;
    });
    el('convCount').textContent = '共 ' + list.length + ' 条会话';
    el('convTable').innerHTML = list.length ? list.map(function (c) {
      return '<tr data-id="' + c.id + '">' +
        '<td class="td-strong td-clip" title="' + esc(c.title) + '">' + esc(c.title) + '</td>' +
        '<td>' + intentBadge(c.intent) + '</td><td>' + fmtStatus(c.status) + '</td>' +
        '<td>' + slaBadge(c) + '</td>' +
        '<td>' + (c.messages || []).length + '</td>' +
        '<td>' + (c.rating ? stars(c.rating.score) : '<span class="muted">未评价</span>') + '</td>' +
        '<td>' + U.formatDateTime(c.updatedAt) + '</td>' +
        '<td><button class="btn btn-sm" data-act="view" data-id="' + c.id + '">查看</button> ' +
          '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + c.id + '">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="empty"><span class="empty-icon">▤</span>没有符合条件的会话</div></td></tr>';
  }

  function openConvDrawer(id) {
    var c = Store.getConversation(id);
    if (!c) return;
    el('drawerTitle').textContent = '会话详情 · ' + c.title;
    var v = c.visitor || {};
    var tags = (c.tags || []).map(function (t) {
      return '<span class="tag" style="margin-right:5px">' + esc(t) +
        ' <b data-drawer-act="deltag" data-tag="' + esc(t) + '" style="cursor:pointer">×</b></span>';
    }).join('') || '<span class="muted">暂无标签</span>';
    var notes = (c.internalNotes || []).map(function (n) {
      return '<div class="drawer-msg"><div class="dm-role"><b>内部备注</b><span>' + U.formatDateTime(n.ts) + '</span></div>' +
        '<div class="dm-body">' + esc(n.text) + '</div></div>';
    }).join('') || '<div class="muted" style="font-size:12px;padding:8px 0">暂无内部备注</div>';
    var firstUser = (c.messages || []).filter(function (m) { return m.role === 'user'; })[0];
    var firstBot = (c.messages || []).filter(function (m) { return m.role === 'assistant'; })[0];
    var frText = firstUser && firstBot ? fmtDuration(Math.max(0, firstBot.ts - firstUser.ts)) : '—';
    var resolveText = c.resolvedAt ? fmtDuration(Math.max(0, c.resolvedAt - c.createdAt)) : '—';
    var html = '<div class="panel" style="margin-bottom:14px"><div class="kv">' +
      '<span>会话 ID</span><span>' + esc(c.id) + '</span>' +
      '<span>识别意图</span><span>' + intentBadge(c.intent) + '</span>' +
      '<span>状态 / SLA</span><span>' + fmtStatus(c.status) + ' ' + slaBadge(c) + '</span>' +
      '<span>创建时间</span><span>' + U.formatDateTime(c.createdAt) + '</span>' +
      '<span>首响 / 解决</span><span>' + frText + ' / ' + resolveText + '</span>' +
      '<span>消息数</span><span>' + (c.messages || []).length + '</span>' +
      '<span>满意度 / NPS</span><span>' + (c.rating ? stars(c.rating.score) : '未评价') + ' · ' + (c.nps == null ? '—' : c.nps) + '</span>' +
      '</div>' +
      '<div style="font-size:12px;margin:12px 0 6px"><b>会话摘要</b> <button class="btn btn-sm" data-drawer-act="resummarize" data-id="' + c.id + '">重新生成</button>' +
      '<div class="notice-card" style="margin-top:6px">' + esc(c.summary || '尚无摘要') + '</div></div>' +
      '<div style="font-size:12px;margin:12px 0 6px"><b>访客画像</b><div class="muted">ID ' + esc(v.id || 'anon') + ' · 语言 ' + esc(v.lang || '—') + ' · 来源 ' + esc(v.ref || '直接访问') + '</div>' +
      '<div class="muted" style="word-break:break-all">UA ' + esc((v.ua || '—').slice(0, 120)) + '</div></div>' +
      '<div style="font-size:12px;margin:12px 0 6px"><b>会话标签</b><div style="margin-top:6px">' + tags + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:6px"><input class="input" id="tagInput" placeholder="新增标签（最多12字）"><button class="btn btn-sm" data-drawer-act="addtag" data-id="' + c.id + '">添加</button></div></div>' +
      '<div style="font-size:12px;margin:12px 0 6px"><b>内部备注（客户不可见）</b>' + notes +
      '<textarea class="textarea" id="noteInput" placeholder="写下处理进展…"></textarea>' +
      '<button class="btn btn-sm" data-drawer-act="addnote" data-id="' + c.id + '" style="margin-top:6px">添加备注</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-sm" data-drawer-act="resolve" data-id="' + c.id + '">标记已解决</button>' +
      '<button class="btn btn-sm" data-drawer-act="export" data-id="' + c.id + '">导出本会话</button>' +
      '<button class="btn btn-sm btn-danger" data-drawer-act="delete" data-id="' + c.id + '">删除会话</button></div></div>';
    html += '<h4 style="font-size:12px;color:var(--ink-3);letter-spacing:1px;margin:0 0 10px">完整对话</h4>';
    html += (c.messages || []).map(function (m) {
      return '<div class="drawer-msg ' + (m.role === 'user' ? 'user' : '') + '">' +
        '<div class="dm-role"><b>' + (m.role === 'user' ? '用户' : '天医小助手') + '</b><span>' + U.formatDateTime(m.ts) + '</span>' +
        (m.intent ? '<span>' + (TY.INTENTS[m.intent] || TY.INTENTS.other).label + '</span>' : '') +
        (m.engine ? '<span>' + esc(m.engine) + '</span>' : '') +
        (m.complianceFlags && m.complianceFlags.length ? '<span class="badge red">合规：' + esc(m.complianceFlags.join('/')) + '</span>' : '') + '</div>' +
        '<div class="dm-body">' + esc(String(m.content || '').replace(/\[\[HANDOFF\]\]/g, '')) + '</div>' +
        (m.handoff ? '<div class="handoff-card" style="margin-top:8px"><strong>已转人工</strong>' + esc(m.handoff) + '</div>' : '') +
        (m.sources && m.sources.length ? '<div class="muted" style="font-size:11px;margin-top:5px">引用：' + m.sources.map(function (x) { return esc(x.question); }).join('；') + '</div>' : '') +
      '</div>';
    }).join('');
    el('drawerBody').innerHTML = html;
    el('drawer').classList.add('open');
    el('drawerMask').classList.add('open');
  }
  function closeDrawer() { el('drawer').classList.remove('open'); el('drawerMask').classList.remove('open'); }

  /* ---------- handoffs ---------- */
  function renderHandoffs() {
    var f = el('handoffFilter').value;
    var list = Store.state().handoffs.filter(function (h) { return f === 'all' ? true : h.status === f; });
    el('handoffCount').textContent = '共 ' + list.length + ' 个工单';
    el('handoffTable').innerHTML = list.length ? list.map(function (h) {
      return '<tr><td class="td-strong">' + esc(h.id.slice(-8)) + '</td>' +
        '<td class="td-clip">' + esc(convTitle(h.conversationId)) + '</td>' +
        '<td class="td-clip" title="' + esc(h.reason) + '">' + esc(h.reason) + '</td>' +
        '<td>' + intentBadge(h.intent) + '</td>' +
        '<td>' + (h.status === 'pending' ? '<span class="badge red">待处理</span>' : '<span class="badge green">已处理</span>') + '</td>' +
        '<td>' + U.formatDateTime(h.createdAt) + '</td>' +
        '<td><button class="btn btn-sm" data-hact="view" data-id="' + h.conversationId + '">查看对话</button> ' +
          (h.status === 'pending' ? '<button class="btn btn-sm btn-primary" data-hact="resolve" data-id="' + h.id + '">标记处理</button>' : '') +
        '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty"><span class="empty-icon">✓</span>暂无工单</div></td></tr>';
  }

  function openResolveModal(id) {
    openModal('<h3>处理人工工单</h3>' +
      '<div class="field"><label>处理备注（选填）</label><textarea class="textarea" id="resolveNote" placeholder="例如：已联系用户并完成退款核验"></textarea></div>' +
      '<div class="modal-foot"><button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="resolveConfirm">确认已处理</button></div>');
    el('resolveConfirm').onclick = function () {
      Store.resolveHandoff(id, el('resolveNote').value.trim());
      closeModal(); render(); U.toast('工单已标记为已处理', 'success');
    };
  }

  /* ---------- FAQ ---------- */
  function renderFaq() {
    var kw = el('faqFilter').value.trim().toLowerCase();
    var cat = el('faqCategoryFilter').value;
    var list = Store.state().faqs.filter(function (f) {
      if (cat && f.category !== cat) return false;
      if (kw && (f.question + f.answer + (f.keywords || []).join('')).toLowerCase().indexOf(kw) < 0) return false;
      return true;
    });
    el('faqTable').innerHTML = list.length ? list.map(function (f) {
      return '<tr><td class="td-strong td-clip" title="' + esc(f.question) + '">' + esc(f.question) + '</td>' +
        '<td>' + esc(f.category) + '</td><td>' + intentBadge(f.intent) + '</td><td>' + (f.hits || 0) + '</td>' +
        '<td>' + (f.enabled === false ? '<span class="badge gray">已停用</span>' : '<span class="badge green">启用中</span>') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-sm" data-fact="edit" data-id="' + f.id + '">编辑</button> ' +
        '<button class="btn btn-sm" data-fact="toggle" data-id="' + f.id + '">' + (f.enabled === false ? '启用' : '停用') + '</button> ' +
        '<button class="btn btn-sm btn-danger" data-fact="del" data-id="' + f.id + '">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="6"><div class="empty"><span class="empty-icon">▣</span>没有匹配的知识条目</div></td></tr>';
  }

  function openFaqModal(id) {
    var f = id ? Store.state().faqs.filter(function (x) { return x.id === id; })[0] : null;
    var cats = TY.FAQ_CATEGORIES.map(function (c) { return '<option ' + (f && f.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');
    var intents = Object.keys(TY.INTENTS).map(function (k) { return '<option value="' + k + '" ' + (f && f.intent === k ? 'selected' : '') + '>' + TY.INTENTS[k].label + '</option>'; }).join('');
    openModal('<h3>' + (f ? '编辑知识条目' : '新增知识条目') + '</h3>' +
      '<div class="field"><label>问题</label><input class="input" id="faqQ" value="' + esc(f ? f.question : '') + '" placeholder="用户可能怎么问"></div>' +
      '<div class="field"><label>标准答案</label><textarea class="textarea" id="faqA" placeholder="客服标准回复">' + esc(f ? f.answer : '') + '</textarea></div>' +
      '<div class="field"><label>检索关键词（英文逗号分隔）</label><input class="input" id="faqK" value="' + esc(f ? (f.keywords || []).join(',') : '') + '" placeholder="退款,退钱,申请退"></div>' +
      '<div class="settings-grid" style="gap:10px">' +
        '<div class="field" style="margin:0"><label>分类</label><select class="select" id="faqC">' + cats + '</select></div>' +
        '<div class="field" style="margin:0"><label>关联意图</label><select class="select" id="faqI">' + intents + '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="faqSave">保存</button></div>');
    el('faqSave').onclick = function () {
      var q = el('faqQ').value.trim(), a = el('faqA').value.trim();
      if (!q || !a) { U.toast('问题与答案不能为空', 'warn'); return; }
      Store.upsertFaq({
        id: f ? f.id : undefined, question: q, answer: a,
        keywords: el('faqK').value.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean),
        category: el('faqC').value, intent: el('faqI').value,
        enabled: f ? f.enabled !== false : true
      });
      closeModal(); renderFaq(); render(); U.toast('知识条目已保存', 'success');
    };
  }

  /* ---------- modal ---------- */
  function openModal(html) { el('modalBox').innerHTML = html; el('modalMask').classList.add('open'); }
  function closeModal() { el('modalMask').classList.remove('open'); }

  /* ---------- LLM ---------- */
  function loadLlm() {
    var l = Store.state().settings.llm;
    el('llmPreset').innerHTML = '<option value="">选择预设（自动填入）</option>' + TY.LLM_PRESETS.map(function (p, i) { return '<option value="' + i + '">' + p.name + '</option>'; }).join('');
    el('llmEnabled').checked = !!l.enabled;
    el('llmBaseUrl').value = l.baseUrl || '';
    el('llmModel').value = l.model || '';
    el('llmApiKey').value = l.apiKey || '';
  }
  function readLlmForm() {
    return {
      enabled: el('llmEnabled').checked,
      baseUrl: el('llmBaseUrl').value.trim(),
      model: el('llmModel').value.trim(),
      apiKey: el('llmApiKey').value.trim()
    };
  }

  /* ---------- cloud sync ---------- */
  function cloudStatusHtml() {
    var st = TY.Cloud.status();
    var last = st.lastPushAt ? '最近上传 ' + U.formatDateTime(st.lastPushAt) : '尚未上传';
    if (st.lastPullAt) last += ' · 最近拉取 ' + U.formatDateTime(st.lastPullAt);
    var color = st.ready ? 'var(--jade)' : 'var(--muted, #8d8d84)';
    return '<span style="color:' + color + '"><b>' + esc(st.text) + '</b></span>' +
      '<br><span class="muted">空间：' + esc(st.space) + ' · ' + esc(last) + '</span>';
  }
  function loadCloud() {
    var c = TY.Cloud.config();
    el('cloudEnabled').checked = !!c.enabled;
    el('cloudUrl').value = c.url || '';
    el('cloudKey').value = c.key || '';
    el('cloudSpace').value = c.space || 'tianyi-default';
    el('cloudAuto').checked = c.auto !== false;
    el('cloudSql').value = TY.Cloud.SQL;
    el('cloudStatus').innerHTML = cloudStatusHtml();
  }
  function readCloudForm() {
    var prev = TY.Cloud.config();
    var key = el('cloudKey').value.trim();
    return {
      enabled: el('cloudEnabled').checked,
      provider: 'supabase',
      url: el('cloudUrl').value.trim().replace(/\/+$/, ''),
      key: key || prev.key,
      space: el('cloudSpace').value.trim() || 'tianyi-default',
      auto: el('cloudAuto').checked
    };
  }
  function setCloudBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.textContent = busy ? '处理中…' : label;
  }

  /* ---------- knowledge insights ---------- */
  function renderInsights() {
    var gaps = Store.knowledgeGaps();
    el('gapCountTag').textContent = gaps.length + ' 个待补主题';
    el('navGapCount').textContent = gaps.length;
    el('navGapCount').classList.toggle('hidden', !gaps.length);
    el('gapList').innerHTML = gaps.length ? gaps.slice(0, 20).map(function (g) {
      return '<div class="alert-row" data-add-faq="' + esc(g.question) + '" style="cursor:pointer">' +
        '<b>' + esc(g.question) + '</b>' +
        '<span>出现 ' + g.count + ' 次 · ' + intentBadge(g.intent) + ' · ' + U.relativeTime(g.lastAt) + '</span>' +
        '<button class="btn btn-sm btn-primary">＋ 补写条目</button></div>';
    }).join('') : '<div class="empty" style="padding:22px"><span class="empty-icon">✓</span>暂无知识缺口，所有转人工会话均有知识引用</div>';

    var stale = Store.staleFaqs(90);
    el('staleCountTag').textContent = stale.length + ' 条';
    el('staleTable').innerHTML = stale.length ? stale.map(function (f) {
      return '<tr><td class="td-clip td-strong">' + esc(f.question) + '</td><td>' + f.hits + '</td>' +
        '<td>' + (f.ageDays >= 0 ? f.ageDays + ' 天前' : '—') + '</td>' +
        '<td><span class="badge gold">' + esc(f.reason) + '</span></td>' +
        '<td><button class="btn btn-sm" data-stale-edit="' + f.id + '">复核编辑</button></td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="empty" style="padding:20px"><span class="empty-icon">✓</span>知识库状态良好</div></td></tr>';
  }

  /* ---------- bot simulation ---------- */
  function simResultHtml(r) {
    if (!r) return '';
    var verdictColor = r.verdict === '可自动解答' ? 'var(--jade)' : (r.verdict === '转人工' ? 'var(--cinnabar)' : 'var(--gold)');
    var hits = r.hits.length ? r.hits.map(function (h, i) {
      return '<li>' + esc(h.question) + ' <span class="muted">（匹配度 ' + h.score + '）</span></li>';
    }).join('') : '<li class="muted">无知识库命中</li>';
    return '<div class="panel" style="background:var(--paper-2,#faf8f2)">' +
      '<div class="kv">' +
      '<span>判定结果</span><span style="color:' + verdictColor + ';font-weight:700">' + esc(r.verdict) + '</span>' +
      '<span>识别意图</span><span>' + intentBadge(r.intent) + ' ' + esc(r.intentLabel) + ' <span class="muted">（置信度 ' + r.confidence.toFixed(2) + '）</span></span>' +
      '<span>用户情绪</span><span>' + esc(r.moodLabel) + '（' + r.mood + '/5）</span>' +
      '<span>最高匹配度</span><span>' + r.bestScore + (r.confident ? ' · 命中充分' : ' · 未达阈值') + '</span>' +
      '<span>合规标记</span><span>' + (r.complianceFlags.length ? '<span class="badge red">' + esc(r.complianceFlags.join('/')) + '</span>' : '<span class="badge green">无</span>') + '</span>' +
      '<span>转人工原因</span><span>' + (r.reason ? esc(r.reason) : '—') + '</span>' +
      '</div>' +
      '<div style="font-size:12px;margin:12px 0 6px"><b>模拟回答</b><div class="notice-card" style="margin-top:6px">' + esc(r.answer) + '</div></div>' +
      '<div style="font-size:12px"><b>检索命中（' + r.hits.length + '）</b><ul style="margin:6px 0 0;padding-left:20px;line-height:1.8">' + hits + '</ul></div>' +
      '</div>';
  }
  function runSim() {
    var text = el('simInput').value.trim();
    if (!text) { U.toast('请输入测试问题', 'warn'); return; }
    var r = Engine.simulate(text);
    el('simResult').innerHTML = simResultHtml(r);
  }
  function batchSim() {
    var samples = [
      '如何查询我的订单状态？', '怎么申请退款？多久到账？', '体质报告打不开怎么办？',
      '数理天医报告是医学诊断吗？', '我要转人工', '太差了，我要投诉', '课程有效期多久？',
      '能保证治好吗？', '支付成功但没开通', '发票怎么开'
    ];
    var out = '<div class="panel"><div class="panel-head"><h3>批量测试结果</h3><span class="spacer"></span><span class="tag">' + samples.length + ' 个样例</span></div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>测试问题</th><th>意图</th><th>情绪</th><th>最高匹配</th><th>判定</th></tr></thead><tbody>';
    samples.forEach(function (s) {
      var r = Engine.simulate(s);
      out += '<tr><td class="td-clip">' + esc(s) + '</td><td>' + intentBadge(r.intent) + '</td>' +
        '<td>' + esc(r.moodLabel) + '</td><td>' + r.bestScore + '</td>' +
        '<td><span class="badge ' + (r.verdict === '可自动解答' ? 'green' : (r.verdict === '转人工' ? 'red' : 'gold')) + '">' + esc(r.verdict) + '</span></td></tr>';
    });
    out += '</tbody></table></div></div>';
    el('simResult').innerHTML = out;
  }

  /* ---------- agents & canned ---------- */
  function renderAgents() {
    var s = Store.state().settings;
    el('routingEnabled').checked = !!(s.routing && s.routing.enabled);
    var counts = Store.stats().assigneeCounts;
    el('agentTable').innerHTML = (s.agents || []).length ? s.agents.map(function (a) {
      var skills = (a.skills || []).map(function (k) { return (TY.INTENTS[k] || TY.INTENTS.other).label; }).join('、') || '通用';
      return '<tr><td class="td-strong">' + esc(a.name) + '</td><td>' + esc(skills) + '</td>' +
        '<td>' + ((counts[a.id] && counts[a.id].count) || 0) + ' 条会话</td>' +
        '<td><button class="btn btn-sm btn-danger" data-agent-del="' + a.id + '">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="empty" style="padding:18px">暂无坐席</div></td></tr>';

    el('cannedList').innerHTML = (s.canned || []).length ? s.canned.map(function (c) {
      return '<div class="alert-row"><b>' + esc(c.title) + '</b><span class="td-clip">' + esc(c.text) + '</span>' +
        '<button class="btn btn-sm btn-danger" data-canned-del="' + c.id + '">删除</button></div>';
    }).join('') : '<div class="empty" style="padding:18px">暂无快捷回复</div>';
  }

  /* ---------- audit ---------- */
  function renderAudit() {
    var logs = Store.auditLog();
    el('auditTable').innerHTML = logs.length ? logs.map(function (l) {
      return '<tr><td style="white-space:nowrap">' + U.formatDateTime(l.ts) + '</td>' +
        '<td><span class="badge">' + esc(l.action) + '</span></td><td>' + esc(l.detail) + '</td></tr>';
    }).join('') : '<tr><td colspan="3"><div class="empty" style="padding:22px"><span class="empty-icon">≡</span>暂无操作记录</div></td></tr>';
  }

  /* ---------- settings ---------- */
  function loadSettings() {
    var s = Store.state().settings;
    el('setBotName').value = s.botName || '';
    el('setWelcome').value = s.welcome || '';
    el('setLanguage').value = s.language || 'zh';
    el('setFaqThreshold').value = s.faqThreshold;
    el('setHandoffThreshold').value = s.handoffThreshold;
    el('setAutoHandoff').checked = !!s.autoHandoff;
    var sla = s.sla || {};
    el('setSlaEnabled').checked = sla.enabled !== false;
    el('setSlaFirst').value = sla.firstResponseMinutes || 5;
    el('setSlaHours').value = sla.resolutionHours || 24;
    var notice = s.notice || {};
    el('setNoticeEnabled').checked = !!notice.enabled;
    el('setNoticeText').value = notice.text || '';
    var pro = s.proactive || {};
    el('setProactiveEnabled').checked = !!pro.enabled;
    el('setProactiveSeconds').value = pro.seconds || 45;
    el('setProactiveText').value = pro.text || '';
    var st = Store.state();
    el('dataConvCount').textContent = st.conversations.length;
    el('dataFaqCount').textContent = st.faqs.length;
    el('dataHandoffCount').textContent = st.handoffs.length;
    var size = 0;
    try { size = (localStorage.getItem(TY.STORAGE_KEY) || '').length * 2; } catch (e) {}
    el('dataSize').textContent = (size / 1024).toFixed(1) + ' KB';
  }

  /* ---------- demo data ---------- */
  function generateDemo() {
    var samples = [
      ['如何查询我的订单状态？', 'order', '可在「我的 → 我的订单」查看全部订单及状态，支付成功后 5 分钟内更新。', 5],
      ['申请退款多久到账？', 'refund', '审核通过后微信/支付宝一般 1-3 个工作日原路退回。', 5],
      ['体质报告打不开', 'tech', '建议使用 Chrome/Edge 最新版并关闭广告拦截插件后刷新。', 3],
      ['数理天医报告能当诊断吗？', 'health', '不能，报告属于健康科普与生活方式参考，不构成医疗诊断。', 4],
      ['课程有效期多久？', 'product', '单门课程自开通起 12 个月内可无限次回放。', 5],
      ['登录不了收不到验证码', 'tech', '请确认手机号无误、短信未被拦截，或切换邮箱验证码登录。', 2],
      ['退款申请被驳回了', 'refund', '页面会展示驳回原因，如需复核请转人工并提供订单号。', 2],
      ['七天无理由规则', 'refund', '支付后 7 天内且课程未开始学习、报告未生成可申请全额退款。', 4],
      ['发票怎么开', 'order', '订单完成后 30 天内在「我的 → 发票管理」提交抬头与税号。', 5],
      ['想找人工客服', 'human', '已为您转接人工客服，工单已生成。', 3],
      ['会员有哪些权益', 'product', '包含会员专区课程、每月体质复测、解读直播回放与学习社群。', 4],
      ['重复扣款怎么办', 'order', '请提供两笔订单号，核实后为重复支付发起退款。', 1]
    ];
    var seed = 20261116, rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    Store.mutate(function (s) {
      samples.forEach(function (row, i) {
        var created = Date.now() - Math.floor(rnd() * 7 * 86400000) - Math.floor(rnd() * 3600000);
        var id = 'demo_conv_' + i + '_' + Date.now();
        var rating = rnd() > 0.22 ? Math.max(1, Math.min(5, row[3] + (rnd() > 0.7 ? -1 : 0))) : null;
        var needsHuman = row[1] === 'human' || rating === 1 || row[1] === 'refund' && rnd() > 0.72;
        var c = {
          id: id, title: '[演示] ' + row[0], createdAt: created, updatedAt: created + 60000,
          status: needsHuman ? (rnd() > 0.5 ? 'resolved' : 'waiting_human') : (rnd() > 0.4 ? 'resolved' : 'active'),
          intent: row[1], unresolvedTurns: 0, channel: 'demo', demo: true,
          rating: rating ? { score: rating, comment: '', ts: created + 90000 } : null,
          messages: [
            { id: id + '_u', role: 'user', content: row[0], ts: created, intent: row[1], intentSource: 'rule' },
            { id: id + '_a', role: 'assistant', content: row[2], ts: created + 12000, intent: row[1], engine: '知识库规则引擎', sources: [{ question: row[0], score: 6.2, id: 'faq_demo' }] }
          ]
        };
        s.conversations.push(c);
        if (needsHuman) {
          s.handoffs.push({
            id: 'demo_hd_' + i + '_' + Date.now(), conversationId: id,
            reason: row[1] === 'human' ? '用户主动要求人工客服' : '用户评价较低，需人工回访',
            intent: row[1], status: c.status === 'resolved' ? 'resolved' : 'pending',
            createdAt: created + 30000, resolvedAt: c.status === 'resolved' ? created + 7200000 : null, note: ''
          });
        }
      });
      s.faqs.forEach(function (f, i) { f.hits = (f.hits || 0) + Math.floor(rnd() * 9); });
    });
    U.toast('已生成 12 条演示会话', 'success');
  }

  /* ---------- render dispatch ---------- */
  function render() {
    if (page === 'overview') renderOverview();
    else if (page === 'conversations') renderConversations();
    else if (page === 'handoffs') renderHandoffs();
    else if (page === 'faq') renderFaq();
    else if (page === 'insights') renderInsights();
    else if (page === 'simulate') { /* 测试页由按钮触发，不自动运行 */ }
    else if (page === 'agents') renderAgents();
    else if (page === 'audit') renderAudit();
    else if (page === 'llm') loadLlm();
    else if (page === 'cloud') loadCloud();
    else if (page === 'settings') loadSettings();
    if (page !== 'overview') {
      var pending = Store.state().handoffs.filter(function (h) { return h.status === 'pending'; }).length;
      el('navHandoffCount').textContent = pending;
      el('navHandoffCount').classList.toggle('hidden', !pending);
      var gaps = Store.knowledgeGaps().length;
      el('navGapCount').textContent = gaps;
      el('navGapCount').classList.toggle('hidden', !gaps);
    }
  }

  /* ---------- events ---------- */
  function bind() {
    el('adminNav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]'); if (b) go(b.getAttribute('data-page'));
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]'); if (g) { go(g.getAttribute('data-goto')); return; }
      var ca = e.target.closest('[data-goto-conv]');
      if (ca) { go('conversations'); openConvDrawer(ca.getAttribute('data-goto-conv')); }
    });
    el('refreshBtn').addEventListener('click', function () { render(); U.toast('数据已刷新', 'success'); });
    el('exportBtn').addEventListener('click', function () {
      U.downloadJson('tianyi-agent-backup-' + U.formatDate(Date.now()) + '.json', Store.exportData());
      U.toast('备份已导出', 'success');
    });

    // conversations
    ['convFilter', 'convIntentFilter', 'convStatusFilter'].forEach(function (id) {
      el(id).addEventListener(id === 'convFilter' ? 'input' : 'change', renderConversations);
    });
    el('convTable').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (btn) {
        var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act');
        if (act === 'view') openConvDrawer(id);
        else if (act === 'del' && confirm('确定删除这条会话记录吗？')) { Store.deleteConversation(id); render(); U.toast('会话已删除'); }
        return;
      }
      var row = e.target.closest('tr[data-id]'); if (row) openConvDrawer(row.getAttribute('data-id'));
    });
    el('drawerClose').addEventListener('click', closeDrawer);
    el('drawerMask').addEventListener('click', closeDrawer);
    el('drawerBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-drawer-act]'); if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-drawer-act');
      if (act === 'resolve') {
        Store.updateConversation(id, { status: 'resolved', resolvedAt: Date.now() });
        closeDrawer(); render(); U.toast('已标记为已解决', 'success');
      } else if (act === 'delete' && confirm('确定删除这条会话记录吗？')) {
        Store.deleteConversation(id); closeDrawer(); render(); U.toast('会话已删除');
      } else if (act === 'addtag') {
        var input = el('tagInput');
        if (!input || !input.value.trim()) { U.toast('请输入标签', 'warn'); return; }
        Store.addTag(id, input.value);
        var conv = Store.getConversation(id); conv.summary = conv.summary; // keep reference
        openConvDrawer(id); render(); U.toast('标签已添加', 'success');
      } else if (act === 'deltag') {
        Store.removeTag(id, b.getAttribute('data-tag'));
        openConvDrawer(id); render();
      } else if (act === 'addnote') {
        var note = el('noteInput');
        if (!note || !note.value.trim()) { U.toast('请输入备注内容', 'warn'); return; }
        Store.addInternalNote(id, note.value);
        openConvDrawer(id); U.toast('内部备注已保存', 'success');
      } else if (act === 'resummarize') {
        Store.summarize(id);
        openConvDrawer(id); U.toast('会话摘要已更新', 'success');
      } else if (act === 'export') {
        var c = Store.getConversation(id);
        if (c) { U.downloadJson('tianyi-conversation-' + id + '.json', c); U.toast('本会话已导出', 'success'); }
      }
    });

    // handoffs
    el('handoffFilter').addEventListener('change', renderHandoffs);
    el('handoffTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-hact]'); if (!b) return;
      if (b.getAttribute('data-hact') === 'view') openConvDrawer(b.getAttribute('data-id'));
      else openResolveModal(b.getAttribute('data-id'));
    });

    // FAQ
    ['faqFilter', 'faqCategoryFilter'].forEach(function (id) {
      el(id).addEventListener(id === 'faqFilter' ? 'input' : 'change', renderFaq);
    });
    el('addFaqBtn').addEventListener('click', function () { openFaqModal(null); });
    el('faqTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-fact]'); if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-fact');
      if (act === 'edit') openFaqModal(id);
      else if (act === 'toggle') {
        var f = Store.state().faqs.filter(function (x) { return x.id === id; })[0];
        Store.upsertFaq({ id: id, enabled: f.enabled === false }); renderFaq();
      } else if (act === 'del' && confirm('确定删除该知识条目吗？')) { Store.deleteFaq(id); renderFaq(); render(); U.toast('条目已删除'); }
    });
    el('resetFaqBtn').addEventListener('click', function () {
      if (!confirm('恢复默认知识库会覆盖当前全部 FAQ 条目（不影响对话记录），确定继续吗？')) return;
      var faqs = Store.resetFaqs();
      U.toast('知识库已恢复默认（' + faqs.length + ' 条）', 'success');
      renderFaq();
    });

    // modal
    el('modalMask').addEventListener('click', function (e) {
      if (e.target === el('modalMask') || e.target.closest('[data-modal-close]')) closeModal();
    });

    // LLM
    el('llmPreset').addEventListener('change', function (e) {
      var p = TY.LLM_PRESETS[Number(e.target.value)];
      if (p && p.baseUrl) { el('llmBaseUrl').value = p.baseUrl; el('llmModel').value = p.model; }
    });
    el('saveLlmBtn').addEventListener('click', function () {
      Store.updateLlm(readLlmForm());
      U.toast('模型设置已保存', 'success');
      el('llmTestResult').innerHTML = '<span class="muted">当前状态：' + (Engine.llmReady() ? '<b style="color:var(--jade)">已启用</b>' : '未启用或信息不完整') + '</span>';
    });
    el('testLlmBtn').addEventListener('click', async function () {
      var form = readLlmForm();
      if (!form.baseUrl || !form.model || !form.apiKey) { U.toast('请先填写 Base URL、模型名称与 API Key', 'warn'); return; }
      var wasEnabled = Store.state().settings.llm.enabled;
      Store.updateLlm(Object.assign({}, form, { enabled: true }));
      var btn = el('testLlmBtn'); btn.disabled = true; btn.textContent = '测试中…';
      el('llmTestResult').innerHTML = '<span class="muted">正在请求模型接口…</span>';
      try {
        var out = '';
        await Engine.llmStream([
          { role: 'system', content: '你是测试助手，只回复四个字：连接正常' },
          { role: 'user', content: '请确认连接' }
        ], function (piece) { out += piece; });
        el('llmTestResult').innerHTML = '<span style="color:var(--jade)">✓ 连接成功，模型返回：' + esc(out.slice(0, 80)) + '</span>';
        U.toast('模型连接成功', 'success');
        Store.updateLlm({ enabled: true });
        el('llmEnabled').checked = true;
      } catch (err) {
        el('llmTestResult').innerHTML = '<span style="color:var(--cinnabar)">✗ 连接失败：' + esc((err && err.message || '未知错误').slice(0, 160)) + '</span>';
        Store.updateLlm({ enabled: wasEnabled });
      } finally { btn.disabled = false; btn.textContent = '测试连接'; }
    });

    // cloud sync
    el('saveCloudBtn').addEventListener('click', function () {
      Store.updateSettings({ cloud: readCloudForm() });
      TY.Cloud.stop();
      if (TY.Cloud.ready()) TY.Cloud.start();
      loadCloud();
      U.toast('云端同步配置已保存', 'success');
    });
    el('testCloudBtn').addEventListener('click', async function () {
      var form = readCloudForm();
      if (!form.url || !form.key) { U.toast('请先填写 Project URL 与 anon key', 'warn'); return; }
      var was = TY.Cloud.config();
      Store.updateSettings({ cloud: Object.assign({}, was, form, { enabled: true }) });
      var btn = el('testCloudBtn');
      setCloudBusy(btn, true, '测试连通');
      el('cloudStatus').innerHTML = '<span class="muted">正在连接云端…</span>';
      try {
        await TY.Cloud.test();
        el('cloudStatus').innerHTML = '<span style="color:var(--jade)">✓ 云端连接正常，上传与下载均成功</span>';
        U.toast('云端连接正常', 'success');
      } catch (err) {
        el('cloudStatus').innerHTML = '<span style="color:var(--cinnabar)">✗ ' + esc((err && err.message || '未知错误').slice(0, 220)) + '</span>';
        Store.updateSettings({ cloud: was });
      } finally { setCloudBusy(btn, false, '测试连通'); loadCloud(); }
    });
    el('pushCloudBtn').addEventListener('click', async function () {
      if (!TY.Cloud.ready()) { U.toast('请先启用并填写云端配置', 'warn'); return; }
      var btn = el('pushCloudBtn'); setCloudBusy(btn, true, '立即上传');
      try { await TY.Cloud.push(); loadCloud(); U.toast('已上传到云端', 'success'); }
      catch (err) { U.toast('上传失败：' + (err && err.message || '未知错误').slice(0, 90), 'error'); }
      finally { setCloudBusy(btn, false, '立即上传'); }
    });
    el('pullCloudBtn').addEventListener('click', async function () {
      if (!TY.Cloud.ready()) { U.toast('请先启用并填写云端配置', 'warn'); return; }
      var btn = el('pullCloudBtn'); setCloudBusy(btn, true, '立即下载');
      try {
        var changed = await TY.Cloud.pull();
        loadCloud(); render();
        U.toast(changed ? '已从云端下载并更新本地数据' : '云端暂无更新或已是最新', 'success');
      } catch (err) { U.toast('下载失败：' + (err && err.message || '未知错误').slice(0, 90), 'error'); }
      finally { setCloudBusy(btn, false, '立即下载'); }
    });
    el('copySqlBtn').addEventListener('click', function () {
      var ta = el('cloudSql');
      try { ta.select(); document.execCommand('copy'); U.toast('SQL 已复制', 'success'); }
      catch (e) { U.toast('复制失败，请手动选择文本', 'warn'); }
    });

    // knowledge insights
    el('gapList').addEventListener('click', function (e) {
      var row = e.target.closest('[data-add-faq]');
      if (row) { openFaqModal(null); el('faqQ').value = row.getAttribute('data-add-faq'); }
    });
    el('staleTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-stale-edit]');
      if (b) openFaqModal(b.getAttribute('data-stale-edit'));
    });

    // bot simulation
    el('simRunBtn').addEventListener('click', runSim);
    el('simInput').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSim(); }
    });
    el('simBatchBtn').addEventListener('click', batchSim);

    // agents & canned
    el('routingEnabled').addEventListener('change', function (e) {
      Store.updateSettings({ routing: { enabled: e.target.checked, strategy: 'roundrobin' } });
      U.toast(e.target.checked ? '已启用自动分配' : '已关闭自动分配', 'success');
    });
    el('addAgentBtn').addEventListener('click', function () {
      var name = el('agentName').value.trim();
      if (!name) { U.toast('请输入坐席姓名', 'warn'); return; }
      var skills = el('agentSkills').value.split(/[,，]/).map(function (x) { return x.trim(); })
        .filter(function (x) { return TY.INTENTS[x]; });
      Store.upsertAgent({ name: name, skills: skills });
      el('agentName').value = ''; el('agentSkills').value = '';
      renderAgents(); U.toast('坐席已添加', 'success');
    });
    el('agentTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-agent-del]');
      if (b && confirm('确定删除该坐席吗？其名下会话将变为未分配。')) {
        Store.deleteAgent(b.getAttribute('data-agent-del')); renderAgents(); U.toast('坐席已删除');
      }
    });
    el('addCannedBtn').addEventListener('click', function () {
      var title = el('cannedTitle').value.trim(), text = el('cannedText').value.trim();
      if (!title || !text) { U.toast('请填写标题与内容', 'warn'); return; }
      Store.upsertCanned({ title: title, text: text });
      el('cannedTitle').value = ''; el('cannedText').value = '';
      renderAgents(); U.toast('快捷回复已添加', 'success');
    });
    el('cannedList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-canned-del]');
      if (b) { Store.deleteCanned(b.getAttribute('data-canned-del')); renderAgents(); U.toast('快捷回复已删除'); }
    });

    // settings
    el('saveSettingsBtn').addEventListener('click', function () {
      Store.updateSettings({
        botName: el('setBotName').value.trim() || '天医小助手',
        welcome: el('setWelcome').value.trim(),
        language: el('setLanguage').value === 'en' ? 'en' : 'zh',
        proactive: {
          enabled: el('setProactiveEnabled').checked,
          seconds: U.clamp(Number(el('setProactiveSeconds').value) || 45, 10, 600),
          text: el('setProactiveText').value.trim().slice(0, 300)
        },
        faqThreshold: U.clamp(Number(el('setFaqThreshold').value) || 2.2, 0.5, 8),
        handoffThreshold: U.clamp(Number(el('setHandoffThreshold').value) || 2, 1, 10),
        autoHandoff: el('setAutoHandoff').checked,
        sla: {
          enabled: el('setSlaEnabled').checked,
          firstResponseMinutes: U.clamp(Number(el('setSlaFirst').value) || 5, 1, 120),
          resolutionHours: U.clamp(Number(el('setSlaHours').value) || 24, 1, 720)
        },
        notice: {
          enabled: el('setNoticeEnabled').checked,
          text: el('setNoticeText').value.trim().slice(0, 200)
        }
      });
      U.toast('客服策略已保存', 'success'); loadSettings();
    });
    el('importBtn').addEventListener('click', function () { el('importFile').click(); });
    el('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try { Store.importData(JSON.parse(reader.result)); U.toast('备份已导入', 'success'); render(); loadSettings(); }
        catch (err) { U.toast('导入失败：' + err.message, 'error'); }
      };
      reader.readAsText(file); e.target.value = '';
    });
    el('demoBtn').addEventListener('click', function () {
      if (!confirm('将追加 12 条明确标注为「演示」的会话与评价，用于查看统计效果。继续吗？')) return;
      generateDemo(); render(); loadSettings();
    });
    el('resetDataBtn').addEventListener('click', function () {
      if (!confirm('将清空全部会话、评价、工单与自定义设置，且不可撤销。建议先导出备份。确定继续吗？')) return;
      Store.reset(); U.toast('全部数据已清空', 'success'); go('overview');
    });
  }

  function init() {
    el('convIntentFilter').innerHTML = '<option value="">全部意图</option>' + Object.keys(TY.INTENTS).map(function (k) { return '<option value="' + k + '">' + TY.INTENTS[k].label + '</option>'; }).join('');
    el('faqCategoryFilter').innerHTML = '<option value="">全部分类</option>' + TY.FAQ_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('');
    bind();
    window.addEventListener('tianyi:cloud-sync', function (e) {
      if (!e.detail || e.detail.source !== 'pull') return;
      render();
      if (page === 'cloud') loadCloud();
      U.toast('已同步云端最新数据');
    });
    loadLlm(); loadSettings();
    go('overview');
  }
  init();
})();
