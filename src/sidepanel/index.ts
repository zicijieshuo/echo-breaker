// 回声破除者 - 侧边栏脚本（L3 元认知外显层）

import { STORAGE_KEYS } from '../lib/constants';

/** 保存思考日志 */
async function saveThoughtLog(thought: string, keyPoints: string): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const data = result[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];

  if (!data[today]) {
    data[today] = { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };
  }

  // 将思考日志存储
  const logKey = `echo_breaker_thoughts_${today}`;
  const logs = (await chrome.storage.local.get(logKey))[logKey] || [];
  logs.push({
    timestamp: Date.now(),
    thought,
    keyPoints,
  });
  await chrome.storage.local.set({ [logKey]: logs });
}

/** 监听输入 */
const thoughtInput = document.getElementById('thought-input') as HTMLTextAreaElement;
const keyPointsInput = document.getElementById('key-points-input') as HTMLInputElement;

// 自动保存
thoughtInput?.addEventListener('blur', () => {
  if (thoughtInput.value.trim()) {
    saveThoughtLog(thoughtInput.value, keyPointsInput?.value || '');
  }
});

console.log('[EchoBreaker] 侧边栏已加载');
