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

/** 扩展上下文是否已失效 */
let contextInvalidated = false;

/** 检查扩展上下文是否仍然有效 */
function isContextValid(): boolean {
  if (contextInvalidated) return false;
  try {
    // 尝试访问 chrome.runtime.id，如果上下文失效会抛出异常
    if (!chrome.runtime?.id) {
      contextInvalidated = true;
      return false;
    }
  } catch {
    contextInvalidated = true;
    return false;
  }
  return true;
}

/** 向 background 发送消息的封装（带上下文失效检测） */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  if (!isContextValid()) {
    // 上下文已失效，停止所有定时器
    stopActiveReporting();
    return;
  }
  try {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || '';
        if (errMsg.includes('Extension context invalidated') || errMsg.includes('message port closed')) {
          console.warn('[EchoBreaker] 扩展上下文已失效，停止消息发送');
          contextInvalidated = true;
          stopActiveReporting();
        }
      }
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('Extension context invalidated')) {
      contextInvalidated = true;
      stopActiveReporting();
    }
  }
}

/** 带防抖的发送检测 */
function detectUserSentQuestion(source: string): void {
  const now = Date.now();
  if (now - lastSendTime < SEND_DEBOUNCE_MS) {
    return;
  }
  lastSendTime = now;
  console.log(`[EchoBreaker] 检测到用户发送问题（${source}）`);
  sendMessage('USER_SENT_QUESTION');
}

/** 从 background 获取当前网站配置（异步，不阻塞监听注册） */
async function fetchSiteConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_CONFIG' });
    if (response && response.domain) {
      siteConfig = response as AIWebsite;
      console.log(`[EchoBreaker] 已加载网站配置: ${siteConfig.name}`);
    } else {
      console.warn('[EchoBreaker] 未匹配到网站配置，使用通用检测');
    }
  } catch (err) {
    console.warn('[EchoBreaker] 获取网站配置失败，使用通用检测:', err);
  }
}

/** 多选择器容错匹配 */
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

    // 1. 优先匹配配置的选择器
    if (siteConfig?.sendButtonSelector && matchesAnySelector(target, siteConfig.sendButtonSelector)) {
      detectUserSentQuestion('按钮点击');
      return;
    }

    // 2. 通用兜底：匹配 role="button" 且在输入区域附近
    const buttonEl = target.closest('[role="button"]');
    if (buttonEl) {
      const textarea = document.querySelector('textarea, [contenteditable="true"]');
      if (textarea) {
        const parent = textarea.parentElement;
        if (parent && parent.contains(buttonEl)) {
          detectUserSentQuestion('按钮点击(通用)');
          return;
        }
      }
    }

    // 3. 通用兜底：匹配 SVG 图标按钮（很多AI网站用SVG做发送图标）
    const svgButton = target.closest('svg');
    if (svgButton) {
      const btnParent = svgButton.closest('button, [role="button"], [class*="send"]');
      if (btnParent) {
        const textarea = document.querySelector('textarea, [contenteditable="true"]');
        if (textarea) {
          const commonParent = textarea.parentElement;
          if (commonParent && commonParent.contains(btnParent)) {
            detectUserSentQuestion('SVG按钮');
            return;
          }
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

/** 监听表单提交事件 */
function monitorFormSubmit(): void {
  document.addEventListener('submit', () => {
    detectUserSentQuestion('表单提交');
  }, true);
}

/** 监听复制和粘贴事件 */
function monitorCopyPaste(): void {
  document.addEventListener('copy', () => {
    console.log('[EchoBreaker] 检测到复制操作');
    sendMessage('USER_PASTED');
  }, true);
  document.addEventListener('paste', () => {
    console.log('[EchoBreaker] 检测到粘贴操作');
    sendMessage('USER_PASTED');
  }, true);
}

/** 监听页面可见性变化 */
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

/** 初始化 L0 监测层 */
function init(): void {
  // 关键：先立即注册所有事件监听器，不依赖任何异步操作
  monitorSendButton();
  monitorEnterKey();
  monitorFormSubmit();
  monitorCopyPaste();
  monitorVisibility();
  listenForAwakening();

  if (document.visibilityState === 'visible') {
    startActiveReporting();
  }

  console.log('[EchoBreaker] L0 监测层已启动（事件监听已注册）');

  // 异步获取网站配置（不阻塞监听注册）
  fetchSiteConfig().then(() => {
    console.log('[EchoBreaker] 网站配置加载完成');
  });
}

init();
