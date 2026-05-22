// 回声破除者 - 本地存储封装

import { STORAGE_KEYS } from './constants';
import { DailyRecord, UsageData, UserSettings, DEFAULT_SETTINGS, TriggerRecord } from './types';

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
