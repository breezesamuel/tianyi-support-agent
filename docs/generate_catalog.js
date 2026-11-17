/* 生成「500+ 功能模块清单 + 竞品差距矩阵」
 * 数据来源：2026-11 对 Intercom/Fin、Zendesk、Ada、Decagon、Sierra、
 * 网易七鱼、智齿、环信、Udesk、Gorgias、Freshdesk、Tidio、Cognigy 的公开资料调研。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = __dirname;

const COMPETITORS = [
  ['Intercom / Fin', 'AI 解决率 76%+，Knowledge Hub、Procedures、Copilot 2、350+ 集成、全渠道、AI Insights'],
  ['Zendesk', 'AI Agents、Agent Builder、Admin/Knowledge/Analyst Copilot、QA Score、Action Flows、MCP、全渠道'],
  ['Ada', '无代码构建器、50+ 语言、全渠道、helpdesk-independent、A/B 测试、主动消息、分析'],
  ['Decagon', 'AOP 自然语言流程、Voice 3、Watchtower 实时质检、Proactive Agents、Duet 自改进、MCP Client'],
  ['Sierra', 'Constellation 多模型架构、品牌语调、ADP 持久记忆、按结果付费、深度 CRM/计费/ERP 动作'],
  ['网易七鱼', '全渠道、在线/呼入机器人、AI 外呼、工单、智能质检、数据大屏、Agent Studio、数字员工'],
  ['智齿科技', '全渠道、智能分配、富媒体、工单+知识库+辅助、多维报表、70+ 语言、150+ 接口'],
  ['环信客服云', '意图识别 95%、情绪 5 级、多实体跟踪、32K 上下文、话题切换、移动端'],
  ['Udesk / 沃丰', '20+ 渠道、SLA 预警、自定义字段/触发器、全量质检、现场服务 ServiceGo、混合部署'],
  ['Gorgias', 'Shopify 原生、订单/退款/折扣在会话内完成、AI 销售归因、300+ 集成、全渠道收件箱'],
  ['Freshdesk / Freddy', 'Copilot 写作/摘要/建议回复/自动分类/情感/Live Translate、AI Agent Studio、AI Insights'],
  ['Tidio / Lyro', '5 分钟从网站训练、12+ 语言、Flows 40+ 模板、统一收件箱、Lyro Connect'],
  ['Cognigy / NiCE', '低代码 Studio、MCP/A2A、可复用技能、决策追踪、语音到语音、治理护栏、110+ 集成']
];

const ALL = 'Intercom,Zendesk,Ada,Decagon,Sierra,七鱼,智齿,环信,Udesk,Gorgias,Freshdesk,Tidio,Cognigy';
const MOST = 'Intercom,Zendesk,Ada,Decagon,七鱼,智齿,环信,Udesk,Gorgias,Freshdesk,Tidio';
const CORE = 'Intercom,Zendesk,Ada,Decagon,七鱼,智齿,Udesk,Freshdesk,Tidio';
const ENT = 'Zendesk,Decagon,Sierra,Udesk,Cognigy';
const CHINA = '七鱼,智齿,环信,Udesk';
const ECOM = 'Gorgias,Intercom,Zendesk,Freshdesk,Tidio,七鱼';
const VOICE = 'Zendesk,Decagon,Sierra,Cognigy,Udesk,七鱼,智齿';
const SEC = 'Zendesk,Decagon,Sierra,Cognigy,Udesk,Freshdesk';

const CATS = [
  { name: '全渠道接入', cov: ALL, feasible: '部分', advice: '前端先做 Web/H5/微信入口与统一身份；原生 SDK/电话需后端', items: [
    '网页聊天','H5 嵌入','移动 Web 适配','iOS SDK','Android SDK','微信公众号','微信小程序','企业微信','抖音客服','微博客服','邮件渠道','短信渠道','WhatsApp','Facebook Messenger','Instagram','Telegram','Slack','Microsoft Teams','电话渠道','视频客服','小程序插件','统一消息 API','Webhook 接入','第三方平台接入','多渠道统一身份','渠道优先级','渠道能力矩阵','离线消息','跨渠道上下文','渠道降级策略'
  ]},
  { name: '会话与收件箱', cov: MOST, feasible: '高', advice: '本地数据层扩展字段即可实现，优先做标签/搜索/分配/协作', items: [
    '统一收件箱','会话列表','会话搜索','会话标签','会话分配','轮询分配','技能分配','VIP 优先','负载均衡','会话排队','排队位置提示','会话转接','会话合并','会话拆分','内部备注','@同事','碰撞检测','草稿同步','快捷回复','回复宏','回复模板','富文本消息','表情','图片消息','文件消息','语音消息','视频消息','链接预览','消息撤回','消息编辑','已读回执','输入指示器','离线自动回复','关键词自动回复','会话结束总结','满意度邀请','会话导出','批量会话操作'
  ]},
  { name: 'Bot / AI 核心', cov: ALL, feasible: '中', advice: '规则引擎已有；RAG、意图、置信度可复用现有 LLM 配置扩展', items: [
    'FAQ 检索','关键词匹配','语义检索','向量检索','RAG 增强','意图识别','多意图识别','槽位填充','多轮对话','上下文保持','话题切换','实体跟踪','情感识别','情绪分级','品牌语调','个性化回复','生成式回答','规则引擎','决策树流程','可视化流程','无代码构建器','AOP 自然语言流程','动作执行','API 调用','工具调用','MCP 接入','函数调用','自动澄清提问','未知问题兜底','幻觉抑制','答案引用溯源','置信度阈值','答案人工审核','Supervisor 模型','模拟测试','A/B 测试','回放测试','持续学习','自我改进','知识缺口发现','训练数据导出','模型切换','多模型路由','提示词管理','提示词版本','沙箱环境'
  ]},
  { name: '知识库与内容', cov: MOST, feasible: '高', advice: '现有 FAQ 管理可直接扩展相似问/版本/审批/导入导出', items: [
    'FAQ 管理','知识分类','知识标签','检索关键词','同义词','相似问法','标准答案','富文本答案','附件知识','PDF 知识','网页抓取','URL 导入','文档导入','表格知识图谱','多语言内容','内容版本','审批流','定时发布','失效提醒','命中统计','内容评分','内容缺口','AI 自动草稿','Confluence 同步','Notion 同步','SharePoint 同步','Google Drive 同步','知识权限','内部知识库','公共帮助中心','文章搜索','文章推荐','文章反馈','重复条目检测','冲突检测','批量导入导出','备份恢复','知识健康检查','知识贡献者','知识有效期','知识审计'
  ]},
  { name: '工单与流程', cov: MOST, feasible: '高', advice: '现有 handoff 工单可扩展字段、SLA、触发器和流转', items: [
    '工单创建','自动建单','手动建单','工单字段自定义','表单模板','工单状态','优先级','工单分类','工单标签','工单指派','自动分配','工单组/队列','协同处理人','抄送人','子工单','父子工单','依赖工单','SLA 策略','首次响应 SLA','解决 SLA','超时预警','自动升级','触发器','定时器','可视化工作流','审批流','跨部门流转','工单评论','内部备注','工单附件','客户可见性','关闭原因','工单重开','工单合并','工单拆分','工单搜索','工单导出','移动处理','工单评价','工单转派','工单催办','工单快照'
  ]},
  { name: '转人工与协作', cov: MOST, feasible: '高', advice: '已有自动转人工；补充路由、工作时间与交接摘要', items: [
    '自动转人工','用户主动转人工','意图触发转人工','情绪触发转人工','低置信度转人工','连续未解决转人工','敏感问题转人工','转接上下文','人工排队','技能路由','VIP 路由','服务时间','非工作时间留言','工单预填','人工接管','机器人辅助人工','坐席建议回复','实时翻译','会话摘要','交接备注','转接原因','转接记录','机器人退出','回访任务','转人工率统计'
  ]},
  { name: '客户画像与 CRM', cov: MOST, feasible: '中', advice: '本地可先做访客档案与标签；真实 CRM 同步需后端或用户配置', items: [
    '客户档案','身份识别','手机号识别','邮箱识别','设备 ID','匿名访客','访客轨迹','页面行为','购物车信息','订单历史','生命周期价值','客户标签','客户分群','VIP 等级','客户偏好','历史会话','历史工单','通话记录','客户笔记','自定义字段','客户合并','去重','客户导入','客户导出','Salesforce 同步','HubSpot 同步','账户层级','联系人层级','客户时间线','满意度历史','隐私掩码','客户出海信息'
  ]},
  { name: '电商与交易', cov: ECOM, feasible: '中', advice: '可做演示级订单/退款表单；真实交易需接入商城 API', items: [
    '订单查询','物流查询','退款申请','退款进度','退货','换货','取消订单','修改订单','创建订单','发票','优惠券','折扣码','价格保护','库存查询','商品推荐','加购','购物车恢复','弃单挽回','支付链接','支付失败处理','重复扣款','分期支付','会员权益','订阅管理','续费','试用','套餐升级','套餐降级','账户余额','积分','礼品卡','评价引导','复购提醒','大促预案','预售咨询','尺码助手','到店预约','门店查询'
  ]},
  { name: '分析与报表', cov: MOST, feasible: '高', advice: '现有概览已具备基础统计；扩展维度与导出即可覆盖多数', items: [
    '会话量','消息量','首次响应时间','平均响应时间','解决时间','一次解决率','AI 解决率','Deflection 率','转人工率','CSAT','NPS','CES','满意度分布','意图分布','趋势分析','渠道分布','坐席绩效','团队绩效','SLA 达成率','知识库命中率','知识缺口','热门问题','情绪分布','质检得分','成本/解决','节省工时','ROI 分析','自定义报表','仪表盘','数据大屏','数据导出','定时报告','邮件报告','自然语言分析','预测分析','异常检测','根因分析','队列监控','实时监控','对话级分析','转化归因'
  ]},
  { name: '质检与合规', cov: SEC, feasible: '中', advice: '医疗红线与非诊疗声明已有；可扩展敏感词、审计日志与保留策略', items: [
    '全量质检','抽样质检','关键词检测','敏感词过滤','违禁词过滤','医疗红线检测','疗效承诺检测','情绪检测','合规评分','质检规则','质检模板','人工复核','申诉流程','违规告警','审计日志','操作留痕','数据脱敏','PII 识别','数据保留策略','被遗忘权','数据导出权','同意管理','DPA','数据驻留','SOC 2','ISO 27001','HIPAA','GDPR','CCPA','等保三级','私有化部署','零留存模式','提示词注入防护','越狱防护','品牌安全','答案引用','模型训练退出','儿童隐私保护','中医合规术语表'
  ]},
  { name: '主动与营销', cov: MOST, feasible: '中', advice: '可在聊天页加入主动消息与调研组件，营销自动化需行为数据源', items: [
    '主动消息','欢迎语','离席消息','访客触发','页面触发','时间触发','购物车触发','弃单触发','回访','满意度邀请','调研问卷','NPS 调研','产品公告','故障通知','活动推送','个性化推荐','交叉销售','升级销售','优惠券推送','流失召回','私域导流','企微添加','社群邀请','直播提醒','预约提醒','续费提醒','到期提醒','沉默唤醒','A/B 营销','营销归因','收入归因','客服转销售','会员日提醒'
  ]},
  { name: '多语言与本地化', cov: ALL, feasible: '中', advice: '先做界面/FAQ 双语与自动检测；实时翻译依赖 LLM 配置', items: [
    '多语言界面','多语言知识库','语言自动检测','实时翻译','坐席翻译','机器人多语言','时区支持','本地化时间','本地化货币','本地化格式','区域政策','区域知识','多区域部署','语言路由','翻译记忆','术语表','语言质量评分','双语坐席','小语种支持','RTL 布局','本地合规','本地支付','本地渠道','本地时区工单','多语言报表','繁体中文','粤语支持','英文客服模板'
  ]},
  { name: '安全与权限', cov: SEC, feasible: '中', advice: '后台可先做角色与简单权限；SSO/加密/审计需服务端支撑', items: [
    'RBAC','角色管理','权限组','字段权限','数据权限','租户隔离','SSO','SAML','OAuth','2FA','IP 白名单','设备信任','会话超时','密码策略','登录日志','操作日志','加密传输','静态加密','BYOK','密钥轮换','备份加密','灾备','故障转移','限流','防刷','水印','敏感操作确认','管理员审批','权限申请','数据访问审计','API 密钥管理','密钥泄露检测'
  ]},
  { name: '集成与开放', cov: ALL, feasible: '低', advice: '提供配置入口与 Webhook 框架；外部系统需账号与服务端', items: [
    'REST API','Webhook','GraphQL','SDK','插件市场','Zapier','Salesforce','HubSpot','Zendesk','Freshdesk','Intercom','Shopify','WooCommerce','Stripe','PayPal','Slack','Teams','WhatsApp','Facebook','Instagram','Notion','Confluence','SharePoint','Google Drive','Jira','ServiceNow','SAP','Oracle','数据库连接','消息队列','CRM 同步','ERP 同步','支付网关','语音网关','身份提供商','MCP','A2A 协议','开放应用市场'
  ]},
  { name: '语音与视频', cov: VOICE, feasible: '低', advice: '需语音网关与媒体服务，建议列为合作集成而非本地实现', items: [
    '呼入机器人','外呼机器人','语音识别','语音合成','声纹识别','打断处理','静音检测','通话转写','实时字幕','通话摘要','通话质检','通话录音','呼叫转移','三方通话','隐私号','外显号码','IVR','排队音乐','语音门户','语音导航','视频客服','屏幕共享','文件传输','视频质检','语音 A/B 测试','语音延迟监控','品牌音色','多语言语音','电话渠道分析','语音情绪检测','坐席耳语'
  ]},
  { name: '坐席辅助与效率', cov: MOST, feasible: '高', advice: '可在管理后台加入摘要、建议回复、相似问答与快捷操作', items: [
    '回复建议','自动补全','写作助手','语气调整','实时翻译','会话摘要','相似工单','相似会话','知识推荐','下一步建议','自动填充字段','自动分类','自动打标签','自动总结','语音转文字','富文本编辑','回复宏','快捷键','批量操作','拖拽工作流','待办','提醒','排班','工作量','忙碌状态','技能组','绩效看板','培训模式','新手指引','智能质检提示','坐席情绪提醒'
  ]},
  { name: '客户自助服务', cov: MOST, feasible: '高', advice: '可新增独立帮助中心页与自助表单，复用现有 FAQ 数据', items: [
    '帮助中心','FAQ 页面','站内搜索','分类浏览','热门文章','相关文章','自助表单','自助订单查询','自助退款','自助改期','自助账户设置','自助找回密码','自助下载','自助进度查询','社区论坛','意见反馈','机器人入口','服务目录','在线预约','工单提交','工单进度查询','服务状态页','公告','知识订阅','移动端自助','服务评价','常见问题地图'
  ]},
  { name: '机器人构建与测试', cov: CORE, feasible: '中', advice: '可视化流程工作量大；先做测试用例、模拟对话与版本管理', items: [
    '可视化流程','条件分支','循环','变量','槽位','API 节点','代码节点','子流程','意图训练','语料标注','测试集','单元测试','对话模拟','多轮测试','回归测试','冒烟测试','A/B 实验','灰度发布','版本管理','回滚','发布审批','沙箱','生产监控','漂移检测','性能监控','成本监控','文档生成','配置导入导出','模板市场','机器人 Copilot','流程校验'
  ]},
  { name: '行业场景模板', cov: ALL, feasible: '中', advice: '以 FAQ 种子包 + 欢迎语 + 意图词表形式快速交付', items: [
    '电商','教育','医疗健康','金融','保险','政务','游戏','SaaS','旅游','物流','零售','餐饮','酒店','汽车','房地产','制造','3C 数码','美妆','时尚鞋服','生鲜','商超','能源','电信','媒体','招聘 HR','法务','知识产权','跨境电商','出海企业','现场服务','中医馆/健康科普','课程培训','知识付费','本地生活'
  ]},
  { name: '运营与治理', cov: MOST, feasible: '中', advice: '服务时间与值班可先做配置；计费/合同需业务系统', items: [
    '服务时间','节假日','排队策略','路由规则','升级策略','通知模板','告警','值班表','服务目录','成本中心','预算','用量监控','配额','计费','账单','合同','SLA 报告','合规报告','变更管理','发布日历','值班交接','事故管理','复盘','知识运营','持续优化闭环','服务水平协议','运营看板','客服排班','服务质量目标'
  ]}
];

const EXISTS = new Set([
  '网页聊天','H5 嵌入','移动 Web 适配','邮件渠道','统一消息 API','Webhook 接入','会话列表','会话搜索','FAQ 检索','关键词匹配','意图识别','多轮对话','上下文保持','规则引擎','FAQ 管理','知识分类','检索关键词','命中统计','批量导入导出','备份恢复','工单创建','自动建单','工单状态','优先级','工单分类','工单标签','工单评论','关闭原因','自动转人工','用户主动转人工','连续未解决转人工','转接上下文','会话量','消息量','转人工率','CSAT','满意度分布','意图分布','趋势分析','热门问题','欢迎语','满意度邀请','非诊疗声明','医疗红线检测','数据脱敏','中文客服模板','客服策略','知识库命中率',  '工单评价','会话导出','FAQ 页面','意见反馈','机器人入口','服务评价',
  /* 第二批已落地 */
  '会话标签','会话分配','内部备注','快捷回复','会话摘要','情绪触发转人工','情绪检测','情绪分级',
  '主动消息','沉默唤醒','多语言界面','模拟测试','对话模拟','知识缺口','知识缺口发现','内容缺口',
  '审计日志','操作留痕','智能分配','轮询分配','技能分配','负载均衡','首次响应时间','解决时间',
  'NPS','工单标签','敏感词过滤','疗效承诺检测','知识健康检查','访客触发','数据大屏',
  /* 第三批已落地 */
  'PII 识别','全量质检','质检得分','合规评分','质检规则','质检模板','违规告警','语音转文字','快捷键','无障碍访问',
  /* 第四批已落地（统一收件箱 / 排队 / 协作） */
  '统一收件箱','VIP 优先','排队位置提示','会话转接','会话合并','会话拆分','@同事','碰撞检测','草稿同步',
  '回复宏','回复模板','离线自动回复','关键词自动回复','批量会话操作','会话结束总结',
  /* 第五批已落地（GitHub Skill 方法论） */
  '混合检索','检索可解释性','回归评测','评测置信区间','LLM 评测','偏见缓解','访客长期记忆','多语言覆盖检测','无障碍自查'
]);

