// 回声破除者 - 常量定义

/** 触发阈值 */
export const THRESHOLDS = {
  /** 单日使用时长阈值（秒）：1.5小时 */
  DURATION_LIMIT: 5400,
  /** 连续提问轮数阈值 */
  CONSECUTIVE_LIMIT: 4,
  /** 长按触发时间（毫秒） */
  LONG_PRESS_DURATION: 3000,
  /** 认知墙相似度阈值 */
  SIMILARITY_THRESHOLD: 0.85,
  /** 每日API调用上限 */
  DAILY_API_LIMIT: 50,
  /** 触发冷却时间（毫秒）：30分钟 */
  TRIGGER_COOLDOWN: 30 * 60 * 1000,
  /** 暂停思考后再次提醒时间（分钟） */
  PAUSE_REMIND_DELAY: 5,
} as const;

/** 存储键名 */
export const STORAGE_KEYS = {
  USAGE_DATA: 'echo_breaker_usage',
  SETTINGS: 'echo_breaker_settings',
  SOCRATIC_PROMPTS: 'echo_breaker_prompts',
  TRIGGER_LOG: 'echo_breaker_triggers',
  AI_WEBSITES: 'echo_breaker_websites',
  LAST_TRIGGER_TIME: 'echo_breaker_last_trigger',
  /** LLM API 配置（各供应商的 key 和 base URL） */
  LLM_CONFIGS: 'echo_breaker_llm_configs',
  /** 会员信息 */
  MEMBERSHIP: 'echo_breaker_membership',
  /** 思考日志 */
  THOUGHT_LOGS: 'echo_breaker_thought_logs',
  /** 靶子文本库 */
  TARGET_TEXTS: 'echo_breaker_target_texts',
  /** 找茬提交记录 */
  FIND_FAULT_SUBMISSIONS: 'echo_breaker_find_fault',
  /** 证据链导图 */
  EVIDENCE_MAPS: 'echo_breaker_evidence_maps',
  /** L5: 认知墙拦截记录 */
  COGNITIVE_WALL_BLOCKS: 'echo_breaker_cognitive_wall',
  /** L5: 当前检测到的场景 */
  DETECTED_SCENARIO: 'echo_breaker_detected_scenario',
  /** L6: CDI 历史记录 */
  CDI_HISTORY: 'echo_breaker_cdi_history',
  /** L6: 徽章获得记录 */
  BADGES: 'echo_breaker_badges',
  /** L6: 云端用户信息 */
  CLOUD_USER: 'echo_breaker_cloud_user',
} as const;

/** LLM 供应商默认配置 */
export const LLM_PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-turbo',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
};

/** 场景与干预模式映射 */
export const SCENARIO_MODE_MAP: Record<string, string> = {
  thesis: 'strict',
  homework: 'suggest',
  reading: 'gentle',
  exam: 'light',
  default: 'suggest',
} as const;

/** 场景URL关键词识别规则 */
export const SCENARIO_URL_RULES: Record<string, string[]> = {
  thesis: ['cnki.net', 'xueshu.baidu.com', 'scholar.google.com', 'wanfangdata.com.cn', 'cqvip.com'],
  reading: ['douban.com/book', 'goodreads.com', 'weread.qq.com', 'z-library.org'],
  homework: ['chaoxing.com', 'xueersi.com', 'zhihuishu.com', 'mooc1.chaoxing.com'],
  exam: [],
} as const;

/** 场景显示名称 */
export const SCENARIO_LABELS: Record<string, string> = {
  thesis: '论文写作',
  homework: '日常作业',
  reading: '文献阅读',
  exam: '考试复习',
  default: '默认模式',
} as const;

/** 徽章定义列表 */
export const BADGE_DEFINITIONS = [
  { id: 'patience_bronze', name: '耐心新手', description: '连续3天使用时长低于1小时', icon: '🧘', tier: 'bronze' as const, condition: 'consecutive_low_usage_3' },
  { id: 'patience_silver', name: '耐心修行者', description: '连续7天使用时长低于1小时', icon: '🧘', tier: 'silver' as const, condition: 'consecutive_low_usage_7' },
  { id: 'patience_gold', name: '耐心大师', description: '连续30天使用时长低于1小时', icon: '🧘', tier: 'gold' as const, condition: 'consecutive_low_usage_30' },
  { id: 'thinker_bronze', name: '思考新手', description: '累计完成10条思考日志', icon: '💭', tier: 'bronze' as const, condition: 'thought_logs_10' },
  { id: 'thinker_silver', name: '思考达人', description: '累计完成50条思考日志', icon: '💭', tier: 'silver' as const, condition: 'thought_logs_50' },
  { id: 'thinker_gold', name: '思考大师', description: '累计完成200条思考日志', icon: '💭', tier: 'gold' as const, condition: 'thought_logs_200' },
  { id: 'questioner_bronze', name: '提问新手', description: '累计触发5次苏格拉底式反问', icon: '❓', tier: 'bronze' as const, condition: 'triggers_5' },
  { id: 'questioner_silver', name: '提问家', description: '累计触发20次苏格拉底式反问', icon: '❓', tier: 'silver' as const, condition: 'triggers_20' },
  { id: 'questioner_gold', name: '提问大师', description: '累计触发50次苏格拉底式反问', icon: '❓', tier: 'gold' as const, condition: 'triggers_50' },
  { id: 'critic_bronze', name: '批判新手', description: '在靶场中完成3次找茬', icon: '🎯', tier: 'bronze' as const, condition: 'find_fault_3' },
  { id: 'critic_silver', name: '批判者', description: '在靶场中完成10次找茬', icon: '🎯', tier: 'silver' as const, condition: 'find_fault_10' },
  { id: 'critic_gold', name: '批判大师', description: '在靶场中完成30次找茬且平均分>70', icon: '🎯', tier: 'gold' as const, condition: 'find_fault_30' },
  { id: 'wall_bronze', name: '守门新手', description: '认知墙成功拦截5次', icon: '🛡️', tier: 'bronze' as const, condition: 'wall_blocks_5' },
  { id: 'wall_silver', name: '守门人', description: '认知墙成功拦截20次', icon: '🛡️', tier: 'silver' as const, condition: 'wall_blocks_20' },
  { id: 'wall_gold', name: '守门大师', description: '认知墙成功拦截50次', icon: '🛡️', tier: 'gold' as const, condition: 'wall_blocks_50' },
] as const;

/** Alarm 名称常量 */
export const ALARM_NAMES = {
  /** 每分钟计时检查 */
  TIMER: 'echoTimer',
  /** 暂停后再次提醒 */
  PAUSE_REMIND: 'echoPauseRemind',
} as const;
