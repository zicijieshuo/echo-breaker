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
} as const;

/** 存储键名 */
export const STORAGE_KEYS = {
  USAGE_DATA: 'echo_breaker_usage',
  SETTINGS: 'echo_breaker_settings',
  SOCRATIC_PROMPTS: 'echo_breaker_prompts',
  TRIGGER_LOG: 'echo_breaker_triggers',
} as const;

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
