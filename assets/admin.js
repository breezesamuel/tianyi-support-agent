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
    llm: ['模型接入', '配置可选的大模型接口，启用语义意图识别与生成式回答'],
    settings: ['系统设置', '客服策略与本地数据管理']
  };

  function fmtStatus(s) {
    return { active: '<span class="badge green">进行中</span>', waiting_human: '<span class="badge red">等待人工</span>', resolved: '<span class="badge gray">已解决</span>' }[s] || '<span class="badge gray">—</span>';
  }
  function intentBadge(key) {
    var i = TY.INTENTS[key] || TY.INTENTS.other;
    return '<span class="badge" style="background:' + i.color + '1a;color:' + i.color + '">' + i.label + '</span>';
  }
  function stars(n) { return '<span class="stars-small">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'; }
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
      ['知识库条目', s.totalFaqs, '共 ' + st.faqs.length + ' 条（含停用）', '']
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
        '<td>' + (c.messages || []).length + '</td>' +
        '<td>' + (c.rating ? stars(c.rating.score) : '<span class="muted">未评价</span>') + '</td>' +
        '<td>' + U.formatDateTime(c.updatedAt) + '</td>' +
        '<td><button class="btn btn-sm" data-act="view" data-id="' + c.id + '">查看</button> ' +
          '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + c.id + '">删除</button></td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty"><span class="empty-icon">▤</span>没有符合条件的会话</div></td></tr>';
  }

  function openConvDrawer(id) {
    var c = Store.getConversation(id);
    if (!c) return;
    el('drawerTitle').textContent = '会话详情 · ' + c.title;
    var html = '<div class="panel" style="margin-bottom:14px"><div class="kv">' +
      '<span>会话 ID</span><span>' + esc(c.id) + '</span>' +
      '<span>识别意图</span><span>' + intentBadge(c.intent) + '</span>' +
      '<span>状态</span><span>' + fmtStatus(c.status) + '</span>' +
      '<span>创建时间</span><span>' + U.formatDateTime(c.createdAt) + '</span>' +
      '<span>消息数</span><span>' + (c.messages || []).length + '</span>' +
      '<span>满意度</span><span>' + (c.rating ? stars(c.rating.score) + ' ' + (c.rating.comment ? '「' + esc(c.rating.comment) + '」' : '') : '未评价') + '</span>' +
      '</div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-sm" data-drawer-act="resolve" data-id="' + c.id + '">标记已解决</button>' +
      '<button class="btn btn-sm btn-danger" data-drawer-act="delete" data-id="' + c.id + '">删除会话</button></div></div>';
    html += '<h4 style="font-size:12px;color:var(--ink-3);letter-spacing:1px;margin:0 0 10px">完整对话</h4>';
    html += (c.messages || []).map(function (m) {
      return '<div class="drawer-msg ' + (m.role === 'user' ? 'user' : '') + '">' +
        '<div class="dm-role"><b>' + (m.role === 'user' ? '用户' : '天医小助手') + '</b><span>' + U.formatDateTime(m.ts) + '</span>' +
        (m.intent ? '<span>' + (TY.INTENTS[m.intent] || TY.INTENTS.other).label + '</span>' : '') +
        (m.engine ? '<span>' + esc(m.engine) + '</span>' : '') + '</div>' +
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

  /* ---------- settings ---------- */
  function loadSettings() {
    var s = Store.state().settings;
    el('setBotName').value = s.botName || '';
    el('setWelcome').value = s.welcome || '';
    el('setFaqThreshold').value = s.faqThreshold;
    el('setHandoffThreshold').value = s.handoffThreshold;
    el('setAutoHandoff').checked = !!s.autoHandoff;
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
    else if (page === 'llm') loadLlm();
    else if (page === 'settings') loadSettings();
    if (page !== 'overview') {
      var pending = Store.state().handoffs.filter(function (h) { return h.status === 'pending'; }).length;
      el('navHandoffCount').textContent = pending;
      el('navHandoffCount').classList.toggle('hidden', !pending);
    }
  }

  /* ---------- events ---------- */
  function bind() {
    el('adminNav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-page]'); if (b) go(b.getAttribute('data-page'));
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]'); if (g) go(g.getAttribute('data-goto'));
    });
    el('refreshBtn').addEventListener('click', function () { render(); U.toast('数据已刷新', 'success'); });
    el('exportBtn').addEventListener('click', function () {
      U.downloadJson('tianyi-agent-backup-' + U.formatDate(Date.now()) + '.json', Store.state());
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
      if (act === 'resolve') { Store.updateConversation(id, { status: 'resolved' }); closeDrawer(); render(); U.toast('已标记为已解决', 'success'); }
      if (act === 'delete' && confirm('确定删除这条会话记录吗？')) { Store.deleteConversation(id); closeDrawer(); render(); U.toast('会话已删除'); }
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

    // settings
    el('saveSettingsBtn').addEventListener('click', function () {
      Store.updateSettings({
        botName: el('setBotName').value.trim() || '天医小助手',
        welcome: el('setWelcome').value.trim(),
        faqThreshold: U.clamp(Number(el('setFaqThreshold').value) || 2.2, 0.5, 8),
        handoffThreshold: U.clamp(Number(el('setHandoffThreshold').value) || 2, 1, 10),
        autoHandoff: el('setAutoHandoff').checked
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
    loadLlm(); loadSettings();
    go('overview');
  }
  init();
})();
