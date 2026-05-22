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

/** 向 background 发送消息的封装 */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  try {
    chrome.runtime.sendMessage({ type, payload });
  } catch {
    // 扩展上下文可能已失效（页面卸载等），静默忽略
  }
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

/** 监听发送按钮点击 */
function monitorSendButton(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (matchesSendButton(target)) {
      console.log('[EchoBreaker] 检测到发送按钮点击');
      sendMessage('USER_SENT_QUESTION');
    }
  }, true);
}

/** 监听键盘 Enter 键发送（很多 AI 网站支持 Enter 发送） */
function monitorEnterKey(): void {
  document.addEventListener('keydown', (e) => {
    // 只在输入框中按 Enter（非 Shift+Enter）时触发
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'TEXTAREA' ||
      target.getAttribute('contenteditable') === 'true' ||
      target.closest(siteConfig?.inputSelector || '__none__');

    if (isInput) {
      // 延迟发送消息，避免在用户按 Enter 换行时误触发
      // 大多数 AI 网站在 Enter 后会清空输入框，我们检测这个变化
      const inputBefore = (target as HTMLTextAreaElement).value || target.textContent || '';
      setTimeout(() => {
        const inputAfter = (target as HTMLTextAreaElement).value || target.textContent || '';
        // 如果输入框被清空了，说明消息已发送
        if (inputBefore.length > 0 && inputAfter.length === 0) {
          console.log('[EchoBreaker] 检测到 Enter 键发送（输入框已清空）');
          sendMessage('USER_SENT_QUESTION');
        }
      }, 300);
    }
  }, true);
}

/** 监听粘贴事件，通过消息通知 background */
function monitorPaste(): void {
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
  // 立即上报一次
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
  // 获取网站配置
  await fetchSiteConfig();

  // 使用 requestIdleCallback 延迟启动非紧急监听
  scheduleIdleTask(() => {
    monitorSendButton();
    monitorEnterKey();
    monitorPaste();
    monitorVisibility();
    listenForAwakening();

    // 页面初始可见时启动活跃上报
    if (document.visibilityState === 'visible') {
      startActiveReporting();
    }
  });

  console.log('[EchoBreaker] L0 监测层已启动');
}

init();
