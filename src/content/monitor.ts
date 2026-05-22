// 回声破除者 - L0 基础监测层

import type { AIWebsite } from '../lib/types';

/** 当前网站配置 */
let siteConfig: AIWebsite | null = null;

/** 页面是否处于活跃状态 */
let isActive = true;

/** 活跃状态定时上报的间隔（毫秒） */
const ACTIVE_REPORT_INTERVAL = 60_000;

/** 活跃状态上报定时器 */
let activeReportTimer: ReturnType<typeof setInterval> | null = null;

/** 发送检测防抖：同一秒内不重复计数 */
let lastSendTime = 0;
const SEND_DEBOUNCE_MS = 1000;

/** 向 background 发送消息的封装 */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  try {
    chrome.runtime.sendMessage({ type, payload });
  } catch {
    // 扩展上下文可能已失效（页面卸载等），静默忽略
  }
}

/** 带防抖的发送检测：避免 Enter+点击双重计数 */
function detectUserSentQuestion(source: string): void {
  const now = Date.now();
  if (now - lastSendTime < SEND_DEBOUNCE_MS) {
    console.log(`[EchoBreaker] 发送检测防抖忽略（${source}，距上次 ${now - lastSendTime}ms）`);
    return;
  }
  lastSendTime = now;
  console.log(`[EchoBreaker] 检测到用户发送问题（${source}）`);
  sendMessage('USER_SENT_QUESTION');
}

/** 从 background 获取当前网站配置 */
async function fetchSiteConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_CONFIG' });
    if (response && response.domain) {
      siteConfig = response as AIWebsite;
      console.log(`[EchoBreaker] 已加载网站配置: ${siteConfig.name}`);
    }
  } catch {
    console.warn('[EchoBreaker] 获取网站配置失败');
  }
}

/** 多选择器容错匹配：尝试逗号分隔的多个选择器 */
function matchesAnySelector(target: HTMLElement, selectorStr: string): boolean {
  if (!selectorStr) return false;
  const selectors = selectorStr.split(',').map((s) => s.trim()).filter(Boolean);
  for (const selector of selectors) {
    try {
      if (target.closest(selector)) return true;
    } catch {
      // 选择器语法异常，跳过
    }
  }
  return false;
}

/** 根据配置的 sendButtonSelector 精确匹配发送按钮 */
function matchesSendButton(target: HTMLElement): boolean {
  if (!siteConfig?.sendButtonSelector) return false;
  return matchesAnySelector(target, siteConfig.sendButtonSelector);
}

/** 判断元素是否为输入区域 */
function isInputElement(el: HTMLElement): boolean {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  if (siteConfig?.inputSelector && matchesAnySelector(el, siteConfig.inputSelector)) return true;
  return false;
}

/** 监听发送按钮点击 */
function monitorSendButton(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // 优先匹配配置的选择器
    if (siteConfig?.sendButtonSelector && matchesAnySelector(target, siteConfig.sendButtonSelector)) {
      detectUserSentQuestion('按钮点击');
      return;
    }

    // 通用兜底：匹配 role="button" 且在输入区域附近的元素
    const buttonEl = target.closest('[role="button"]');
    if (buttonEl) {
      // 检查按钮是否在输入区域容器内（向上3层）
      const inputArea = document.querySelector(siteConfig?.inputSelector || 'textarea');
      if (inputArea) {
        const inputContainer = inputArea.closest('div')?.parentElement;
        if (inputContainer && inputContainer.contains(buttonEl)) {
          detectUserSentQuestion('按钮点击(通用)');
          return;
        }
      }

      // 检查按钮是否紧邻输入框（兄弟元素）
      const textarea = document.querySelector('textarea, [contenteditable="true"]');
      if (textarea) {
        const parent = textarea.parentElement;
        if (parent && parent.contains(buttonEl)) {
          detectUserSentQuestion('按钮点击(兄弟)');
          return;
        }
      }
    }
  }, true);
}

/** 监听键盘 Enter 键发送 */
function monitorEnterKey(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

    const target = e.target as HTMLElement;
    if (isInputElement(target)) {
      detectUserSentQuestion('Enter键');
    }
  }, true);
}

/** 监听表单提交事件（部分 AI 网站使用 form submit） */
function monitorFormSubmit(): void {
  document.addEventListener('submit', () => {
    detectUserSentQuestion('表单提交');
  }, true);
}

/** 监听复制和粘贴事件 */
function monitorCopyPaste(): void {
  // 监听复制（用户从AI回复中复制内容）
  document.addEventListener('copy', () => {
    console.log('[EchoBreaker] 检测到复制操作');
    sendMessage('USER_PASTED');
  }, true);
  // 监听粘贴（用户粘贴内容到输入框）
  document.addEventListener('paste', () => {
    console.log('[EchoBreaker] 检测到粘贴操作');
    sendMessage('USER_PASTED');
  }, true);
}

/** 监听页面可见性变化，区分活跃/后台 */
function monitorVisibility(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      isActive = true;
      startActiveReporting();
    } else {
      isActive = false;
      stopActiveReporting();
    }
  });
}

/** 启动活跃状态定时上报 */
function startActiveReporting(): void {
  if (activeReportTimer) return;
  sendMessage('USER_ACTIVE');
  activeReportTimer = setInterval(() => {
    if (isActive) {
      sendMessage('USER_ACTIVE');
    }
  }, ACTIVE_REPORT_INTERVAL);
}

/** 停止活跃状态定时上报 */
function stopActiveReporting(): void {
  if (activeReportTimer) {
    clearInterval(activeReportTimer);
    activeReportTimer = null;
  }
}

/** 监听来自 background 的唤醒消息 */
function listenForAwakening(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TRIGGER_AWAKENING') {
      document.dispatchEvent(new CustomEvent('echo-breaker-awaken'));
    }
  });
}

/** 使用 requestIdleCallback 执行非紧急操作 */
function scheduleIdleTask(task: () => void): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(task);
  } else {
    setTimeout(task, 0);
  }
}

/** 初始化 L0 监测层 */
async function init(): Promise<void> {
  await fetchSiteConfig();

  scheduleIdleTask(() => {
    monitorSendButton();
    monitorEnterKey();
    monitorFormSubmit();
    monitorCopyPaste();
    monitorVisibility();
    listenForAwakening();

    if (document.visibilityState === 'visible') {
      startActiveReporting();
    }
  });

  console.log('[EchoBreaker] L0 监测层已启动');
}

init();
