// 回声破除者 - 本地存储封装

import { STORAGE_KEYS } from './constants';
import {
  DailyRecord,
  UsageData,
  UserSettings,
  DEFAULT_SETTINGS,
  TriggerRecord,
  LLMApiConfig,
  MembershipInfo,
  ThoughtLog,
  TargetText,
  FindFaultSubmission,
  EvidenceMap,
} from './types';

/** 获取今日日期字符串 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** 获取空白的每日记录 */
export function getEmptyDailyRecord(): DailyRecord {
  return {
    total_seconds: 0,
    active_seconds: 0,
    consecutive_rounds: 0,
    copy_paste_count: 0,
    question_count: 0,
    triggers: [],
    hourly_data: new Array(24).fill(0),
    api_call_count: 0,
  };
}

/** 读取所有使用数据 */
export async function getUsageData(): Promise<UsageData> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  return result[STORAGE_KEYS.USAGE_DATA] || {};
}

/** 获取今日使用记录 */
export async function getTodayRecord(): Promise<DailyRecord> {
  const data = await getUsageData();
  const today = getTodayKey();
  return data[today] || getEmptyDailyRecord();
}

/** 更新今日使用记录 */
export async function updateTodayRecord(updater: (record: DailyRecord) => DailyRecord): Promise<void> {
  const data = await getUsageData();
  const today = getTodayKey();
  data[today] = updater(data[today] || getEmptyDailyRecord());
  await chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: data });
}

/** 累加使用时长 */
export async function addDuration(seconds: number): Promise<void> {
  await updateTodayRecord((record) => {
    const hour = new Date().getHours();
    const hourlyData = [...record.hourly_data];
    hourlyData[hour] = (hourlyData[hour] || 0) + seconds;
    return {
      ...record,
      total_seconds: record.total_seconds + seconds,
      hourly_data: hourlyData,
    };
  });
}

/** 累加活跃时长 */
export async function addActiveDuration(seconds: number): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    active_seconds: record.active_seconds + seconds,
  }));
}

/** 增加连续提问轮数 */
export async function incrementConsecutiveRounds(): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    consecutive_rounds: record.consecutive_rounds + 1,
  }));
}

/** 重置连续提问轮数 */
export async function resetConsecutiveRounds(): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    consecutive_rounds: 0,
  }));
}

/** 增加复制粘贴计数 */
export async function incrementCopyPasteCount(): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    copy_paste_count: record.copy_paste_count + 1,
  }));
}

/** 增加提问计数 */
export async function incrementQuestionCount(): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    question_count: record.question_count + 1,
  }));
}

/** 记录触发事件（结构化） */
export async function recordTrigger(trigger: TriggerRecord): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    triggers: [...record.triggers, trigger],
  }));
}

/** 增加 API 调用计数 */
export async function incrementApiCallCount(): Promise<number> {
  let currentCount = 0;
  await updateTodayRecord((record) => {
    currentCount = record.api_call_count + 1;
    return { ...record, api_call_count: currentCount };
  });
  return currentCount;
}

/** 获取今日 API 调用次数 */
export async function getTodayApiCallCount(): Promise<number> {
  const record = await getTodayRecord();
  return record.api_call_count || 0;
}

/** 获取最近7天的数据 */
export async function getWeeklyData(): Promise<UsageData> {
  const data = await getUsageData();
  const result: UsageData = {};
  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    if (data[key]) {
      result[key] = data[key];
    }
  }

  return result;
}

/** 读取用户设置 */
export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || { ...DEFAULT_SETTINGS };
}

/** 保存用户设置 */
export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  });
}

/** 获取上次触发时间 */
export async function getLastTriggerTime(): Promise<number> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LAST_TRIGGER_TIME);
  return result[STORAGE_KEYS.LAST_TRIGGER_TIME] || 0;
}

/** 设置上次触发时间 */
export async function setLastTriggerTime(timestamp: number): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.LAST_TRIGGER_TIME]: timestamp });
}

// ============ LLM API 配置 ============

/** 获取所有 LLM 配置 */
export async function getLLMConfigs(): Promise<Record<string, LLMApiConfig>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LLM_CONFIGS);
  return result[STORAGE_KEYS.LLM_CONFIGS] || {};
}

