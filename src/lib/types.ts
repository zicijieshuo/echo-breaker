// 回声破除者 - 类型定义

/** 触发条件类型 */
export type TriggerType = 'duration' | 'consecutive';

/** 触发事件记录（增强版） */
export interface TriggerRecord {
  timestamp: number;
  type: TriggerType;
  action: 'dismissed' | 'paused';
}

/** 每日使用记录（增强版） */
export interface DailyRecord {
  total_seconds: number;
  active_seconds: number;
  consecutive_rounds: number;
  copy_paste_count: number;
  question_count: number;
  triggers: TriggerRecord[];
  /** 记录每小时的使用时长，用于高频时段分析 */
  hourly_data: number[];
}

/** 所有日期的记录映射 */
export interface UsageData {
  [date: string]: DailyRecord;
}

/** AI 网站配置 */
export interface AIWebsite {
  domain: string;
  name: string;
  inputSelector: string;
  sendButtonSelector: string;
  responseSelector: string;
}

/** 干预场景 */
export type Scenario = 'thesis' | 'homework' | 'reading' | 'exam' | 'default';

/** 干预模式 */
export type InterventionMode = 'strict' | 'suggest' | 'gentle' | 'light';

/** 用户设置 */
export interface UserSettings {
  enabled: boolean;
  durationThreshold: number;
  consecutiveThreshold: number;
  scenario: Scenario;
  dataUploadConsent: boolean;
  dailyApiLimit: number;
}

/** 默认用户设置 */
export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  durationThreshold: 5400,
  consecutiveThreshold: 4,
  scenario: 'default',
  dataUploadConsent: false,
  dailyApiLimit: 50,
};

/** 苏格拉底式反问文案 */
export interface SocraticPrompt {
  id: string;
  text: string;
  category: string;
}

/** Content Script → Background 消息类型 */
export type ContentMessageType =
  | 'USER_ACTIVE'
  | 'USER_PASTED'
  | 'USER_SENT_QUESTION'
  | 'TRIGGER_DISMISSED'
  | 'TRIGGER_PAUSED'
  | 'GET_SITE_CONFIG';

/** Content Script 发送给 Background 的消息 */
export interface ContentMessage {
  type: ContentMessageType;
  payload?: Record<string, unknown>;
}

/** Background → Content Script 消息类型 */
export type BackgroundMessageType =
  | 'TRIGGER_AWAKENING'
  | 'SITE_CONFIG';

/** Background 发送给 Content Script 的消息 */
export interface BackgroundMessage {
  type: BackgroundMessageType;
  payload?: Record<string, unknown>;
}