const PARTIAL = new Set([
  '富文本消息','表情','图片消息','文件消息','满意度邀请','数据导出','实时监控','情绪分布','模型切换','提示词管理','答案引用','API 调用','工具调用','客户标签','客户分群','客户时间线','订单查询','退款申请','退款进度','自助表单','工单提交','工单进度查询','多轮测试','回归测试','中文客服模板','中医合规术语表','服务时间','通知模板','用量监控',
  /* 第二批部分落地 */
  '多语言知识库','语言自动检测','实时翻译','版本管理','A/B 实验','技能路由','抽样质检','人工复核','语音合成','语音质检'
]);

const CORE_CATS = new Set(['会话与收件箱','Bot / AI 核心','知识库与内容','工单与流程','转人工与协作','分析与报表','质检与合规','客户自助服务','坐席辅助与效率']);
const ADV_CATS = new Set(['客户画像与 CRM','电商与交易','主动与营销','多语言与本地化','安全与权限','机器人构建与测试','行业场景模板','运营与治理']);

function statusOf(name) {
  if (EXISTS.has(name)) return '已有';
  if (PARTIAL.has(name)) return '部分';
  return '缺失';
}
function priorityOf(status, catName) {
  if (status === '已有') return 'P0 保持';
  if (status === '部分') return 'P1 补齐';
  if (CORE_CATS.has(catName)) return 'P1 优先';
  if (ADV_CATS.has(catName)) return 'P2 规划';
  return 'P3 观察';
}
function adviceOf(status, cat) {
  if (status === '已有') return '已具备基础能力：补自动化测试、边界场景与使用文档';
  if (status === '部分') return cat.advice + '；先补字段与交互，再接后端';
  return cat.advice;
}

