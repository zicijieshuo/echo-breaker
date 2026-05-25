// 回声破除者 - L5 认知墙层

import type { Scenario, CognitiveWallBlock } from '../lib/types';
import { THRESHOLDS } from '../lib/constants';
import { getSettings, saveCognitiveWallBlock } from '../lib/storage';

/** 扩展上下文是否已失效 */
let contextInvalidated = false;

/** 连续发送失败次数 */
let consecutiveFailures = 0;

/** 最大连续失败次数 */
const MAX_CONSECUTIVE_FAILURES = 3;

/** 缓存的最近 AI 回复文本 */
let cachedAIResponseText = '';

/** 当前待粘贴的文本（拦截时暂存） */
let pendingPasteText = '';

/** 当前拦截的输入元素（用于强制粘贴时恢复） */
let pendingPasteTarget: HTMLElement | null = null;

/** 向 background 发送消息的封装（带上下文失效检测） */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  if (contextInvalidated) return;
  try {
    chrome.runtime.sendMessage({ type, payload }, (_response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || '';
        if (errMsg.includes('Extension context invalidated')) {
          console.warn('[EchoBreaker-L5] 扩展上下文已失效，停止消息发送');
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

// ============ 文本相似度计算 ============

/** 生成文本的 trigram 集合 */
function getTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  return trigrams;
}

/** 计算两段文本的 trigram 相似度（Jaccard 系数） */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  if (text1 === text2) return 1;

  const trigrams1 = getTrigrams(text1);
  const trigrams2 = getTrigrams(text2);

  if (trigrams1.size === 0 || trigrams2.size === 0) return 0;

  let intersection = 0;
  for (const tri of trigrams1) {
    if (trigrams2.has(tri)) {
      intersection++;
    }
  }

  const union = trigrams1.size + trigrams2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ============ 认知墙核心检查 ============

/** 检查认知墙是否应拦截 */
async function checkCognitiveWall(
  userText: string,
  scenario: Scenario
): Promise<{ blocked: boolean; similarity: number }> {
  const settings = await getSettings();

  // 全局开关未开启
  if (!settings.cognitiveWallEnabled) {
    return { blocked: false, similarity: 0 };
  }

  // 仅在论文和作业场景下启用认知墙
  if (scenario !== 'thesis' && scenario !== 'homework') {
    return { blocked: false, similarity: 0 };
  }

  // 没有缓存的 AI 回复，无法比较
  if (!cachedAIResponseText) {
    return { blocked: false, similarity: 0 };
  }

  // 用户粘贴文本太短，跳过检查
  if (userText.length < 20) {
    return { blocked: false, similarity: 0 };
  }

  const similarity = calculateSimilarity(userText, cachedAIResponseText);
  const threshold = settings.cognitiveWallThreshold || THRESHOLDS.SIMILARITY_THRESHOLD;

  if (similarity > threshold) {
    return { blocked: true, similarity };
  }

  return { blocked: false, similarity };
}

// ============ 拦截 UI ============

/** 注入认知墙样式 */
function injectStyles(): void {
  if (document.getElementById('echo-breaker-l5-style')) return;

  const style = document.createElement('style');
  style.id = 'echo-breaker-l5-style';
  style.textContent = `
    @keyframes echoWallFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes echoWallCardIn {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
    @keyframes echoWallBreathe {
      0%, 100% { box-shadow: 0 0 20px rgba(224, 85, 85, 0.2), 0 4px 24px rgba(0,0,0,0.1); }
      50% { box-shadow: 0 0 30px rgba(224, 85, 85, 0.35), 0 4px 24px rgba(0,0,0,0.1); }
    }
    #echo-wall-dismiss:hover {
      background: #dce6f0 !important;
    }
    #echo-wall-force:hover {
      background: #c94444 !important;
    }
  `;
  document.head.appendChild(style);
}

/** 显示认知墙拦截 UI */
function showBlockUI(
  similarity: number,
  scenario: Scenario,
  userText: string
): void {
  // 避免重复弹窗
  if (document.getElementById('echo-breaker-cognitive-wall')) return;

  injectStyles();

  const similarityPercent = Math.round(similarity * 100);

  const overlay = document.createElement('div');
  overlay.id = 'echo-breaker-cognitive-wall';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(44, 62, 80, 0.3);
    backdrop-filter: blur(4px);
    animation: echoWallFadeIn 0.3s ease-out forwards;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    position: relative;
    background: #ffffff;
    color: #2c3e50;
    border-radius: 16px;
    padding: 32px 36px;
    max-width: 440px;
    width: 90%;
    text-align: center;
    border: 1px solid #dce6f0;
    animation: echoWallCardIn 0.4s ease-out forwards, echoWallBreathe 3s ease-in-out 0.4s infinite;
  `;

  // 盾牌图标
  const icon = document.createElement('div');
  icon.style.cssText = `
    font-size: 36px;
    margin-bottom: 12px;
    line-height: 1;
  `;
  icon.textContent = '🛡️';

  // 标题
  const title = document.createElement('div');
  title.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 12px;
  `;
  title.textContent = '认知墙拦截';

  // 消息
  const message = document.createElement('p');
  message.style.cssText = `
    font-size: 14px;
    line-height: 1.7;
    color: #7f8c9b;
    margin: 0 0 8px 0;
  `;
  message.textContent = `检测到你正在粘贴与AI回复高度相似的内容（相似度 ${similarityPercent}%）。请尝试用自己的话重新表达。`;

  // 相似度指示条
  const barContainer = document.createElement('div');
  barContainer.style.cssText = `
    width: 100%;
    height: 6px;
    background: #f0f5fa;
    border-radius: 3px;
    margin: 16px 0 24px 0;
    overflow: hidden;
  `;
  const barFill = document.createElement('div');
  const barColor = similarityPercent > 90 ? '#e05555' : similarityPercent > 80 ? '#e8a838' : '#5b9bd5';
  barFill.style.cssText = `
    height: 100%;
    width: ${Math.min(similarityPercent, 100)}%;
    background: ${barColor};
    border-radius: 3px;
    transition: width 0.6s ease-out;
  `;
  barContainer.appendChild(barFill);

  // 按钮区域
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: center;
  `;

  // "我重新写"按钮
  const dismissBtn = document.createElement('button');
  dismissBtn.id = 'echo-wall-dismiss';
  dismissBtn.style.cssText = `
    padding: 10px 24px;
    border-radius: 8px;
    border: 1px solid #dce6f0;
    background: #f0f5fa;
    color: #3a7cc3;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  `;
  dismissBtn.textContent = '我重新写';

  // "仍然粘贴"按钮
  const forceBtn = document.createElement('button');
  forceBtn.id = 'echo-wall-force';
  forceBtn.style.cssText = `
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: #e05555;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  `;
  forceBtn.textContent = '仍然粘贴';

  btnGroup.appendChild(dismissBtn);
  btnGroup.appendChild(forceBtn);

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(barContainer);
  card.appendChild(btnGroup);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // 关闭弹窗
  function dismissOverlay(): void {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s';
    setTimeout(() => overlay.remove(), 300);
  }

  // "我重新写"：记录为 blocked
  dismissBtn.addEventListener('click', () => {
    dismissOverlay();
    recordBlock(scenario, similarity, userText, cachedAIResponseText, 'blocked');
    sendMessage('COGNITIVE_WALL_BLOCKED', {
      action: 'blocked',
      similarity,
      scenario,
    });
  });

  // "仍然粘贴"：记录为 warned，执行粘贴
  forceBtn.addEventListener('click', () => {
    dismissOverlay();
    recordBlock(scenario, similarity, userText, cachedAIResponseText, 'warned');
    sendMessage('COGNITIVE_WALL_BLOCKED', {
      action: 'warned',
      similarity,
      scenario,
    });
    // 执行强制粘贴
    forcePaste();
  });

  // 点击遮罩层关闭（等同于"我重新写"）
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      dismissOverlay();
      recordBlock(scenario, similarity, userText, cachedAIResponseText, 'blocked');
      sendMessage('COGNITIVE_WALL_BLOCKED', {
        action: 'blocked',
        similarity,
        scenario,
      });
    }
  });
}

