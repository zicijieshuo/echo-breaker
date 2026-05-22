// 回声破除者 - L0 基础监测层

import { STORAGE_KEYS } from '../lib/constants';

/** 监听用户发送按钮点击 */
function monitorSendButton(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // 尝试匹配常见的发送按钮
    const sendButton = target.closest('button[type="submit"], [data-testid="send-button"], .send-button');
    if (sendButton) {
      chrome.runtime.sendMessage({ type: 'USER_SENT_QUESTION' });
    }
  }, true);
}

/** 监听输入框内容变化（区分手动输入 vs 粘贴） */
function monitorInput(): void {
  document.addEventListener('paste', () => {
    // 检测到粘贴行为
    chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA, (result) => {
      const data = result[STORAGE_KEYS.USAGE_DATA] || {};
      const today = new Date().toISOString().split('T')[0];
      const record = data[today] || { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };
      record.copy_paste_count += 1;
      data[today] = record;
      chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: data });
    });
  }, true);
}

/** 监听来自 Background 的唤醒消息 */
function listenForAwakening(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TRIGGER_AWAKENING') {
      showAwakening();
    }
  });
}

/** 显示唤醒提示（由 awakening.ts 处理） */
function showAwakening(): void {
  // 触发自定义事件，由 awakening 模块监听
  document.dispatchEvent(new CustomEvent('echo-breaker-awaken'));
}

// 初始化监测
monitorSendButton();
monitorInput();
listenForAwakening();

console.log('[EchoBreaker] L0 监测层已启动');
