// 回声破除者 - L2 延迟满足层

import type { AIWebsite } from '../lib/types';

/** 长按检测时间阈值（毫秒） */
const LONG_PRESS_DURATION = 3000;

/** 进度环动画帧率间隔（毫秒） */
const PROGRESS_ANIMATION_INTERVAL = 16;

/** 当前网站配置 */
let siteConfig: AIWebsite | null = null;

/** 引导教育模式状态 */
let isGuidedMode = false;

/** 长按定时器 */
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

/** 进度动画定时器 */
let progressAnimTimer: ReturnType<typeof setInterval> | null = null;

/** 长按开始时间戳 */
let longPressStartTime = 0;

/** 当前长按的按钮元素 */
let currentLongPressButton: HTMLElement | null = null;

/** 进度环 SVG 元素 */
let progressRing: SVGSVGElement | null = null;

/** 扩展上下文是否已失效 */
let contextInvalidated = false;

/** 连续发送失败次数 */
let consecutiveFailures = 0;

/** 最大连续失败次数 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** 对话上下文：最近一次用户问题 */
let lastUserQuestion = '';

/** 对话上下文：最近一次 AI 回答 */
let lastAIAnswer = '';

/** LLM 生成的引导 Prompt 缓存 */
let cachedLLMPrompt: string | null = null;

/** 向 background 发送消息的封装（带上下文失效检测） */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  if (contextInvalidated) return;
  try {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || '';
        if (errMsg.includes('Extension context invalidated')) {
          console.warn('[EchoBreaker-L2] 扩展上下文已失效，停止消息发送');
          contextInvalidated = true;
        } else if (errMsg.includes('message port closed')) {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            contextInvalidated = true;
          }
        }
      } else {
        consecutiveFailures = 0;
      }
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('Extension context invalidated')) {
      contextInvalidated = true;
    }
  }
}

