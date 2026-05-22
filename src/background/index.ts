// 回声破除者 - Background Service Worker

import { THRESHOLDS, STORAGE_KEYS, ALARM_NAMES } from '../lib/constants';
import type { AIWebsite, DailyRecord, TriggerType } from '../lib/types';
import {
  getTodayRecord,
  addDuration,
  addActiveDuration,
  incrementConsecutiveRounds,
  incrementCopyPasteCount,
  incrementQuestionCount,
  resetConsecutiveRounds,
  recordTrigger,
  getWeeklyData,
  getSettings,
  getLastTriggerTime,
  setLastTriggerTime,
} from '../lib/storage';

/** 已加载的 AI 网站配置列表 */
let aiWebsites: AIWebsite[] = [];

/** 加载 AI 网站配置 */
async function loadAIWebsites(): Promise<void> {
  try {
    const url = chrome.runtime.getURL('data/ai_websites.json');
    const response = await fetch(url);
    aiWebsites = await response.json() as AIWebsite[];
    console.log(`[EchoBreaker] 已加载 ${aiWebsites.length} 个 AI 网站配置`);
  } catch (err) {
    console.error('[EchoBreaker] 加载 AI 网站配置失败:', err);
    aiWebsites = [];
  }
}

/** 根据 URL 匹配 AI 网站配置 */
function matchSiteConfig(url: string): AIWebsite | null {
  try {
    const hostname = new URL(url).hostname;
    for (const site of aiWebsites) {
      if (hostname.includes(site.domain)) {
        return site;
      }
    }
  } catch {
    // URL 解析失败
  }
  return null;
}

/** 判断 URL 是否为 AI 网站 */
function isAIWebsite(url: string): boolean {
  return matchSiteConfig(url) !== null;
}

/** 检查是否应该触发唤醒 */
function shouldTrigger(record: DailyRecord): TriggerType | null {
  if (record.total_seconds >= THRESHOLDS.DURATION_LIMIT) {
    return 'duration';
  }
  if (record.consecutive_rounds >= THRESHOLDS.CONSECUTIVE_LIMIT) {
    return 'consecutive';
  }
  return null;
}

/** 检查是否在冷却期内 */
async function isInCooldown(): Promise<boolean> {
  const lastTime = await getLastTriggerTime();
  if (lastTime === 0) return false;
  return Date.now() - lastTime < THRESHOLDS.TRIGGER_COOLDOWN;
}

/** 尝试触发唤醒（含防重复检查） */
async function tryTrigger(tabId: number, triggerType: TriggerType): Promise<void> {
  // 检查冷却期
  if (await isInCooldown()) return;

  // 检查用户设置是否启用
  const settings = await getSettings();
  if (!settings.enabled) return;

  // 记录触发时间
  await setLastTriggerTime(Date.now());

  // 发送唤醒消息到 content script
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_AWAKENING' });
  } catch {
    // 标签页可能已关闭或无 content script
  }
}

/** 插件安装时初始化 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[EchoBreaker] 插件已安装/更新');

  // 加载网站配置
  await loadAIWebsites();

  // 设置默认设置
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (!result[STORAGE_KEYS.SETTINGS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: {
        enabled: true,
        durationThreshold: THRESHOLDS.DURATION_LIMIT,
        consecutiveThreshold: THRESHOLDS.CONSECUTIVE_LIMIT,
        scenario: 'default',
        dataUploadConsent: false,
        dailyApiLimit: THRESHOLDS.DAILY_API_LIMIT,
      },
    });
  }
});

/** Service Worker 启动时加载配置 */
chrome.runtime.onStartup.addListener(async () => {
  await loadAIWebsites();
});

/** 使用 chrome.alarms 实现持久化计时 */
chrome.alarms.create(ALARM_NAMES.TIMER, { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.TIMER) {
    await handleTimerAlarm();
  } else if (alarm.name === ALARM_NAMES.PAUSE_REMIND) {
    await handlePauseRemindAlarm();
  }
});

/** 每分钟计时检查：遍历所有标签页，对活跃的 AI 网站标签页累加时长 */
async function handleTimerAlarm(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const activeAITabIds: number[] = [];

    for (const tab of tabs) {
      if (tab.url && isAIWebsite(tab.url) && tab.active) {
        activeAITabIds.push(tab.id!);
      }
    }

    if (activeAITabIds.length > 0) {
      // 累加总时长和活跃时长
      await addDuration(60);
      await addActiveDuration(60);

      // 检查是否触发
      const record = await getTodayRecord();
      const triggerType = shouldTrigger(record);
      if (triggerType) {
        // 对第一个活跃 AI 标签页触发
        await tryTrigger(activeAITabIds[0], triggerType);
      }
    }
  } catch (err) {
    console.error('[EchoBreaker] 计时检查出错:', err);
  }
}

