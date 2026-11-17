/* 数理天医 · 智能客服 Agent — 访客对话页 */
(function () {
  'use strict';
  var TY = window.TY;
  var U = TY.utils, Store = TY.Store, Engine = TY.Engine;
  var CURRENT_KEY = 'tianyi_current_conv_v1';

  function el(id) { return document.getElementById(id); }
  var currentId = null;
  var busy = false;
  var controller = null;
  var pendingScore = 0;
  var searchTerm = '';

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
    return { active: '进行中', waiting_human: '等待人工', resolved: '已解决' }[status] || '进行中';
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
      '<h3>您好，我是天医小助手</h3>' +
      '<p>' + U.escapeHtml(Store.state().settings.welcome) + '</p>' +
      '<div class="quick-chips">' + QUICK.map(function (q) {
        return '<button class="quick-chip" data-q="' + U.escapeHtml(q) + '">' + U.escapeHtml(q) + '</button>';
      }).join('') + '</div></div>';
  }

  function renderMessages() {
    var conv = currentConv();
    var inner = el('msgListInner');
    var html = welcomeHtml();
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
        ? '<span class="intent-tag" style="color:' + intent.color + '">' + intent.label + (m.intentSource === 'llm' ? ' · AI' : '') + '</span>'
        : '') +
      (m.engine ? '<span>' + U.escapeHtml(m.engine) + '</span>' : '') +
      '</div>';
    var sources = (m.sources && m.sources.length)
      ? '<details class="sources"><summary>参考知识库 ' + m.sources.length + ' 条</summary><ul>' +
          m.sources.map(function (s) { return '<li>' + U.escapeHtml(s.question) + '（匹配度 ' + s.score + '）</li>'; }).join('') +
        '</ul></details>'
      : '';
    var handoff = m.handoff
      ? '<div class="handoff-card"><strong>已为您转接人工客服</strong>' + U.escapeHtml(m.handoff) +
        '　工单已生成，人工客服服务时间 09:00–21:00。您也可以继续补充信息。</div>'
      : '';
    var rating = '';
    if (isLastBot && conv) {
      if (conv.rating) {
        rating = '<div class="rating-box"><span class="rating-done">✓ 已评价：' + conv.rating.score + ' 星</span>' +
          (conv.rating.comment ? '<span class="muted">' + U.escapeHtml(conv.rating.comment) + '</span>' : '') + '</div>';
      } else {
        rating = '<div class="rating-box" data-rating-box data-score="' + pendingScore + '">' +
          '<span>本次回答是否解决您的问题？</span>' +
          '<div class="stars">' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button class="star ' + (n <= pendingScore ? 'on' : '') + '" data-score="' + n + '" title="' + n + ' 星">★</button>';
          }).join('') + '</div>' +
          '<input class="input" data-rating-comment placeholder="补充说明（选填）">' +
          '<button class="btn btn-sm" data-rating-submit>提交评价</button>' +
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
    el('infoIntent').textContent = conv ? (TY.INTENTS[conv.intent] || TY.INTENTS.other).label : '—';
    el('infoStatus').textContent = conv ? statusLabel(conv.status) : '进行中';
    el('infoMsgs').textContent = conv ? (conv.messages || []).length : 0;
    el('infoFaq').textContent = conv ? conv.messages.filter(function (m) { return m.sources && m.sources.length; }).length + ' 次' : '0 次';
    el('infoRating').textContent = conv && conv.rating ? conv.rating.score + ' ★' : '未评价';
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
    el('chatIntent').innerHTML = '<span class="tag-dot"></span>' + (conv ? (TY.INTENTS[conv.intent] || TY.INTENTS.other).label : '待识别');
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
    Store.addHandoff(conv.id, reason, intentKey);
    Store.updateConversation(conv.id, { status: 'waiting_human' });
    Store.addMessage(conv.id, {
      role: 'assistant',
      content: '已为您转接人工客服，工单已生成。',
      handoff: reason,
      engine: '自动转人工'
    });
    U.toast('已生成人工工单，客服将在服务时间内跟进', 'warn');
  }

  function manualHandoff() {
    if (!currentId) {
      var c = Store.newConversation('转人工请求');
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
    if (!currentId) {
      var created = Store.newConversation(text);
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
    Store.addMessage(conv.id, { role: 'user', content: text, intent: ruleIntent.key, intentSource: 'rule' });
    renderMessages();

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
    var dissatisfied = /没用|答非所问|还是不行|解决不了|投诉|太差|不满意/.test(text);
    var noHit = !retrieval.confident;
    var resolved = llmUsed ? !wantsHandoff : retrieval.confident;
    var unresolved = resolved ? 0 : (conv.unresolvedTurns || 0) + 1;
    if (settings.autoHandoff && unresolved >= (settings.handoffThreshold || 2)) wantsHandoff = true;
    if (dissatisfied) wantsHandoff = true;

    var clean = full.replace(/\[\[HANDOFF\]\]/g, '').trim();
    if (!clean) clean = '抱歉，暂时没有生成有效回答，已为您转接人工客服。';

    var reason = '';
    if (intent.key === 'human') reason = '用户主动要求人工客服';
    else if (dissatisfied) reason = '用户对回答表示不满，需人工跟进';
    else if (/\[\[HANDOFF\]\]/.test(full)) reason = '模型判断知识库无法覆盖或需查询具体业务数据';
    else if (settings.autoHandoff && unresolved >= (settings.handoffThreshold || 2)) reason = '连续 ' + unresolved + ' 轮未能命中知识库，自动升级人工';
    else if (!retrieval.hits.length && !llmUsed) reason = '知识库无匹配条目，避免给出不确定信息';

    var row = el('streamingRow');
    if (row) row.remove();

    Store.addMessage(conv.id, {
      role: 'assistant', content: clean,
      intent: intent.key,
      engine: llmUsed ? '大模型 + 知识库' : '知识库规则引擎',
      sources: retrieval.hits.map(function (h) { return { question: h.faq.question, score: h.score, id: h.faq.id }; }),
      handoff: (wantsHandoff ? (reason || '系统判断需要人工介入') : ''),
      score: retrieval.bestScore
    });
    Store.updateConversation(conv.id, { unresolvedTurns: unresolved });
    if (wantsHandoff) doHandoff(conv, reason || '系统判断需要人工介入', intent.key);

    busy = false;
    setBusy(false);
    controller = null;
    renderAll();
  }

  function setBusy(v) {
    el('sendBtn').disabled = v;
    el('msgInput').disabled = v;
    el('stopBtn').classList.toggle('hidden', !v);
  }

  function autoResize() {
    var t = el('msgInput');
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 130) + 'px';
  }

  /* ---------- events ---------- */
  function bind() {
    el('newChatBtn').addEventListener('click', newChat);
    el('menuBtn').addEventListener('click', function () { el('sidebar').classList.toggle('open'); });
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
          Store.setRating(currentId, pendingScore, comment);
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
    bind();
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
