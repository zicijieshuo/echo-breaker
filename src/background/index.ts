// 回声破除者 - Background Service Worker

import { THRESHOLDS, STORAGE_KEYS } from '../lib/constants';

/** 检查是否应该触发唤醒 */
function shouldTrigger(record: { total_seconds: number; consecutive_rounds: number }): boolean {
  return (
    record.total_seconds >= THRESHOLDS.DURATION_LIMIT ||
    record.consecutive_rounds >= THRESHOLDS.CONSECUTIVE_LIMIT
  );
}

/** 插件安装时初始化 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[EchoBreaker] 插件已安装/更新');

  // 设置默认设置
  chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
    if (!result[STORAGE_KEYS.SETTINGS]) {
      chrome.storage.local.set({
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
});

/** 使用 chrome.alarms 实现持久化计时 */
chrome.alarms.create('echoTimer', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'echoTimer') {
    // 每分钟检查活跃标签页是否为AI网站
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA, (result) => {
          const data = result[STORAGE_KEYS.USAGE_DATA] || {};
          const today = new Date().toISOString().split('T')[0];
          const record = data[today] || { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };

          // 累加60秒
          record.total_seconds += 60;
          data[today] = record;
          chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: data });

          // 检查是否触发
          if (shouldTrigger(record)) {
            chrome.tabs.sendMessage(tabs[0].id!, { type: 'TRIGGER_AWAKENING' });
          }
        });
      }
    });
  }
});

/** 监听来自 Content Script 的消息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'USER_SENT_QUESTION':
      // 用户发送了问题，增加连续轮数
      handleUserQuestion();
      break;
    case 'GET_TODAY_DATA':
      // 返回今日数据
      getTodayData().then(sendResponse);
      return true; // 异步响应
    case 'USER_DISMISSED_TRIGGER':
      // 用户关闭了唤醒提示，重置连续轮数
      resetConsecutive();
      break;
  }
});

async function handleUserQuestion(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const data = result[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  const record = data[today] || { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };

  record.consecutive_rounds += 1;
  data[today] = record;
  await chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: data });

  if (shouldTrigger(record)) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AWAKENING' });
    }
  }
}

async function getTodayData() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const data = result[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  return data[today] || { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };
}

async function resetConsecutive(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const data = result[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  if (data[today]) {
    data[today].consecutive_rounds = 0;
    await chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: data });
  }
}