/** 暂停后再次提醒的 alarm 处理 */
async function handlePauseRemindAlarm(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.url && isAIWebsite(tab.url) && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AWAKENING' });
        } catch {
          // 标签页可能已关闭
        }
        break;
      }
    }
  } catch (err) {
    console.error('[EchoBreaker] 暂停提醒出错:', err);
  }
}

/** 监听来自 Content Script 的消息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SITE_CONFIG': {
      // 根据发送者标签页的 URL 返回匹配的网站配置
      const tabUrl = sender.tab?.url || '';
      const config = matchSiteConfig(tabUrl);
      sendResponse(config);
      return false;
    }

    case 'USER_ACTIVE': {
      // 用户活跃，累加活跃时长
      handleUserActive();
      return false;
    }

    case 'USER_PASTED': {
      // 用户粘贴，增加计数
      handleUserPasted();
      return false;
    }

    case 'USER_SENT_QUESTION': {
      // 用户发送问题
      handleUserQuestion(sender.tab?.id);
      return false;
    }

    case 'TRIGGER_DISMISSED': {
      // 用户选择"继续使用"，记录 dismissed，重置连续轮数
      handleTriggerDismissed();
      return false;
    }

    case 'TRIGGER_PAUSED': {
      // 用户选择"暂停思考"，记录 paused，重置连续轮数，设置5分钟后提醒
      handleTriggerPaused();
      return false;
    }

    case 'GET_TODAY_DATA': {
      // 返回今日数据
      getTodayRecord().then(sendResponse);
      return true; // 异步响应
    }

    case 'GET_WEEKLY_DATA': {
      // 返回最近7天数据
      getWeeklyData().then(sendResponse);
      return true; // 异步响应
    }

    case 'CHECK_CURRENT_SITE': {
      // Popup 查询当前标签页是否为 AI 网站
      handleCheckCurrentSite().then(sendResponse);
      return true;
    }

    case 'CLEAR_TODAY_DATA': {
      // 清除今日数据
      handleClearTodayData().then(() => sendResponse({ success: true }));
      return true;
    }
  }

  return false;
});

/** 处理用户活跃消息 */
async function handleUserActive(): Promise<void> {
  await addActiveDuration(60);
}

/** 处理用户粘贴消息 */
async function handleUserPasted(): Promise<void> {
  await incrementCopyPasteCount();
}

/** 处理用户发送问题 */
async function handleUserQuestion(tabId?: number): Promise<void> {
  await incrementConsecutiveRounds();
  await incrementQuestionCount();

  const record = await getTodayRecord();
  const triggerType = shouldTrigger(record);
  if (triggerType && tabId) {
    await tryTrigger(tabId, triggerType);
  }
}

/** 处理触发被关闭（继续使用） */
async function handleTriggerDismissed(): Promise<void> {
  await recordTrigger({
    timestamp: Date.now(),
    type: 'duration',
    action: 'dismissed',
  });
  await resetConsecutiveRounds();
}

/** 处理触发被暂停 */
async function handleTriggerPaused(): Promise<void> {
  await recordTrigger({
    timestamp: Date.now(),
    type: 'duration',
    action: 'paused',
  });
  await resetConsecutiveRounds();

  // 设置5分钟后再次提醒的 alarm
  chrome.alarms.create(ALARM_NAMES.PAUSE_REMIND, {
    delayInMinutes: THRESHOLDS.PAUSE_REMIND_DELAY,
  });
}

/** 处理查询当前标签页是否为 AI 网站 */
async function handleCheckCurrentSite(): Promise<{ isAI: boolean; siteName?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const config = matchSiteConfig(tab.url);
      if (config) {
        return { isAI: true, siteName: config.name };
      }
    }
  } catch {
    // 忽略错误
  }
  return { isAI: false };
}

/** 处理清除今日数据 */
async function handleClearTodayData(): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const usageData = data[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  delete usageData[today];
  await chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: usageData });
}

// 初始化时加载配置
loadAIWebsites();

console.log('[EchoBreaker] Background Service Worker 已启动');