/** 从 background 获取当前网站配置 */
async function fetchSiteConfig(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_SITE_CONFIG' });
    if (response && response.domain) {
      siteConfig = response as AIWebsite;
    }
  } catch {
    // 静默处理
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

/** 判断点击目标是否为发送按钮（复用 monitor.ts 的检测逻辑） */
function isSendButton(target: HTMLElement): boolean {
  // 1. 优先匹配配置的选择器
  if (siteConfig?.sendButtonSelector && matchesAnySelector(target, siteConfig.sendButtonSelector)) {
    return true;
  }

  // 2. 通用兜底：匹配 role="button" 且在输入区域附近
  const buttonEl = target.closest('[role="button"]');
  if (buttonEl) {
    const textarea = document.querySelector('textarea, [contenteditable="true"]');
    if (textarea) {
      const parent = textarea.parentElement;
      if (parent && parent.contains(buttonEl)) {
        return true;
      }
    }
  }

  // 3. 通用兜底：匹配 SVG 图标按钮
  const svgButton = target.closest('svg');
  if (svgButton) {
    const btnParent = svgButton.closest('button, [role="button"], [class*="send"]');
    if (btnParent) {
      const textarea = document.querySelector('textarea, [contenteditable="true"]');
      if (textarea) {
        const commonParent = textarea.parentElement;
        if (commonParent && commonParent.contains(btnParent)) {
          return true;
        }
      }
    }
  }

  // 4. 通用兜底：button[type="submit"] 等常见发送按钮
  const btnEl = target.closest('button');
  if (btnEl) {
    const textarea = document.querySelector('textarea, [contenteditable="true"]');
    if (textarea) {
      const parent = textarea.parentElement;
      if (parent && parent.contains(btnEl)) {
        return true;
      }
    }
  }

  return false;
}

/** 获取发送按钮的实际按钮元素（用于定位进度环） */
function getButtonElement(target: HTMLElement): HTMLElement | null {
  // 尝试逐级向上找到按钮容器
  const buttonEl =
    target.closest('button') ||
    target.closest('[role="button"]') ||
    target.closest('[class*="send"]') ||
    target;
  return buttonEl as HTMLElement;
}

/** 创建进度环 SVG */
function createProgressRing(button: HTMLElement): SVGSVGElement {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) + 12;
  const center = size / 2;
  const radius = center - 3;
  const circumference = 2 * Math.PI * radius;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2 - size / 2}px;
    top: ${rect.top + rect.height / 2 - size / 2}px;
    z-index: 2147483645;
    pointer-events: none;
    transform: rotate(-90deg);
  `;

  // 背景圆环
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', String(center));
  bgCircle.setAttribute('cy', String(center));
  bgCircle.setAttribute('r', String(radius));
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'rgba(58, 124, 195, 0.2)');
  bgCircle.setAttribute('stroke-width', '3');

  // 进度圆环
  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', String(center));
  progressCircle.setAttribute('cy', String(center));
  progressCircle.setAttribute('r', String(radius));
  progressCircle.setAttribute('fill', 'none');
  progressCircle.setAttribute('stroke', '#3a7cc3');
  progressCircle.setAttribute('stroke-width', '3');
  progressCircle.setAttribute('stroke-linecap', 'round');
  progressCircle.setAttribute('stroke-dasharray', String(circumference));
  progressCircle.setAttribute('stroke-dashoffset', String(circumference));
  progressCircle.id = 'echo-breaker-progress-circle';

  svg.appendChild(bgCircle);
  svg.appendChild(progressCircle);
  document.body.appendChild(svg);

  return svg;
}

/** 更新进度环 */
function updateProgress(elapsed: number): void {
  const circle = document.getElementById('echo-breaker-progress-circle');
  if (!circle) return;

  const radius = parseFloat(circle.getAttribute('r') || '0');
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(elapsed / LONG_PRESS_DURATION, 1);
  const offset = circumference * (1 - progress);

  circle.setAttribute('stroke-dashoffset', String(offset));

  // 接近完成时变色
  if (progress > 0.8) {
    circle.setAttribute('stroke', '#5b9bd5');
  }
}

/** 移除进度环 */
function removeProgressRing(): void {
  if (progressRing) {
    progressRing.remove();
    progressRing = null;
  }
  const circle = document.getElementById('echo-breaker-progress-circle');
  if (circle) {
    circle.closest('svg')?.remove();
  }
}

/** 给按钮添加脉冲效果 */
function addPulseEffect(button: HTMLElement): void {
  button.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
  button.dataset.echoOriginalBoxShadow = button.style.boxShadow;
  button.dataset.echoOriginalTransform = button.style.transform;

  let pulsePhase = false;
  function pulseTick(): void {
    if (!currentLongPressButton) return;
    pulsePhase = !pulsePhase;
    button.style.boxShadow = pulsePhase
      ? '0 0 16px rgba(58, 124, 195, 0.7), 0 0 32px rgba(58, 124, 195, 0.3)'
      : '0 0 8px rgba(58, 124, 195, 0.4)';
    button.style.transform = pulsePhase ? 'scale(1.05)' : 'scale(1)';
  }

  progressAnimTimer = setInterval(pulseTick, 400);
  pulseTick();
}

/** 移除按钮脉冲效果 */
function removePulseEffect(button: HTMLElement): void {
  if (progressAnimTimer) {
    clearInterval(progressAnimTimer);
    progressAnimTimer = null;
  }
  button.style.boxShadow = button.dataset.echoOriginalBoxShadow || '';
  button.style.transform = button.dataset.echoOriginalTransform || '';
  delete button.dataset.echoOriginalBoxShadow;
  delete button.dataset.echoOriginalTransform;
}

/** 开始长按检测 */
function startLongPress(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  if (!isSendButton(target)) return;

  const button = getButtonElement(target);
  if (!button) return;

  currentLongPressButton = button;
  longPressStartTime = Date.now();

  // 创建进度环
  progressRing = createProgressRing(button);

  // 添加脉冲效果
  addPulseEffect(button);

  // 启动进度动画
  progressAnimTimer = setInterval(() => {
    const elapsed = Date.now() - longPressStartTime;
    updateProgress(elapsed);

    if (elapsed >= LONG_PRESS_DURATION) {
      // 长按完成，切换引导模式
      cancelLongPress();
      toggleGuidedMode();
    }
  }, PROGRESS_ANIMATION_INTERVAL);
}

/** 取消长按（释放或超时完成） */
function cancelLongPress(): void {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (progressAnimTimer) {
    clearInterval(progressAnimTimer);
    progressAnimTimer = null;
  }

  removeProgressRing();

  if (currentLongPressButton) {
    removePulseEffect(currentLongPressButton);
    currentLongPressButton = null;
  }
}

/** 切换引导教育模式 */
function toggleGuidedMode(): void {
  if (isGuidedMode) {
    exitGuidedMode();
  } else {
    enterGuidedMode();
  }
  sendMessage('GUIDED_MODE_TRIGGERED', { enabled: isGuidedMode });
}

/** 注入 L2 层样式 */
function injectStyles(): void {
  if (document.getElementById('echo-breaker-l2-style')) return;

  const style = document.createElement('style');
  style.id = 'echo-breaker-l2-style';
  style.textContent = `
    @keyframes echoGuidedBreathe {
      0%, 100% { opacity: 0.92; transform: translateX(-50%) scale(1); }
      50% { opacity: 1; transform: translateX(-50%) scale(1.02); }
    }
    @keyframes echoGuidedPulse {
      0%, 100% { box-shadow: 0 0 8px rgba(58, 124, 195, 0.4); }
      50% { box-shadow: 0 0 20px rgba(58, 124, 195, 0.8), 0 0 40px rgba(58, 124, 195, 0.3); }
    }
    .echo-breaker-guided-btn {
      animation: echoGuidedPulse 2s ease-in-out infinite !important;
      background: #3a7cc3 !important;
      box-shadow: 0 0 12px rgba(58, 124, 195, 0.5) !important;
    }
    #echo-breaker-guided-close:hover {
      background: #dce6f0 !important;
    }
  `;
  document.head.appendChild(style);
}

/** 进入引导教育模式 */
function enterGuidedMode(): void {
  isGuidedMode = true;
  injectStyles();

  // 创建顶部浮动标签
  const label = document.createElement('div');
  label.id = 'echo-breaker-guided-label';
  label.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483646;
    background: rgba(58, 124, 195, 0.9);
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px rgba(58, 124, 195, 0.4);
    display: flex;
    align-items: center;
    gap: 8px;
    animation: echoGuidedBreathe 3s ease-in-out infinite;
    user-select: none;
  `;

  const textSpan = document.createElement('span');
  textSpan.textContent = '🧠 引导教育模式';

  const closeBtn = document.createElement('span');
  closeBtn.id = 'echo-breaker-guided-close';
  closeBtn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    transition: background 0.2s;
    background: #dce6f0;
  `;
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    exitGuidedMode();
    sendMessage('GUIDED_MODE_TRIGGERED', { enabled: false });
  });

  label.appendChild(textSpan);
  label.appendChild(closeBtn);
  document.body.appendChild(label);

  // 修改发送按钮样式
  applyGuidedButtonStyles();

  console.log('[EchoBreaker-L2] 引导教育模式已开启');
}

/** 给所有发送按钮添加引导模式样式 */
function applyGuidedButtonStyles(): void {
  const buttons = findAllSendButtons();
  buttons.forEach((btn) => {
    btn.classList.add('echo-breaker-guided-btn');
  });
}

/** 移除所有发送按钮的引导模式样式 */
function removeGuidedButtonStyles(): void {
  const buttons = document.querySelectorAll('.echo-breaker-guided-btn');
  buttons.forEach((btn) => {
    btn.classList.remove('echo-breaker-guided-btn');
  });
}

/** 查找页面上所有发送按钮 */
function findAllSendButtons(): HTMLElement[] {
  const buttons: HTMLElement[] = [];

  // 1. 配置选择器匹配
  if (siteConfig?.sendButtonSelector) {
    const selectors = siteConfig.sendButtonSelector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const selector of selectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          buttons.push(el as HTMLElement);
        });
      } catch {
        // 选择器语法异常
      }
    }
  }

  // 2. 通用兜底：输入区域附近的按钮
  const textareas = document.querySelectorAll('textarea, [contenteditable="true"]');
  textareas.forEach((textarea) => {
    const parent = textarea.parentElement;
    if (!parent) return;

    // 查找附近的 button
    parent.querySelectorAll('button').forEach((btn) => {
      if (!buttons.includes(btn as HTMLElement)) {
        buttons.push(btn as HTMLElement);
      }
    });

    // 查找附近的 role="button"
    parent.querySelectorAll('[role="button"]').forEach((btn) => {
      if (!buttons.includes(btn as HTMLElement)) {
        buttons.push(btn as HTMLElement);
      }
    });
  });

  return buttons;
}

/** 退出引导教育模式 */
function exitGuidedMode(): void {
  isGuidedMode = false;

  // 移除顶部标签
  document.getElementById('echo-breaker-guided-label')?.remove();

  // 移除按钮样式
  removeGuidedButtonStyles();

  console.log('[EchoBreaker-L2] 引导教育模式已关闭');
}

/** 获取用户输入框中的文本 */
function getUserInput(): string {
  // 尝试 textarea
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    return textarea.value.trim();
  }

  // 尝试 contenteditable
  const editable = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (editable) {
    return editable.innerText?.trim() || '';
  }

  return '';
}

/** 设置用户输入框中的文本 */
function setUserInput(text: string): void {
  // 尝试 textarea
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
  if (textarea) {
    // 使用 nativeInputValueSetter 来正确触发 React 等框架的 onChange
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // 尝试 contenteditable
  const editable = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
  if (editable) {
    editable.innerText = text;
    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/** 内置引导 Prompt 模板 */
function getBuiltInPrompt(userQuestion: string): string {
  return `你是一个"思维教练"，你的目标不是给出答案，而是通过提问引导用户自己思考。用户的问题："${userQuestion}"