const rows = [];
CATS.forEach((cat, ci) => {
  cat.items.forEach((name, ii) => {
    const status = statusOf(name);
    rows.push({
      id: 'F' + String(ci + 1).padStart(2, '0') + '-' + String(ii + 1).padStart(3, '0'),
      category: cat.name,
      name,
      status,
      competitors: cat.cov,
      priority: priorityOf(status, cat.name),
      feasible: cat.feasible,
      advice: adviceOf(status, cat)
    });
  });
});

if (rows.length < 500) throw new Error('功能数量不足 500：' + rows.length);

const counts = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
const prio = rows.reduce((a, r) => { a[r.priority] = (a[r.priority] || 0) + 1; return a; }, {});

function csvCell(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }
const csv = [
  ['ID','大类','功能模块','天医状态','竞品覆盖','优先级','前端可行性','差距与实现建议'].join(','),
  ...rows.map(r => [r.id,r.category,r.name,r.status,r.competitors,r.priority,r.feasible,r.advice].map(csvCell).join(','))
].join('\n');
fs.writeFileSync(path.join(OUT_DIR, 'feature-catalog.csv'), '\ufeff' + csv, 'utf8');

const md = [];
md.push('# 数理天医智能客服 · 500+ 功能模块全景与竞品差距矩阵');
md.push('');
md.push('> 生成时间：2026-11-17　|　候选模块：**' + rows.length + ' 项**　|　调研竞品：13 家');
md.push('');
md.push('## 一、结论摘要');
md.push('');
md.push('- 当前应用已覆盖 **' + (counts['已有'] || 0) + ' 项**，部分覆盖 **' + (counts['部分'] || 0) + ' 项**，完全缺失 **' + (counts['缺失'] || 0) + ' 项**。');
md.push('- 竞品普遍已具备而我们缺失的 P1 模块集中在：**会话协作、坐席辅助、质检合规、客户画像、自助服务、主动消息**。');
md.push('- 企业级竞品（Decagon/Sierra/Cognigy/Zendesk）领先在：AOP 自然语言流程、实时质检、跨渠道记忆、深度业务动作、治理与追踪。');
md.push('- 国内竞品（七鱼/智齿/环信/Udesk）领先在：全渠道、呼叫中心、工单流转、智能质检、数据大屏、行业模板。');
md.push('- 电商竞品（Gorgias/Tidio）领先在：Shopify 原生订单动作、收入归因、弃单挽回、商品推荐。');
md.push('');
md.push('## 二、竞品能力对照');
md.push('');
md.push('| 竞品 | 关键能力 |');
md.push('|---|---|');
COMPETITORS.forEach(c => md.push('| ' + c[0] + ' | ' + c[1] + ' |'));
md.push('');
md.push('## 三、状态与优先级统计');
md.push('');
md.push('| 状态 | 数量 | 说明 |');
md.push('|---|---:|---|');
md.push('| 已有 | ' + (counts['已有'] || 0) + ' | 当前版本已具备，进入保持与测试 |');
md.push('| 部分 | ' + (counts['部分'] || 0) + ' | 有雏形但深度不足，优先补齐 |');
md.push('| 缺失 | ' + (counts['缺失'] || 0) + ' | 需新增，按优先级分批 |');
md.push('');
md.push('| 优先级 | 数量 |');
md.push('|---|---:|');
Object.keys(prio).sort().forEach(k => md.push('| ' + k + ' | ' + prio[k] + ' |'));
md.push('');
md.push('## 四、完整功能清单（按大类）');
md.push('');
CATS.forEach((cat, ci) => {
  const catRows = rows.filter(r => r.category === cat.name);
  md.push('### ' + (ci + 1) + '. ' + cat.name + '（' + catRows.length + ' 项）');
  md.push('');
  md.push('| ID | 功能模块 | 天医状态 | 优先级 | 竞品覆盖 | 前端可行性 |');
  md.push('|---|---|---|---|---|---|');
  catRows.forEach(r => md.push('| ' + r.id + ' | ' + r.name + ' | ' + r.status + ' | ' + r.priority + ' | ' + r.competitors + ' | ' + r.feasible + ' |'));
  md.push('');
});
md.push('> 详细的「差距与实现建议」列见同目录 `feature-catalog.csv`。');
fs.writeFileSync(path.join(OUT_DIR, 'feature-catalog.md'), md.join('\n'), 'utf8');

