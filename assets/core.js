/* 数理天医 · 智能客服 Agent
 * core.js — 持久化数据层 + FAQ 检索 / 意图识别 / 大模型接入引擎
 * 默认使用浏览器本地存储；可在管理后台配置 Supabase 后启用云端同步。
 * 密钥只保存在当前浏览器，不写入源码，也不会同步到云端。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'tianyi_agent_state_v1';
  var Cloud = null; // 在文件末尾初始化，save() 通过全局引用调用

  var INTENTS = {
    refund: { key: 'refund', label: '退款退费', en: 'Refund', color: '#b4453c', icon: '退' },
    order: { key: 'order', label: '查询订单', en: 'Order', color: '#b07a2a', icon: '单' },
    tech: { key: 'tech', label: '技术支持', en: 'Tech support', color: '#2f6b5f', icon: '技' },
    product: { key: 'product', label: '产品咨询', en: 'Product', color: '#5b5f9e', icon: '产' },
    health: { key: 'health', label: '健康合规', en: 'Health & compliance', color: '#7a6a55', icon: '健' },
    human: { key: 'human', label: '转人工', en: 'Human agent', color: '#8d4b7b', icon: '人' },
    other: { key: 'other', label: '其他咨询', en: 'Other', color: '#6b7280', icon: '他' }
  };

  /* 多语言界面词库（第二批）：仅覆盖访客端高频界面文案，知识库答案保持平台原文 */
  var I18N = {
    zh: {
      'brand': '数理天医 · 智能客服', 'admin': '管理后台', 'newChat': '＋ 新建会话', 'help': '▣ 帮助中心 / 自助查询',
      'convRecords': '对话记录', 'searchConv': '搜索历史会话', 'disclaimer': '非诊疗声明',
      'disclaimerText': '本助手仅提供平台订单、课程、售后与技术支持咨询；内容不构成医疗诊断、治疗或用药建议。身体不适请及时就医。',
      'subtitle': '多轮对话 · 知识库检索 · 意图识别 · 自动转人工', 'handoff': '🙋 转人工',
      'session': '本次会话', 'intent': '识别意图', 'status': '会话状态', 'msgs': '消息数量', 'faqHits': '知识库命中',
      'rating': '满意度', 'suggest': '推荐知识', 'serviceInfo': '服务说明', 'notRated': '未评价',
      'active': '进行中', 'waiting_human': '等待人工', 'resolved': '已解决', 'pending': '待识别',
      'rateQ': '本次回答是否解决您的问题？', 'rateComment': '补充说明（选填）', 'nps': '推荐意愿 0-10（选填）',
      'rateSubmit': '提交评价', 'rated': '✓ 已评价：', 'stars': ' 星', 'sources': '参考知识库',
      'handoffDone': '已为您转接人工客服', 'handoffTip': '　工单已生成，人工客服服务时间 09:00–21:00。您也可以继续补充信息。',
      'placeholder': '请描述您的问题，例如：我的订单还没开通 / 如何申请退款…',
      'composerFoot': '按 Enter 发送，Shift + Enter 换行 · 回答由知识库与大模型辅助生成，请以平台实际规则为准',
      'welcomeTitle': '您好，我是天医小助手', 'mood': '情绪', 'language': '语言',
      'proactiveDefault': '您好，还有疑问吗？可以随时告诉我，或回复「转人工」由客服为您服务。',
      'aiDisclosure': '您正在与 AI 智能助手对话', 'aiDisclosureTip': '回答由知识库与大模型辅助生成，请以平台实际规则为准；如需人工请回复「转人工」。',
      'voice': '语音输入', 'voiceListening': '正在聆听…', 'voiceUnsupported': '当前浏览器不支持语音输入，请使用文字输入',
      'piiAlert': '检测到敏感信息，已为您脱敏处理', 'skipToChat': '跳转到对话区', 'fontSize': '字号', 'contrast': '高对比度'
    },
    en: {
      'brand': 'Tianyi · Smart Support', 'admin': 'Admin console', 'newChat': '＋ New chat', 'help': '▣ Help center',
      'convRecords': 'Conversations', 'searchConv': 'Search conversations', 'disclaimer': 'Non-medical disclaimer',
      'disclaimerText': 'This assistant only answers questions about orders, courses, after-sales and technical support. It does not provide medical diagnosis, treatment or medication advice. Please see a doctor if unwell.',
      'subtitle': 'Multi-turn chat · FAQ retrieval · Intent detection · Auto escalation', 'handoff': '🙋 Human agent',
      'session': 'This session', 'intent': 'Detected intent', 'status': 'Status', 'msgs': 'Messages', 'faqHits': 'FAQ hits',
      'rating': 'Rating', 'suggest': 'Suggested articles', 'serviceInfo': 'Service notes', 'notRated': 'Not rated',
      'active': 'Active', 'waiting_human': 'Waiting for agent', 'resolved': 'Resolved', 'pending': 'Pending',
      'rateQ': 'Did this answer solve your problem?', 'rateComment': 'Additional comment (optional)', 'nps': 'Recommendation 0-10 (optional)',
      'rateSubmit': 'Submit rating', 'rated': '✓ Rated: ', 'stars': ' stars', 'sources': 'FAQ sources',
      'handoffDone': 'Transferred to a human agent', 'handoffTip': '  A ticket has been created. Service hours 09:00–21:00. You may add more details.',
      'placeholder': 'Describe your question, e.g. my order is not activated / how to request a refund…',
      'composerFoot': 'Enter to send, Shift + Enter for new line · Answers are generated from the FAQ and AI, please refer to official platform rules',
      'welcomeTitle': 'Hello, I am Tianyi Assistant', 'mood': 'Mood', 'language': 'Language',
      'proactiveDefault': 'Still need help? Just let me know, or type "human agent" to reach our team.',
      'aiDisclosure': 'You are talking to an AI assistant', 'aiDisclosureTip': 'Answers are generated from the FAQ and AI. Please refer to official platform rules. Type "human agent" for a person.',
      'voice': 'Voice input', 'voiceListening': 'Listening…', 'voiceUnsupported': 'Voice input is not supported in this browser. Please type instead.',
      'piiAlert': 'Sensitive information detected and masked', 'skipToChat': 'Skip to conversation', 'fontSize': 'Font size', 'contrast': 'High contrast'
    }
  };

  var SENTIMENTS = {
    1: { key: 1, label: '愤怒', en: 'Angry', color: '#b4453c' },
    2: { key: 2, label: '不满', en: 'Frustrated', color: '#c2703c' },
    3: { key: 3, label: '中性', en: 'Neutral', color: '#6b7280' },
    4: { key: 4, label: '满意', en: 'Satisfied', color: '#2f6b5f' },
    5: { key: 5, label: '赞赏', en: 'Delighted', color: '#2f6b5f' }
  };

  /* PII 敏感信息识别（竞品 Guardrails / PII Redaction 的本地规则版）
     模式：mask 中间脱敏 / token 替换为占位符 / alert 仅告警 */
  var PII_RULES = [
    { key: 'phone', label: '手机号', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g, token: '[PHONE]' },
    { key: 'idcard', label: '身份证号', pattern: /(?<!\d)\d{17}[\dXx](?!\d)/g, token: '[ID_CARD]' },
    { key: 'bankcard', label: '银行卡号', pattern: /(?<!\d)\d{16,19}(?!\d)/g, token: '[CARD]' },
    { key: 'email', label: '邮箱', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, token: '[EMAIL]' },
    { key: 'order', label: '订单号', pattern: /(?<!\d)\d{10,16}(?!\d)/g, token: '[ORDER_ID]' }
  ];
  function maskValue(v) {
    var s = String(v);
    if (s.length <= 4) return '*'.repeat(s.length);
    if (s.indexOf('@') > 0) {
      var parts = s.split('@');
      return parts[0].slice(0, 1) + '***@' + parts[1];
    }
    return s.slice(0, 3) + '*'.repeat(Math.max(2, s.length - 7)) + s.slice(-4);
  }

  /* QA 质检评分卡（竞品 Intercom Custom Scorecards / Fin CX Score 的本地规则版）
     每维 0-2 分，按权重汇总为 1-5 分；critical 项失败则整单不通过 */
  var QA_DIMENSIONS = [
    { key: 'grounded', label: '答案有据', en: 'Grounded answer', weight: 30, critical: true,
      hint: '回答是否引用了知识库来源、是否有可核对的依据' },
    { key: 'compliance', label: '合规安全', en: 'Compliance safety', weight: 30, critical: true,
      hint: '是否命中敏感表述、是否附带非诊疗提示' },
    { key: 'resolution', label: '问题解决', en: 'Issue resolved', weight: 25, critical: false,
      hint: '是否给出明确解答或已妥善转人工' },
    { key: 'empathy', label: '服务态度', en: 'Empathy & tone', weight: 15, critical: false,
      hint: '负面情绪是否被识别并安抚' }
  ];

  var FAQ_CATEGORIES = ['订单与支付', '退款与售后', '技术支持', '产品与服务', '健康与合规', '人工服务'];

  var SEED_FAQS = [
    { category: '订单与支付', intent: 'order', question: '如何查询我的订单状态？', answer: '登录后进入「我的 → 我的订单」，可查看全部订单及状态（待支付 / 已开通 / 已退款）。如使用手机号下单，请用下单时的手机号登录；订单状态一般在支付成功后 5 分钟内更新。', keywords: ['订单', '查询订单', '订单状态', '我的订单', '订单号', '查单'] },
    { category: '订单与支付', intent: 'order', question: '支付成功但课程/报告未开通怎么办？', answer: '支付通道回调偶尔存在 1-5 分钟延迟。请先刷新「我的订单」；超过 10 分钟仍未开通，请提供订单号与支付时间，我们将为您人工核验并补开。', keywords: ['支付成功', '未开通', '没开通', '回调', '延迟', '补开'] },
    { category: '订单与支付', intent: 'order', question: '支付失败或重复扣款如何处理？', answer: '支付失败一般不会扣款；若银行已扣款但订单显示未支付，款项通常会在 1-3 个工作日原路退回。重复扣款请提供两笔交易的订单号，我们核实后发起退款。', keywords: ['支付失败', '重复扣款', '扣款', '未支付', '原路退回'] },
    { category: '订单与支付', intent: 'order', question: '可以开发票吗？', answer: '支持开具电子普通发票。请在订单完成后 30 天内，于「我的 → 发票管理」提交抬头与税号，或联系人工客服提供订单号，约 3 个工作日发送至预留邮箱。', keywords: ['发票', '开票', '税号', '抬头', '电子发票'] },
    { category: '订单与支付', intent: 'order', question: '优惠券和会员折扣怎么使用？', answer: '优惠券在结算页自动匹配可用券，也可手动选择；会员折扣与优惠券通常不可叠加，以结算页实付金额为准。已过期优惠券无法补发。', keywords: ['优惠券', '折扣', '会员', '结算', '叠加'] },
    { category: '订单与支付', intent: 'order', question: '订单号在哪里看？', answer: '订单号是 16 位数字，可在「我的订单」详情页查看，也包含在支付成功短信与确认邮件中。向客服咨询时提供订单号可以显著加快处理速度。', keywords: ['订单号', '单号', '16位', '短信', '确认邮件'] },

    { category: '退款与售后', intent: 'refund', question: '如何申请退款？', answer: '进入「我的 → 我的订单」，选择对应订单点击「申请退款」，填写原因并提交。虚拟课程/报告类商品在未开始学习且购买未超过 7 天时支持无理由退款，审核通常在 1-2 个工作日内完成。', keywords: ['退款', '申请退款', '怎么退', '退费', '退钱'] },
    { category: '退款与售后', intent: 'refund', question: '退款多久能到账？', answer: '审核通过后，退款按原支付渠道退回：微信/支付宝一般 1-3 个工作日，银行卡 3-7 个工作日。到账时间以支付机构为准，可在「退款记录」中查看进度。', keywords: ['退款到账', '多久到账', '几天', '退款进度', '原路退回'] },
    { category: '退款与售后', intent: 'refund', question: '已经学过一部分课程还能退款吗？', answer: '已学习超过 20% 或已下载完整报告的订单，原则上不支持无理由退款；如因平台技术故障导致无法正常使用，可提交订单号与问题截图申请特殊处理，由人工客服审核。', keywords: ['学了一部分', '已学习', '部分退款', '不支持退款', '特殊处理'] },
    { category: '退款与售后', intent: 'refund', question: '退款申请被驳回怎么办？', answer: '驳回页面会展示具体原因（如超出期限、已核销等）。若您认为判断有误，可回复「转人工」并附上订单号，人工客服将在服务时间内复核。', keywords: ['驳回', '退款失败', '不给退', '复核', '申诉'] },
    { category: '退款与售后', intent: 'refund', question: '七天无理由退款规则是什么？', answer: '自支付成功之日起 7 天内、且课程未开始学习 / 报告未生成，可申请全额无理由退款；生成报告或开课后按平台服务协议处理。活动特价商品以商品页标注的售后规则为准。', keywords: ['七天', '7天', '无理由', '全额退款', '售后规则'] },
    { category: '退款与售后', intent: 'refund', question: '退款后会员权益还在吗？', answer: '订单全额退款成功后，该订单对应的会员权益与课程访问权限同步关闭；账户中其他有效订单不受影响。', keywords: ['退款后', '会员权益', '权限关闭', '访问'] },

    { category: '技术支持', intent: 'tech', question: '登录不了 / 验证码收不到怎么办？', answer: '请先确认手机号无误、短信未被拦截，并尝试 60 秒后重新获取。若仍收不到，可切换「邮箱验证码」登录，或清除浏览器缓存后重试；连续失败 5 次会临时锁定 30 分钟。', keywords: ['登录不了', '验证码', '收不到', '登录失败', '短信', '锁定'] },
    { category: '技术支持', intent: 'tech', question: '数理体质报告打不开或一直加载中？', answer: '建议使用 Chrome / Edge 最新版本，关闭广告拦截插件后刷新；报告为 PDF，需允许弹窗与下载。若仍无法打开，请提供订单号、浏览器版本与错误截图，技术同事会协助排查。', keywords: ['报告打不开', '加载中', '打不开', 'PDF', '浏览器', '白屏', '闪退'] },
    { category: '技术支持', intent: 'tech', question: '页面报错、空白或小程序闪退', answer: '常见原因是本地缓存过期。请尝试：退出重新登录 → 清除缓存 → 更新到最新版本。若问题持续，请记录报错提示文字与发生时间，转人工后我们会生成技术工单。', keywords: ['报错', '空白', '闪退', '崩溃', '缓存', 'bug', '错误'] },
    { category: '技术支持', intent: 'tech', question: '数据不同步 / 换了设备看不到记录', answer: '请使用与下单时相同的手机号或邮箱登录，记录与账号绑定。若确认账号一致仍缺失，请提供账号与最近一次操作时间，我们协助核对数据。', keywords: ['数据同步', '不同步', '换设备', '记录丢失', '账号'] },
    { category: '技术支持', intent: 'tech', question: '如何修改绑定手机号或密码？', answer: '进入「我的 → 账号与安全」，通过原手机号验证后可更换绑定；密码修改同样需要先完成身份验证。原手机号已停用时，请转人工提交身份核验。', keywords: ['修改手机号', '换绑', '改密码', '账号安全', '身份验证'] },
    { category: '技术支持', intent: 'tech', question: '报告支持导出或打印吗？', answer: '支持。在报告详情页点击「导出 PDF」即可保存；打印时建议选择 A4 纵向、背景图形开启。导出功能需要浏览器允许下载。', keywords: ['导出', '打印', 'PDF', '下载', '保存'] },

    { category: '产品与服务', intent: 'product', question: '什么是「数理天医」体质分析报告？', answer: '「数理天医」是基于中医经典理论与现代数据建模，对用户填写的体质问卷进行结构化归纳，输出的一份生活方式参考报告，包含体质倾向、四时调养建议与作息提示。它是健康科普与自我管理工具，不是医学诊断书。', keywords: ['数理天医', '体质报告', '是什么', '报告内容', '介绍'] },
    { category: '产品与服务', intent: 'product', question: '课程有效期是多久？可以反复看吗？', answer: '单门课程自开通之日起有效期 12 个月，有效期内可无限次回放；会员有效期内可学习会员专区全部课程。到期前 30 天会在站内消息提醒。', keywords: ['有效期', '课程', '回放', '到期', '会员专区'] },
    { category: '产品与服务', intent: 'product', question: '会员包含哪些权益？', answer: '会员权益包含：会员专区课程、每月一次体质复测、报告解读直播回放、专属学习社群。具体权益以购买页公示为准，平台可能随版本更新调整并提前公告。', keywords: ['会员', '权益', '复测', '社群', '直播'] },
    { category: '产品与服务', intent: 'product', question: '如何预约一对一咨询？', answer: '在「服务 → 预约咨询」选择时段并支付后，顾问会在服务时间前 1 小时通过站内消息发送接入方式。如需改期，请至少提前 4 小时在原预约页操作。', keywords: ['预约', '一对一', '咨询', '改期', '时段'] },
    { category: '产品与服务', intent: 'product', question: '课程有结业证书吗？', answer: '完成指定课程全部章节并通过在线测评后，可在「我的 → 证书」查看电子结业证书。该证书为学习完成证明，不属于职业资格或执业资质认证。', keywords: ['证书', '结业', '测评', '资格', '认证'] },

    { category: '健康与合规', intent: 'health', question: '平台报告能当作诊断或治疗依据吗？', answer: '不能。平台所有报告、课程与内容均属于健康科普与生活方式参考，不构成医疗诊断、治疗方案或用药建议，也不能替代执业医师的面诊。如有不适或疾病相关问题，请及时前往正规医疗机构就诊。', keywords: ['诊断', '治疗', '看病', '用药', '医疗', '医生', '能不能治'] },
    { category: '健康与合规', intent: 'health', question: '智能客服会给出调理药方吗？', answer: '不会。智能客服仅回答平台订单、课程、售后与技术支持相关问题，不提供辨证处方、用药剂量或疗效承诺。涉及个体健康的问题我们会转接人工顾问，并建议您咨询具备资质的医师。', keywords: ['药方', '方子', '调理', '处方', '吃什么药', '疗效'] },
    { category: '健康与合规', intent: 'health', question: '我的问卷和体质数据如何保护？', answer: '问卷数据仅用于生成您本人的报告，不会对外出售；您可在「账号与安全」中申请导出或删除个人数据。请勿在对话中发送身份证号、银行卡号等敏感信息。', keywords: ['隐私', '数据保护', '个人信息', '删除数据', '安全'] },

    { category: '人工服务', intent: 'human', question: '人工客服的服务时间？', answer: '人工客服服务时间为每日 09:00 - 21:00。非服务时间提交的转人工请求会生成工单，工作人员将在次日服务时间优先处理，并通过站内消息回复。', keywords: ['人工', '客服', '服务时间', '几点', '上班'] },
    { category: '人工服务', intent: 'human', question: '如何转接人工客服？', answer: '直接发送「转人工」，或点击输入框左侧的「转人工」按钮即可。系统会把本次对话摘要与意图一并生成工单，无需重复描述问题。', keywords: ['转人工', '人工客服', '真人', '找客服', '投诉'] }
  ];

  var DEFAULT_SETTINGS = {
    botName: '天医小助手',
    welcome: '您好，我是天医小助手。关于订单、退款、课程、报告或技术问题都可以问我；我会先检索知识库，必要时为您转接人工。',
    autoHandoff: true,
    handoffThreshold: 2,
    faqThreshold: 2.2,
    llm: {
      enabled: false,
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      apiKey: ''
    },
    cloud: {
      enabled: false,
      provider: 'supabase',
      url: '',
      key: '',
      space: 'tianyi-default',
      auto: true,
      interval: 20,
      lastPushAt: 0,
      lastPullAt: 0,
      lastAppliedAt: 0
    },
    sla: {
      enabled: true,
      firstResponseMinutes: 5,
      resolutionHours: 24
    },
    compliance: {
      enabled: true,
      terms: ['保证治愈', '根治', '包治', '无副作用', '替代医院', '不用就医', '药到病除', '绝对有效']
    },
    notice: {
      enabled: false,
      text: ''
    },
    language: 'zh',
    canned: [
      { id: 'c1', title: '退款进度', text: '您的退款申请已提交，审核一般 1-2 个工作日完成，退款到账以支付渠道为准。' },
      { id: 'c2', title: '订单未开通', text: '请提供订单号与支付时间，我们为您核验并补开权限。' },
      { id: 'c3', title: '非诊疗声明', text: '平台内容仅作健康科普与生活方式参考，不构成医疗诊断或治疗建议，如有不适请及时就医。' }
    ],
    agents: [
      { id: 'a1', name: '客服-晓琳', skills: ['refund', 'order'] },
      { id: 'a2', name: '客服-明远', skills: ['tech', 'product'] },
      { id: 'a3', name: '客服-静宜', skills: ['health', 'human'] }
    ],
    routing: {
      enabled: false,
      strategy: 'roundrobin'
    },
    proactive: {
      enabled: false,
      trigger: 'idle',
      seconds: 45,
      text: '您好，还有疑问吗？可以随时告诉我，或回复「转人工」由客服为您服务。'
    },
    /* 第三轮：EU AI Act Art.50 透明度 —— 明确告知用户在与 AI 对话 */
    disclosure: {
      enabled: true,
      text: '您正在与 AI 智能助手对话。回答由知识库与大模型辅助生成，请以平台实际规则为准。'
    },
    /* 第三轮：PII 检测与脱敏策略 */
    privacy: {
      enabled: true,
      mode: 'mask', // mask | token | alert
      rules: ['phone', 'idcard', 'bankcard', 'email', 'order'],
      logRedactions: true
    },
    /* 第三轮：QA 质检评分卡 */
    qa: {
      enabled: true,
      passScore: 3.5,
      dimensions: QA_DIMENSIONS.map(function (d) { return { key: d.key, weight: d.weight, critical: d.critical }; })
    },
    /* 第三轮：WCAG 2.2 无障碍偏好（访客本机保存，可后台设默认） */
    a11y: {
      largeText: false,
      highContrast: false,
      reduceMotion: false,
      announcements: true
    },
    /* 第三轮：Web Speech 语音输入 */
    voice: {
      enabled: true,
      lang: 'zh-CN'
    },
    /* 第四轮：统一收件箱 —— VIP 优先 / 排队 / 服务时间 */
    inbox: {
      queueEnabled: true,
      serviceHours: '09:00-21:00',
      vipPriority: 100,
      collisionWindowSec: 60
    },
    /* 第四轮：关键词自动回复 + 离线自动回复 */
    autoReply: {
      enabled: false,
      offlineEnabled: true,
      offlineText: '您好，人工客服当前不在线（服务时间 09:00-21:00）。已为您记录，我们将在服务时间优先回复；紧急问题可留言订单号。',
      keywords: [
        { id: 'ar1', keys: ['发票', '开票', '税号'], answer: '支持电子普通发票，请在「我的 → 发票管理」提交抬头与税号，约 3 个工作日发送至预留邮箱。', enabled: true },
        { id: 'ar2', keys: ['服务时间', '几点上班', '人工时间'], answer: '人工客服服务时间为每日 09:00 - 21:00，非服务时间提交的请求会在次日优先处理。', enabled: true }
      ]
    },
    /* 第四轮：回复宏（一次触发多步坐席动作） */
    macros: [
      { id: 'm1', title: '退款标准处理', steps: [
        { type: 'tag', value: '退款' },
        { type: 'canned', value: 'c1' },
        { type: 'note', value: '按退款标准流程处理，已发送进度话术。' }
      ] },
      { id: 'm2', title: '技术工单升级', steps: [
        { type: 'tag', value: '技术' },
        { type: 'assign', value: 'a2' },
        { type: 'note', value: '已升级技术坐席跟进。' }
      ] }
    ],
    /* 第四轮：回复模板（支持 {{visitor}} {{intent}} {{agent}} {{date}} {{order}} 变量） */
    templates: [
      { id: 'tp1', title: '人工接入欢迎', text: '您好 {{visitor}}，我是 {{agent}}。已了解您咨询的是「{{intent}}」相关问题，请问具体订单号是多少？' },
      { id: 'tp2', title: '结束语', text: '感谢您的咨询（{{date}}）。如还有疑问可随时回复，祝您生活愉快。' }
    ]
  };

  /* 统一补齐 settings 中的可选分组（load/import/applyRemote 共用，避免新增字段遗漏） */
  function mergeSettings(base, saved) {
    var s = Object.assign({}, JSON.parse(JSON.stringify(base)), saved || {});
    ['llm', 'cloud', 'sla', 'compliance', 'notice', 'routing', 'proactive',
      'disclosure', 'privacy', 'qa', 'a11y', 'voice', 'inbox', 'autoReply'].forEach(function (k) {
      s[k] = Object.assign({}, JSON.parse(JSON.stringify(base[k] || {})), (saved && saved[k]) || {});
    });
    ['canned', 'agents', 'macros', 'templates'].forEach(function (k) {
      s[k] = Array.isArray(saved && saved[k]) ? saved[k] : JSON.parse(JSON.stringify(base[k] || []));
    });
    if (Array.isArray(s.autoReply.keywords)) {
      s.autoReply.keywords = s.autoReply.keywords.slice();
    } else {
      s.autoReply.keywords = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.autoReply.keywords));
    }
    return s;
  }

  var LLM_PRESETS = [
    { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { name: 'Moonshot / Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    { name: 'OpenAI 兼容', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    { name: '自定义兼容接口', baseUrl: '', model: '' }
  ];

  /* ---------------- utils ---------------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function formatTime(ts) {
    var d = new Date(ts);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function formatDate(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function formatDateTime(ts) {
    var d = new Date(ts);
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function relativeTime(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    return formatDate(ts);
  }
  function toast(message, kind) {
    var host = document.getElementById('toastHost');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 260); }, 2800);
  }
  function downloadJson(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function t(key) {
    var lang = (load().settings && load().settings.language) || 'zh';
    var dict = I18N[lang] || I18N.zh;
    return dict[key] != null ? dict[key] : (I18N.zh[key] != null ? I18N.zh[key] : key);
  }
  function intentLabel(key) {
    var i = INTENTS[key] || INTENTS.other;
    var lang = (load().settings && load().settings.language) || 'zh';
    return lang === 'en' ? (i.en || i.label) : i.label;
  }
  function sentimentLabel(key) {
    var s = SENTIMENTS[key] || SENTIMENTS[3];
    var lang = (load().settings && load().settings.language) || 'zh';
    return lang === 'en' ? s.en : s.label;
  }

  /* 情绪识别：基于词典规则的 5 级情绪（愤怒/不满/中性/满意/赞赏） */
  var SENTI_RULES = {
    1: ['气死', '愤怒', '太离谱', '骗人', '欺诈', '举报', '曝光', '律师', '投诉到底', '垃圾'],
    2: ['投诉', '太差', '没用', '答非所问', '解决不了', '还是不行', '不满意', '什么破', '浪费时间', '催了', '快点', '急'],
    4: ['谢谢', '感谢', '好的', '明白了', '有用', '解决了', '满意'],
    5: ['非常感谢', '太棒了', '点赞', '非常好', '很专业', '五星', '好评']
  };
  function detectSentiment(text) {
    var s = String(text || '');
    var best = 3, bestHits = 0;
    Object.keys(SENTI_RULES).forEach(function (level) {
      var hits = 0;
      SENTI_RULES[level].forEach(function (w) { if (s.indexOf(w) >= 0) hits++; });
      var weight = Number(level) <= 2 ? hits * 2 : hits;
      if (weight > bestHits) { bestHits = weight; best = Number(level); }
    });
    if (/[！!]{2,}|\?\?|[？]{2,}/.test(s) && best === 3) best = 2;
    return { level: best, label: sentimentLabel(best), confidence: clamp(0.5 + bestHits * 0.15, 0.5, 0.95) };
  }

  function audit(action, detail) {
    try {
      var s = load();
      if (!s.auditLog) s.auditLog = [];
      s.auditLog.unshift({ id: uid('log'), ts: Date.now(), action: action, detail: String(detail || '').slice(0, 160) });
      if (s.auditLog.length > 300) s.auditLog.length = 300;
    } catch (e) { /* audit must never break writes */ }
  }

  /* ---------------- PII detection & redaction (第三轮) ----------------
     在任何内容进入日志/云端/大模型之前先识别敏感信息；
     不保证 100% 覆盖（正则的固有局限），但提供可审计、可回放的脱敏记录。 */
  function detectPii(text) {
    var s = String(text || '');
    var cfg = load().settings.privacy || DEFAULT_SETTINGS.privacy;
    var enabledRules = Array.isArray(cfg.rules) ? cfg.rules : DEFAULT_SETTINGS.privacy.rules;
    var found = [];
    PII_RULES.forEach(function (rule) {
      if (enabledRules.indexOf(rule.key) < 0) return;
      var re = new RegExp(rule.pattern.source, rule.pattern.flags);
      var m;
      while ((m = re.exec(s)) !== null) {
        found.push({ key: rule.key, label: rule.label, value: m[0], token: rule.token, index: m.index });
        if (!m[0].length) re.lastIndex++;
      }
    });
    // 长串优先（订单号/银行卡比手机号更长），避免短规则重复覆盖同一段
    found.sort(function (a, b) { return b.value.length - a.value.length; });
    var used = [], out = [];
    found.forEach(function (f) {
      var overlap = used.some(function (r) { return !(f.index + f.value.length <= r.start || f.index >= r.end); });
      if (!overlap) { out.push(f); used.push({ start: f.index, end: f.index + f.value.length }); }
    });
    return out.sort(function (a, b) { return a.index - b.index; });
  }
  function redactPii(text, mode) {
    var cfg = load().settings.privacy || DEFAULT_SETTINGS.privacy;
    if (cfg.enabled === false) return { text: String(text || ''), hits: [], mode: 'off' };
    var m = mode || cfg.mode || 'mask';
    var hits = detectPii(text);
    if (!hits.length) return { text: String(text || ''), hits: [], mode: m };
    var out = String(text || ''), offset = 0;
    hits.forEach(function (h) {
      var replacement = m === 'token' ? h.token : (m === 'alert' ? h.value : maskValue(h.value));
      var start = h.index + offset;
      out = out.slice(0, start) + replacement + out.slice(start + h.value.length);
      offset += replacement.length - h.value.length;
    });
    if (m !== 'alert' && cfg.logRedactions !== false) {
      audit('pii.redact', hits.map(function (h) { return h.label; }).join('/') + ' → ' + m);
    }
    return { text: out, hits: hits, mode: m };
  }

  /* ---------------- QA scorecard (第三轮) ---------------- */
  function scoreConversation(convId) {
    var s = load();
    var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
    if (!c) return null;
    var msgs = c.messages || [];
    var botMsgs = msgs.filter(function (m) { return m.role === 'assistant' && !m.proactive; });
    var userMsgs = msgs.filter(function (m) { return m.role === 'user'; });
    var sourcesCount = botMsgs.filter(function (m) { return m.sources && m.sources.length; }).length;
    var flagged = msgs.some(function (m) { return m.complianceFlags && m.complianceFlags.length; });
    var hasHandoff = c.status === 'waiting_human' || msgs.some(function (m) { return m.handoff; });
    var hasHealth = c.intent === 'health' || userMsgs.some(function (m) { return /诊断|治疗|用药|药方|处方/.test(String(m.content || '')); });
    var healthCovered = !hasHealth || botMsgs.some(function (m) { return /就医|医师|不构成|科普|参考/.test(String(m.content || '')); });
    var negativeMood = (c.mood || 3) <= 2;
    var moodHandled = !negativeMood || hasHandoff || botMsgs.some(function (m) { return /理解|抱歉|抱歉|人工|重视/.test(String(m.content || '')); });
    var ratedGood = c.rating && c.rating.score >= 4;
    var dimScores = {
      grounded: sourcesCount ? (sourcesCount >= botMsgs.length / 2 ? 2 : 1) : 0,
      compliance: (flagged ? 0 : (healthCovered ? 2 : 1)),
      resolution: (hasHandoff ? 1 : (ratedGood || c.status === 'resolved' ? 2 : (botMsgs.length ? 1 : 0))),
      empathy: (moodHandled ? 2 : (negativeMood ? 0 : 1))
    };
    var cfg = s.settings.qa || DEFAULT_SETTINGS.qa;
    var dims = Array.isArray(cfg.dimensions) && cfg.dimensions.length ? cfg.dimensions : DEFAULT_SETTINGS.qa.dimensions;
    var totalW = dims.reduce(function (a, d) { return a + (Number(d.weight) || 0); }, 0) || 100;
    var raw = dims.reduce(function (a, d) { return a + (dimScores[d.key] || 0) * (Number(d.weight) || 0); }, 0) / totalW; // 0..2
    var score = Math.round((1 + raw) * 10) / 10; // 映射到 1..5
    var failedCritical = dims.filter(function (d) { return d.critical && dimScores[d.key] === 0; }).map(function (d) { return d.key; });
    return {
      conversationId: convId, score: clamp(score, 1, 5), dims: dimScores,
      pass: failedCritical.length === 0 && score >= (Number(cfg.passScore) || 3.5),
      failedCritical: failedCritical, at: Date.now()
    };
  }
  function qaStats() {
    var s = load();
    var scored = s.conversations.filter(function (c) { return (c.messages || []).some(function (m) { return m.role === 'assistant'; }); })
      .map(function (c) { return scoreConversation(c.id); }).filter(Boolean);
    var pass = scored.filter(function (r) { return r.pass; }).length;
    var avg = scored.length ? scored.reduce(function (a, r) { return a + r.score; }, 0) / scored.length : 0;
    var failures = {};
    scored.forEach(function (r) {
      r.failedCritical.forEach(function (k) { failures[k] = (failures[k] || 0) + 1; });
    });
    return { total: scored.length, pass: pass, passRate: scored.length ? pass / scored.length : 0,
      avg: avg, failures: failures };
  }

  /* 真实解决率指标（竞品区分 containment/false-resolution 的做法） */
  function trueMetrics() {
    var s = load();
    var convs = s.conversations;
    var n = convs.length;
    var contained = 0, resolvedVerified = 0, repeat = 0, fallback = 0, withMsgs = 0;
    var windowMs = 7 * 86400000;
    convs.forEach(function (c) {
      var msgs = c.messages || [];
      if (!msgs.some(function (m) { return m.role === 'user'; })) return;
      withMsgs++;
      var hasHandoff = c.status === 'waiting_human' || msgs.some(function (m) { return m.handoff; });
      if (!hasHandoff) contained++;
      var hasSource = msgs.some(function (m) { return m.sources && m.sources.length; });
      if ((c.rating && c.rating.score >= 4) || (c.status === 'resolved' && hasSource)) resolvedVerified++;
      var noHit = msgs.some(function (m) { return m.role === 'assistant' && /知识库中暂时没有找到|没有找到与/.test(String(m.content || '')); });
      if (noHit) fallback++;
      var firstUser = msgs.filter(function (m) { return m.role === 'user'; })[0];
      if (firstUser) {
        var q = normalize(firstUser.content).slice(0, 12);
        var earlier = convs.some(function (o) {
          if (o.id === c.id || !o.visitor || o.visitor.id !== (c.visitor || {}).id) return false;
          if (!(o.createdAt < c.createdAt && c.createdAt - o.createdAt <= windowMs)) return false;
          var ou = (o.messages || []).filter(function (m) { return m.role === 'user'; })[0];
          return ou && normalize(ou.content).slice(0, 12) === q;
        });
        if (earlier) repeat++;
      }
    });
    return {
      total: n, withMessages: withMsgs,
      containmentRate: withMsgs ? contained / withMsgs : 0,
      verifiedResolutionRate: withMsgs ? resolvedVerified / withMsgs : 0,
      fallbackRate: withMsgs ? fallback / withMsgs : 0,
      repeatContactRate: withMsgs ? repeat / withMsgs : 0,
      overstatement: withMsgs ? Math.max(0, (contained - resolvedVerified) / withMsgs) : 0
    };
  }

  /* ---------------- state ---------------- */
  function initialState() {
    var t = Date.now();
    return {
      version: 2,
      createdAt: t,
      conversations: [],
      auditLog: [],
      faqs: SEED_FAQS.map(function (f, i) {
        return {
          id: 'faq_' + (i + 1), category: f.category, intent: f.intent,
          question: f.question, answer: f.answer, keywords: f.keywords.slice(),
          hits: 0, enabled: true, updatedAt: t
        };
      }),
      handoffs: [],
      drafts: {},      // 草稿同步：convId -> { text, ts }
      mentions: [],    // @同事提醒：{ id, convId, to, text, ts, read }
      viewLocks: {},   // 碰撞检测：convId -> { agent, ts }
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
    };
  }

  /* 补齐第四轮新增的数据集合（兼容旧版本 state） */
  function ensureCollections(s) {
    if (!s.drafts || typeof s.drafts !== 'object' || Array.isArray(s.drafts)) s.drafts = {};
    if (!Array.isArray(s.mentions)) s.mentions = [];
    if (!s.viewLocks || typeof s.viewLocks !== 'object' || Array.isArray(s.viewLocks)) s.viewLocks = {};
    return s;
  }

  var S = null;

  function load() {
    if (S) return S;
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.conversations) && Array.isArray(parsed.faqs)) {
          S = parsed;
          S.settings = mergeSettings(DEFAULT_SETTINGS, parsed.settings);
          if (!S.settings.language) S.settings.language = 'zh';
          S.handoffs = parsed.handoffs || [];
          S.auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : [];
          ensureCollections(S);
          return S;
        }
      }
    } catch (e) { /* corrupted state -> rebuild */ }
    S = initialState();
    save();
    return S;
  }
  var suppressCloudPush = false;
  function save() {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }
    catch (e) { toast('本地存储空间不足，建议导出数据后清理旧会话', 'warn'); }
    if (!suppressCloudPush && global.TY && global.TY.Cloud) global.TY.Cloud.schedulePush();
    return S;
  }

  var Store = {
    state: load,
    save: save,
    reset: function () { S = initialState(); save(); return S; },
    resetFaqs: function () {
      return Store.mutate(function (s) {
        s.faqs = initialState().faqs;
        return s.faqs;
      });
    },
    importData: function (obj) {
      if (!obj || !Array.isArray(obj.conversations) || !Array.isArray(obj.faqs)) throw new Error('数据格式不正确');
      var prev = load();
      var prevLlmKey = (prev.settings.llm && prev.settings.llm.apiKey) || '';
      var prevCloudKey = (prev.settings.cloud && prev.settings.cloud.key) || '';
      S = obj;
      S.settings = mergeSettings(DEFAULT_SETTINGS, obj.settings);
      if (!S.settings.language) S.settings.language = 'zh';
      if (!S.settings.llm.apiKey) S.settings.llm.apiKey = prevLlmKey;
      if (!S.settings.cloud.key) S.settings.cloud.key = prevCloudKey;
      S.handoffs = obj.handoffs || [];
      S.auditLog = Array.isArray(obj.auditLog) ? obj.auditLog : [];
      ensureCollections(S);
      save(); return S;
    },
    exportData: function () {
      var copy = JSON.parse(JSON.stringify(load()));
      if (copy.settings && copy.settings.llm) copy.settings.llm.apiKey = '';
      if (copy.settings && copy.settings.cloud) copy.settings.cloud.key = '';
      return copy;
    },
    mutate: function (fn) { var s = load(); var r = fn(s); save(); return r; },
    auditLog: function () { return (load().auditLog || []).slice(0, 100); },
    /* ---------- 第二批：多语言 / 坐席 / 快捷回复 / 情绪 / 知识缺口 ---------- */
    setLanguage: function (lang) {
      var l = lang === 'en' ? 'en' : 'zh';
      var r = Store.updateSettings({ language: l });
      audit('settings.language', l);
      return r;
    },
    setA11y: function (patch) {
      return Store.mutate(function (s) {
        s.settings.a11y = Object.assign({}, DEFAULT_SETTINGS.a11y, s.settings.a11y || {}, patch || {});
        return s.settings.a11y;
      });
    },
    saveQa: function (convId) {
      var result = scoreConversation(convId);
      if (!result) return null;
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (c) { c.qa = result; }
        audit('qa.score', convId + ' → ' + result.score + (result.pass ? ' ✓' : ' ✗'));
        return result;
      });
    },
    setQaReview: function (convId, reviewed) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (c && c.qa) { c.qa.reviewed = !!reviewed; c.qa.reviewedAt = Date.now(); }
        return c ? c.qa : null;
      });
    },
    setAssignee: function (convId, agentId) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        c.assignee = agentId || '';
        var a = s.settings.agents.filter(function (x) { return x.id === agentId; })[0];
        audit('conversation.assign', (c.title || '') + ' → ' + (a ? a.name : '未分配'));
        return c;
      });
    },

    /* ---------- 第四轮：统一收件箱 / VIP / 排队 / 协作 ---------- */
    setVip: function (convId, vip) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        c.vip = !!vip;
        audit('conversation.vip', (c.title || '') + (c.vip ? ' → VIP' : ' → 普通'));
        return c;
      });
    },
    /* 会话转接：记录 from→to 历史、写内部备注并审计 */
    transferConversation: function (convId, toAgentId, note) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        var from = s.settings.agents.filter(function (x) { return x.id === c.assignee; })[0];
        var to = s.settings.agents.filter(function (x) { return x.id === toAgentId; })[0];
        if (!to) return c;
        if (!c.transfers) c.transfers = [];
        c.transfers.unshift({ from: c.assignee || '', to: toAgentId, note: note || '', ts: Date.now() });
        c.assignee = toAgentId;
        if (note && String(note).trim()) {
          if (!c.internalNotes) c.internalNotes = [];
          c.internalNotes.unshift({ id: uid('note'), text: '【转接】' + String(note).trim(), ts: Date.now() });
        }
        c.queuedAt = null;
        audit('conversation.transfer', (c.title || '') + ' → ' + to.name);
        return c;
      });
    },
    /* 会话合并：把 sourceIds 的消息/标签/备注并入 targetId，并软删除来源会话 */
    mergeConversations: function (targetId, sourceIds) {
      return Store.mutate(function (s) {
        var target = s.conversations.filter(function (x) { return x.id === targetId; })[0];
        if (!target || !sourceIds || !sourceIds.length) return null;
        var merged = { messages: 0, tags: 0, notes: 0 };
        sourceIds.forEach(function (sid) {
          if (sid === targetId) return;
          var src = s.conversations.filter(function (x) { return x.id === sid; })[0];
          if (!src) return;
          (src.messages || []).forEach(function (m) { m.mergedFrom = sid; target.messages.push(m); merged.messages++; });
          (src.tags || []).forEach(function (tag) { Store._addTagRaw(target, tag) && merged.tags++; });
          (src.internalNotes || []).forEach(function (n) { target.internalNotes.push(n); merged.notes++; });
          if (src.vip) target.vip = true;
          s.conversations = s.conversations.filter(function (x) { return x.id !== sid; });
          s.handoffs = s.handoffs.filter(function (h) { return h.conversationId !== sid; });
        });
        target.messages.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
        target.updatedAt = Date.now();
        if (!target.mergedIds) target.mergedIds = [];
        target.mergedIds = target.mergedIds.concat(sourceIds);
        audit('conversation.merge', '合并 ' + sourceIds.length + ' 个会话 → ' + (target.title || ''));
        return { conversation: target, merged: merged };
      });
    },
    /* 会话拆分：按消息 id 拆分出一条新会话，原会话保留其余消息 */
    splitConversation: function (convId, messageIds) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c || !messageIds || !messageIds.length) return null;
        var picked = (c.messages || []).filter(function (m) { return messageIds.indexOf(m.id) >= 0; });
        if (!picked.length) return null;
        var firstUser = picked.filter(function (m) { return m.role === 'user'; })[0] || picked[0];
        var n = {
          id: uid('conv'), title: ('拆分 · ' + String(firstUser.content || '').slice(0, 14)),
          createdAt: Date.now(), updatedAt: Date.now(), status: 'active',
          intent: c.intent || 'other', messages: picked, rating: null, unresolvedTurns: 0,
          channel: c.channel || 'web', tags: (c.tags || []).slice(), internalNotes: [],
          summary: '', nps: null, firstResponseAt: null, resolvedAt: null, mood: c.mood || 3,
          assignee: c.assignee || '', vip: !!c.vip, queuedAt: null, transfers: [],
          splitFrom: convId, visitor: JSON.parse(JSON.stringify(c.visitor || {}))
        };
        c.messages = (c.messages || []).filter(function (m) { return messageIds.indexOf(m.id) < 0; });
        c.updatedAt = Date.now();
        s.conversations.unshift(n);
        audit('conversation.split', (c.title || '') + ' → 拆分出 ' + picked.length + ' 条消息');
        return n;
      });
    },
    _addTagRaw: function (c, tag) {
      var t = String(tag || '').trim().slice(0, 12);
      if (t && !c.tags) c.tags = [];
      if (t && c.tags.indexOf(t) < 0) { c.tags.push(t); return true; }
      return false;
    },
    /* @同事：写入提及提醒（支持 @姓名 或 @坐席ID） */
    mentionAgent: function (convId, text) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return [];
        var raw = String(text || '');
        var created = [];
        s.settings.agents.forEach(function (a) {
          if (raw.indexOf('@' + a.name) >= 0 || raw.indexOf('@' + a.id) >= 0) {
            var m = { id: uid('mention'), convId: convId, to: a.id, toName: a.name, text: raw, ts: Date.now(), read: false };
            s.mentions.push(m);
            created.push(m);
          }
        });
        if (created.length) audit('conversation.mention', (c.title || '') + ' @ ' + created.map(function (m) { return m.toName; }).join('/'));
        return created;
      });
    },
    unreadMentions: function (agentId) {
      var s = load();
      return (s.mentions || []).filter(function (m) { return !m.read && (!agentId || m.to === agentId); });
    },
    /* 排队位置：等待人工且未分配的会话，按 VIP 优先 + 入队时间排序，返回 1-based 位次 */
    queueInfo: function (convId) {
      var s = load();
      var cfg = s.settings.inbox || DEFAULT_SETTINGS.inbox;
      if (!cfg.queueEnabled) return { enabled: false, position: 0, total: 0 };
      var queue = s.conversations.filter(function (c) {
        return c.status === 'waiting_human' && !c.assignee;
      }).sort(function (a, b) {
        if (!!a.vip !== !!b.vip) return a.vip ? -1 : 1;
        return (a.queuedAt || a.updatedAt || a.createdAt) - (b.queuedAt || b.updatedAt || b.createdAt);
      });
      var idx = queue.map(function (c) { return c.id; }).indexOf(convId);
      return { enabled: true, position: idx >= 0 ? idx + 1 : 0, total: queue.length };
    },
    readMentions: function (agentId) {
      return Store.mutate(function (s) {
        (s.mentions || []).forEach(function (m) { if (!agentId || m.to === agentId) m.read = true; });
        return true;
      });
    },
    /* 碰撞检测：登记正在查看的坐席；若窗口内有其他坐席查看则返回冲突对象 */
    beginView: function (convId, agent) {
      return Store.mutate(function (s) {
        ensureCollections(s);
        var now = Date.now();
        var win = (s.settings.inbox.collisionWindowSec || 60) * 1000;
        var lock = s.viewLocks[convId];
        var collision = null;
        if (lock && lock.agent !== agent && (now - lock.ts) < win) collision = { agent: lock.agent, ago: now - lock.ts };
        s.viewLocks[convId] = { agent: agent, ts: now };
        return collision;
      });
    },
    /* 草稿同步：按 convId 暂存坐席草稿，切换会话不丢失 */
    saveDraft: function (convId, text) {
      return Store.mutate(function (s) {
        ensureCollections(s);
        s.drafts[convId] = { text: String(text || ''), ts: Date.now() };
        return s.drafts[convId];
      });
    },
    getDraft: function (convId) {
      var d = load().drafts || {};
      return d[convId] || null;
    },
    clearDraft: function (convId) {
      return Store.mutate(function (s) {
        ensureCollections(s);
        delete s.drafts[convId];
        return true;
      });
    },
    /* 回复宏：按 steps 顺序执行 tag/canned/note/assign/status 动作 */
    runMacro: function (convId, macroId) {
      var s = load();
      var macro = (s.settings.macros || []).filter(function (m) { return m.id === macroId; })[0];
      if (!macro) return null;
      var applied = [];
      (macro.steps || []).forEach(function (step) {
        if (step.type === 'tag') { Store.addTag(convId, step.value); applied.push('标签: ' + step.value); }
        else if (step.type === 'note') { Store.addInternalNote(convId, step.value); applied.push('内部备注'); }
        else if (step.type === 'assign') { Store.setAssignee(convId, step.value); applied.push('分配坐席'); }
        else if (step.type === 'canned') {
          var cc = (load().settings.canned || []).filter(function (x) { return x.id === step.value; })[0];
          if (cc) { Store.saveDraft(convId, cc.text); applied.push('草稿: ' + cc.title); }
        } else if (step.type === 'status') {
          Store.updateConversation(convId, step.value === 'resolved' ? { status: 'resolved', resolvedAt: Date.now() } : { status: step.value });
          applied.push('状态: ' + step.value);
        }
      });
      audit('macro.run', (macro.title || macroId) + ' @ ' + convId);
      return { title: macro.title, applied: applied };
    },
    /* 回复模板：替换 {{visitor}} {{intent}} {{agent}} {{date}} {{order}} 变量 */
    renderTemplate: function (templateId, convId) {
      var s = load();
      var tp = (s.settings.templates || []).filter(function (x) { return x.id === templateId; })[0];
      if (!tp) return '';
      var c = s.conversations.filter(function (x) { return x.id === convId; })[0] || {};
      var agent = (s.settings.agents || []).filter(function (x) { return x.id === c.assignee; })[0];
      var firstUser = (c.messages || []).filter(function (m) { return m.role === 'user'; })[0];
      var order = (String((firstUser || {}).content || '').match(/\d{10,16}/) || [])[0] || '';
      return String(tp.text)
        .replace(/\{\{visitor\}\}/g, (c.visitor && c.visitor.id) || '用户')
        .replace(/\{\{intent\}\}/g, intentLabel(c.intent || 'other'))
        .replace(/\{\{agent\}\}/g, agent ? agent.name : '人工客服')
        .replace(/\{\{date\}\}/g, formatDate(Date.now()))
        .replace(/\{\{order\}\}/g, order || '（订单号待补充）');
    },
    /* 批量会话操作：assign / tag / resolve / vip / delete */
    batchOperation: function (ids, action, value) {
      return Store.mutate(function (s) {
        if (!Array.isArray(ids) || !ids.length) return { count: 0 };
        var count = 0;
        ids.forEach(function (id) {
          var c = s.conversations.filter(function (x) { return x.id === id; })[0];
          if (!c) return;
          if (action === 'assign') c.assignee = value || '';
          else if (action === 'tag') Store._addTagRaw(c, value);
          else if (action === 'resolve') { c.status = 'resolved'; c.resolvedAt = Date.now(); }
          else if (action === 'vip') c.vip = !!value;
          else if (action === 'delete') { s.conversations = s.conversations.filter(function (x) { return x.id !== id; }); s.handoffs = s.handoffs.filter(function (h) { return h.conversationId !== id; }); }
          count++;
        });
        audit('conversation.batch', action + ' × ' + count);
        return { count: count };
      });
    },
    autoAssign: function (intentKey) {
      return Store.mutate(function (s) {
        var agents = s.settings.agents || [];
        if (!agents.length) return null;
        var skilled = agents.filter(function (a) { return (a.skills || []).indexOf(intentKey) >= 0; });
        var pool = skilled.length ? skilled : agents;
        var counts = {};
        s.conversations.forEach(function (c) { if (c.assignee) counts[c.assignee] = (counts[c.assignee] || 0) + 1; });
        var pick = pool.slice().sort(function (a, b) { return (counts[a.id] || 0) - (counts[b.id] || 0); })[0];
        return pick || null;
      });
    },
    upsertCanned: function (item) {
      return Store.mutate(function (s) {
        s.settings.canned = Array.isArray(s.settings.canned) ? s.settings.canned : [];
        if (item.id) {
          var c = s.settings.canned.filter(function (x) { return x.id === item.id; })[0];
          if (c) { Object.assign(c, item); audit('canned.update', c.title); return c; }
        }
        var n = Object.assign({ id: uid('canned') }, item);
        s.settings.canned.push(n); audit('canned.create', n.title); return n;
      });
    },
    deleteCanned: function (id) {
      return Store.mutate(function (s) {
        s.settings.canned = (s.settings.canned || []).filter(function (x) { return x.id !== id; });
        audit('canned.delete', id); return true;
      });
    },
    upsertAgent: function (item) {
      return Store.mutate(function (s) {
        s.settings.agents = Array.isArray(s.settings.agents) ? s.settings.agents : [];
        if (item.id) {
          var a = s.settings.agents.filter(function (x) { return x.id === item.id; })[0];
          if (a) { Object.assign(a, item); audit('agent.update', a.name); return a; }
        }
        var n = Object.assign({ id: uid('agent'), skills: [] }, item);
        s.settings.agents.push(n); audit('agent.create', n.name); return n;
      });
    },
    deleteAgent: function (id) {
      return Store.mutate(function (s) {
        s.settings.agents = (s.settings.agents || []).filter(function (x) { return x.id !== id; });
        s.conversations.forEach(function (c) { if (c.assignee === id) c.assignee = ''; });
        audit('agent.delete', id); return true;
      });
    },
    setMood: function (convId, level) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        c.mood = clamp(Number(level) || 3, 1, 5);
        return c;
      });
    },
    knowledgeGaps: function () {
      var s = load();
      var map = {};
      s.conversations.forEach(function (c) {
        var unsolved = c.status === 'waiting_human' || (c.unresolvedTurns || 0) > 0 ||
          (c.messages || []).some(function (m) { return m.handoff && /知识库|未命中|无法覆盖/.test(m.handoff); });
        if (!unsolved) return;
        var u = (c.messages || []).filter(function (m) { return m.role === 'user'; })[0];
        if (!u) return;
        var q = String(u.content || '').trim().slice(0, 60);
        if (!q) return;
        var hit = false;
        (c.messages || []).forEach(function (m) { if (m.sources && m.sources.length) hit = true; });
        if (hit) return;
        if (!map[q]) map[q] = { question: q, count: 0, intent: c.intent || 'other', lastAt: 0 };
        map[q].count++; map[q].lastAt = Math.max(map[q].lastAt, c.updatedAt || c.createdAt);
      });
      return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.count - a.count; });
    },
    staleFaqs: function (days) {
      var s = load();
      var limit = (days || 90) * 86400000;
      var now = Date.now();
      return s.faqs.filter(function (f) {
        return (f.enabled !== false) && ((f.hits || 0) === 0 || (now - (f.updatedAt || f.createdAt || now)) > limit);
      }).map(function (f) {
        return { id: f.id, question: f.question, hits: f.hits || 0,
          ageDays: Math.floor((now - (f.updatedAt || f.createdAt || now)) / 86400000),
          reason: (f.hits || 0) === 0 ? '零命中' : '超过 90 天未更新' };
      });
    },
    newConversation: function (firstText, meta) {
      return Store.mutate(function (s) {
        var c = {
          id: uid('conv'), title: (firstText || '新的咨询').slice(0, 20),
          createdAt: Date.now(), updatedAt: Date.now(),
          status: 'active', intent: 'other', messages: [],
          rating: null, unresolvedTurns: 0, channel: 'web',
          tags: [], internalNotes: [], summary: '', nps: null,
          firstResponseAt: null, resolvedAt: null, mood: 3, assignee: '',
          vip: false, queuedAt: null, transfers: [], closedSummary: '',
          visitor: Object.assign({ id: 'anon', ua: '', lang: '', ref: '', firstSeen: Date.now() }, meta || {})
        };
        s.conversations.unshift(c);
        audit('conversation.create', c.title);
        return c;
      });
    },
    getConversation: function (id) {
      return load().conversations.filter(function (c) { return c.id === id; })[0] || null;
    },
    addMessage: function (convId, msg) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        var m = Object.assign({ id: uid('msg'), ts: Date.now() }, msg);
        c.messages.push(m);
        c.updatedAt = Date.now();
        if (msg.role === 'user' && c.messages.filter(function (x) { return x.role === 'user'; }).length === 1) {
          c.title = String(msg.content || '新的咨询').slice(0, 20);
        }
        return m;
      });
    },
    updateMessage: function (convId, msgId, patch) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        var m = c.messages.filter(function (x) { return x.id === msgId; })[0];
        if (m) Object.assign(m, patch);
        return m;
      });
    },
    updateConversation: function (id, patch) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === id; })[0];
        if (c) { Object.assign(c, patch); c.updatedAt = Date.now(); }
        return c;
      });
    },
    deleteConversation: function (id) {
      return Store.mutate(function (s) {
        s.conversations = s.conversations.filter(function (c) { return c.id !== id; });
        s.handoffs = s.handoffs.filter(function (h) { return h.conversationId !== id; });
        return true;
      });
    },
    setRating: function (convId, score, comment, nps) {
      var num = nps == null || nps === '' ? null : clamp(Number(nps), 0, 10);
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        c.rating = { score: score, comment: comment || '', ts: Date.now() };
        if (num != null) c.nps = num;
        return c;
      });
    },
    addTag: function (convId, tag) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        var t = String(tag || '').trim().slice(0, 12);
        if (t && !c.tags) c.tags = [];
        if (t && c.tags.indexOf(t) < 0) c.tags.push(t);
        return c.tags;
      });
    },
    removeTag: function (convId, tag) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        c.tags = (c.tags || []).filter(function (t) { return t !== tag; });
        return c.tags;
      });
    },
    addInternalNote: function (convId, text) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c || !String(text || '').trim()) return null;
        if (!c.internalNotes) c.internalNotes = [];
        var n = { id: uid('note'), text: String(text).trim(), ts: Date.now() };
        c.internalNotes.unshift(n);
        return n;
      });
    },
    summarize: function (convId) {
      return Store.mutate(function (s) {
        var c = s.conversations.filter(function (x) { return x.id === convId; })[0];
        if (!c) return null;
        var firstUser = (c.messages || []).filter(function (m) { return m.role === 'user'; })[0];
        var lastBot = (c.messages || []).filter(function (m) { return m.role === 'assistant'; }).slice(-1)[0];
        var label = (INTENTS[c.intent] || INTENTS.other).label;
        var parts = [];
        if (firstUser) parts.push('用户咨询：' + String(firstUser.content).slice(0, 40));
        parts.push('识别意图：' + label);
        if (lastBot) parts.push('最新答复：' + String(lastBot.content).replace(/\[\[HANDOFF\]\]/g, '').replace(/\s+/g, ' ').slice(0, 56));
        parts.push('消息数：' + (c.messages || []).length);
        c.summary = parts.join('；');
        return c.summary;
      });
    },
    slaStatus: function (conv) {
      var cfg = load().settings.sla || DEFAULT_SETTINGS.sla;
      if (!cfg.enabled || !conv) return { label: '—', level: 'none' };
      var fr = conv.firstResponseAt;
      if (!fr) {
        var u = (conv.messages || []).filter(function (m) { return m.role === 'user'; })[0];
        var a = (conv.messages || []).filter(function (m) { return m.role === 'assistant'; })[0];
        if (u && a) fr = a.ts;
      }
      var frLimit = (cfg.firstResponseMinutes || 5) * 60000;
      var overdueFr = fr && u ? (fr - u.ts) > frLimit : false;
      var end = conv.resolvedAt || (conv.status === 'resolved' ? conv.updatedAt : Date.now());
      var overResolve = (end - conv.createdAt) > (cfg.resolutionHours || 24) * 3600000 && conv.status !== 'resolved';
      if (overdueFr || overResolve) return { label: 'SLA 超时', level: 'danger' };
      if (conv.status === 'waiting_human') return { label: '待人工', level: 'warn' };
      return { label: 'SLA 正常', level: 'ok' };
    },
    addHandoff: function (convId, reason, intent) {
      return Store.mutate(function (s) {
        var pending = s.handoffs.filter(function (h) { return h.conversationId === convId && h.status === 'pending'; })[0];
        if (pending) return pending;
        var h = {
          id: uid('hd'), conversationId: convId, reason: reason, intent: intent || 'other',
          status: 'pending', createdAt: Date.now(), resolvedAt: null, note: ''
        };
        s.handoffs.unshift(h);
        var conv = s.conversations.filter(function (c) { return c.id === convId; })[0];
        if (conv) { conv.status = 'waiting_human'; conv.queuedAt = Date.now(); }
        return h;
      });
    },
    resolveHandoff: function (id, note) {
      return Store.mutate(function (s) {
        var h = s.handoffs.filter(function (x) { return x.id === id; })[0];
        if (h) { h.status = 'resolved'; h.resolvedAt = Date.now(); h.note = note || ''; }
        var conv = h && s.conversations.filter(function (c) { return c.id === h.conversationId; })[0];
        if (conv) conv.status = 'resolved';
        return h;
      });
    },
    upsertFaq: function (faq) {
      return Store.mutate(function (s) {
        if (faq.id) {
          var f = s.faqs.filter(function (x) { return x.id === faq.id; })[0];
          if (f) { Object.assign(f, faq, { updatedAt: Date.now() }); return f; }
        }
        var n = Object.assign({ id: uid('faq'), hits: 0, enabled: true, updatedAt: Date.now(), keywords: [] }, faq);
        s.faqs.push(n); return n;
      });
    },
    deleteFaq: function (id) {
      return Store.mutate(function (s) { s.faqs = s.faqs.filter(function (f) { return f.id !== id; }); return true; });
    },
    bumpFaqHits: function (ids) {
      if (!ids || !ids.length) return;
      Store.mutate(function (s) {
        ids.forEach(function (id) {
          var f = s.faqs.filter(function (x) { return x.id === id; })[0];
          if (f) f.hits = (f.hits || 0) + 1;
        });
      });
    },
    updateSettings: function (patch) {
      return Store.mutate(function (s) { Object.assign(s.settings, patch); return s.settings; });
    },
    updateLlm: function (patch) {
      return Store.mutate(function (s) { Object.assign(s.settings.llm, patch); return s.settings.llm; });
    },
    stats: function () {
      var s = load();
      var convs = s.conversations;
      var ratings = convs.filter(function (c) { return c.rating; });
      var avg = ratings.length ? ratings.reduce(function (a, c) { return a + c.rating.score; }, 0) / ratings.length : 0;
      var satisfied = ratings.filter(function (c) { return c.rating.score >= 4; }).length;
      var intentCount = {};
      var statusCount = { active: 0, waiting_human: 0, resolved: 0 };
      var msgCount = 0;
      convs.forEach(function (c) {
        intentCount[c.intent || 'other'] = (intentCount[c.intent || 'other'] || 0) + 1;
        statusCount[c.status] = (statusCount[c.status] || 0) + 1;
        msgCount += (c.messages || []).length;
      });
      var dist = [0, 0, 0, 0, 0];
      ratings.forEach(function (c) { dist[c.rating.score - 1]++; });
      var trend = [];
      for (var i = 6; i >= 0; i--) {
        var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
        var start = d.getTime(), end = start + 86400000;
        var dayConvs = convs.filter(function (c) { return c.createdAt >= start && c.createdAt < end; });
        var dayRatings = dayConvs.filter(function (c) { return c.rating; });
        trend.push({
          date: formatDate(start),
          label: pad(d.getMonth() + 1) + '/' + pad(d.getDate()),
          conversations: dayConvs.length,
          avg: dayRatings.length ? dayRatings.reduce(function (a, c) { return a + c.rating.score; }, 0) / dayRatings.length : 0
        });
      }
      var pending = s.handoffs.filter(function (h) { return h.status === 'pending'; }).length;
      var frTimes = [], resolvedTimes = [], npsScores = [], flagged = 0;
      var tagCounts = {};
      convs.forEach(function (c) {
        var firstUser = (c.messages || []).filter(function (m) { return m.role === 'user'; })[0];
        var firstBot = (c.messages || []).filter(function (m) { return m.role === 'assistant'; })[0];
        if (firstUser && firstBot) frTimes.push(Math.max(0, firstBot.ts - firstUser.ts));
        if (c.status === 'resolved' && c.resolvedAt) resolvedTimes.push(Math.max(0, c.resolvedAt - c.createdAt));
        if (typeof c.nps === 'number') npsScores.push(c.nps);
        if ((c.messages || []).some(function (m) { return m.complianceFlags && m.complianceFlags.length; })) flagged++;
        (c.tags || []).forEach(function (t) { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      });
      return {
        totalConversations: convs.length,
        totalMessages: msgCount,
        totalFaqs: s.faqs.filter(function (f) { return f.enabled; }).length,
        avgRating: avg,
        ratingCount: ratings.length,
        satisfactionRate: ratings.length ? satisfied / ratings.length : 0,
        dist: dist,
        intentCount: intentCount,
        statusCount: statusCount,
        pendingHandoffs: pending,
        totalHandoffs: s.handoffs.length,
        handoffRate: convs.length ? s.handoffs.length / convs.length : 0,
        resolvedRate: convs.length ? (statusCount.resolved / convs.length) : 0,
        topFaqs: s.faqs.slice().sort(function (a, b) { return (b.hits || 0) - (a.hits || 0); }).slice(0, 5),
        trend: trend,
        avgFirstResponseMs: frTimes.length ? frTimes.reduce(function (a, b) { return a + b; }, 0) / frTimes.length : 0,
        avgResolutionMs: resolvedTimes.length ? resolvedTimes.reduce(function (a, b) { return a + b; }, 0) / resolvedTimes.length : 0,
        avgNps: npsScores.length ? npsScores.reduce(function (a, b) { return a + b; }, 0) / npsScores.length : null,
        npsCount: npsScores.length,
        complianceFlags: flagged,
        tagCounts: tagCounts,
        moodCounts: (function () {
          var m = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          convs.forEach(function (c) { if (c.mood) m[c.mood] = (m[c.mood] || 0) + 1; });
          return m;
        })(),
        assigneeCounts: (function () {
          var map = {}, agents = s.settings.agents || [];
          agents.forEach(function (a) { map[a.id] = { name: a.name, count: 0 }; });
          convs.forEach(function (c) { if (c.assignee && map[c.assignee]) map[c.assignee].count++; });
          return map;
        })(),
        gaps: Store.knowledgeGaps().length,
        trueMetrics: trueMetrics(),
        qa: qaStats(),
        inbox: {
          vipCount: convs.filter(function (c) { return c.vip; }).length,
          queuedCount: convs.filter(function (c) { return c.status === 'waiting_human' && !c.assignee; }).length,
          unreadMentions: Store.unreadMentions().length,
          drafts: Object.keys(s.drafts || {}).length
        }
      };
    }
  };

  /* ---------------- intent engine ---------------- */
  var INTENT_RULES = {
    human: { strong: ['转人工', '人工客服', '真人', '找客服', '人工服务', '要投诉', '投诉'], weak: ['人工', '客服'] },
    refund: { strong: ['退款', '退费', '退钱', '申请退', '退货', '退还', '无理由'], weak: ['退回', '到账', '驳回', '扣款'] },
    order: { strong: ['订单', '查单', '订单号', '下单', '支付', '发票', '优惠券', '物流', '发货'], weak: ['买了', '购买', '付款', '价格', '多少钱'] },
    tech: { strong: ['报错', '打不开', '闪退', '登录不了', '验证码', '白屏', '加载中', 'bug', '故障', '导出不了', '不同步', '崩溃'], weak: ['密码', '缓存', '浏览器', '账号', '同步', '卡顿'] },
    health: { strong: ['诊断', '治疗', '药方', '处方', '吃什么药', '能不能治', '看病', '疗效', '医师'], weak: ['调理', '体质', '养生', '症状', '不舒服'] },
    product: { strong: ['课程', '会员', '报告', '预约', '证书', '权益', '有效期', '数理天医', '体质分析'], weak: ['是什么', '介绍', '怎么学', '内容'] }
  };

  function normalize(text) {
    return String(text || '').toLowerCase().replace(/[\s\u3000]/g, '')
      .replace(/[，。！？、；：""''（）()【】\[\].,!?;:~～\-—_/\\]/g, '');
  }

  function detectIntent(text) {
    var raw = String(text || '');
    var n = normalize(raw);
    var scores = {};
    var signals = {};
    Object.keys(INTENT_RULES).forEach(function (key) {
      var s = 0; var hit = [];
      INTENT_RULES[key].strong.forEach(function (w) { if (n.indexOf(normalize(w)) >= 0) { s += 3; hit.push(w); } });
      INTENT_RULES[key].weak.forEach(function (w) { if (n.indexOf(normalize(w)) >= 0) { s += 1; hit.push(w); } });
      scores[key] = s; signals[key] = hit;
    });
    if (/\d{10,}/.test(raw)) { scores.order += 3; signals.order.push('订单号'); }
    if (/退款|退货|退费/.test(raw) && /订单|课程|报告/.test(raw)) scores.refund += 1;
    var best = 'other', bestScore = 0;
    Object.keys(scores).forEach(function (k) { if (scores[k] > bestScore) { bestScore = scores[k]; best = k; } });
    if (bestScore === 0) return { key: 'other', label: INTENTS.other.label, confidence: 0.2, signals: [], scores: scores };
    var confidence = clamp(0.42 + bestScore * 0.13, 0.42, 0.97);
    return { key: best, label: INTENTS[best].label, confidence: confidence, signals: signals[best], scores: scores };
  }

  /* ---------------- FAQ retrieval ---------------- */
  function grams(text, n) {
    var s = normalize(text), out = [], seen = {};
    for (var i = 0; i <= s.length - n; i++) {
      var g = s.slice(i, i + n);
      if (!seen[g]) { seen[g] = 1; out.push(g); }
    }
    return out;
  }

  function retrieveFaq(query, intentKey, limit) {
    var s = load();
    var pool = s.faqs.filter(function (f) { return f.enabled !== false; });
    var qn = normalize(query);
    var q2 = grams(query, 2);
    var q3 = grams(query, 3);
    var results = pool.map(function (f) {
      var hay = normalize(f.question + ' ' + f.answer + ' ' + (f.keywords || []).join(' ') + ' ' + f.category);
      var matched2 = q2.filter(function (g) { return hay.indexOf(g) >= 0; }).length;
      var matched3 = q3.filter(function (g) { return hay.indexOf(g) >= 0; }).length;
      var ratio2 = q2.length ? matched2 / q2.length : 0;
      var ratio3 = q3.length ? matched3 / q3.length : 0;
      var kwBonus = 0;
      (f.keywords || []).forEach(function (k) {
        var kn = normalize(k);
        if (!kn) return;
        if (qn.indexOf(kn) >= 0) kwBonus += 2.4;
        else if (kn.length >= 2 && hay.indexOf(kn) >= 0 && qn.length >= 2 && kn.indexOf(qn) >= 0) kwBonus += 1.2;
      });
      var exact = normalize(f.question) === qn ? 4 : 0;
      var intentBonus = (intentKey && f.intent === intentKey) ? 0.9 : 0;
      var score = ratio2 * 5 + ratio3 * 2 + kwBonus + exact + intentBonus;
      return { faq: f, score: Math.round(score * 100) / 100, ratio: ratio2 };
    });
    results.sort(function (a, b) { return b.score - a.score; });
    var threshold = s.settings.faqThreshold || 2.2;
    var top = results.slice(0, limit || 3);
    return {
      hits: top.filter(function (r) { return r.score >= threshold; }),
      top: top,
      bestScore: results.length ? results[0].score : 0,
      confident: results.length > 0 && results[0].score >= Math.max(threshold, 4)
    };
  }

  /* 机器人模拟测试（竞品 Simulations 的本地轻量版）：
     输入一句话，完整回放意图识别→知识库检索→回答→情绪→合规→转人工决策链，
     可在上线前验证 FAQ 与规则改动，避免直接改坏线上机器人。 */
  function simulate(text) {
    var raw = String(text || '');
    if (!raw.trim()) return null;
    var intent = detectIntent(raw);
    var retrieval = retrieveFaq(raw, intent.key, 3);
    var answer = buildFallbackAnswer(raw, retrieval, intent);
    var mood = detectSentiment(raw);
    var complianceFlags = scanCompliance(answer);
    var handoff = /\[\[HANDOFF\]\]/.test(answer) || intent.key === 'human' || mood.level <= 2;
    var reason = intent.key === 'human' ? '用户主动要求人工'
      : (mood.level <= 2 ? '检测到负面情绪，需优先人工跟进'
      : (handoff ? '知识库未能充分覆盖' : ''));
    return {
      text: raw, intent: intent.key, intentLabel: intentLabel(intent.key), confidence: intent.confidence,
      signals: intent.signals, mood: mood.level, moodLabel: mood.label,
      hits: retrieval.hits.map(function (h) { return { question: h.faq.question, score: h.score, id: h.faq.id }; }),
      bestScore: retrieval.bestScore, confident: retrieval.confident,
      answer: answer.replace(/\[\[HANDOFF\]\]/g, '').trim(), complianceFlags: complianceFlags,
      handoff: handoff, reason: reason,
      verdict: handoff ? '转人工' : (retrieval.confident ? '可自动解答' : '需复核')
    };
  }

  /* 第四轮：关键词自动回复 —— 命中配置关键词时直接返回预设答案（优先级高于 FAQ/LLM） */
  function matchAutoReply(text) {
    var cfg = load().settings.autoReply || DEFAULT_SETTINGS.autoReply;
    if (!cfg.enabled) return null;
    var raw = normalize(text);
    var hit = null;
    (cfg.keywords || []).forEach(function (rule) {
      if (hit || rule.enabled === false) return;
      (rule.keys || []).forEach(function (k) {
        if (!hit && raw.indexOf(normalize(k)) >= 0) hit = rule;
      });
    });
    return hit ? { answer: hit.answer, id: hit.id } : null;
  }
  /* 第四轮：服务时间判断 + 离线自动回复（非服务时间且转人工时提示） */
  function inServiceHours(now) {
    var cfg = load().settings.inbox || DEFAULT_SETTINGS.inbox;
    var range = String(cfg.serviceHours || '09:00-21:00').split('-');
    var d = now ? new Date(now) : new Date();
    var mins = d.getHours() * 60 + d.getMinutes();
    function toMin(s) { var p = String(s).trim().split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }
    var start = toMin(range[0]), end = toMin(range[1]);
    return start <= end ? (mins >= start && mins < end) : (mins >= start || mins < end);
  }
  function offlineReplyText() {
    var cfg = load().settings.autoReply || DEFAULT_SETTINGS.autoReply;
    return cfg.offlineText || DEFAULT_SETTINGS.autoReply.offlineText;
  }

  /* ---------------- LLM (optional, OpenAI-compatible) ---------------- */
  function llmReady() {
    var l = load().settings.llm;
    return !!(l && l.enabled && l.baseUrl && l.model && l.apiKey);
  }

  function llmStream(messages, onDelta, signal) {
    var l = load().settings.llm;
    if (!llmReady()) return Promise.reject(new Error('LLM_NOT_CONFIGURED'));
    var url = l.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + l.apiKey },
      body: JSON.stringify({ model: l.model, messages: messages, stream: true, temperature: 0.6 }),
      signal: signal
    }).then(function (resp) {
      if (!resp.ok) {
        return resp.text().then(function (t) {
          throw new Error('模型接口返回 ' + resp.status + '：' + t.slice(0, 180));
        });
      }
      if (!resp.body) throw new Error('当前浏览器不支持流式响应');
      var reader = resp.body.getReader();
      var decoder = new TextDecoder('utf-8');
      var buffer = '', full = '';
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return full;
          buffer += decoder.decode(res.value, { stream: true });
          var lines = buffer.split(/\r?\n/);
          buffer = lines.pop();
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line || line.indexOf('data:') !== 0) continue;
            var data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              var obj = JSON.parse(data);
              var delta = obj.choices && obj.choices[0] && obj.choices[0].delta;
              var piece = delta && delta.content ? delta.content : '';
              if (piece) { full += piece; if (onDelta) onDelta(piece, full); }
            } catch (e) { /* ignore keep-alive frames */ }
          }
          return pump();
        });
      }
      return pump();
    });
  }

  function classifyWithLlm(text) {
    if (!llmReady()) return Promise.resolve(null);
    var sys = '你是意图分类器。把用户消息归入且仅归入以下之一：refund(退款/退费)、order(查询订单/支付/发票)、tech(技术支持/故障)、product(产品与课程咨询)、health(健康医疗相关)、human(明确要求人工)、other(其他)。只返回 JSON：{"intent":"...","confidence":0.0}。';
    var out = '';
    return llmStream([
      { role: 'system', content: sys },
      { role: 'user', content: String(text).slice(0, 500) }
    ], function (piece) { out += piece; }).then(function () {
      var m = out.match(/\{[\s\S]*\}/);
      if (!m) return null;
      var obj = JSON.parse(m[0]);
      if (!INTENTS[obj.intent]) return null;
      return { key: obj.intent, label: INTENTS[obj.intent].label, confidence: clamp(Number(obj.confidence) || 0.7, 0, 1), source: 'llm' };
    }).catch(function () { return null; });
  }

  function buildSystemPrompt(context) {
    var faqText = (context.hits || []).map(function (h, i) {
      return '[' + (i + 1) + '] Q: ' + h.faq.question + '\nA: ' + h.faq.answer;
    }).join('\n\n');
    return [
      '你是「数理天医」平台的智能客服「天医小助手」，服务范围是：订单与支付、退款售后、课程与会员、体质报告、技术支持、账号问题。',
      '回答要求：用简体中文，语气温和专业，分点简洁（一般不超过 180 字）；只依据下面提供的知识库与平台规则作答，不编造订单状态、金额、时效或承诺。',
      '严禁提供医疗诊断、辨证处方、用药建议或疗效承诺；涉及个体健康问题时说明平台内容仅为健康科普与生活方式参考，建议咨询正规医疗机构的执业医师。',
      '如果知识库无法覆盖、需要查询具体订单数据、用户表达不满或要求人工，请在回答末尾单独输出标记 [[HANDOFF]]，并简要说明将为其转接人工。不要在其他情况下输出该标记。',
      '本次识别的用户意图：' + (context.intentLabel || '其他咨询') + '。',
      '知识库检索结果：\n' + (faqText || '（无匹配条目）')
    ].join('\n');
  }

  function scanCompliance(text) {
    var cfg = load().settings.compliance || DEFAULT_SETTINGS.compliance;
    if (!cfg.enabled) return [];
    var s = String(text || '');
    return (cfg.terms || []).filter(function (t) { return t && s.indexOf(t) >= 0; });
  }

  function buildFallbackAnswer(query, retrieval, intent) {
    var hits = retrieval.hits;
    if (!hits.length) {
      return '抱歉，知识库中暂时没有找到与「' + escapeHtml(String(query).slice(0, 30)) + '」匹配的资料。为避免给出不准确的信息，我为您转接人工客服，请稍候。\n\n[[HANDOFF]]';
    }
    var main = hits[0].faq;
    var parts = ['根据知识库，为您找到以下解答：', '', '**' + main.question + '**', main.answer];
    var related = hits.slice(1, 3).map(function (h) { return '· ' + h.faq.question; });
    if (related.length) parts.push('', '您可能还想了解：', related.join('\n'));
    if (intent && intent.key === 'health') {
      parts.push('', '温馨提示：以上内容属于健康科普与生活方式参考，不构成医疗诊断或治疗建议；如有身体不适，请及时前往正规医疗机构就诊。');
    }
    if (!retrieval.confident) {
      parts.push('', '如果以上没有解决您的问题，可以回复「转人工」，我会为您生成工单。');
    }
    return parts.join('\n');
  }

  /* ---------------- Cloud sync (optional Supabase REST) ---------------- */
  var PUSH_TIMER = null;
  var POLL_TIMER = null;
  var cloudBusy = { push: false, pull: false };

  var CLOUD_SQL = [
    '-- 在 Supabase 控制台 SQL Editor 执行一次即可',
    'create table if not exists public.tianyi_state (',
    '  id text primary key,',
    '  data jsonb not null,',
    '  updated_at timestamptz not null default now()',
    ');',
    'alter table public.tianyi_state enable row level security;',
    'drop policy if exists "tianyi anon all" on public.tianyi_state;',
    'create policy "tianyi anon all" on public.tianyi_state',
    '  for all to anon using (true) with check (true);'
  ].join('\n');

  function emit(name, detail) {
    try { global.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch (e) {}
  }
  function cloudConfig() {
    var s = load();
    return Object.assign({}, DEFAULT_SETTINGS.cloud, (s.settings && s.settings.cloud) || {});
  }
  function cloudReady() {
    var c = cloudConfig();
    return !!(c.enabled && c.url && c.key);
  }
  function cloudHeaders(c) {
    return {
      'apikey': c.key,
      'Authorization': 'Bearer ' + c.key,
      'Content-Type': 'application/json'
    };
  }
  function cloudBase(c) { return String(c.url).replace(/\/+$/, ''); }
  function cloudId(c) { return 'tianyi_state_v1__' + (c.space || 'default'); }
  function cloudPayload() {
    var copy = JSON.parse(JSON.stringify(load()));
    if (copy.settings && copy.settings.llm) copy.settings.llm.apiKey = '';
    if (copy.settings && copy.settings.cloud) copy.settings.cloud.key = '';
    copy.updatedAt = Date.now();
    return copy;
  }
  function markCloud(patch) {
    suppressCloudPush = true;
    Store.mutate(function (s) {
      Object.assign(s.settings.cloud, patch);
      return s.settings.cloud;
    });
    suppressCloudPush = false;
  }
  function applyRemote(remote) {
    var local = load();
    var llmKey = (local.settings.llm && local.settings.llm.apiKey) || '';
    var cloudKey = (local.settings.cloud && local.settings.cloud.key) || '';
    S = Object.assign({}, local, remote);
    /* 以本地设置为基准叠加远端，远端缺失的新字段由 mergeSettings 用默认值补齐 */
    S.settings = mergeSettings(local.settings, remote.settings);
    /* 云同步时敏感配置以本地为准，避免覆盖本机密钥与网关地址 */
    S.settings.cloud = Object.assign({}, local.settings.cloud, (remote.settings && remote.settings.cloud) || {});
    S.settings.llm.apiKey = llmKey;
    S.settings.cloud.key = cloudKey;
    S.handoffs = Array.isArray(remote.handoffs) ? remote.handoffs : (local.handoffs || []);
    S.drafts = (remote.drafts && typeof remote.drafts === 'object') ? remote.drafts : (local.drafts || {});
    S.mentions = Array.isArray(remote.mentions) ? remote.mentions : (local.mentions || []);
    S.viewLocks = (remote.viewLocks && typeof remote.viewLocks === 'object') ? remote.viewLocks : (local.viewLocks || {});
    ensureCollections(S);
    suppressCloudPush = true; save(); suppressCloudPush = false;
    emit('tianyi:cloud-sync', { source: 'pull', at: Date.now() });
  }

  Cloud = {
    SQL: CLOUD_SQL,
    config: cloudConfig,
    ready: cloudReady,
    status: function () {
      var c = cloudConfig();
      return {
        ready: cloudReady(),
        provider: c.provider || 'supabase',
        space: c.space || 'default',
        auto: c.auto !== false,
        lastPushAt: Number(c.lastPushAt || 0),
        lastPullAt: Number(c.lastPullAt || 0),
        text: !c.enabled ? '未启用' : (!c.url || !c.key ? '配置不完整' : (c.auto === false ? '已启用（手动同步）' : '已启用 · 自动同步'))
      };
    },
    schedulePush: function () {
      if (!cloudReady() || cloudConfig().auto === false) return;
      clearTimeout(PUSH_TIMER);
      PUSH_TIMER = setTimeout(function () { Cloud.push().catch(function () {}); }, 1500);
    },
    push: function () {
      if (!cloudReady()) return Promise.reject(new Error('云端同步未启用或配置不完整'));
      if (cloudBusy.push) return Promise.resolve(false);
      cloudBusy.push = true;
      var c = cloudConfig();
      var payload = cloudPayload();
      var body = { id: cloudId(c), data: payload, updated_at: new Date().toISOString() };
      return fetch(cloudBase(c) + '/rest/v1/tianyi_state', {
        method: 'POST',
        headers: Object.assign({}, cloudHeaders(c), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(body)
      }).then(function (resp) {
        cloudBusy.push = false;
        if (!resp.ok) {
          return resp.text().then(function (t) { throw new Error('云端写入失败（' + resp.status + '）：' + t.slice(0, 160)); });
        }
        markCloud({ lastPushAt: Date.now(), lastAppliedAt: payload.updatedAt });
        emit('tianyi:cloud-sync', { source: 'push', at: Date.now() });
        return true;
      }).catch(function (err) {
        cloudBusy.push = false;
        throw err;
      });
    },
    pull: function () {
      if (!cloudReady()) return Promise.reject(new Error('云端同步未启用或配置不完整'));
      if (cloudBusy.pull) return Promise.resolve(false);
      cloudBusy.pull = true;
      var c = cloudConfig();
      var url = cloudBase(c) + '/rest/v1/tianyi_state?id=eq.' + encodeURIComponent(cloudId(c)) + '&select=data,updated_at';
      return fetch(url, { headers: cloudHeaders(c) }).then(function (resp) {
        if (!resp.ok) {
          return resp.text().then(function (t) { throw new Error('云端读取失败（' + resp.status + '）：' + t.slice(0, 160)); });
        }
        return resp.json();
      }).then(function (rows) {
        cloudBusy.pull = false;
        markCloud({ lastPullAt: Date.now() });
        if (!Array.isArray(rows) || !rows.length || !rows[0].data) return false;
        var remote = rows[0].data;
        if (!Array.isArray(remote.conversations) || !Array.isArray(remote.faqs)) return false;
        var rt = Number(remote.updatedAt || 0);
        var applied = Number(cloudConfig().lastAppliedAt || 0);
        if (rt && rt <= applied) return false;
        markCloud({ lastAppliedAt: rt });
        applyRemote(remote);
        return true;
      }).catch(function (err) {
        cloudBusy.pull = false;
        throw err;
      });
    },
    test: function () { return Cloud.push().then(function () { return Cloud.pull(); }); },
    start: function () {
      clearInterval(POLL_TIMER);
      if (!cloudReady()) return;
      var sec = Math.max(10, Number(cloudConfig().interval) || 20);
      POLL_TIMER = setInterval(function () { Cloud.pull().catch(function () {}); }, sec * 1000);
      Cloud.pull().catch(function () {});
    },
    stop: function () { clearInterval(POLL_TIMER); clearTimeout(PUSH_TIMER); POLL_TIMER = null; PUSH_TIMER = null; }
  };

  global.TY = {
    STORAGE_KEY: STORAGE_KEY,
    INTENTS: INTENTS,
    FAQ_CATEGORIES: FAQ_CATEGORIES,
    LLM_PRESETS: LLM_PRESETS,
    Store: Store,
    Cloud: Cloud,
    Engine: {
      detectIntent: detectIntent,
      retrieveFaq: retrieveFaq,
      llmReady: llmReady,
      llmStream: llmStream,
      classifyWithLlm: classifyWithLlm,
      buildSystemPrompt: buildSystemPrompt,
      buildFallbackAnswer: buildFallbackAnswer,
      scanCompliance: scanCompliance,
      simulate: simulate,
      detectSentiment: detectSentiment,
      detectPii: detectPii,
      redactPii: redactPii,
      scoreConversation: scoreConversation,
      qaStats: qaStats,
      trueMetrics: trueMetrics,
      matchAutoReply: matchAutoReply,
      inServiceHours: inServiceHours,
      offlineReplyText: offlineReplyText
    },
    I18N: I18N,
    SENTIMENTS: SENTIMENTS,
    PII_RULES: PII_RULES,
    QA_DIMENSIONS: QA_DIMENSIONS,
    t: t,
    intentLabel: intentLabel,
    sentimentLabel: sentimentLabel,
    utils: {
      uid: uid, escapeHtml: escapeHtml, pad: pad, formatTime: formatTime,
      formatDate: formatDate, formatDateTime: formatDateTime, relativeTime: relativeTime,
      toast: toast, downloadJson: downloadJson, clamp: clamp
    }
  };

  Cloud.start();
})(window);
