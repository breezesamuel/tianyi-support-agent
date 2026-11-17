/* 数理天医 · 智能客服 Agent — 管理后台 */
(function () {
  'use strict';
  var TY = window.TY;
  var U = TY.utils, Store = TY.Store, Engine = TY.Engine;
  function el(id) { return document.getElementById(id); }
  function esc(v) { return U.escapeHtml(v); }
  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
  var page = 'overview';
  var autoTimer = null;
  var PAGE_META = {
    overview: ['数据概览', '对话量、满意度、意图分布与人工工单一览'],
    conversations: ['对话记录', '查看完整多轮对话、识别意图与满意度评价'],
    handoffs: ['人工工单', '处理自动或用户主动发起的转人工请求'],
    faq: ['知识库', '维护 FAQ 条目，直接影响检索命中与回答质量'],
    insights: ['知识洞察', '知识缺口聚类与陈旧条目，持续优化自助解答率'],
    simulate: ['机器人测试', '上线前模拟真实问题，回放意图→检索→回答→转人工全链路'],
    agents: ['坐席与快捷回复', '配置人工坐席、技能分配与标准话术'],
    audit: ['审计日志', '关键操作的可追溯记录'],
    qa: ['质检评分', '按评分卡自动质检每条会话，监控真实解决率与敏感信息脱敏'],
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
    /* 实时监控：概览页 30 秒自动刷新（标签页隐藏时暂停，避免无谓计算） */
    clearInterval(autoTimer);
    autoTimer = null;
    if (name === 'overview') {
      autoTimer = setInterval(function () {
        if (!document.hidden) render();
      }, 30000);
    }
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
      ['合规预警', s.complianceFlags, '命中敏感表述的会话', s.complianceFlags ? 'warn' : ''],
      ['会话封闭率', s.totalConversations ? Math.round(s.trueMetrics.containmentRate * 100) + '%' : '—', '未转人工（可能含放弃）', ''],
      ['已验证解决率', s.totalConversations ? Math.round(s.trueMetrics.verifiedResolutionRate * 100) + '%' : '—', '4 星以上或已解决且有引用', 'accent'],
      ['质检通过率', s.qa.total ? Math.round(s.qa.passRate * 100) + '%' : '—', s.qa.total + ' 条已质检 · 均分 ' + (s.qa.total ? s.qa.avg.toFixed(1) : '—'), 'gold']
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

    // 情绪分布（1-5）
    var moodCount = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    st.conversations.forEach(function (c) { var m = c.mood || 3; moodCount[m] = (moodCount[m] || 0) + 1; });
    var maxM = Math.max(moodCount[1], moodCount[2], moodCount[3], moodCount[4], moodCount[5], 1);
    el('moodBars').innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      var sm = TY.SENTIMENTS[n];
      return bar(sm.label + (n <= 2 ? ' ⚠' : ''), moodCount[n], maxM, sm.color, moodCount[n] + ' 条');
    }).join('');

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
  var selectedConvs = {};

  function queueBadge(c) {
    if (c.vip) return '<span class="badge red">VIP</span>';
    if (c.status === 'waiting_human' && !c.assignee) {
      var qi = Store.queueInfo(c.id);
      return '<span class="badge amber">排队 ' + (qi.position || '-') + '</span>';
    }
    if (c.assignee) return '<span class="badge green">已分配</span>';
    return '<span class="muted">—</span>';
  }

  function syncBatchBar() {
    var ids = Object.keys(selectedConvs).filter(function (k) { return selectedConvs[k]; });
    var bar = el('batchBar');
    if (!bar) return;
    bar.classList.toggle('hidden', ids.length === 0);
    el('batchCount').textContent = '已选 ' + ids.length + ' 条';
  }

  function renderConversations() {
    var kw = el('convFilter').value.trim().toLowerCase();
    var ik = el('convIntentFilter').value, sk = el('convStatusFilter').value;
    var qk = el('convQueueFilter') ? el('convQueueFilter').value : '';
    var list = Store.state().conversations.slice().sort(function (a, b) {
      if (!!a.vip !== !!b.vip) return a.vip ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    }).filter(function (c) {
      if (ik && c.intent !== ik) return false;
      if (sk && c.status !== sk) return false;
      if (qk === 'vip' && !c.vip) return false;
      if (qk === 'queued' && !(c.status === 'waiting_human' && !c.assignee)) return false;
      if (qk === 'mine' && !c.assignee) return false;
      if (kw && (c.title || '').toLowerCase().indexOf(kw) < 0 &&
          !(c.messages || []).some(function (m) { return String(m.content || '').toLowerCase().indexOf(kw) >= 0; })) return false;
      return true;
    });
    el('convCount').textContent = '共 ' + list.length + ' 条会话';
    el('convTable').innerHTML = list.length ? list.map(function (c) {
      var checked = selectedConvs[c.id] ? ' checked' : '';
      return '<tr data-id="' + c.id + '">' +
        '<td><input type="checkbox" data-pick="' + c.id + '"' + checked + ' aria-label="选择会话"></td>' +
        '<td class="td-strong td-clip" title="' + esc(c.title) + '">' + (c.vip ? '<span class="badge red" style="margin-right:4px">VIP</span>' : '') + esc(c.title) + '</td>' +
        '<td>' + intentBadge(c.intent) + '</td><td>' + fmtStatus(c.status) + '</td>' +
        '<td>' + queueBadge(c) + '</td>' +
        '<td>' + slaBadge(c) + '</td>' +
        '<td>' + (c.messages || []).length + '</td>' +
        '<td>' + (c.rating ? stars(c.rating.score) : '<span class="muted">未评价</span>') + '</td>' +
        '<td>' + U.formatDateTime(c.updatedAt) + '</td>' +
        '<td><button class="btn btn-sm" data-act="view" data-id="' + c.id + '">查看</button> ' +
          '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + c.id + '">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="10"><div class="empty"><span class="empty-icon">▤</span>没有符合条件的会话</div></td></tr>';
    syncBatchBar();
    renderVisitor360();
  }

  /* 访客 360：按 visitor.id 聚合客户画像 / 分群 / 时间线 */
  function renderVisitor360() {
    var convs = Store.state().conversations;
    var map = {};
    convs.forEach(function (c) {
      var vid = (c.visitor && c.visitor.id) || 'anon';
      if (!map[vid]) map[vid] = { id: vid, convs: [], tags: {}, ratingSum: 0, rated: 0, moodSum: 0, first: Infinity, last: 0, vip: false };
      var g = map[vid];
      g.convs.push(c);
      (c.tags || []).forEach(function (t) { g.tags[t] = (g.tags[t] || 0) + 1; });
      if (c.rating) { g.ratingSum += c.rating.score; g.rated++; }
      g.moodSum += c.mood || 3;
      g.first = Math.min(g.first, c.createdAt || Infinity);
      g.last = Math.max(g.last, c.updatedAt || 0);
      if (c.vip) g.vip = true;
    });
    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.last - a.last; });
    el('visitorCount').textContent = rows.length + ' 位访客';
    el('visitor360Table').innerHTML = rows.length ? rows.map(function (g) {
      var avgRating = g.rated ? (g.ratingSum / g.rated).toFixed(1) + ' ★' : '<span class="muted">—</span>';
      var avgMood = (g.moodSum / g.convs.length).toFixed(1);
      var segment = g.vip ? '<span class="badge red">VIP</span>' :
        (g.convs.length >= 3 ? '<span class="badge amber">多次咨询</span>' :
        ((g.moodSum / g.convs.length) <= 2.5 ? '<span class="badge gray">待关怀</span>' : '<span class="badge green">普通</span>'));
      var tags = Object.keys(g.tags).map(function (t) { return '<span class="badge gray" style="margin-right:3px">' + esc(t) + '</span>'; }).join('') || '<span class="muted">—</span>';
      return '<tr><td class="td-strong">' + segment + ' ' + esc(g.id === 'anon' ? '匿名访客' : g.id.slice(0, 10)) + '</td>' +
        '<td>' + g.convs.length + '</td>' +
        '<td class="td-clip" style="max-width:200px">' + tags + '</td>' +
        '<td>' + avgRating + '</td>' +
        '<td>' + avgMood + ' / 5</td>' +
        '<td>' + (g.first === Infinity ? '—' : U.formatDate(g.first)) + '</td>' +
        '<td>' + (g.last ? U.formatDate(g.last) : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty"><span class="empty-icon">♙</span>暂无访客数据</div></td></tr>';
  }

  function agentOptions(current) {
    return (Store.state().settings.agents || []).map(function (a) {
      return '<option value="' + esc(a.id) + '"' + (a.id === current ? ' selected' : '') + '>' + esc(a.name) + '</option>';
    }).join('');
  }
  function macroButtons(convId) {
    var macros = Store.state().settings.macros || [];
    return macros.map(function (m) {
      return '<button class="btn btn-sm btn-ghost" data-drawer-act="macro" data-id="' + convId + '" data-macro="' + esc(m.id) + '" title="执行回复宏：' + esc(m.title) + '">⚡ ' + esc(m.title) + '</button>';
    }).join('') || '<span class="muted" style="font-size:11px">暂无回复宏</span>';
  }
  function templateButtons(convId) {
    var tps = Store.state().settings.templates || [];
    return tps.map(function (tp) {
      return '<button class="btn btn-sm btn-ghost" data-drawer-act="template" data-id="' + convId + '" data-tpl="' + esc(tp.id) + '" title="插入回复模板到草稿">▤ ' + esc(tp.title) + '</button>';
    }).join('') || '<span class="muted" style="font-size:11px">暂无模板</span>';
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
      '<div class="collab-box">' +
        '<div class="collab-title">⚙ 坐席协作台（第四轮）</div>' +
        '<div class="collab-row"><span>优先级 / 分配</span><div>' +
          (c.vip ? '<span class="badge red">★ VIP</span>' : '<span class="muted">普通</span>') + ' · ' +
          '<span>' + esc((Store.state().settings.agents.filter(function (a) { return a.id === c.assignee; })[0] || {}).name || '未分配') + '</span>' +
          ' <button class="btn btn-sm" data-drawer-act="toggleVip" data-id="' + c.id + '">' + (c.vip ? '取消 VIP' : '标为 VIP') + '</button></div></div>' +
        '<div class="collab-row"><span>转接坐席</span><div><select class="select" id="transferAgent">' +
          '<option value="">选择坐席…</option>' + agentOptions(c.assignee) + '</select>' +
          '<input class="input" id="transferNote" placeholder="转接备注（选填）" style="margin-top:6px">' +
          '<button class="btn btn-sm" data-drawer-act="transfer" data-id="' + c.id + '" style="margin-top:6px">转接</button></div></div>' +
        (c.transfers && c.transfers.length ? '<div class="collab-row"><span>转接记录</span><div class="muted" style="font-size:11px">' +
          esc(c.transfers.map(function (tr) {
            var an = Store.state().settings.agents.filter(function (a) { return a.id === tr.to; })[0];
            return U.formatDateTime(tr.ts) + ' → ' + (an ? an.name : tr.to);
          }).join('；')) + '</div></div>' : '') +
        '<div class="collab-row"><span>@同事</span><div><input class="input" id="mentionInput" placeholder="输入 @坐席姓名 + 说明">' +
          '<button class="btn btn-sm" data-drawer-act="mention" data-id="' + c.id + '" style="margin-top:6px">发送提醒</button></div></div>' +
        '<div class="collab-row"><span>回复草稿</span><div><textarea class="textarea" id="draftInput" placeholder="自动保存草稿，切换会话不丢失">' + esc((Store.getDraft(c.id) || {}).text || '') + '</textarea>' +
          '<button class="btn btn-sm" data-drawer-act="savedraft" data-id="' + c.id + '" style="margin-top:6px">保存草稿</button></div></div>' +
        '<div class="collab-row"><span>回复宏 / 模板</span><div style="display:flex;gap:6px;flex-wrap:wrap">' +
          macroButtons(c.id) + templateButtons(c.id) + '</div></div>' +
        '<div class="collab-row"><span>合并 / 拆分</span><div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<input class="input" id="mergeInput" placeholder="来源会话ID（逗号分隔）" style="flex:1;min-width:160px">' +
          '<button class="btn btn-sm" data-drawer-act="merge" data-id="' + c.id + '">合并</button>' +
          '<button class="btn btn-sm" data-drawer-act="split" data-id="' + c.id + '">拆分勾选消息</button></div>' +
          '<div class="muted" style="font-size:11px;margin-top:4px">拆分需在下方消息区勾选消息（见每条消息左侧复选框）</div></div>' +
        '<div class="collab-row"><span>排队位置</span><div>' + (function () { var qi = Store.queueInfo(c.id); return qi.enabled && qi.position ? ('第 ' + qi.position + ' 位 / 共 ' + qi.total + ' 人') : '<span class="muted">未在排队</span>'; })() + '</div></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-sm" data-drawer-act="resolve" data-id="' + c.id + '">标记已解决</button>' +
      '<button class="btn btn-sm" data-drawer-act="export" data-id="' + c.id + '">导出本会话</button>' +
      '<button class="btn btn-sm btn-danger" data-drawer-act="delete" data-id="' + c.id + '">删除会话</button></div></div>';
    html += '<h4 style="font-size:12px;color:var(--ink-3);letter-spacing:1px;margin:0 0 10px">完整对话</h4>';
    html += (c.messages || []).map(function (m) {
      return '<div class="drawer-msg ' + (m.role === 'user' ? 'user' : '') + '">' +
        '<div class="dm-role"><label class="split-pick" title="拆分时勾选此消息"><input type="checkbox" data-split-msg="' + esc(m.id) + '"></label><b>' + (m.role === 'user' ? '用户' : '天医小助手') + '</b><span>' + U.formatDateTime(m.ts) + '</span>' +
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
    /* 碰撞检测：登记当前坐席正在查看，若窗口内有其他坐席则提示 */
    var collision = Store.beginView(c.id, '当前坐席');
    if (collision) U.toast('注意：另一位坐席正在查看此会话（' + esc(collision.agent) + '）', 'warn');
  }
  function closeDrawer() { el('drawer').classList.remove('open'); el('drawerMask').classList.remove('open'); }

  /* ---------- handoffs ---------- */
  function renderHandoffs() {
    var f = el('handoffFilter').value;
    var list = Store.state().handoffs.filter(function (h) { return f === 'all' ? true : h.status === f; });
    el('handoffCount').textContent = '共 ' + list.length + ' 个工单';
    var statusBadge = {
      pending: '<span class="badge red">待处理</span>',
      processing: '<span class="badge amber">处理中</span>',
      resolved: '<span class="badge green">已处理</span>'
    };
    el('handoffTable').innerHTML = list.length ? list.map(function (h) {
      return '<tr><td class="td-strong">' + esc(h.id.slice(-8)) + '</td>' +
        '<td class="td-clip">' + esc(convTitle(h.conversationId)) + '</td>' +
        '<td class="td-clip" title="' + esc(h.reason) + '">' + esc(h.reason) + '</td>' +
        '<td>' + intentBadge(h.intent) + '</td>' +
        '<td>' + (statusBadge[h.status] || esc(h.status)) + '</td>' +
        '<td>' + U.formatDateTime(h.createdAt) + '</td>' +
        '<td><button class="btn btn-sm" data-hact="view" data-id="' + h.conversationId + '">查看对话</button> ' +
          (h.status === 'pending' ? '<button class="btn btn-sm btn-primary" data-hact="accept" data-id="' + h.id + '">开始处理</button>' : '') +
          (h.status === 'pending' || h.status === 'processing' ? '<button class="btn btn-sm" data-hact="resolve" data-id="' + h.id + '">标记解决</button>' : '') +
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
    renderFaqDrafts();
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
      '<div class="modal-foot"><button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="faqSave">保存</button></div>' +
      (f && Array.isArray(f.revisions) && f.revisions.length
        ? '<div style="margin-top:14px;border-top:1px solid var(--line,#eee7d8);padding-top:10px"><div style="font-size:12px"><b>版本历史（最近 ' + f.revisions.length + ' 条，可回退）</b></div>' +
          f.revisions.map(function (r) {
            return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 0;border-bottom:1px dashed var(--line,#eee7d8)">' +
              '<span class="muted" style="min-width:110px">' + U.formatDateTime(r.ts) + '</span>' +
              '<span class="td-clip" style="flex:1" title="' + esc(r.answer.slice(0, 60)) + '">' + esc(r.question.slice(0, 24)) + ' · ' + esc(r.answer.slice(0, 30)) + '…</span>' +
              '<button class="btn btn-sm" data-revert-faq="' + r.ts + '" data-id="' + f.id + '">回退</button></div>';
          }).join('') + '</div>'
        : ''));
    // 版本回退
    el('modalBox').querySelectorAll('[data-revert-faq]').forEach(function (b) {
      b.onclick = function () {
        if (Store.revertFaq(b.getAttribute('data-id'), Number(b.getAttribute('data-revert-faq')))) {
          closeModal(); renderFaq(); U.toast('已回退到历史版本', 'success');
        }
      };
    });
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
    el('llmTranslate').checked = !!l.translate;
    el('llmPromptTemplate').value = (Store.state().settings.prompt && Store.state().settings.prompt.system) || '';
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

  /* ---------- QA scorecard (第三轮) ---------- */
  function scoreBadge(v) {
    var color = v >= 2 ? 'var(--jade)' : (v === 1 ? 'var(--gold)' : 'var(--cinnabar)');
    return '<b style="color:' + color + '">' + v + '</b>';
  }
  function renderQa() {
    var s = Store.state().settings;
    var qa = s.qa || {};
    el('qaEnabled').checked = qa.enabled !== false;
    el('qaPassScore').value = qa.passScore || 3.5;
    el('qaSampleRate').value = typeof qa.sampleRate === 'number' ? qa.sampleRate : 100;
    el('qaReviewThreshold').value = typeof qa.reviewThreshold === 'number' ? qa.reviewThreshold : 2.5;
    el('privacyMode').value = (s.privacy && s.privacy.mode) || 'mask';
    el('privacyEnabled').checked = !(s.privacy && s.privacy.enabled === false);
    var dimCfg = qa.dimensions || TY.QA_DIMENSIONS.map(function (d) { return { key: d.key, weight: d.weight, critical: d.critical }; });
    el('qaDimList').innerHTML = TY.QA_DIMENSIONS.map(function (d) {
      var cfg = dimCfg.filter(function (x) { return x.key === d.key; })[0] || d;
      return '<div class="switch-row" style="padding:8px 0;border-bottom:1px solid var(--line,#eee7d8)">' +
        '<div class="sr-text"><b>' + esc(d.label) + '</b><small>' + esc(d.hint) + (d.critical ? ' · <b style="color:var(--cinnabar)">关键项</b>' : '') + '</small></div>' +
        '<input class="input" type="number" min="0" max="100" value="' + (cfg.weight || 0) + '" data-qa-weight="' + d.key + '" style="width:70px" title="权重">' +
        '</div>';
    }).join('');

    var q = Engine.qaStats();
    el('qaOverview').innerHTML = [
      ['已质检会话', q.total + ' 条'],
      ['通过评分卡', q.pass + ' 条'],
      ['质检通过率', Math.round(q.passRate * 100) + '%'],
      ['平均质检分', q.total ? q.avg.toFixed(2) + ' / 5' : '—'],
      ['合规项失败', (q.failures.compliance || 0) + ' 条'],
      ['答案有据失败', (q.failures.grounded || 0) + ' 条']
    ].map(function (r) { return '<span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span>'; }).join('');

    var tm = Engine.trueMetrics();
    function pct(v) { return Math.round(v * 100) + '%'; }
    el('trueMetrics').innerHTML = [
      ['会话封闭率', pct(tm.containmentRate) + '（无转人工）'],
      ['已验证解决率', pct(tm.verifiedResolutionRate) + '（有评价或知识引用）'],
      ['被高估部分', pct(tm.overstatement) + '（封闭率 − 已验证）'],
      ['知识库无命中率', pct(tm.fallbackRate)],
      ['7 日内重复咨询率', pct(tm.repeatContactRate)]
    ].map(function (r) { return '<span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span>'; }).join('');

    var rows = Store.state().conversations.filter(function (c) { return (c.messages || []).some(function (m) { return m.role === 'assistant'; }); })
      .slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; }).slice(0, 50);
    el('qaDetailTag').textContent = q.total + ' 条';
    el('qaTable').innerHTML = rows.length ? rows.map(function (c) {
      var sc = c.qa || Engine.scoreConversation(c.id);
      if (!sc) return '';
      var verdict = sc.pass ? '<span class="badge green">通过</span>' : '<span class="badge red">未通过</span>';
      return '<tr data-id="' + c.id + '">' +
        '<td class="td-strong td-clip">' + esc(c.title) + '</td>' +
        '<td><b>' + sc.score.toFixed(1) + '</b> / 5</td>' +
        '<td>' + scoreBadge(sc.dims.grounded) + '</td>' +
        '<td>' + scoreBadge(sc.dims.compliance) + '</td>' +
        '<td>' + scoreBadge(sc.dims.resolution) + '</td>' +
        '<td>' + scoreBadge(sc.dims.empathy) + '</td>' +
        '<td>' + verdict + (sc.failedCritical.length ? ' <span class="muted">' + sc.failedCritical.map(function (k) { return TY.QA_DIMENSIONS.filter(function (d) { return d.key === k; })[0].label; }).join('/') + '</span>' : '') + '</td>' +
        '<td><button class="btn btn-sm" data-qa-view="' + c.id + '">查看对话</button></td></tr>';
    }).join('') : '<tr><td colspan="8"><div class="empty" style="padding:22px"><span class="empty-icon">◉</span>暂无可质检的会话</div></td></tr>';

    /* 人工复核队列 */
    var rq = Store.reviewQueue();
    el('reviewQueueTable').innerHTML = rq.length ? rq.map(function (r) {
      return '<tr><td class="td-strong td-clip">' + esc(r.title || r.convId) + '</td>' +
        '<td><b>' + r.score.toFixed(1) + '</b> / 5</td>' +
        '<td>' + (r.critical.length ? esc(r.critical.map(function (k) {
          var d = TY.QA_DIMENSIONS.filter(function (x) { return x.key === k; })[0];
          return d ? d.label : k;
        }).join('、')) : '<span class="muted">综合低分</span>') + '</td>' +
        '<td><button class="btn btn-sm" data-qa-view="' + r.convId + '">查看对话</button></td></tr>';
    }).join('') : '<tr><td colspan="4"><div class="empty" style="padding:18px"><span class="empty-icon">✓</span>暂无待复核会话</div></td></tr>';

    /* 中医合规术语表预览 */
    var gl = (s.compliance && s.compliance.glossary) || [];
    el('glossaryPreview').innerHTML = gl.length
      ? gl.map(function (g) { return '<div style="font-size:12px;padding:4px 0;border-bottom:1px dashed var(--line,#eee7d8)"><b>' + esc(g.term) + '</b><span class="muted"> · ' + esc(g.note) + '</span></div>'; }).join('')
      : '<div class="muted" style="font-size:12px">暂无术语，左侧保存后显示</div>';
    el('glossaryInput').value = gl.map(function (g) { return g.term + ' | ' + g.note; }).join('\n');
  }

  /* ---------- skill lab（GitHub Skill 方法论落地） ---------- */
  function renderSkillLab() {
    var E = TY.Engine;
    // 偏见缓解清单
    var bias = E.judgeBiasChecklist();
    el('judgeBiasList').innerHTML = bias.map(function (b) {
      return '<div style="padding:6px 0;border-bottom:1px solid var(--line);font-size:12px">' +
        '<b>' + esc(b.bias) + '</b> <span class="muted">(' + esc(b.en) + ')</span> ' +
        (b.mitigated ? '<span class="badge green">已缓解</span>' : '<span class="badge red">待处理</span>') +
        '<div class="muted" style="margin-top:3px">' + esc(b.action) + '</div></div>';
    }).join('');
    // 多语言覆盖
    var cov = E.i18nCoverage();
    var missText = cov.complete ? '<span class="badge green">全部齐全</span>' :
      Object.keys(cov.missing).map(function (k) { return k + ': ' + cov.missing[k].length + ' 键'; }).join('；');
    el('i18nCoverage').innerHTML = '<span>界面语言</span><span>' + cov.languages.join(' / ') + '</span>' +
      '<span>基准键数</span><span>' + cov.baseKeys + '</span>' +
      '<span>缺失键</span><span>' + esc(missText) + '</span>';
    // WCAG 自查
    var a11y = E.a11yChecklist();
    var rows = a11y.automated.concat(a11y.manualRequired).map(function (a) {
      return '<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;font-size:12px">' +
        '<span>' + (a.passed ? '✓' : '○') + '</span><span><b>' + esc(a.item) + '</b>' +
        '<span class="muted"> · ' + esc(a.note) + '</span></span></div>';
    }).join('');
    el('a11yChecklist').innerHTML = rows + '<div class="muted" style="font-size:11px;margin-top:6px">' + esc(a11y.disclaimer) + '</div>';
    // judge 配置
    var j = Store.state().settings.judge || {};
    el('judgeMinScore').value = typeof j.minScore === 'number' ? j.minScore : 7;
    el('judgeModel').value = j.model || '';
    // 用量与成本
    renderUsage();
  }

  function renderUsage() {
    var u = TY.Engine.usageSummary();
    var fmt = function (n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n; };
    var cost = function (c) { return '¥' + (c >= 0.01 ? c.toFixed(2) : c.toFixed(4)); };
    var est = u.today.estimatedCalls ? ' <span class="badge amber">含 ' + u.today.estimatedCalls + ' 次估算</span>' : '';
    var budgetLine = u.budget > 0
      ? '<span>单日预算</span><span>' + cost(u.today.cost) + ' / ¥' + u.budget + '（' + Math.round(u.budgetUsed * 100) + '%）' + (u.overBudget ? ' <span class="badge red">已超限</span>' : '') + '</span>'
      : '<span>单日预算</span><span class="muted">未设置（不限额）</span>';
    el('usagePanel').innerHTML =
      '<span>今日调用</span><span>' + u.today.calls + ' 次' + est + '</span>' +
      '<span>今日 tokens</span><span>入 ' + fmt(u.today.promptTokens) + ' / 出 ' + fmt(u.today.completionTokens) + '</span>' +
      '<span>今日成本</span><span>' + cost(u.today.cost) + '</span>' +
      '<span>近 30 天累计</span><span>' + u.week.calls + ' 次 · ' + cost(u.week.cost) + '</span>' +
      budgetLine;
    var s = Store.state().settings.llm || {};
    el('setDailyBudget').value = s.dailyBudget || 0;
    el('setPriceIn').value = typeof s.priceIn === 'number' ? s.priceIn : 2;
    el('setPriceOut').value = typeof s.priceOut === 'number' ? s.priceOut : 8;
  }

  function runLlmReg() {
    var E = TY.Engine;
    if (!E.llmReady()) { U.toast('请先在「模型接入」启用并配置大模型 API Key', 'warn'); return; }
    var cases = parseRegCases(el('regCases').value);
    if (!cases.length) { U.toast('请先填写测试用例', 'warn'); return; }
    // 保存 judge 配置
    Store.updateSettings({ judge: Object.assign({}, Store.state().settings.judge, {
      minScore: Number(el('judgeMinScore').value) || 7,
      model: el('judgeModel').value.trim()
    }) });
    var btn = el('runLlmRegBtn');
    btn.disabled = true; btn.textContent = '评测中…';
    el('llmRegProgress').textContent = '准备评测（共 ' + cases.length + ' 条用例，每条需生成回答 + 评审两次调用）…';
    var t0 = Date.now();
    E.runLlmRegression(cases, function (done, total, r) {
      var score = r.judge ? '，评分 ' + r.judge.score : '';
      el('llmRegProgress').textContent = '进度 ' + done + '/' + total + '：' + (r.input || '').slice(0, 16) + '… → ' + r.verdict + score;
    }).then(function (rep) {
      btn.disabled = false; btn.textContent = '运行 LLM 真实评测';
      if (!rep) return;
      var badge = rep.decision === 'pass' ? 'green' : (rep.decision === 'fail' ? 'red' : 'amber');
      var ci = rep.confidence;
      var html = '<div class="notice-card" style="border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.7">' +
        '<b>结论：</b><span class="badge ' + badge + '">' + esc(rep.decision) + '</span> · ' +
        '通过 ' + rep.passed + '/' + rep.total + ' · 评审模型 <b>' + esc(rep.judgeModel) + '</b> · 评分卡 ' + esc(rep.rubricVersion) +
        (rep.selfJudgedAny ? ' <span class="badge amber">含自评（生成与评审同模型，存在自增强偏见风险）</span>' : ' <span class="badge green">生成/评审模型分离</span>') + '<br>' +
        (ci ? '<b>Wilson 95% 置信区间：</b>[' + (ci.low * 100).toFixed(1) + '%, ' + (ci.high * 100).toFixed(1) + '%]' : '') +
        ' · 耗时 ' + Math.round((Date.now() - t0) / 1000) + 's</div>';
      html += '<div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th>用例</th><th>结论</th><th>评分</th><th>回答摘要 / 问题</th></tr></thead><tbody>' +
        rep.results.map(function (x) {
          if (x.verdict === 'error') return '<tr><td class="td-strong">' + esc(x.input) + '</td><td><span class="badge gray">调用失败</span></td><td>—</td><td class="muted">' + esc(x.error) + '</td></tr>';
          var vBadge = x.verdict === 'pass' ? '<span class="badge green">通过</span>' :
            (x.verdict === 'critical-fail' ? '<span class="badge red">关键失败</span>' : '<span class="badge amber">未达标</span>');
          var jd = x.judge || {};
          var dims = jd.dimensions ? ['准' + jd.dimensions.accuracy, '安' + jd.dimensions.safety, '助' + jd.dimensions.helpfulness, '达' + jd.dimensions.tone].join(' ') : '';
          var detail = esc((x.answer || '').slice(0, 60)) + (jd.issues && jd.issues.length ? '<br><span class="muted">问题：' + esc(jd.issues.join('；')) + '</span>' : '');
          return '<tr><td class="td-strong">' + esc(x.input) + '</td><td>' + vBadge + '</td><td>' + (jd.score != null ? '<b>' + jd.score + '</b><div class="muted" style="font-size:11px">' + dims + '</div>' : '—') + '</td><td style="max-width:280px">' + detail + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      el('llmRegResult').innerHTML = html;
      renderUsage();
      U.toast('LLM 真实评测完成：' + rep.decision, rep.decision === 'pass' ? 'success' : 'warn');
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = '运行 LLM 真实评测';
      el('llmRegProgress').textContent = '';
      U.toast('评测失败：' + String(e && e.message || e).slice(0, 80), 'error');
    });
  }

  /* ---------- 知识缺口草稿审核 ---------- */
  function renderFaqDrafts() {
    var pending = Store.faqDrafts('pending');
    el('faqDraftCount').textContent = pending.length + ' 条待审核';
    el('faqDraftTable').innerHTML = pending.length ? pending.map(function (d) {
      return '<tr data-draft="' + d.id + '"><td class="td-strong td-clip" title="' + esc(d.question) + '">' + esc(d.question) + '</td>' +
        '<td>' + d.count + '</td><td>' + esc(TY.intentLabel(d.intent)) + '</td><td><span class="badge amber">待审核</span></td>' +
        '<td style="white-space:nowrap"><button class="btn btn-sm" data-dact="promote" data-id="' + d.id + '">审核入库</button> ' +
        '<button class="btn btn-sm btn-danger" data-dact="dismiss" data-id="' + d.id + '">忽略</button></td></tr>';
    }).join('') : '<tr><td colspan="5"><div class="empty"><span class="empty-icon">◇</span>暂无待审核草稿，可点击上方按钮从知识缺口生成</div></td></tr>';
  }

  function openDraftPromoteModal(id) {
    var d = Store.faqDrafts().filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    var cats = TY.FAQ_CATEGORIES.map(function (c) { return '<option ' + (d.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('');
    var intents = Object.keys(TY.INTENTS).map(function (k) { return '<option value="' + k + '" ' + (d.intent === k ? 'selected' : '') + '>' + TY.INTENTS[k].label + '</option>'; }).join('');
    openModal('<h3>审核知识缺口草稿</h3>' +
      '<div class="muted" style="font-size:12px;margin-bottom:10px">该提问出现 ' + d.count + ' 次且知识库未命中。补写标准答案后入库，同类提问将可直接自动解答。</div>' +
      '<div class="field"><label>问题</label><input class="input" id="draftQ" value="' + esc(d.question) + '"></div>' +
      '<div class="field"><label>标准答案</label><textarea class="textarea" id="draftA" placeholder="补写客服标准回复"></textarea></div>' +
      '<div class="settings-grid" style="gap:10px">' +
        '<div class="field" style="margin:0"><label>分类</label><select class="select" id="draftC">' + cats + '</select></div>' +
        '<div class="field" style="margin:0"><label>关联意图</label><select class="select" id="draftI">' + intents + '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-modal-close>取消</button><button class="btn btn-primary" id="draftSave">入库</button></div>');
    el('draftSave').onclick = function () {
      var f = Store.promoteFaqDraft(d.id, {
        question: el('draftQ').value.trim(),
        answer: el('draftA').value.trim(),
        category: el('draftC').value
      });
      if (!f) { U.toast('答案不能为空', 'warn'); return; }
      closeModal(); renderFaq(); renderFaqDrafts(); U.toast('已入库知识库，来源：缺口草稿', 'success');
    };
  }

  function parseRegCases(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      var p = line.split('|').map(function (x) { return x.trim(); });
      if (!p[0]) return null;
      var tc = { id: p[0].slice(0, 12), input: p[0] };
      if (p[1] && p[1] !== '-') tc.expectIntent = p[1];
      if (p[2] && p[2] !== '-') tc.expectHandoff = p[2] === 'true';
      if (p[3] && p[3] !== '-') tc.expectNoCompliance = p[3] === 'true';
      return tc;
    }).filter(Boolean);
  }
  function runReg() {
    var cases = parseRegCases(el('regCases').value);
    var r = TY.Engine.runRegressionSuite(cases);
    if (!r) { U.toast('请先填写测试用例', 'warn'); return; }
    var badge = r.decision === 'pass' ? 'green' : (r.decision === 'fail' ? 'red' : 'amber');
    var ci = r.confidence;
    var html = '<div class="notice-card" style="border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.7">' +
      '<b>结论：</b><span class="badge ' + badge + '">' + esc(r.decision) + '</span> · ' +
      '通过 ' + r.passed + '/' + r.total + '（' + Math.round(r.passRate * 100) + '%） · ' +
      '关键安全失败 <b>' + r.criticalFailures + '</b><br>' +
      '<b>Wilson 95% 置信区间：</b>' + (ci ? '[' + (ci.low * 100).toFixed(1) + '%, ' + (ci.high * 100).toFixed(1) + '%]' : '—') +
      ' <span class="muted">（即使 ' + ci.passes + '/' + ci.trials + ' 全过，也不能断言 100% 可靠）</span></div>';
    html += '<div class="table-wrap" style="margin-top:10px"><table class="data"><thead><tr><th>用例</th><th>结论</th><th>校验项</th><th>实际</th></tr></thead><tbody>' +
      r.results.map(function (x) {
        var vBadge = x.verdict === 'pass' ? '<span class="badge green">通过</span>' :
          (x.verdict === 'critical-fail' ? '<span class="badge red">关键失败</span>' : '<span class="badge amber">失败</span>');
        var checks = Object.keys(x.checks).map(function (k) { return k + ':' + (x.checks[k] ? '✓' : '✗'); }).join(' ') || '—';
        var actual = '意图=' + esc(x.actual.intent) + '，转人工=' + x.actual.handoff + '，合规=' + (x.actual.compliance.length || 0);
        return '<tr><td class="td-strong">' + esc(x.input) + '</td><td>' + vBadge + '</td><td>' + esc(checks) + '</td><td>' + actual + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    el('regResult').innerHTML = html;
    U.toast('回归评测完成：' + r.decision, r.decision === 'pass' ? 'success' : 'warn');
  }

  /* ---------- settings ---------- */
  /* 关键词规则 <-> 文本（每行：关键词1|关键词2 => 回复） */
  function keywordRulesToText(rules) {
    return (rules || []).map(function (r) {
      return (r.keys || []).join('|') + ' => ' + (r.answer || '');
    }).join('\n');
  }
  function textToKeywordRules(text) {
    var out = [];
    String(text || '').split(/\r?\n/).forEach(function (line, i) {
      var arrow = line.indexOf('=>');
      if (arrow < 0) return;
      var keys = line.slice(0, arrow).split(/[|｜,，]/).map(function (k) { return k.trim(); }).filter(Boolean);
      var answer = line.slice(arrow + 2).trim();
      if (keys.length && answer) out.push({ id: 'ar' + i + '_' + Date.now().toString(36), keys: keys, answer: answer, enabled: true });
    });
    return out;
  }

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
    var disc = s.disclosure || {};
    el('setDisclosureEnabled').checked = disc.enabled !== false;
    el('setDisclosureText').value = disc.text || '';
    el('setVoiceEnabled').checked = !(s.voice && s.voice.enabled === false);
    if (el('setSpeakEnabled')) el('setSpeakEnabled').checked = !!(s.voice && s.voice.speak);
    if (el('setAutoInvite')) el('setAutoInvite').checked = (s.satisfaction && s.satisfaction.autoInvite) !== false;
    var ab = s.abTest || {};
    if (el('setAbEnabled')) {
      el('setAbEnabled').checked = !!ab.enabled;
      var vs = ab.variants || [];
      el('setAbA').value = (vs[0] && vs[0].text) || '';
      el('setAbB').value = (vs[1] && vs[1].text) || '';
    }
    var inbox = s.inbox || {};
    if (el('setQueueEnabled')) el('setQueueEnabled').checked = inbox.queueEnabled !== false;
    if (el('setServiceHours')) el('setServiceHours').value = inbox.serviceHours || '09:00-21:00';
    var ar = s.autoReply || {};
    if (el('setAutoReplyEnabled')) el('setAutoReplyEnabled').checked = !!ar.enabled;
    if (el('setOfflineEnabled')) el('setOfflineEnabled').checked = ar.offlineEnabled !== false;
    if (el('setOfflineText')) el('setOfflineText').value = ar.offlineText || '';
    if (el('setKeywordRules')) el('setKeywordRules').value = keywordRulesToText(ar.keywords);
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
    else if (page === 'qa') renderQa();
    else if (page === 'skilllab') renderSkillLab();
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
      var qaFail = Engine.qaStats().total - Engine.qaStats().pass;
      el('navQaCount').textContent = qaFail;
      el('navQaCount').classList.toggle('hidden', !qaFail);
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
    /* CSV 导出：会话 + 工单两张表（同一文件分节），便于 Excel 分析 */
    el('exportCsvBtn').addEventListener('click', function () {
      function csvCell(v) {
        var s = String(v == null ? '' : v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
        return /[",]/.test(s) ? '"' + s + '"' : s;
      }
      var st = Store.state();
      var lines = [];
      lines.push('== 会话 ==');
      lines.push('会话ID,标题,意图,状态,消息数,满意度,NPS,情绪,VIP,标签,创建时间,更新时间');
      st.conversations.forEach(function (c) {
        lines.push([
          c.id, c.title, c.intent, c.status, (c.messages || []).length,
          c.rating ? c.rating.score : '', c.nps || '', c.mood || 3, c.vip ? '是' : '否',
          (c.tags || []).join(' '), new Date(c.createdAt).toISOString(), new Date(c.updatedAt).toISOString()
        ].map(csvCell).join(','));
      });
      lines.push('');
      lines.push('== 工单 ==');
      lines.push('工单ID,关联会话,原因,意图,状态,创建时间,解决时间,备注');
      st.handoffs.forEach(function (h) {
        lines.push([h.id, h.conversationId, h.reason, h.intent, h.status,
          new Date(h.createdAt).toISOString(), h.resolvedAt ? new Date(h.resolvedAt).toISOString() : '', h.note || ''].map(csvCell).join(','));
      });
      /* 加 BOM 保证 Excel 识别 UTF-8 中文 */
      var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tianyi-agent-export-' + U.formatDate(Date.now()) + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      U.toast('CSV 已导出（会话 ' + st.conversations.length + ' 条 / 工单 ' + st.handoffs.length + ' 个）', 'success');
    });

    // conversations
    ['convFilter', 'convIntentFilter', 'convStatusFilter', 'convQueueFilter'].forEach(function (id) {
      if (!el(id)) return;
      el(id).addEventListener(id === 'convFilter' ? 'input' : 'change', renderConversations);
    });
    el('convCheckAll').addEventListener('change', function (e) {
      var checked = e.target.checked;
      Array.prototype.slice.call(document.querySelectorAll('[data-pick]')).forEach(function (cb) {
        cb.checked = checked; selectedConvs[cb.getAttribute('data-pick')] = checked;
      });
      syncBatchBar();
    });
    el('convTable').addEventListener('change', function (e) {
      var cb = e.target.closest('[data-pick]');
      if (cb) { selectedConvs[cb.getAttribute('data-pick')] = cb.checked; syncBatchBar(); }
    });
    el('convTable').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (btn) {
        var id = btn.getAttribute('data-id'), act = btn.getAttribute('data-act');
        if (act === 'view') openConvDrawer(id);
        else if (act === 'del' && confirm('确定删除这条会话记录吗？')) { Store.deleteConversation(id); render(); U.toast('会话已删除'); }
        return;
      }
      if (e.target.closest('[data-pick]')) return;
      var row = e.target.closest('tr[data-id]'); if (row) openConvDrawer(row.getAttribute('data-id'));
    });
    if (el('batchBar')) {
      el('batchBar').addEventListener('click', function (e) {
        var b = e.target.closest('[data-batch]'); if (!b) return;
        var act = b.getAttribute('data-batch');
        var ids = Object.keys(selectedConvs).filter(function (k) { return selectedConvs[k]; });
        if (act === 'clear') { selectedConvs = {}; renderConversations(); return; }
        if (!ids.length) { U.toast('请先勾选会话', 'warn'); return; }
        if (act === 'assign') {
          var a = el('batchAgent').value;
          if (!a) { U.toast('请选择坐席', 'warn'); return; }
          Store.batchOperation(ids, 'assign', a);
        } else if (act === 'vip') Store.batchOperation(ids, 'vip', true);
        else if (act === 'resolve') Store.batchOperation(ids, 'resolve', true);
        else if (act === 'tag') {
          var tg = prompt('输入要添加的标签（最多12字）：', '待跟进');
          if (!tg) return;
          Store.batchOperation(ids, 'tag', tg);
        } else if (act === 'delete') {
          if (!confirm('确定删除选中的 ' + ids.length + ' 条会话吗？')) return;
          Store.batchOperation(ids, 'delete', true);
        }
        selectedConvs = {}; render(); U.toast('批量操作已完成', 'success');
      });
    }
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
      } else if (act === 'toggleVip') {
        var cv = Store.getConversation(id);
        Store.setVip(id, !cv.vip); openConvDrawer(id); render();
        U.toast(cv.vip ? '已取消 VIP' : '已标记为 VIP', 'success');
      } else if (act === 'transfer') {
        var to = el('transferAgent') ? el('transferAgent').value : '';
        if (!to) { U.toast('请选择转接坐席', 'warn'); return; }
        Store.transferConversation(id, to, el('transferNote') ? el('transferNote').value : '');
        openConvDrawer(id); render(); U.toast('会话已转接', 'success');
      } else if (act === 'mention') {
        var mi = el('mentionInput');
        if (!mi || !mi.value.trim()) { U.toast('请输入 @坐席 与说明', 'warn'); return; }
        var created = Store.mentionAgent(id, mi.value);
        if (!created.length) { U.toast('未识别到 @坐席，请用 @坐席姓名', 'warn'); return; }
        Store.addInternalNote(id, mi.value);
        openConvDrawer(id); U.toast('已提醒 ' + created.map(function (x) { return x.toName; }).join('/'), 'success');
      } else if (act === 'savedraft') {
        var di = el('draftInput');
        Store.saveDraft(id, di ? di.value : ''); U.toast('草稿已自动保存', 'success');
      } else if (act === 'macro') {
        var r = Store.runMacro(id, b.getAttribute('data-macro'));
        if (r) { openConvDrawer(id); render(); U.toast('已执行宏：' + r.title + '（' + r.applied.length + ' 步）', 'success'); }
      } else if (act === 'template') {
        var txt = Store.renderTemplate(b.getAttribute('data-tpl'), id);
        var tdi = el('draftInput');
        if (tdi) { tdi.value = (tdi.value ? tdi.value + '\n' : '') + txt; Store.saveDraft(id, tdi.value); U.toast('模板已插入草稿', 'success'); }
      } else if (act === 'merge') {
        var mi2 = el('mergeInput');
        if (!mi2 || !mi2.value.trim()) { U.toast('请输入来源会话 ID', 'warn'); return; }
        var src = mi2.value.split(/[,，\s]+/).filter(Boolean);
        var mr = Store.mergeConversations(id, src);
        if (mr) { closeDrawer(); render(); U.toast('已合并 ' + mr.merged.messages + ' 条消息', 'success'); }
        else U.toast('合并失败：会话不存在', 'warn');
      } else if (act === 'split') {
        var picks = Array.prototype.slice.call(document.querySelectorAll('[data-split-msg]:checked')).map(function (x) { return x.getAttribute('data-split-msg'); });
        if (!picks.length) { U.toast('请先勾选要拆分的消息', 'warn'); return; }
        var sp = Store.splitConversation(id, picks);
        if (sp) { closeDrawer(); render(); U.toast('已拆出新会话（' + sp.messages.length + ' 条消息）', 'success'); }
      }
    });

    // handoffs
    el('handoffFilter').addEventListener('change', renderHandoffs);
    el('autoRouteBtn').addEventListener('click', function () {
      var n = Store.autoRouteUnassigned();
      render();
      U.toast(n ? '已自动分配 ' + n + ' 条等待会话' : '没有待分配的会话（或坐席未配置技能）', n ? 'success' : 'info');
    });
    el('handoffTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-hact]'); if (!b) return;
      var act = b.getAttribute('data-hact'), id = b.getAttribute('data-id');
      if (act === 'view') openConvDrawer(id);
      else if (act === 'accept') { Store.setHandoffStatus(id, 'processing'); renderHandoffs(); U.toast('工单已开始处理', 'success'); }
      else openResolveModal(id);
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
      Store.updateSettings({
        llm: Object.assign({}, Store.state().settings.llm, { translate: el('llmTranslate').checked }),
        prompt: { system: el('llmPromptTemplate').value }
      });
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
    el('multiTurnBtn').addEventListener('click', function () {
      var scripts = String(el('multiTurnInput').value || '').split(/\r?\n/).map(function (line) {
        var p = line.split('|').map(function (x) { return x.trim(); });
        if (!p[0]) return null;
        var sc = { id: p[0], turns: (p[1] || '').split(';;').map(function (x) { return x.trim(); }).filter(Boolean) };
        if (p[2] && p[2] !== '-') sc.expectIntent = p[2];
        if (p[3] && p[3] !== '-') sc.expectFinalHandoff = p[3] === 'true';
        return sc;
      }).filter(function (x) { return x && x.turns.length; });
      var rep = Engine.runMultiTurnTest(scripts);
      if (!rep) { U.toast('请先填写多轮脚本', 'warn'); return; }
      var badge = rep.decision === 'pass' ? '<span class="badge green">全部通过</span>' : '<span class="badge amber">' + (rep.total - rep.passed) + ' 条未通过</span>';
      var ciText = rep.confidence ? '[' + (rep.confidence.low * 100).toFixed(0) + '%, ' + (rep.confidence.high * 100).toFixed(0) + '%]' : '—';
      var html = '<div style="margin-bottom:8px">' + badge + ' · 通过 ' + rep.passed + '/' + rep.total + '（Wilson 95% CI：' + ciText + '）</div>';
      html += '<div class="table-wrap"><table class="data"><thead><tr><th>脚本</th><th>轮次链路</th><th>校验</th><th>结论</th></tr></thead><tbody>' +
        rep.results.map(function (r) {
          var chain = r.turns.map(function (t) { return t.turn + '. ' + esc(t.input) + ' → ' + t.intent + (t.handoff ? ' (转人工)' : ''); }).join('<br>');
          var checks = Object.keys(r.checks).map(function (k) { return k + ':' + (r.checks[k] ? '✓' : '✗'); }).join(' ') || '—';
          return '<tr><td class="td-strong">' + esc(r.id) + '</td><td>' + chain + '</td><td>' + esc(checks) + '</td><td>' +
            (r.verdict === 'pass' ? '<span class="badge green">通过</span>' : '<span class="badge amber">未过</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      el('multiTurnResult').innerHTML = html;
    });
    el('simInput').addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSim(); }
    });
    el('simBatchBtn').addEventListener('click', batchSim);

    // QA scorecard
    el('saveQaBtn').addEventListener('click', function () {
      var dims = TY.QA_DIMENSIONS.map(function (d) {
        var input = document.querySelector('[data-qa-weight="' + d.key + '"]');
        return { key: d.key, weight: input ? clampNum(input.value, 0, 100, d.weight) : d.weight, critical: d.critical };
      });
      Store.updateSettings({
        qa: { enabled: el('qaEnabled').checked, passScore: clampNum(el('qaPassScore').value, 1, 5, 3.5), sampleRate: clampNum(el('qaSampleRate').value, 0, 100, 100), reviewThreshold: clampNum(el('qaReviewThreshold').value, 1, 5, 2.5), dimensions: dims },
        privacy: { enabled: el('privacyEnabled').checked, mode: el('privacyMode').value || 'mask',
          rules: (Store.state().settings.privacy && Store.state().settings.privacy.rules) || ['phone', 'idcard', 'bankcard', 'email', 'order'],
          logRedactions: true }
      });
      U.toast('评分卡与脱敏策略已保存', 'success'); renderQa();
    });
    el('qaTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-qa-view]');
      if (b) { go('conversations'); openConvDrawer(b.getAttribute('data-qa-view')); }
    });
    el('saveGlossaryBtn').addEventListener('click', function () {
      var gl = String(el('glossaryInput').value || '').split(/\r?\n/).map(function (line) {
        var p = line.split('|');
        if (!p[0] || !p[0].trim()) return null;
        return { term: p[0].trim(), note: (p[1] || '').trim() };
      }).filter(Boolean);
      Store.updateSettings({ compliance: Object.assign({}, Store.state().settings.compliance, { glossary: gl }) });
      renderQa();
      U.toast('术语表已保存（' + gl.length + ' 条）', 'success');
    });

    // skill lab
    el('runRegBtn').addEventListener('click', runReg);
    el('runLlmRegBtn').addEventListener('click', runLlmReg);
    el('saveUsageBtn').addEventListener('click', function () {
      Store.updateSettings({ llm: Object.assign({}, Store.state().settings.llm, {
        dailyBudget: Math.max(0, Number(el('setDailyBudget').value) || 0),
        priceIn: Math.max(0, Number(el('setPriceIn').value) || 0),
        priceOut: Math.max(0, Number(el('setPriceOut').value) || 0)
      }) });
      renderUsage();
      U.toast('预算与单价已保存', 'success');
    });
    el('genFaqDraftBtn').addEventListener('click', function () {
      var added = Store.createFaqDrafts();
      renderFaqDrafts();
      U.toast(added.length ? '已从知识缺口生成 ' + added.length + ' 条草稿' : '没有新的缺口（或均与现有知识重复）', added.length ? 'success' : 'info');
    });
    el('faqDraftTable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-dact]');
      if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-dact');
      if (act === 'promote') openDraftPromoteModal(id);
      else if (act === 'dismiss' && confirm('忽略这条缺口草稿？之后同类提问不会再自动生成。')) {
        Store.dismissFaqDraft(id); renderFaqDrafts(); U.toast('草稿已忽略');
      }
    });

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
    if (el('abReportBtn')) el('abReportBtn').addEventListener('click', function () {
      var rep = Engine.abReport();
      var rows = rep.variants.map(function (v) {
        return '<tr><td class="td-strong">' + esc(v.id) + '</td><td>' + v.convs + '</td>' +
          '<td>' + (v.avgRating != null ? v.avgRating + ' ★' : '<span class="muted">—</span>') + '</td>' +
          '<td>' + Math.round(v.resolveRate * 100) + '%</td>' +
          '<td>' + Math.round(v.handoffRate * 100) + '%</td></tr>';
      }).join('');
      el('abReportResult').innerHTML = '<div class="table-wrap"><table class="data"><thead><tr><th>变体</th><th>会话数</th><th>平均满意度</th><th>解决率</th><th>转人工率</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '<div class="hint" style="margin-top:6px">' + (rep.enoughSample ? '样本量充足，可参考对比结果。' : '⚠ 任一变体样本不足 30 条，差异可能只是随机波动，请勿据此下结论。') + '</div>';
    });
    el('saveSettingsBtn').addEventListener('click', function () {
      Store.updateSettings({
        botName: el('setBotName').value.trim() || '天医小助手',
        welcome: el('setWelcome').value.trim(),        language: el('setLanguage').value === 'en' ? 'en' : 'zh',
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
        },
        disclosure: {
          enabled: el('setDisclosureEnabled').checked,
          text: el('setDisclosureText').value.trim().slice(0, 300)
        },
        voice: {
          enabled: el('setVoiceEnabled').checked,
          lang: (Store.state().settings.voice && Store.state().settings.voice.lang) || 'zh-CN',
          speak: el('setSpeakEnabled') ? el('setSpeakEnabled').checked : false
        },
        satisfaction: {
          autoInvite: el('setAutoInvite') ? el('setAutoInvite').checked : true
        },
        abTest: {
          enabled: el('setAbEnabled') ? el('setAbEnabled').checked : false,
          variants: [
            { id: 'A', text: el('setAbA') ? el('setAbA').value.trim() : '', weight: 1 },
            { id: 'B', text: el('setAbB') ? el('setAbB').value.trim() : '', weight: 1 }
          ]
        },
        inbox: {
          queueEnabled: el('setQueueEnabled') ? el('setQueueEnabled').checked : true,
          serviceHours: (el('setServiceHours') && el('setServiceHours').value.trim()) || '09:00-21:00',
          vipPriority: (Store.state().settings.inbox && Store.state().settings.inbox.vipPriority) || 100,
          collisionWindowSec: (Store.state().settings.inbox && Store.state().settings.inbox.collisionWindowSec) || 60
        }
      });
      var arPatch = {
        enabled: el('setAutoReplyEnabled') ? el('setAutoReplyEnabled').checked : false,
        offlineEnabled: el('setOfflineEnabled') ? el('setOfflineEnabled').checked : true,
        offlineText: (el('setOfflineText') && el('setOfflineText').value.trim().slice(0, 300)) || ''
      };
      var kwText = el('setKeywordRules') ? el('setKeywordRules').value.trim() : '';
      if (kwText) arPatch.keywords = textToKeywordRules(kwText); // 留空则保留现有规则
      Store.updateSettings({ autoReply: Object.assign({}, (Store.state().settings.autoReply || {}), arPatch) });
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
