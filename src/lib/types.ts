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
  /** 当日 LLM API 调用次数 */
  api_call_count: number;
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

/** LLM 供应商类型 */
export type LLMProvider = 'deepseek' | 'zhipu' | 'qwen' | 'custom';

/** LLM API 配置 */
export interface LLMApiConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** 会员等级 */
export type MembershipTier = 'free' | 'deep_thinker' | 'pro';

/** 会员信息 */
export interface MembershipInfo {
  tier: MembershipTier;
  expireAt: number | null; // 过期时间戳，null 表示永久或免费
  licenseKey: string;
}

/** 各等级权益配置 */
export interface TierQuota {
  dailyApiLimit: number;
  guidedModeEnabled: boolean;
  thoughtLogEnabled: boolean;
  biasAnalysisEnabled: boolean;
  targetRangeEnabled: boolean;
  evidenceMapEnabled: boolean;
}

/** 用户设置（第二阶段增强版） */
export interface UserSettings {
  enabled: boolean;
  durationThreshold: number;
  consecutiveThreshold: number;
  scenario: Scenario;
  dataUploadConsent: boolean;
  dailyApiLimit: number;
  /** L2: 引导教育模式是否启用 */
  guidedModeEnabled: boolean;
  /** L3: 思考日志强制输入是否启用 */
  forceThoughtInput: boolean;
  /** L3: 偏差分析是否启用 */
  biasAnalysisEnabled: boolean;
  /** L4: 靶场是否启用 */
  targetRangeEnabled: boolean;
  /** 首选 LLM 供应商 */
  preferredProvider: LLMProvider;
}

/** 默认用户设置 */
export const DEFAULT_SETTINGS: UserSettings = {
  enabled: true,
  durationThreshold: 5400,
  consecutiveThreshold: 4,
  scenario: 'default',
  dataUploadConsent: false,
  dailyApiLimit: 50,
  guidedModeEnabled: true,
  forceThoughtInput: true,
  biasAnalysisEnabled: true,
  targetRangeEnabled: true,
  preferredProvider: 'deepseek',
};

/** 各等级默认权益 */
export const TIER_QUOTAS: Record<MembershipTier, TierQuota> = {
  free: {
    dailyApiLimit: 10,
    guidedModeEnabled: true,
    thoughtLogEnabled: true,
    biasAnalysisEnabled: false,
    targetRangeEnabled: false,
    evidenceMapEnabled: false,
  },
  deep_thinker: {
    dailyApiLimit: 50,
    guidedModeEnabled: true,
    thoughtLogEnabled: true,
    biasAnalysisEnabled: true,
    targetRangeEnabled: true,
    evidenceMapEnabled: false,
  },
  pro: {
    dailyApiLimit: 200,
    guidedModeEnabled: true,
    thoughtLogEnabled: true,
    biasAnalysisEnabled: true,
    targetRangeEnabled: true,
    evidenceMapEnabled: true,
  },
};

/** 苏格拉底式反问文案 */
export interface SocraticPrompt {
  id: string;
  text: string;
  category: string;
}

/** 思考日志条目 */
export interface ThoughtLog {
  id: string;
  timestamp: number;
  question: string;
  myThought: string;
  keyPoints: string;
  aiAnswer?: string;
  biasAnalysis?: BiasAnalysis;
}

/** 思维偏差分析报告 */
export interface BiasAnalysis {
  id: string;
  timestamp: number;
  thoughtLogId: string;
  missingDimensions: string[];
  strengthAreas: string[];
  suggestions: string[];
  overallScore: number; // 0-100
  rawResponse?: string;
}

/** 靶子文本 */
export interface TargetText {
  id: string;
  title: string;
  content: string;
  category: string;
  /** 预置的正反依据集合 */
  proEvidence: string[];
  conEvidence: string[];
  weakPoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

/** 找茬任务提交 */
export interface FindFaultSubmission {
  id: string;
  timestamp: number;
  targetId: string;
  highlightedWeakPoints: string[];
  matchScore: number; // 0-100
}

/** 证据链导图节点 */
export interface EvidenceNode {
  id: string;
  text: string;
  type: 'evidence' | 'inference' | 'conclusion';
  x: number;
  y: number;
}

/** 证据链导图连线 */
export interface EvidenceEdge {
  from: string;
  to: string;
  label?: string;
}

/** 证据链导图 */
export interface EvidenceMap {
  id: string;
  targetId: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  createdAt: number;
}

/** Content Script → Background 消息类型 */
export type ContentMessageType =
  | 'USER_ACTIVE'
  | 'USER_PASTED'
  | 'USER_SENT_QUESTION'
  | 'TRIGGER_DISMISSED'
  | 'TRIGGER_PAUSED'
  | 'GET_SITE_CONFIG'
  | 'GUIDED_MODE_TRIGGERED'
  | 'THOUGHT_LOG_SAVED'
  | 'REQUEST_BIAS_ANALYSIS'
  | 'REQUEST_GUIDED_PROMPT';

/** Content Script 发送给 Background 的消息 */
export interface ContentMessage {
  type: ContentMessageType;
  payload?: Record<string, unknown>;
}

/** Background → Content Script 消息类型 */
export type BackgroundMessageType =
  | 'TRIGGER_AWAKENING'
  | 'SITE_CONFIG'
  | 'GUIDED_PROMPT_RESULT'
  | 'BIAS_ANALYSIS_RESULT';

/** Background 发送给 Content Script 的消息 */
export interface BackgroundMessage {
  type: BackgroundMessageType;
  payload?: Record<string, unknown>;
}