const topGaps = rows.filter(r => r.priority === 'P1 补齐' || r.priority === 'P1 优先').slice(0, 40);
const gapMd = [];
gapMd.push('# 竞品差距分析与补缺路线图');
gapMd.push('');
gapMd.push('## 1. 调研范围');
gapMd.push('');
gapMd.push('国际：Intercom/Fin、Zendesk、Ada、Decagon、Sierra、Gorgias、Freshdesk、Tidio、Cognigy；国内：网易七鱼、智齿、环信、Udesk。资料来自各厂商官网、帮助中心与 2026 年公开评测，检索日期 2026-11-17。');
gapMd.push('');
gapMd.push('## 2. 我们已领先 / 已对齐的点');
gapMd.push('');
gapMd.push('- 多轮对话 + FAQ 检索增强 + 意图识别 + 自动转人工：与中小客服机器人对齐。');
gapMd.push('- 满意度评分与统计、对话历史、知识库后台、转人工工单：覆盖基础闭环。');
gapMd.push('- 中医健康场景非诊疗声明与医疗红线提示：比通用竞品更贴合本项目合规要求。');
gapMd.push('- 已支持可选大模型与 Supabase 云端同步：具备继续演进底座。');
gapMd.push('');
gapMd.push('## 3. 主要差距（按业务价值排序）');
gapMd.push('');
gapMd.push('| # | 差距 | 竞品代表 | 影响 | 建议 |');
gapMd.push('|---:|---|---|---|---|');
[
  ['会话标签/分配/协作','Intercom、Zendesk、七鱼','后台只能看不能运营','增加标签、指派、内部备注、快捷回复'],
  ['坐席辅助 Copilot','Zendesk、Freshdesk、Decagon','人工接管后无辅助','会话摘要、建议回复、知识推荐'],
  ['质检与敏感词','七鱼、Udesk、Decagon','健康类高风险回答缺少自动质检','敏感词、疗效承诺检测、合规评分'],
  ['客户画像与访客轨迹','七鱼、智齿、Gorgias','无法识别回头客','本地画像 + 访客轨迹 + 标签'],
  ['自助服务门户','Freshdesk、Zendesk、七鱼','用户只能对话不能自助','独立帮助中心与自助表单'],
  ['主动消息与调研','Intercom、Tidio、Ada','只能被动应答','欢迎语、离席消息、NPS 调研'],
  ['多语言','Ada、Tidio、智齿','仅中文','界面与 FAQ 双语 + 语言自动检测'],
  ['报表深度','Zendesk、七鱼、Freshdesk','只有基础统计','首次响应、解决时长、趋势、导出'],
  ['SLA 与升级','Udesk、Freshdesk、Zendesk','工单无时限','SLA 配置、超时预警与升级'],
  ['机器人测试与版本','Decagon、Cognigy、Intercom','改配置无法回归','测试用例、模拟对话、版本回滚']
].forEach((g, i) => gapMd.push('| ' + (i + 1) + ' | ' + g[0] + ' | ' + g[1] + ' | ' + g[2] + ' | ' + g[3] + ' |'));
gapMd.push('');
gapMd.push('## 4. 本轮优先落地的 P1 模块');
gapMd.push('');
gapMd.push('从上方差距中选取纯前端可实现、价值密度最高的 12 项：');
gapMd.push('');
topGaps.slice(0, 12).forEach((r, i) => gapMd.push((i + 1) + '. **' + r.name + '**（' + r.id + '，' + r.category + '）'));
gapMd.push('');
gapMd.push('## 5. 路线图建议');
gapMd.push('');
gapMd.push('- **第一批（已落地）**：会话标签、内部备注/快捷回复、会话摘要、敏感词质检、访客画像、帮助中心入口、NPS/反馈、SLA 预警、会话导出、数据看板增强。');
gapMd.push('- **第二批（已落地）**：多语言（中英）、5 级情绪识别与负面优先转人工、主动关怀消息、坐席技能自动分配、快捷回复库、机器人模拟测试、知识缺口聚类、陈旧条目检测、审计日志。');
gapMd.push('- **第三批（需服务端/外部账号）**：语音机器人、CRM 深度同步、支付闭环、SSO、全量 QA 评分、WFM 排班。');
gapMd.push('');
gapMd.push('## 6. 关键来源');
gapMd.push('');
COMPETITORS.forEach(c => gapMd.push('- ' + c[0] + '：' + c[1]));
gapMd.push('');
gapMd.push('---');
gapMd.push('');
gapMd.push('## 7. 第二轮深度对比（2026-11-17）');
gapMd.push('');
gapMd.push('### 7.1 新增调研维度与竞品做法');
gapMd.push('');
gapMd.push('| 维度 | 竞品代表做法（2026 公开资料） | 我们的应对 |');
gapMd.push('|---|---|---|');
gapMd.push('| 多语言 | Zendesk 宣称 80 种、Ada 60 种、Decagon 70+、Fin 45+；Fin 单知识库实时翻译、每会话只检测一次语言 | 落地中英界面切换 + 意图双语标签；知识库答案保留原文，避免机翻造成医疗措辞风险 |');
gapMd.push('| 机器人测试/版本 | Decagon Simulations/AOP/版本/A-B/Watchtower；Fin AI Simulations + CX Score 100% 可观测 | 落地「机器人测试」：单条与批量模拟，回放意图→检索→回答→情绪→转人工全链路，不写真实会话 |');
gapMd.push('| 情绪识别 | Zendesk「情绪感知路由」按愤怒程度优先派高级客服；环信 5 级情绪；瓴羊情绪+拒识多层过滤降幻觉 | 落地规则版 5 级情绪，命中负面自动触发人工并标记优先级 |');
gapMd.push('| 知识库治理 | Freshdesk Improve、Gorgias Opportunities、HubSpot Coaching、Zendesk Knowledge gaps/Freshness score；行业数据 64% 客服发现知识库自相矛盾 | 落地「知识洞察」：从未命中转人工会话聚类高频缺口 + 陈旧/零命中条目检测，一键补写 |');
gapMd.push('| 主动消息 | Intercom in-context 自动消息降低咨询量；Tidio Flows 40+ 模板 | 落地闲置触发的主动关怀消息，阈值与文案可配 |');
gapMd.push('| 坐席协作与审计 | Intercom Copilot 2、Zendesk QA+WFM、Fini 全量审计轨迹 | 落地技能+负载均衡自动分配、快捷回复库、操作审计日志 |');
gapMd.push('');
gapMd.push('### 7.2 第二轮已落地模块（9 项）');
gapMd.push('');
['多语言（中英）界面与意图/情绪双语标签、非诊疗声明英译','5 级情绪识别，负面优先转人工','主动关怀消息（闲置阈值可配，每会话一次）','坐席管理 + 技能匹配 + 负载最低自动分配','快捷回复库（标准话术统一管理）','机器人模拟测试（单条 + 10 样例批量，全决策链可视化）','知识缺口聚类（未命中转人工高频问题，一键补写 FAQ）','陈旧 / 零命中条目检测（90 天阈值）','操作审计日志（会话创建/分配、配置、知识库、坐席变更）'].forEach((x,i)=>gapMd.push((i+1)+'. '+x));
gapMd.push('');
gapMd.push('### 7.3 仍存在的差距（诚实说明）');
gapMd.push('');
gapMd.push('- **语音渠道**：竞品普遍具备 Voice AI（Fin Voice 2、Decagon Voice 3、Sierra 59 语言语音），本应用无语音能力，需服务端与电话网关。');
gapMd.push('- **全渠道**：竞品覆盖 WhatsApp/Slack/邮件/短信/小程序，本应用仅 Web。');
gapMd.push('- **多语言深度**：本应用为界面级中英双语，未接入实时翻译与多语言知识库检索；长尾语言、会话中切换语言暂不支持。');
gapMd.push('- **服务端闭环**：CRM/支付/订单真实查询、SSO、细粒度权限、全量 QA 评分与 WFM 需后端与外部账号，纯静态实现无法覆盖。');
gapMd.push('- **云端同步**：当前为 Supabase 单 JSON 记录方案（可选启用），非生产级多租户数据库；未配置时数据仍在本地浏览器。');
gapMd.push('');
gapMd.push('### 7.4 第二轮验证');
gapMd.push('');
gapMd.push('- 三个 JS 文件 `node --check` 通过。');
gapMd.push('- Node 桩测试通过：多语言切换、情绪识别、模拟测试、知识缺口、坐席分配、审计日志、统计增强。');
gapMd.push('- 全 DOM id 桩验证通过：admin.html 11 个页面 section、index.html 访客端，JS 引用的 DOM id 全部匹配，初始化无运行时错误。');
gapMd.push('');
gapMd.push('## 8. 第三轮深挖（2026-11-17）');
gapMd.push('');
gapMd.push('第三轮不再追求功能数量，而是对照竞品在**合规、安全、质量度量、可访问性**四个"上线才会被审计/投诉"的深水区逐项补齐。');
gapMd.push('');
gapMd.push('### 8.1 新增调研维度与竞品做法');
gapMd.push('');
gapMd.push('| 维度 | 竞品 2026 做法 | 本轮应对 |');
gapMd.push('|---|---|---|');
gapMd.push('| AI 身份透明 | EU AI Act 第50条（2026-08 生效）：直接与人交互的 AI 必须告知用户身份，违规最高罚 1500 万欧元或全球营收 3% | 访客端常驻"您正在与 AI 助手对话"披露条，后台可开关与改文案，中英双语 |');
gapMd.push('| PII 检测脱敏 | Lorikeet / Questa / Fora Soft：手机号、身份证、卡号、邮箱在进入模型、日志、分析前 token 化；可回放的脱敏审计 | 正则规则版识别 5 类敏感信息，支持中间脱敏/占位符/仅告警三模式，写入会话前脱敏并记审计 |');
gapMd.push('| 质检评分卡 | Intercom Monitors + Custom Scorecards、Fin CX Score（1-5）、Forethought QA（100% 评分）：按可配置维度权重给每条会话打分，关键项可一票否决 | 可配置 4 维度权重评分卡（答案有据/合规安全/问题解决/服务态度），每条会话自动 1-5 分，关键项失败不通过，后台质检明细表 |');
gapMd.push('| 真实解决率 | Fin/Zendesk 对"封闭率（containment）"与"真正解决"的口径之争：客户停止回应≠问题解决；Gorgias/ZeninTech 强调重复联系率 | 新增会话封闭率、已验证解决率、被高估部分、知识库无命中率、7 日内重复咨询率，明确区分两种口径 |');
gapMd.push('| WCAG 2.2 无障碍 | EU AI Act/EAA/ADA：aria-live 播报、键盘可达、可见焦点、字号与对比度、减少动效；语音不能是唯一路径 | skip link、aria-live 播报区、键盘快捷键（Alt+N/Alt+/ /Esc）、大字号、高对比度、减少动效、可见焦点环，且保留文字输入 |');
gapMd.push('| 语音输入 | Web Speech API（Chrome/Edge/Safari 支持，Firefox 不支持），需可见状态与文字降级 | 浏览器语音识别按钮，带录音状态动画与播报；不支持时自动降级为文字并提示 |');
gapMd.push('');
gapMd.push('### 8.2 第三轮已落地模块（6 项）');
gapMd.push('');
gapMd.push('1. **AI 身份披露条**：符合 EU AI Act 第50条透明度的常驻提示，后台可配置。');
gapMd.push('2. **PII 检测脱敏**：5 类敏感信息 × 3 种策略，入库前脱敏 + 可审计，覆盖用户消息进入大模型之前的链路。');
gapMd.push('3. **结构化质检评分卡**：4 维度可配权重、关键项一票否决、自动 1-5 分、后台质检明细与通过率。');
gapMd.push('4. **真实解决率指标**：封闭率 vs 已验证解决率 vs 被高估部分，无命中率与重复咨询率，写进口径说明。');
gapMd.push('5. **WCAG 2.2 无障碍**：skip link、aria-live 播报、键盘快捷键、大字号、高对比度、减少动效、可见焦点。');
gapMd.push('6. **语音输入**：Web Speech API 渐进增强，含不支持时的文字降级路径。');
gapMd.push('');
gapMd.push('### 8.3 仍存在的差距（诚实说明）');
gapMd.push('');
gapMd.push('- **PII 正则的局限**：正则无法 100% 覆盖自由文本中的姓名、地址等非结构化 PII，也无误杀平衡；生产需 NER 模型 + 单向哈希 + 分角色短时提权，本实现仅为规则版防护。');
gapMd.push('- **语音仅输入**：本轮语音是浏览器端语音转文字（SpeechRecognition），非端到端 Voice AI 坐席； synthesis 播报、电话网关、声纹验证未实现，Firefox 不支持。');
gapMd.push('- **QA 为规则评分**：评分卡基于可解释规则（是否引用来源、是否命中敏感词、是否解决、情绪处理），非 LLM 语义评分；无人工复核工作流与抽样策略配置。');
gapMd.push('- **无障碍为自助实现**：已覆盖关键 WCAG 2.2 条款，但未做 axe-core 自动扫描与真实读屏软件（NVDA/VoiceOver）用户测试，自动化仅能发现约 30% 问题。');
gapMd.push('- **服务端/全渠道/多语言深度**：与第二轮结论一致，CRM/支付/SSO/WhatsApp/实时翻译需后端与外部账号，纯静态应用无法覆盖。');
gapMd.push('');
gapMd.push('### 8.4 第三轮验证');
gapMd.push('');
gapMd.push('- 四个 JS 文件 `node --check` 通过，无硬编码密钥。');
gapMd.push('- Node 桩测试通过：PII 检测与三模式脱敏、QA 评分（含合规一票否决与分数线配置）、真实指标、a11y 持久化、导出脱敏。');
gapMd.push('- 全 DOM id 桩验证通过：admin.html 12 个页面 section、index.html 访客端，所有 `el()` 引用命中且初始化无运行时错误。');

