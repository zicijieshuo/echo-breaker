# 回声破除者 (Echo Breaker)

> 不反对 AI，反对被 AI 替代的思考。让每个人在回声四起的时代，重新听见自己的声音。

一款面向 AI 时代学习者的**认知抗阻伴学浏览器插件**，通过温和的实时干预与系统性认知训练，帮助用户在使用 AI 的同时保持并强化独立思考能力。

## 功能概览

### L0 基础监测层
- 自动识别 8 个主流 AI 平台（DeepSeek、Kimi、ChatGPT、文心一言、通义千问、豆包、Claude 等）
- 精准计时（区分活跃/后台状态）
- 统计使用时长、提问次数、复制行为

### L1 主动唤醒层
- 双阈值触发：单日使用 ≥1.5 小时 或 连续提问 ≥4 轮
- "认知柔光"非模态提醒（边缘光效 + 苏格拉底式反问卡片）
- 20+ 条苏格拉底式反问文案库

### L2 延迟满足层
- 长按发送按钮 3 秒开启"引导教育模式"（带进度环动画）
- 自动注入苏格拉底式引导 Prompt，让 AI 反问而非直接给答案
- 支持 LLM 生成个性化引导问题

### L3 元认知外显层
- 侧边栏"思考日志"：强制在获取 AI 答案前写下自己的想法
- 大模型偏差分析：对比用户思考与 AI 回答，生成缺失维度/亮点/建议报告
- 综合评分（0-100）可视化展示

### L4 逆向重构层
- "AI 结论靶场"：独立页面，训练批判性思维
- 找茬任务：高亮文本中的薄弱依据，LLM/本地双模式评分
- 证据链导图：Canvas 交互画板，构建证据到结论的推理链
- 内置 3 个样本靶子（气候变化/学习方法/历史事件）

### 数据看板
- ECharts 可视化：今日概览、本周趋势、提问 vs 复制比例、高频时段
- 实时状态指示（是否正在监测 AI 网站）
- 日志导出功能

## 安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/zicijieshuo/echo-breaker.git
cd echo-breaker

# 安装依赖
npm install

# 构建
npm run build

# 产物在 dist/ 目录
```

### 加载到浏览器

1. 打开 Edge/Chrome，进入 `edge://extensions/` 或 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展"，选择 `dist/` 目录

## 配置

### API Key 设置

L2/L3/L4 层级功能需要大模型 API 支持。在扩展设置页面配置：

1. 点击扩展 Popup → 底部"设置"按钮
2. 在"API Key 管理"区域选择供应商并填写 Key
3. 点击"测试连接"验证 Key 有效性
4. 保存配置

支持的供应商：
| 供应商 | 默认模型 | API 地址 |
|--------|----------|----------|
| DeepSeek | deepseek-v4-flash | https://api.deepseek.com |
| 智谱 GLM | glm-4-flash | https://open.bigmodel.cn/api/paas/v4 |
| 通义千问 | qwen-turbo | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| 自定义 | 用户指定 | 用户指定 |

所有供应商均使用 OpenAI 兼容 API 格式。

### 功能开关

在设置页面可独立开关各层级功能：
- 引导教育模式（L2）
- 强制思考输入（L3）
- 偏差分析（L3）
- 靶场训练（L4）

## 会员体系

| 等级 | 月费 | 每日 API 上限 | 引导模式 | 思考日志 | 偏差分析 | 靶场 | 证据链导图 |
|------|------|--------------|---------|---------|---------|------|-----------|
| 免费版 | - | 10 次 | ✓ | ✓ | - | - | - |
| 深度思考会员 | ¥12.9 | 50 次 | ✓ | ✓ | ✓ | ✓ | - |
| 专业训练版 | ¥29.9 | 200 次 | ✓ | ✓ | ✓ | ✓ | ✓ |

在设置页面输入许可证密钥激活会员。

## 技术栈

- **扩展框架**: Chrome Extension Manifest V3
- **核心语言**: TypeScript
- **UI**: 原生 DOM + 内联样式
- **数据可视化**: ECharts 5
- **构建工具**: Webpack 5 + ts-loader
- **存储**: chrome.storage.local
- **LLM**: OpenAI 兼容 API（用户自备 Key）

## 项目结构

```
src/
├── background/       # Service Worker 后台脚本
├── content/          # Content Scripts
│   ├── monitor.ts    # L0 基础监测层
│   ├── awakening.ts  # L1 主动唤醒层
│   └── delay-satisfy.ts  # L2 延迟满足层
├── popup/            # 弹出式数据看板
├── sidepanel/        # 侧边栏（L3 思考日志）
├── options/          # 设置页面（API Key 管理）
├── target/           # AI 靶场页面（L4）
└── lib/              # 共享模块
    ├── types.ts      # 类型定义
    ├── constants.ts  # 常量
    ├── storage.ts    # 本地存储封装
    ├── llm.ts        # LLM API 网关
    └── utils.ts      # 工具函数
```

## 开发

```bash
# 开发模式（监听文件变化自动构建）
npm run dev

# 生产构建
npm run build

# 类型检查
npm run typecheck
```

## 隐私

- **本地优先**：行为统计默认只存 chrome.storage.local，不上传
- **用户授权**：需独立勾选"同意上传训练数据"才会加密发送
- **数据脱敏**：社群公开内容不包含可识别身份信息
- **传输加密**：全站 HTTPS，敏感字段 AES-256 加密

详见 [隐私协议](docs/PRIVACY_POLICY.md)

## 版本历史

### v2.0.0 (2026-05-25)
- 新增 L2 延迟满足层（长按3秒进度环 + 引导教育模式 + 苏格拉底式 Prompt 注入）
- 新增 L3 元认知外显层（思考日志侧边栏 + 强制思考输入 + 大模型偏差分析报告）
- 新增 L4 逆向重构层（AI结论靶场 + 找茬任务 + 证据链导图 + 3个内置靶子）
- 新增 LLM API 网关模块（支持 DeepSeek v4 / 智谱GLM / 通义千问 / 自定义 OpenAI 兼容端点）
- 新增设置页面（API Key 管理 + 测试连接 + 功能开关 + 阈值配置 + 会员激活）
- 新增付费体系（free / deep_thinker / pro 三级会员 + 本地许可证验证）
- 新增 Popup 训练工具入口（引导模式 / 思考日志 / AI靶场 / API计数）
- 全新"晨雾"淡蓝主题（清新舒适的湖蓝色配色）
- 修复 CSP 内联事件处理器违规（改用 CSS :focus/:hover）
- 修复 manifest.json options_page 字段格式
- 更新 DeepSeek API 至 v4（base_url + deepseek-v4-flash 模型）

### v2.0.0-beta.1 (2026-05-25)
- 第二阶段测试版发布

### v1.0.0 (2026-05-22)
- L0 基础监测层（AI 网站识别 + 行为统计 + 精准计时）
- L1 主动唤醒层（双阈值触发 + 认知柔光 UI + 苏格拉底式反问）
- Popup 数据看板（ECharts 图表 + 状态指示）
- 首个正式版发布

## License

MIT