请严格按以下步骤回应，不要直接回答用户的问题：

1. **指出细节**：请指出用户可能忽略的关键细节，用"你注意到……吗？"的句式提问。
2. **提取关键词**：请要求用户从问题中摘录三个最关键的术语，并解释为什么选择这三个。
3. **概念辨析**：请追问一个概念辨析问题，例如"为什么用A而不是B？"或"A和C有什么本质区别？"。

注意事项：
- 语气要鼓励思考，不评判
- 每次只问一个问题，不要一次抛出全部
- 如果用户回答了，继续追问更深层次的问题
- 绝对不要直接给出答案`;
}

/** 生成引导 Prompt（优先使用 LLM，否则使用内置模板） */
export function getGuidedPrompt(userQuestion: string): string {
  if (cachedLLMPrompt) {
    return cachedLLMPrompt;
  }
  return getBuiltInPrompt(userQuestion);
}

/** 拦截用户发送，修改输入内容 */
function interceptSend(): void {
  if (!isGuidedMode) return;

  const userInput = getUserInput();
  if (!userInput) return;

  // 保存上下文
  lastUserQuestion = userInput;

  // 生成引导 Prompt
  const guidedPrompt = getGuidedPrompt(userInput);

  // 修改输入框内容
  setUserInput(guidedPrompt);

  // 请求 LLM 生成个性化 Prompt（异步，下次使用）
  requestLLMPrompt(userInput);

  console.log('[EchoBreaker-L2] 已拦截用户发送，注入引导 Prompt');
}

/** 请求 LLM 生成个性化引导 Prompt */
function requestLLMPrompt(userQuestion: string): void {
  sendMessage('REQUEST_GUIDED_PROMPT', {
    question: userQuestion,
    lastQuestion: lastUserQuestion,
    lastAnswer: lastAIAnswer,
  });
}

/** 监听来自 background 的消息 */
function listenForBackgroundMessages(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'GUIDED_PROMPT_RESULT' && message.payload) {
      const prompt = message.payload.prompt as string | undefined;
      if (prompt) {
        cachedLLMPrompt = prompt;
        console.log('[EchoBreaker-L2] 收到 LLM 生成的引导 Prompt');
      }
    }
    if (message.type === 'TOGGLE_GUIDED_MODE') {
      if (isGuidedMode) {
        exitGuidedMode();
      } else {
        enterGuidedMode();
      }
    }
  });
}

/** 监听 AI 回答出现（用于上下文追踪） */
function monitorAIResponse(): void {
  // 使用 MutationObserver 监听 AI 回答区域
  const observer = new MutationObserver(() => {
    if (!isGuidedMode) return;

    // 尝试从配置的选择器获取回答
    if (siteConfig?.responseSelector) {
      const selectors = siteConfig.responseSelector.split(',').map((s) => s.trim()).filter(Boolean);
      for (const selector of selectors) {
        try {
          const responseEl = document.querySelector(selector);
          if (responseEl) {
            const text = (responseEl as HTMLElement).innerText?.trim();
            if (text && text !== lastAIAnswer && text.length > 20) {
              lastAIAnswer = text;
            }
          }
        } catch {
          // 选择器语法异常
        }
      }
    }

    // 通用兜底：查找最后一个长文本块
    if (!siteConfig?.responseSelector) {
      const proseElements = document.querySelectorAll(
        '[class*="prose"], [class*="markdown"], [class*="message"], [class*="response"]'
      );
      const lastEl = proseElements[proseElements.length - 1] as HTMLElement | undefined;
      if (lastEl) {
        const text = lastEl.innerText?.trim();
        if (text && text !== lastAIAnswer && text.length > 20) {
          lastAIAnswer = text;
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/** 监听长按发送按钮 */
function monitorLongPress(): void {
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (!isSendButton(target)) return;

    e.preventDefault();
    startLongPress(e);
  }, true);

  document.addEventListener('mouseup', () => {
    if (currentLongPressButton) {
      cancelLongPress();
    }
  }, true);

  document.addEventListener('mouseleave', () => {
    if (currentLongPressButton) {
      cancelLongPress();
    }
  }, true);

  // 触摸设备支持
  document.addEventListener('touchstart', (e) => {
    const target = e.target as HTMLElement;
    if (!isSendButton(target)) return;

    const touch = e.touches[0];
    const mouseEvent = {
      target: e.target,
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
    } as unknown as MouseEvent;
    startLongPress(mouseEvent);
  }, true);

  document.addEventListener('touchend', () => {
    if (currentLongPressButton) {
      cancelLongPress();
    }
  }, true);

  document.addEventListener('touchcancel', () => {
    if (currentLongPressButton) {
      cancelLongPress();
    }
  }, true);
}

/** 监听用户发送（拦截并修改输入） */
function monitorSendInterception(): void {
  // 拦截 Enter 键发送
  document.addEventListener('keydown', (e) => {
    if (!isGuidedMode) return;
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;

    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.getAttribute('contenteditable') === 'true';

    if (isInput) {
      // 延迟拦截，让原始输入先完成
      setTimeout(() => {
        interceptSend();
      }, 50);
    }
  }, true);

  // 拦截按钮点击发送
  document.addEventListener('click', (e) => {
    if (!isGuidedMode) return;

    const target = e.target as HTMLElement;
    if (isSendButton(target)) {
      // 延迟拦截，让原始事件先完成
      setTimeout(() => {
        interceptSend();
      }, 50);
    }
  }, true);

  // 拦截表单提交
  document.addEventListener('submit', () => {
    if (!isGuidedMode) return;
    setTimeout(() => {
      interceptSend();
    }, 50);
  }, true);
}

/** 定期刷新发送按钮样式（处理动态 DOM 变化） */
function refreshButtonStyles(): void {
  if (!isGuidedMode) return;
  applyGuidedButtonStyles();
}

/** 初始化 L2 延迟满足层 */
function init(): void {
  // 立即注册事件监听
  monitorLongPress();
  monitorSendInterception();
  listenForBackgroundMessages();
  monitorAIResponse();

  // 定期刷新按钮样式（应对 SPA 动态渲染）
  setInterval(refreshButtonStyles, 2000);

  console.log('[EchoBreaker] L2 延迟满足层已启动');

  // 异步获取网站配置
  fetchSiteConfig().then(() => {
    console.log('[EchoBreaker-L2] 网站配置加载完成');
  });
}

init();