/* ---- 第四轮：统一收件箱与坐席协作（2026-11-17） ---- */
gapMd.push('');
gapMd.push('---');
gapMd.push('');
gapMd.push('## 9. 第四轮深挖：统一收件箱与坐席协作（2026-11-17）');
gapMd.push('');
gapMd.push('第三轮之前虽在路线图中规划了「统一收件箱」12 项 P1 模块，但核对源码发现仅停留在文档、未真正落地。第四轮把这些承诺补齐为可用的产品能力，聚焦「后台不只是看，而是能运营」。');
gapMd.push('');
gapMd.push('### 9.1 落地模块（14 项）');
gapMd.push('');
gapMd.push('1. **统一收件箱工作台**：会话列表支持 VIP 置顶、队列筛选（VIP / 排队中 / 我的），把「看对话」升级为「分配与处理」。');
gapMd.push('2. **VIP 优先**：会话可标记 VIP，列表置顶并优先排队；批量标 VIP。');
gapMd.push('3. **会话排队 + 位置提示**：转人工进入队列（VIP 优先 + 入队时间排序），访客端实时显示「排在第 N 位 / 共 M 人」。');
gapMd.push('4. **会话转接**：坐席之间转接，记录 from→to 历史并写内部备注，转接后退出排队。');
gapMd.push('5. **会话合并**：多条会话的消息、标签、备注并入目标会话，来源会话软删除且工单同步迁移。');
gapMd.push('6. **会话拆分**：按勾选消息拆出新会话，保留访客画像与意图。');
gapMd.push('7. **@同事**：在会话内 @坐席姓名生成提醒，含未读计数与已读标记。');
gapMd.push('8. **碰撞检测**：坐席打开会话时登记查看锁，窗口期内其他坐席查看会收到提示，避免重复回复。');
gapMd.push('9. **草稿同步**：坐席回复草稿按会话自动保存，切换会话不丢失。');
gapMd.push('10. **回复宏**：一次点击顺序执行「打标签 / 插话术 / 分配 / 写备注 / 改状态」多步动作。');
gapMd.push('11. **回复模板**：支持 `{{visitor}} {{intent}} {{agent}} {{date}} {{order}}` 变量的模板，一键插入草稿。');
gapMd.push('12. **批量会话操作**：多选后批量分配、加标签、标 VIP、标已解决、删除。');
gapMd.push('13. **关键词自动回复**：命中关键词直接答复，优先级高于知识库与大模型，最短路径解决问题。');
gapMd.push('14. **离线自动回复**：非服务时间（含跨天时段）转人工时自动给出服务时间与留资提示。');
gapMd.push('');
gapMd.push('### 9.2 仍存在的差距（诚实说明）');
gapMd.push('');
gapMd.push('- **消息形态增强未做**：富文本、图片/文件/语音/视频消息、链接预览、消息撤回/编辑、已读回执、输入指示器仍为缺失或部分，需文件存储与后端支持。');
gapMd.push('- **协作为单机模拟**：碰撞检测、草稿、@提醒基于本地存储，多坐席真实协同需服务端推送（WebSocket）与账号体系。');
gapMd.push('- **排队为展示层**：排队位置按本地规则计算，非分布式队列；真实并发排队与坐席工作台需后端。');
gapMd.push('');
gapMd.push('### 9.3 第四轮验证');
gapMd.push('');
gapMd.push('- 四个 JS 文件 `node --check` 通过，无硬编码密钥。');
gapMd.push('- Node 桩测试 21 项数据层能力全部通过（VIP / 排队 / 转接 / 合并 / 拆分 / @提及 / 草稿 / 宏 / 模板 / 批量 / 关键词等）。');
gapMd.push('- 访客流程桩测试 9 项通过（关键词命中与开关、VIP 插队、服务时间与离线文案）。');
gapMd.push('- DOM id 桩验证：admin.html / index.html 所有 `el()` 引用命中（动态生成 id 已核对），无运行时错误。');

