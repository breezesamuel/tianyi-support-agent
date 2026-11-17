# GitHub Agent Skill 调研与集成报告

> 调研日期：2026-11-17　数据来源：GitHub REST API 实时查询（`gh api`），非记忆推测。

## 1. 调研范围与真实数据

用户要求「到 GitHub 寻找 1000+ skill，筛选并集成到项目」。实际检索引擎如下（Star 数为查询时快照）：

| 仓库 | Star | 说明 | 许可 |
|---|---:|---|---|
| `anthropics/skills` | 196,213 | Anthropic 官方 Agent Skills 公共仓库 | 见仓库 |
| `sickn33/agentic-awesome-skills` | 49,827 | **索引含 2,981 个 skill**，支持 Claude/Codex/Cursor/Gemini | 混合（见各 skill） |
| `ComposioHQ/awesome-claude-skills` | 79,674 | Claude Skills 精选合集 | — |
| `VoltAgent/awesome-agent-skills` | 37,258 | 官方+社区 1000+ skill 合集 | — |
| `hesreallyhim/awesome-claude-code` | 58,189 | Claude Code 生态精选 | — |

核心样本取自 `sickn33/agentic-awesome-skills` 的 `skills_index.json`（2.27 MB，2,981 条）。

## 2. 风险筛查（关键）

**不是所有 skill 都安全。** 索引自报风险分布：

| 风险等级 | 数量 | 处置 |
|---|---:|---|
| `safe` | 1,110 | 可作为方法论来源 |
| `critical` | 1,614 | **排除**，不引入 |
| `offensive` | 151 | **排除** |
| `none` / `unknown` | 106 | 排除 |

本轮**仅采纳 `risk=safe` 且来源明确**的 skill 的方法论，未引入任何 critical/offensive 项，也未引入任何需要服务端凭证的代码。

## 3. 重要认知：skill 的性质与集成方式

这些 skill 是给 **Claude Code / Cursor / Codex 等编程 Agent** 使用的「方法论指令文件（SKILL.md）」——它们指导「如何写 RAG、如何做评测」，而**不是**能塞进天医客服网页运行的插件。因此集成方式不是"安装"，而是：

> **提炼 safe skill 的方法论 → 转化为客服 Agent 的真实、可验证能力。**

## 4. 筛选结果与集成映射

关键词命中客服/RAG/质检/多语言等维度共 429 项；其中 `safe` 且多维命中 26 项；最终落地 6 项：

| 来源 Skill（risk=safe） | 提炼的方法论 | 落地到本应用的能力 | 代码位置 |
|---|---|---|---|
| `agent-evaluation`（Apache-2.0） | 冻结用例契约、基线/候选对比、关键安全失败不被平均分掩盖、Wilson 区间 | `Engine.runRegressionSuite()` + `Engine.wilsonInterval()`；后台「Skill 实验室」回归评测套件 | `core.js` / `admin.js` |
| `advanced-evaluation` | LLM-as-Judge 的位置/长度/自增强/漂移偏见及缓解 | `Engine.judgeBiasChecklist()`；后台偏见缓解清单 | `core.js` / `admin.js` |
| `hybrid-search-implementation` | 向量/语义检索 + 关键词字面检索结合 | FAQ 检索升级为「字面精确 + 语义 n-gram + 关键词 + 意图」混合排序，返回可解释分项分数 `breakdown` | `core.js: retrieveFaq()` |
| `agent-memory-systems` | 语义/情景/程序化记忆分层、保留期、租户隔离 | `Engine.visitorMemory()`：按访客 id 隔离的三层记忆，可配保留天数 | `core.js` |
| `i18n-localization` | 硬编码检测、翻译键管理、覆盖度 | `Engine.i18nCoverage()`：多语言键完整度自查 | `core.js` |
| `accessibility-audit` | WCAG 自动扫描 + 人工核验分离，未测项不等于通过 | `Engine.a11yChecklist()`：自动项与人工核验项分开列示 | `core.js` / `admin.js` |

## 5. 能力开关与配置

`DEFAULT_SETTINGS` 新增三组配置（`load/import/applyRemote` 已通过 `mergeSettings()` 统一合并）：

- `search`：`hybrid` 开关、`lexicalWeight`/`semanticWeight`/`intentWeight` 权重
- `memory`：`enabled`、`retentionDays`（默认 90）、`scope`（按访客隔离）
- `judge`：`swapPositions` / `ignoreLength` / `crossModel` 偏见缓解开关

## 6. 验证

- 四个 JS `node --check` 通过；无硬编码密钥。
- 第五轮方法桩测试 12 项全过：Wilson 区间（含非法输入）、混合检索 breakdown 与开关、回归套件逐用例校验、偏见清单、访客记忆分层与 VIP 语义、i18n 覆盖、a11y 自动/人工分离、simulate 分项分数。
- DOM 桩完整初始化测试通过：core.js + admin.js 在 133 个 id 的 document 桩中无运行时异常，新增「Skill 实验室」页所有 id 命中。

## 7. 局限与诚实说明

- 未引入任何第三方 skill 的可执行代码，仅实现其公开的方法论（避免 supply-chain 风险；样本中 54% 为 critical/offensive）。
- ~~`runRegressionSuite()` 使用规则的 `simulate()` 作为被测对象，不调用真实 LLM~~ → **第六轮已落地 `runLlmRegression()`**：真实生成回答 + LLM-as-Judge 评分 + 自增强偏见标注（详见 gap-analysis 第 11 章）。规则版 `runRegressionSuite()` 保留，作为无需 API Key 的快速回归。
- Wilson 区间表述的是「同一任务分布下重复抽样」的统计不确定性，重复跑同一用例不构成独立样本。
- 访客记忆为本地派生视图（不新增存储集合），跨设备同步依赖已有的 Supabase 可选同步。
- 第六轮新增局限：评分卡为通用客服质量卡（未叠加中医合规专用 rubric）；用量台账目前覆盖评测/评审调用，访客流式对话暂未入账。

## 8. 第六轮：从方法论到端到端（2026-11-17 追加）

第五轮的 `runRegressionSuite` 只测规则引擎。第六轮在「Skill 实验室」新增 **LLM 真实评测**：

1. 每条用例：`retrieveFaq` 上下文 + `buildSystemPrompt` → `llmChat` 真实生成（temperature 0.6）；
2. `llmJudge` 按 rubric-v1 评分卡评审（温度 0，输出四维度分 + issues）；
3. 偏见防护落地：评审模型可配置为与生成模型不同（`judge.model`），同模型自评自动标 `selfJudged` 局限徽章；
4. 每次调用的 usage（或字数估算）写入 30 天滚动用量台账，按可配置单价折算成本、按单日预算告警。

同时落地 **知识缺口闭环**：`knowledgeGaps` → `createFaqDrafts`（去重）→ 后台审核入库 / 忽略 → 入库条目带 `gap-draft` 来源。