/** 记录拦截/警告事件 */
function recordBlock(
  scenario: Scenario,
  similarity: number,
  userText: string,
  aiText: string,
  action: CognitiveWallBlock['action']
): void {
  const block: CognitiveWallBlock = {
    id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now(),
    scenario,
    similarity,
    userText: userText.substring(0, 500),
    aiText: aiText.substring(0, 500),
    action,
  };

  saveCognitiveWallBlock(block).catch(() => {
    // 存储失败静默处理
  });
}

/** 强制粘贴被拦截的文本 */
function forcePaste(): void {
  if (!pendingPasteText) return;

  const target = pendingPasteTarget;
  if (!target) return;

  // textarea / input
  if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
    const el = target as HTMLTextAreaElement | HTMLInputElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const newValue = before + pendingPasteText + after;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      target.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, newValue);
    } else {
      el.value = newValue;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.setSelectionRange(start + pendingPasteText.length, start + pendingPasteText.length);
  }

  // contenteditable
  if (target.getAttribute('contenteditable') === 'true') {
    document.execCommand('insertText', false, pendingPasteText);
  }

  // 清理
  pendingPasteText = '';
  pendingPasteTarget = null;
}

// ============ 粘贴事件拦截 ============

/** 获取当前场景 */
async function getCurrentScenario(): Promise<Scenario> {
  try {
    const settings = await getSettings();
    return settings.scenario || 'default';
  } catch {
    return 'default';
  }
}

