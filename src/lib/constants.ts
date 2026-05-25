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
  thesis: ['cnki.net', 'xueshu.baidu.com'],
  reading: ['douban.com/book', 'goodreads.com'],
} as const;

/** Alarm 名称常量 */
export const ALARM_NAMES = {
  /** 每分钟计时检查 */
  TIMER: 'echoTimer',
  /** 暂停后再次提醒 */
  PAUSE_REMIND: 'echoPauseRemind',
} as const;
