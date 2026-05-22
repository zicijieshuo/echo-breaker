// 回声破除者 - 本地存储封装

import { STORAGE_KEYS } from './constants';
import { DailyRecord, UsageData, UserSettings, DEFAULT_SETTINGS } from './types';

/** 获取今日日期字符串 */
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** 获取空白的每日记录 */
function getEmptyDailyRecord(): DailyRecord {
  return {
    total_seconds: 0,
    consecutive_rounds: 0,
    copy_paste_count: 0,
    triggers: [],
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
  await updateTodayRecord((record) => ({
    ...record,
    total_seconds: record.total_seconds + seconds,
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

/** 记录触发事件 */
export async function logTrigger(timestamp: number): Promise<void> {
  await updateTodayRecord((record) => ({
    ...record,
    triggers: [...record.triggers, timestamp],
  }));
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