/** 监听粘贴事件 */
function monitorPasteEvents(): void {
  document.addEventListener('paste', async (e: ClipboardEvent) => {
    // 如果上下文已失效，不拦截
    if (contextInvalidated) return;

    // 获取粘贴的文本
    const clipboardText = e.clipboardData?.getData('text/plain') || '';
    if (!clipboardText || clipboardText.length < 20) return;

    // 获取当前场景
    const scenario = await getCurrentScenario();

    // 执行认知墙检查
    const result = await checkCognitiveWall(clipboardText, scenario);

    if (result.blocked) {
      // 阻止粘贴
      e.preventDefault();
      e.stopPropagation();

      // 暂存粘贴信息
      pendingPasteText = clipboardText;
      pendingPasteTarget = e.target as HTMLElement;

      // 显示拦截 UI
      showBlockUI(result.similarity, scenario, clipboardText);

      console.log(`[EchoBreaker-L5] 认知墙拦截：相似度 ${Math.round(result.similarity * 100)}%`);
    } else if (result.similarity > 0.5) {
      // 相似度较高但未超过阈值，记录为 allowed
      recordBlock(scenario, result.similarity, clipboardText, cachedAIResponseText, 'allowed');
    }
  }, true);
}

// ============ AI 回复缓存 ============

/** 使用 MutationObserver 监听 AI 回复 */
function cacheAIResponse(): void {
  const observer = new MutationObserver(() => {
    // 通用选择器：匹配常见的 AI 回复容器
    const selectors = [
      '[class*="prose"]',
      '[class*="markdown"]',
      '[class*="message"]',
      '[class*="response"]',
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        const lastEl = elements[elements.length - 1] as HTMLElement | undefined;
        if (lastEl) {
          const text = lastEl.innerText?.trim();
          if (text && text.length > 20 && text !== cachedAIResponseText) {
            cachedAIResponseText = text;
          }
        }
      } catch {
        // 选择器语法异常，跳过
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// ============ 监听 background 消息 ============

function listenForBackgroundMessages(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'COGNITIVE_WALL_RESULT' && message.payload) {
      const { blocked, similarity } = message.payload as { blocked: boolean; similarity: number };
      if (blocked) {
        // background 确认拦截
        console.log(`[EchoBreaker-L5] Background 确认拦截，相似度 ${Math.round(similarity * 100)}%`);
      }
    }

    if (message.type === 'SCENARIO_DETECTED' && message.payload) {
      const { scenario } = message.payload as { scenario: Scenario };
      console.log(`[EchoBreaker-L5] 场景更新: ${scenario}`);
    }
  });
}

// ============ 初始化 ============

function init(): void {
  // 立即注册事件监听
  monitorPasteEvents();
  listenForBackgroundMessages();
  cacheAIResponse();

  console.log('[EchoBreaker] L5 认知墙层已启动');
}

init();
