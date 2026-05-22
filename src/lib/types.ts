// 回声破除者 - 类型定义

/** 每日使用记录 */
export interface DailyRecord {
  total_seconds: number;
  consecutive_rounds: number;
  copy_paste_count: number;
  triggers: number[];
}

/** 所有日期的记录映射 */
export interface UsageData {
  [date: string]: DailyRecord;
}

/** 触发条件类型 */
export type TriggerType = 'duration' | 'consecutive';

/** 触发事件 */
export interface TriggerEvent {
  type: TriggerType;
  timestamp: number;
  dismissed: boolean;
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
