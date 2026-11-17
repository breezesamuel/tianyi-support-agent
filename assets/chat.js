/* 数理天医 · 智能客服 Agent — 访客对话页 */
(function () {
  'use strict';
  var TY = window.TY;
  var U = TY.utils, Store = TY.Store, Engine = TY.Engine;
  var CURRENT_KEY = 'tianyi_current_conv_v1';
  var idleTimer = null;
  var proactiveShown = false;

  function t(k) { return TY.t(k); }
  function ilabel(k) { return TY.intentLabel(k); }

  /* 应用多语言到静态 DOM 文案 */
  function applyI18n() {
    var lang = Store.state().settings.language || 'zh';
    var isEn = lang === 'en';
    function set(id, text) { var n = el(id); if (n) n.textContent = text; }
    set('adminText', t('admin'));
    set('newChatBtn', t('newChat'));
    set('convRecordsText', t('convRecords'));
    set('disclaimerTitle', t('disclaimer'));
    set('disclaimerText', t('disclaimerText'));
    set('helpLink', t('help'));
    set('lblIntent', t('intent'));
    set('lblStatus', t('status'));
    set('lblMsgs', t('msgs'));
    set('lblFaq', t('faqHits'));
    set('lblRating', t('rating'));
    set('lblMood', t('mood'));
    set('lblAssignee', '服务坐席');
    set('langLabel', isEn ? '中' : 'EN');
    set('chatSub', t('subtitle'));
    set('handoffBtn', t('handoff'));
    set('composerFoot', t('composerFoot'));
    var search = el('convSearch'); if (search) search.placeholder = t('searchConv');
    var input = el('msgInput'); if (input) input.placeholder = t('placeholder');
    set('skipLink', t('skipToChat'));
    var voice = el('voiceBtn'); if (voice) voice.title = t('voice');
    var disc = Store.state().settings.disclosure || {};
    set('aiDisclosureText', disc.enabled !== false ? (isEn ? 'You are talking to an AI assistant. Answers are generated from the FAQ and AI; please refer to official platform rules.' : (disc.text || t('aiDisclosureTip'))) : '');
    var discBox = el('aiDisclosure'); if (discBox) discBox.classList.toggle('hidden', disc.enabled === false);
    document.documentElement.lang = isEn ? 'en' : 'zh-CN';
  }

  function el(id) { return document.getElementById(id); }
  var currentId = null;
  var busy = false;
  var controller = null;
  var pendingScore = 0;
  var searchTerm = '';
  var speechRec = null;
  var speechOn = false;

  /* 无障碍播报：把关键状态变化读给屏幕阅读器（WCAG 2.2 4.1.3） */
  function announce(msg) {
    var cfg = Store.state().settings.a11y || {};
    if (cfg.announcements === false) return;
    var n = el('liveAnnouncer'); if (!n) return;
    n.textContent = '';
    setTimeout(function () { n.textContent = msg; }, 60);
  }
  function applyA11y() {
    var cfg = Store.state().settings.a11y || {};
    var root = el('appRoot');
    if (root) {
      root.classList.toggle('a11y-large', !!cfg.largeText);
      root.classList.toggle('a11y-contrast', !!cfg.highContrast);
      root.classList.toggle('a11y-reduce-motion', !!cfg.reduceMotion);
    }
    var tb = el('a11yTextBtn'); if (tb) tb.setAttribute('aria-pressed', cfg.largeText ? 'true' : 'false');
    var cb = el('a11yContrastBtn'); if (cb) cb.setAttribute('aria-pressed', cfg.highContrast ? 'true' : 'false');
  }

  function buildSummaryText(conv, intentKey, answer) {
    var firstUser = (conv.messages || []).filter(function (m) { return m.role === 'user'; })[0];
    var label = (TY.INTENTS[intentKey] || TY.INTENTS.other).label;
    var parts = [];
    if (firstUser) parts.push('用户咨询：' + String(firstUser.content).slice(0, 40));
    parts.push('识别意图：' + label);
    if (answer) parts.push('最新答复：' + String(answer).replace(/\[\[HANDOFF\]\]/g, '').replace(/\s+/g, ' ').slice(0, 56));
    parts.push('消息数：' + ((conv.messages || []).length + 1));
    return parts.join('；');
  }

  function visitorMeta() {
    var id = '';
    try {
      id = localStorage.getItem('tianyi_visitor_v1') || '';
      if (!id) { id = U.uid('visitor'); localStorage.setItem('tianyi_visitor_v1', id); }
    } catch (e) { id = U.uid('visitor'); }
    return { id: id, ua: navigator.userAgent || '', lang: navigator.language || '', ref: document.referrer || '' };
  }

  var QUICK = [
    '如何查询我的订单状态？',
    '怎么申请退款？多久到账？',
    '体质报告打不开怎么办？',
    '数理天医报告是医学诊断吗？'
  ];

  function md(text) {
    var t = U.escapeHtml(String(text || '').replace(/\[\[HANDOFF\]\]/g, ''));
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return t.replace(/\n/g, '<br>');
  }

  function currentConv() { return currentId ? Store.getConversation(currentId) : null; }

  function statusLabel(status) {
    return t(status) || t('active');
  }
  function moodHtml(level) {
    var m = TY.SENTIMENTS[level] || TY.SENTIMENTS[3];
    return '<span class="intent-tag" style="color:' + m.color + '">' + t('mood') + ' ' + TY.sentimentLabel(level) + '</span>';
  }

  /* ---------- sidebar ---------- */
  function renderSidebar() {
    var convs = Store.state().conversations.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var kw = searchTerm.trim().toLowerCase();
    if (kw) {
      convs = convs.filter(function (c) {
        return (c.title || '').toLowerCase().indexOf(kw) >= 0 ||
          (c.messages || []).some(function (m) { return String(m.content || '').toLowerCase().indexOf(kw) >= 0; });
      });
    }
    var host = el('convList');
    if (!convs.length) {
      host.innerHTML = '<div class="empty" style="padding:26px 10px"><span class="empty-icon">☰</span>' +
        (kw ? '没有匹配的会话' : '还没有对话记录<br>发送第一条消息开始咨询') + '</div>';
      return;
    }
    host.innerHTML = convs.map(function (c) {
      var pending = c.status === 'waiting_human';
      return '<div class="conv-item ' + (c.id === currentId ? 'active' : '') + '" data-id="' + c.id + '">' +
        '<div class="ci-title">' + U.escapeHtml(c.title || '新的咨询') + '</div>' +
        '<div class="ci-meta">' +
          (pending ? '<span class="ci-badge" title="等待人工"></span>' : '') +
          '<span>' + U.relativeTime(c.updatedAt) + '</span><span>·</span>' +
          '<span>' + (c.messages || []).length + ' 条</span>' +
          (c.rating ? '<span>· ' + c.rating.score + '★</span>' : '') +
        '</div>' +
        '<button class="ci-del" data-del="' + c.id + '" title="删除会话">×</button>' +
      '</div>';
    }).join('');
  }

  /* ---------- messages ---------- */
  function welcomeHtml() {
    return '<div class="welcome-card">' +
      '<h3>' + t('welcomeTitle') + '</h3>' +
      '<p>' + U.escapeHtml(Store.state().settings.welcome) + '</p>' +
      '<div class="quick-chips">' + QUICK.map(function (q) {
        return '<button class="quick-chip" data-q="' + U.escapeHtml(q) + '">' + U.escapeHtml(q) + '</button>';
      }).join('') + '</div></div>';
  }

  function renderMessages() {
    var conv = currentConv();
    var inner = el('msgListInner');
    var html = welcomeHtml();
    var notice = Store.state().settings.notice;
    if (notice && notice.enabled && notice.text) {
      html += '<div class="notice-card" style="margin:0 0 14px">' + U.escapeHtml(notice.text) + '</div>';
    }
    if (conv && conv.messages && conv.messages.length) {
      var lastBotIndex = -1;
      conv.messages.forEach(function (m, i) { if (m.role === 'assistant') lastBotIndex = i; });
      html = conv.messages.map(function (m, i) { return messageHtml(m, i === lastBotIndex, conv); }).join('');
    }
    inner.innerHTML = html;
    scrollBottom();
  }

  function messageHtml(m, isLastBot, conv) {
    var isUser = m.role === 'user';
    var intent = TY.INTENTS[m.intent] || TY.INTENTS.other;
    var meta = '<div class="msg-meta">' +
      '<span>' + U.formatTime(m.ts) + '</span>' +
      (isUser && m.intent && m.intent !== 'other'
        ? '<span class="intent-tag" style="color:' + intent.color + '">' + ilabel(m.intent) + (m.intentSource === 'llm' ? ' · AI' : '') + '</span>'
        : '') +
      (isUser && m.mood && m.mood !== 3 ? moodHtml(m.mood) : '') +
      (m.engine ? '<span>' + U.escapeHtml(m.engine) + '</span>' : '') +
      (m.complianceFlags && m.complianceFlags.length ? '<span class="intent-tag" style="color:#b4453c">合规标记</span>' : '') +
      '</div>';
    var sources = (m.sources && m.sources.length)
      ? '<details class="sources"><summary>' + t('sources') + ' ' + m.sources.length + '</summary><ul>' +
          m.sources.map(function (s) { return '<li>' + U.escapeHtml(s.question) + '（匹配度 ' + s.score + '）</li>'; }).join('') +
        '</ul></details>'
      : '';
    var handoff = m.handoff
      ? '<div class="handoff-card"><strong>' + t('handoffDone') + '</strong>' + U.escapeHtml(m.handoff) +
        U.escapeHtml(t('handoffTip')) + '</div>'
      : '';
    var rating = '';
    if (isLastBot && conv) {
      if (conv.rating) {
        rating = '<div class="rating-box"><span class="rating-done">' + t('rated') + conv.rating.score + t('stars') + '</span>' +
          (conv.rating.comment ? '<span class="muted">' + U.escapeHtml(conv.rating.comment) + '</span>' : '') + '</div>';
      } else {
        rating = '<div class="rating-box" data-rating-box data-score="' + pendingScore + '">' +
          '<span>' + t('rateQ') + '</span>' +
          '<div class="stars">' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button class="star ' + (n <= pendingScore ? 'on' : '') + '" data-score="' + n + '" title="' + n + t('stars') + '">★</button>';
          }).join('') + '</div>' +
          '<input class="input" data-rating-comment placeholder="' + t('rateComment') + '">' +
          '<input class="input" data-rating-nps type="number" min="0" max="10" placeholder="' + t('nps') + '" style="margin-top:6px">' +
          '<button class="btn btn-sm" data-rating-submit style="margin-top:6px">' + t('rateSubmit') + '</button>' +
        '</div>';
      }
    }
    return '<div class="msg-row ' + (isUser ? 'user' : 'bot') + '">' +
      '<div class="msg-avatar">' + (isUser ? '我' : '医') + '</div>' +
      '<div class="msg-body"><div class="bubble">' + md(m.content) + '</div>' + meta + sources + handoff + rating + '</div>' +
    '</div>';
  }

  function scrollBottom(force) {
    var list = el('msgList');
    if (force || list.scrollTop + list.clientHeight > list.scrollHeight - 320) {
      requestAnimationFrame(function () { list.scrollTop = list.scrollHeight; });
    }
  }

  function addStreamingRow(engineLabel) {
    var inner = el('msgListInner');
    var row = document.createElement('div');
    row.className = 'msg-row bot';
    row.id = 'streamingRow';
    row.innerHTML = '<div class="msg-avatar">医</div><div class="msg-body">' +
      '<div class="bubble cursor-blink" id="streamBubble"></div>' +
      '<div class="msg-meta"><span>' + U.formatTime(Date.now()) + '</span><span>' + U.escapeHtml(engineLabel) + '</span></div></div>';
    inner.appendChild(row);
    scrollBottom(true);
    return el('streamBubble');
  }

  /* ---------- aside ---------- */
  function renderAside() {
    var conv = currentConv();
    var s = Store.state();
    el('infoIntent').textContent = conv ? ilabel(conv.intent) : '—';
    el('infoStatus').textContent = conv ? statusLabel(conv.status) : t('active');
    el('infoMsgs').textContent = conv ? (conv.messages || []).length : 0;
    el('infoFaq').textContent = conv ? conv.messages.filter(function (m) { return m.sources && m.sources.length; }).length + ' 次' : '0 次';
    el('infoRating').textContent = conv && conv.rating ? conv.rating.score + ' ★' : t('notRated');
    el('infoMood').textContent = conv ? TY.sentimentLabel(conv.mood || 3) : TY.sentimentLabel(3);
    var agent = (s.settings.agents || []).filter(function (a) { return a.id === (conv && conv.assignee); })[0];
    el('infoAssignee').textContent = agent ? agent.name : '—';
    var lastUser = conv && conv.messages.slice().reverse().filter(function (m) { return m.role === 'user'; })[0];
    var list;
    if (lastUser) {
      list = Engine.retrieveFaq(lastUser.content, lastUser.intent, 5).top.map(function (r) { return r.faq; });
    } else {
      list = s.faqs.slice().sort(function (a, b) { return (b.hits || 0) - (a.hits || 0); }).slice(0, 5);
    }
    el('suggestList').innerHTML = list.map(function (f, i) {
      return '<li data-q="' + U.escapeHtml(f.question) + '"><span class="fs-idx">' + (i + 1) + '</span><span>' + U.escapeHtml(f.question) + '</span></li>';
    }).join('');
    var ready = Engine.llmReady();
    var cloudOn = TY.Cloud && TY.Cloud.ready();
    el('statusPill').classList.toggle('off', !ready);
    el('statusText').textContent = (ready ? '大模型已接入 · ' + s.settings.llm.model : '本地知识库模式') + (cloudOn ? ' · 云端同步' : '');
    el('engineNotice').innerHTML = ready
      ? '当前为<strong>大模型增强模式</strong>：意图识别与回答由 ' + U.escapeHtml(s.settings.llm.model) + ' 生成，并优先引用内置知识库；无法确认的信息将自动转人工。'
      : '当前为<strong>本地知识库模式</strong>：回答基于内置 FAQ 检索与规则引擎生成。可在管理后台的「模型接入」中启用大模型，获得更自然的语义理解与多轮推理。';
    el('composerFoot').textContent = ready
      ? '按 Enter 发送 · 回答由大模型结合知识库生成，请以平台实际规则为准'
      : '按 Enter 发送，Shift + Enter 换行 · 回答由知识库与规则引擎生成，请以平台实际规则为准';
    el('chatIntent').innerHTML = '<span class="tag-dot"></span>' + (conv ? ilabel(conv.intent) : t('pending'));
    var moodLevel = conv ? (conv.mood || 3) : 3;
    var moodTag = el('moodTag');
    var mm = TY.SENTIMENTS[moodLevel] || TY.SENTIMENTS[3];
    moodTag.style.color = mm.color;
    el('moodText').textContent = t('mood') + ' ' + TY.sentimentLabel(moodLevel);
  }

  function renderAll() { renderSidebar(); renderMessages(); renderAside(); }

  /* ---------- conversation actions ---------- */
  function selectConversation(id) {
    currentId = id;
    pendingScore = 0;
    try { localStorage.setItem(CURRENT_KEY, id); } catch (e) {}
    var conv = currentConv();
    el('chatTitle').textContent = conv ? conv.title : '新的咨询';
    el('chatSub').textContent = conv ? '创建于 ' + U.formatDateTime(conv.createdAt) + ' · 共 ' + conv.messages.length + ' 条消息' : '多轮对话 · 知识库检索 · 意图识别 · 自动转人工';
    renderAll();
    el('sidebar').classList.remove('open');
  }

  function newChat() {
    currentId = null;
    pendingScore = 0;
    try { localStorage.removeItem(CURRENT_KEY); } catch (e) {}
    el('chatTitle').textContent = '新的咨询';
    el('chatSub').textContent = '多轮对话 · 知识库检索 · 意图识别 · 自动转人工';
    renderAll();
    el('msgInput').focus();
    el('sidebar').classList.remove('open');
  }

  function doHandoff(conv, reason, intentKey) {
    Store.addHandoff(conv.id, reason, intentKey); // 内部会置 status=waiting_human 并记录 queuedAt
    Store.updateConversation(conv.id, { status: 'waiting_human' });
    var queue = Store.queueInfo(conv.id);
    var queueText = queue.enabled && queue.position
      ? '您当前排在部门队首第 ' + queue.position + ' 位（共 ' + queue.total + ' 人）。'
      : '';
    var offlineText = '';
    var ar = Store.state().settings.autoReply || {};
    if (ar.offlineEnabled !== false && !Engine.inServiceHours()) offlineText = Engine.offlineReplyText();
    Store.addMessage(conv.id, {
      role: 'assistant',
      content: '已为您转接人工客服，工单已生成。' + (queueText ? '\n' + queueText : ''),
      handoff: reason,
      engine: '自动转人工',
      queueInfo: queue
    });
    if (offlineText) {
      Store.addMessage(conv.id, { role: 'assistant', content: offlineText, engine: '离线自动回复' });
    }
    U.toast('已生成人工工单，客服将在服务时间内跟进', 'warn');
  }

  function manualHandoff() {
    if (!currentId) {
      var c = Store.newConversation('转人工请求', visitorMeta());
      currentId = c.id;
    }
    var conv = currentConv();
    if (conv.status === 'waiting_human') { U.toast('本次会话已转人工，请等待客服跟进'); return; }
    Store.addMessage(conv.id, {
      role: 'user', content: '请转接人工客服', intent: 'human', intentSource: 'rule'
    });
    doHandoff(conv, '用户主动要求人工客服', 'human');
    renderAll();
  }

  /* ---------- main answer flow ---------- */
  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    /* PII 防护：敏感信息在写入会话/日志/大模型之前先脱敏 */
    var privacy = Store.state().settings.privacy || {};
    if (privacy.enabled !== false) {
      var red = Engine.redactPii(text);
      if (red.hits && red.hits.length) {
        text = red.text;
        U.toast(t('piiAlert') + '（' + red.hits.map(function (h) { return h.label; }).join('、') + '）', 'warn');
        announce(t('piiAlert'));
      }
    }
    if (!currentId) {
      var created = Store.newConversation(text, visitorMeta());
      currentId = created.id;
      try { localStorage.setItem(CURRENT_KEY, currentId); } catch (e) {}
    }
    var conv = currentConv();
    el('chatTitle').textContent = conv.title;
    el('chatSub').textContent = '创建于 ' + U.formatDateTime(conv.createdAt) + ' · 共 ' + (conv.messages.length + 1) + ' 条消息';

    busy = true;
    setBusy(true);
    el('msgInput').value = '';
    autoResize();

    var ruleIntent = Engine.detectIntent(text);
    var mood = Engine.detectSentiment(text);
    Store.addMessage(conv.id, { role: 'user', content: text, intent: ruleIntent.key, intentSource: 'rule', mood: mood.level });
    var moodPatch = { mood: mood.level };
    if (Store.state().settings.routing && Store.state().settings.routing.enabled && !conv.assignee) {
      var agent = Store.autoAssign(ruleIntent.key);
      if (agent) moodPatch.assignee = agent.id;
    }
    Store.updateConversation(conv.id, moodPatch);
    renderMessages();

    /* 关键词自动回复：命中时优先于知识库/大模型，最快返回预设答案 */
    var autoReply = Engine.matchAutoReply(text);
    if (autoReply && !/转人工|人工客服|投诉/.test(text)) {
      var arMsg = Store.addMessage(conv.id, {
        role: 'assistant', content: autoReply.answer, intent: ruleIntent.key,
        engine: '关键词自动回复', autoReplyId: autoReply.id
      });
      Store.updateConversation(conv.id, {
        firstResponseAt: conv.firstResponseAt || (arMsg && arMsg.ts) || Date.now(),
        summary: buildSummaryText(conv, ruleIntent.key, autoReply.answer)
      });
      busy = false; setBusy(false); controller = null;
      proactiveShown = false; resetIdleTimer(); renderAll();
      announce('已给出回答');
      return;
    }

    var retrieval = Engine.retrieveFaq(text, ruleIntent.key, 3);
    var llmIntent = await Engine.classifyWithLlm(text);
    var intent = ruleIntent;
    if (llmIntent && llmIntent.confidence >= ruleIntent.confidence - 0.12) intent = llmIntent;
    if (llmIntent) {
      Store.updateMessage(conv.id, conv.messages.filter(function (m) { return m.role === 'user'; }).slice(-1)[0].id,
        { intent: intent.key, intentSource: llmIntent ? 'llm' : 'rule' });
    }
    Store.updateConversation(conv.id, { intent: intent.key });
    Store.bumpFaqHits(retrieval.hits.map(function (h) { return h.faq.id; }));

    var settings = Store.state().settings;
    var useLlm = Engine.llmReady();
    controller = new AbortController();
    var bubble = addStreamingRow(useLlm ? '大模型生成中' : '知识库检索中');
    var full = '';
    var llmUsed = false;
    var llmError = '';

    if (useLlm) {
      var history = (conv.messages || []).slice(-9, -1).map(function (m) {
        return { role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').replace(/\[\[HANDOFF\]\]/g, '').slice(0, 800) };
      });
      var messages = [
        { role: 'system', content: Engine.buildSystemPrompt({ hits: retrieval.hits, intentLabel: intent.label }) },
        ...history,
        { role: 'user', content: text }
      ];
      try {
        full = await Engine.llmStream(messages, function (piece, acc) {
          bubble.innerHTML = md(acc);
          scrollBottom();
        }, controller.signal);
        llmUsed = true;
      } catch (e) {
        llmError = e && e.name === 'AbortError' ? '已停止生成' : (e && e.message ? e.message : '模型调用失败');
      }
    } else {
      await new Promise(function (r) { setTimeout(r, 260); });
    }

    if (!llmUsed) {
      full = Engine.buildFallbackAnswer(text, retrieval, intent);
      if (llmError) {
        U.toast('大模型不可用，已切换知识库回答：' + llmError.slice(0, 60), 'warn');
      }
    }

    var wantsHandoff = /\[\[HANDOFF\]\]/.test(full) || intent.key === 'human';
    var dissatisfied = /没用|答非所问|还是不行|解决不了|投诉|太差|不满意/.test(text) || mood.level <= 2;
    var noHit = !retrieval.confident;
    var resolved = llmUsed ? !wantsHandoff : retrieval.confident;
    var unresolved = resolved ? 0 : (conv.unresolvedTurns || 0) + 1;
    if (settings.autoHandoff && unresolved >= (settings.handoffThreshold || 2)) wantsHandoff = true;
    if (dissatisfied) wantsHandoff = true;

    var clean = full.replace(/\[\[HANDOFF\]\]/g, '').trim();
    if (!clean) clean = '抱歉，暂时没有生成有效回答，已为您转接人工客服。';

    var reason = '';
    if (intent.key === 'human') reason = '用户主动要求人工客服';
    else if (mood.level <= 2 && !/没用|答非所问|还是不行|解决不了|投诉|太差|不满意/.test(text)) reason = '检测到负面情绪（' + TY.sentimentLabel(mood.level) + '），优先人工跟进';
    else if (dissatisfied) reason = '用户对回答表示不满，需人工跟进';
    else if (/\[\[HANDOFF\]\]/.test(full)) reason = '模型判断知识库无法覆盖或需查询具体业务数据';
    else if (settings.autoHandoff && unresolved >= (settings.handoffThreshold || 2)) reason = '连续 ' + unresolved + ' 轮未能命中知识库，自动升级人工';
    else if (!retrieval.hits.length && !llmUsed) reason = '知识库无匹配条目，避免给出不确定信息';

    var row = el('streamingRow');
    if (row) row.remove();

    var complianceFlags = Engine.scanCompliance(clean);
    var botMsg = Store.addMessage(conv.id, {
      role: 'assistant', content: clean,
      intent: intent.key,
      engine: llmUsed ? '大模型 + 知识库' : '知识库规则引擎',
      sources: retrieval.hits.map(function (h) { return { question: h.faq.question, score: h.score, id: h.faq.id }; }),
      handoff: (wantsHandoff ? (reason || '系统判断需要人工介入') : ''),
      score: retrieval.bestScore,
      complianceFlags: complianceFlags
    });
    if (complianceFlags.length) U.toast('合规提醒：本次回答命中敏感表述，已标记供质检复核', 'warn');
    Store.updateConversation(conv.id, {
      unresolvedTurns: unresolved,
      firstResponseAt: (conv.firstResponseAt || (botMsg && botMsg.ts) || Date.now()),
      summary: buildSummaryText(conv, intent.key, clean)
    });
    if (wantsHandoff) doHandoff(conv, reason || '系统判断需要人工介入', intent.key);

    busy = false;
    setBusy(false);
    controller = null;
    proactiveShown = false;
    resetIdleTimer();
    renderAll();
    announce(wantsHandoff ? '已为您转接人工客服' : (t('welcomeTitle') + ' 已给出回答'));
  }

  function setBusy(v) {
    el('sendBtn').disabled = v;
    el('msgInput').disabled = v;
    el('stopBtn').classList.toggle('hidden', !v);
  }

  /* 主动消息：访客闲置超过阈值时主动提示一次（竞品 Proactive Messaging 的本地实现） */
  function resetIdleTimer() {
    var p = Store.state().settings.proactive || {};
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (!p.enabled || proactiveShown) return;
    var sec = U.clamp(Number(p.seconds) || 45, 10, 600);
    idleTimer = setTimeout(function () {
      if (!currentId || busy) return;
      proactiveShown = true;
      Store.addMessage(currentId, {
        role: 'assistant', content: p.text || t('proactiveDefault'), engine: '主动消息',
        proactive: true
      });
      renderAll();
      U.toast('已发送主动关怀消息');
    }, sec * 1000);
  }

  function autoResize() {
    var t = el('msgInput');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 130) + 'px';
  }

  /* Web Speech API 语音输入（渐进增强：不支持时降级为文字输入并提示） */
  function bindVoice() {
    var btn = el('voiceBtn');
    if (!btn) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var vcfg = Store.state().settings.voice || {};
    if (!SR || vcfg.enabled === false) {
      btn.disabled = true;
      btn.title = t('voiceUnsupported');
      btn.setAttribute('aria-label', t('voiceUnsupported'));
      return;
    }
    btn.addEventListener('click', function () {
      if (speechOn) {
        if (speechRec) speechRec.stop();
        return;
      }
      try {
        speechRec = new SR();
        speechRec.lang = vcfg.lang || 'zh-CN';
        speechRec.interimResults = true;
        speechRec.continuous = false;
        var finalText = '';
        speechRec.onresult = function (e) {
          var interim = '';
          for (var i = e.resultIndex; i < e.results.length; i++) {
            var seg = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += seg; else interim += seg;
          }
          el('msgInput').value = (finalText + interim).trim();
          autoResize();
        };
        speechRec.onerror = function (e) {
          speechOn = false; btn.classList.remove('recording');
          btn.setAttribute('aria-pressed', 'false');
          U.toast('语音识别失败：' + (e.error || '未知错误'), 'warn');
        };
        speechRec.onend = function () {
          speechOn = false; btn.classList.remove('recording');
          btn.setAttribute('aria-pressed', 'false');
          btn.textContent = '🎙';
          announce('语音输入已结束');
        };
        speechRec.start();
        speechOn = true;
        btn.classList.add('recording');
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = '■';
        announce(t('voiceListening'));
      } catch (err) {
        U.toast('无法启动语音输入，请使用文字输入', 'warn');
      }
    });
  }

  /* ---------- events ---------- */
  function bind() {
    el('newChatBtn').addEventListener('click', newChat);
    el('menuBtn').addEventListener('click', function () { el('sidebar').classList.toggle('open'); });
    el('langBtn').addEventListener('click', function () {
      var cur = Store.state().settings.language || 'zh';
      Store.setLanguage(cur === 'zh' ? 'en' : 'zh');
      applyI18n(); renderAll();
      U.toast(cur === 'zh' ? 'Switched to English' : '已切换为中文', 'success');
    });
    // WCAG 无障碍控制
    el('a11yTextBtn').addEventListener('click', function () {
      var cur = Store.state().settings.a11y || {};
      Store.setA11y({ largeText: !cur.largeText });
      applyA11y(); announce(cur.largeText ? '已恢复正常字号' : '已放大字号');
    });
    el('a11yContrastBtn').addEventListener('click', function () {
      var cur = Store.state().settings.a11y || {};
      Store.setA11y({ highContrast: !cur.highContrast });
      applyA11y(); announce(cur.highContrast ? '已关闭高对比度' : '已开启高对比度');
    });
    // 键盘快捷键：Alt+N 新会话、Alt+/ 聚焦输入、Esc 停止生成
    document.addEventListener('keydown', function (e) {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); newChat(); }
      if (e.altKey && e.key === '/') { e.preventDefault(); el('msgInput').focus(); }
      if (e.key === 'Escape' && busy && controller) { controller.abort(); U.toast('已停止生成'); }
    });
    bindVoice();
    el('msgInput').addEventListener('input', resetIdleTimer);
    el('convSearch').addEventListener('input', function (e) { searchTerm = e.target.value; renderSidebar(); });
    el('convList').addEventListener('click', function (e) {
      var del = e.target.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        if (confirm('确定删除这条会话记录吗？此操作不可撤销。')) {
          var id = del.getAttribute('data-del');
          Store.deleteConversation(id);
          if (currentId === id) newChat(); else renderSidebar();
          U.toast('会话已删除', 'success');
        }
        return;
      }
      var item = e.target.closest('.conv-item');
      if (item) selectConversation(item.getAttribute('data-id'));
    });

    el('msgInput').addEventListener('input', autoResize);
    el('msgInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(el('msgInput').value); }
    });
    el('sendBtn').addEventListener('click', function () { send(el('msgInput').value); });
    el('stopBtn').addEventListener('click', function () {
      if (controller) { controller.abort(); U.toast('已停止生成'); }
    });
    el('handoffBtn').addEventListener('click', manualHandoff);
    el('humanBtn').addEventListener('click', manualHandoff);

    el('msgListInner').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-q]');
      if (chip) { send(chip.getAttribute('data-q')); return; }
      var box = e.target.closest('[data-rating-box]');
      if (box) {
        var star = e.target.closest('.star');
        if (star) {
          pendingScore = Number(star.getAttribute('data-score'));
          box.setAttribute('data-score', pendingScore);
          box.querySelectorAll('.star').forEach(function (s) {
            s.classList.toggle('on', Number(s.getAttribute('data-score')) <= pendingScore);
          });
          return;
        }
        if (e.target.closest('[data-rating-submit]')) {
          if (!pendingScore) { U.toast('请先选择星级', 'warn'); return; }
          var comment = box.querySelector('[data-rating-comment]').value.trim();
          var nps = box.querySelector('[data-rating-nps]').value.trim();
          Store.setRating(currentId, pendingScore, comment, nps);
          U.toast('感谢您的评价！', 'success');
          renderAll();
        }
      }
    });

    el('suggestList').addEventListener('click', function (e) {
      var li = e.target.closest('[data-q]');
      if (li) send(li.getAttribute('data-q'));
    });
  }

  function init() {
    applyI18n();
    applyA11y();
    bind();
    resetIdleTimer();
    window.addEventListener('tianyi:cloud-sync', function (e) {
      if (!e.detail || e.detail.source !== 'pull') return;
      if (currentId && !Store.getConversation(currentId)) newChat();
      else if (currentId) selectConversation(currentId);
      else renderAll();
      U.toast('已同步云端最新数据');
    });
    var saved = null;
    try { saved = localStorage.getItem(CURRENT_KEY); } catch (e) {}
    var convs = Store.state().conversations;
    if (saved && convs.some(function (c) { return c.id === saved; })) selectConversation(saved);
    else if (convs.length) {
      var latest = convs.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
      selectConversation(latest.id);
    } else newChat();
    autoResize();
  }

  init();
})();