/** 保存单个 LLM 配置 */
export async function saveLLMConfig(config: LLMApiConfig): Promise<void> {
  const configs = await getLLMConfigs();
  configs[config.provider] = config;
  await chrome.storage.local.set({ [STORAGE_KEYS.LLM_CONFIGS]: configs });
}

/** 获取指定供应商的 LLM 配置 */
export async function getLLMConfig(provider: string): Promise<LLMApiConfig | null> {
  const configs = await getLLMConfigs();
  return configs[provider] || null;
}

/** 删除指定供应商的 LLM 配置 */
export async function deleteLLMConfig(provider: string): Promise<void> {
  const configs = await getLLMConfigs();
  delete configs[provider];
  await chrome.storage.local.set({ [STORAGE_KEYS.LLM_CONFIGS]: configs });
}

// ============ 会员信息 ============

/** 获取会员信息 */
export async function getMembership(): Promise<MembershipInfo> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MEMBERSHIP);
  return result[STORAGE_KEYS.MEMBERSHIP] || { tier: 'free', expireAt: null, licenseKey: '' };
}

/** 保存会员信息 */
export async function saveMembership(info: MembershipInfo): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.MEMBERSHIP]: info });
}

/** 检查会员是否有效 */
export async function isMembershipActive(): Promise<boolean> {
  const info = await getMembership();
  if (info.tier === 'free') return true;
  if (!info.expireAt) return true;
  return Date.now() < info.expireAt;
}

// ============ 思考日志 ============

/** 获取所有思考日志 */
export async function getThoughtLogs(): Promise<ThoughtLog[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.THOUGHT_LOGS);
  return result[STORAGE_KEYS.THOUGHT_LOGS] || [];
}

/** 保存思考日志 */
export async function saveThoughtLog(log: ThoughtLog): Promise<void> {
  const logs = await getThoughtLogs();
  logs.unshift(log); // 最新的在前
  // 最多保留 200 条
  if (logs.length > 200) logs.length = 200;
  await chrome.storage.local.set({ [STORAGE_KEYS.THOUGHT_LOGS]: logs });
}

/** 更新思考日志（添加偏差分析结果） */
export async function updateThoughtLog(logId: string, updates: Partial<ThoughtLog>): Promise<void> {
  const logs = await getThoughtLogs();
  const idx = logs.findIndex((l) => l.id === logId);
  if (idx !== -1) {
    logs[idx] = { ...logs[idx], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.THOUGHT_LOGS]: logs });
  }
}

// ============ 靶子文本 ============

/** 获取所有靶子文本 */
export async function getTargetTexts(): Promise<TargetText[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TARGET_TEXTS);
  return result[STORAGE_KEYS.TARGET_TEXTS] || [];
}

/** 保存靶子文本 */
export async function saveTargetText(target: TargetText): Promise<void> {
  const targets = await getTargetTexts();
  targets.push(target);
  await chrome.storage.local.set({ [STORAGE_KEYS.TARGET_TEXTS]: targets });
}

/** 删除靶子文本 */
export async function deleteTargetText(id: string): Promise<void> {
  const targets = await getTargetTexts();
  const filtered = targets.filter((t) => t.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.TARGET_TEXTS]: filtered });
}

// ============ 找茬提交 ============

/** 获取所有找茬提交 */
export async function getFindFaultSubmissions(): Promise<FindFaultSubmission[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FIND_FAULT_SUBMISSIONS);
  return result[STORAGE_KEYS.FIND_FAULT_SUBMISSIONS] || [];
}

/** 保存找茬提交 */
export async function saveFindFaultSubmission(sub: FindFaultSubmission): Promise<void> {
  const subs = await getFindFaultSubmissions();
  subs.unshift(sub);
  await chrome.storage.local.set({ [STORAGE_KEYS.FIND_FAULT_SUBMISSIONS]: subs });
}

// ============ 证据链导图 ============

/** 获取所有证据链导图 */
export async function getEvidenceMaps(): Promise<EvidenceMap[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.EVIDENCE_MAPS);
  return result[STORAGE_KEYS.EVIDENCE_MAPS] || [];
}

/** 保存证据链导图 */
export async function saveEvidenceMap(map: EvidenceMap): Promise<void> {
  const maps = await getEvidenceMaps();
  const idx = maps.findIndex((m) => m.id === map.id);
  if (idx !== -1) {
    maps[idx] = map;
  } else {
    maps.push(map);
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.EVIDENCE_MAPS]: maps });
}