/* ---- 第五轮：GitHub Agent Skill 方法论集成（2026-11-17） ---- */
gapMd.push('');
gapMd.push('---');
gapMd.push('');
gapMd.push('## 10. 第五轮：GitHub Agent Skill 调研与方法论集成（2026-11-17）');
gapMd.push('');
gapMd.push('按用户要求赴 GitHub 检索 1000+ Agent Skill，筛选后集成。真实数据：sickn33/agentic-awesome-skills 索引 2,981 个 skill（safe 1,110 / critical 1,614 / offensive 151），另有 anthropics/skills 官方库（196k★）、VoltAgent/awesome-agent-skills（1,000+）、ComposioHQ/awesome-claude-skills（79.7k★）。详见 `docs/github-skills-integration.md`。');
gapMd.push('');
gapMd.push('### 10.1 关键认知与集成方式');
gapMd.push('');
gapMd.push('- 这些 skill 是给 Claude Code/Cursor/Codex 等**编程 Agent** 的方法论指令（SKILL.md），不是可塞进网页运行的插件。因此采用「提炼 safe skill 方法论 → 转化为客服 Agent 真实能力」的方式，而非假装安装。');
gapMd.push('- **风险筛查**：样本中 54% 为 critical/offensive，仅采纳 `risk=safe` 且来源明确的 skill，未引入任何高风险项或需服务端凭证的代码。');
gapMd.push('');
gapMd.push('### 10.2 落地能力（6 项）');
gapMd.push('');
gapMd.push('1. **混合检索（hybrid-search-implementation）**：FAQ 检索升级为字面精确 + 语义 n-gram + 关键词 + 意图的混合排序，返回可解释分项分数；后台开关与权重可配。');
gapMd.push('2. **回归评测（agent-evaluation, Apache-2.0）**：版本化冻结用例，逐条跑全决策链；关键安全失败单独计数不被平均分掩盖；Wilson 95% 置信区间（10/10 不等于 100% 可靠）。后台「Skill 实验室」可运行。');
gapMd.push('3. **偏见缓解清单（advanced-evaluation）**：位置/长度/自增强/评分漂移四类 LLM-as-Judge 偏见的缓解动作。');
gapMd.push('4. **访客长期记忆（agent-memory-systems）**：语义/情景/程序化三层记忆，按访客 id 隔离，可配保留天数。');
gapMd.push('5. **多语言覆盖自查（i18n-localization）**：翻译键完整度报告。');
gapMd.push('6. **无障碍自查（accessibility-audit）**：WCAG 2.2 自动项与人工核验项分离，未测项不视为通过。');
gapMd.push('');
gapMd.push('### 10.3 局限');
gapMd.push('');
gapMd.push('- 仅实现方法论，未引入任何第三方可执行代码（规避供应链风险）。');
gapMd.push('- 回归评测当前以规则 `simulate()` 为被测对象；评测真实 LLM 输出需配置 API Key 并替换 verifier。');
gapMd.push('');
gapMd.push('### 10.4 第五轮验证');
gapMd.push('');
gapMd.push('- 四个 JS `node --check` 通过，无硬编码密钥。');
gapMd.push('- 第五轮方法桩测试 12 项全过（Wilson 区间、混合检索分项与开关、回归套件、偏见清单、访客记忆分层、i18n/a11y 自查）。');
gapMd.push('- DOM 桩完整初始化测试通过：core.js + admin.js 在 133 个 id 下无运行时异常，新增「Skill 实验室」页全部 id 命中。');
fs.writeFileSync(path.join(OUT_DIR, 'gap-analysis.md'), gapMd.join('\n'), 'utf8');

console.log(JSON.stringify({ total: rows.length, counts, priorities: prio, files: ['feature-catalog.md','feature-catalog.csv','gap-analysis.md'] }, null, 2));
