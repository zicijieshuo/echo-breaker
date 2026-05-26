// 回声破除者 - L5 情境适应层

import type { Scenario, ScenarioStrategy } from '../lib/types';
import { SCENARIO_STRATEGIES } from '../lib/types';
import { SCENARIO_URL_RULES, SCENARIO_LABELS } from '../lib/constants';
import { getSettings, saveSettings, getDetectedScenario, saveDetectedScenario } from '../lib/storage';

/** 场景描述文案 */
const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  thesis: '严格干预，防止论文过度依赖AI',
  homework: '适度引导，鼓励独立完成作业',
  reading: '轻度提醒，专注阅读理解',
  exam: '最小干预，考试场景自由使用',
  default: '标准干预，平衡使用与思考',
};

/** 场景图标 */
const SCENARIO_ICONS: Record<Scenario, string> = {
  thesis: '📝',
  homework: '📚',
  reading: '📖',
  exam: '🎯',
  default: '⚙️',
};

/** 扩展上下文是否已失效 */
let contextInvalidated = false;

/** 当前生效的场景 */
let currentScenario: Scenario = 'default';

/** 当前生效的策略 */
let currentStrategy: ScenarioStrategy = SCENARIO_STRATEGIES.default;

/** 场景指示器元素 */
let indicatorEl: HTMLDivElement | null = null;

/** 场景选择下拉框元素 */
let dropdownEl: HTMLDivElement | null = null;

/** 向 background 发送消息的封装（带上下文失效检测） */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  if (contextInvalidated) return;
  try {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message || '';
        if (errMsg.includes('Extension context invalidated')) {
          console.warn('[EchoBreaker-L5] 扩展上下文已失效，停止消息发送');
          contextInvalidated = true;
        }
      }
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('Extension context invalidated')) {
      contextInvalidated = true;
    }
  }
}

// ============ 场景识别 ============

/** 从 URL 关键词检测场景 */
export function detectScenarioFromURL(url: string): Scenario {
  const urlLower = url.toLowerCase();

  for (const [scenario, keywords] of Object.entries(SCENARIO_URL_RULES)) {
    for (const keyword of keywords) {
      if (urlLower.includes(keyword.toLowerCase())) {
        return scenario as Scenario;
      }
    }
  }

  return 'default';
}

/** 获取当前场景（自动检测或手动设置） */
export async function getCurrentScenario(): Promise<Scenario> {
  try {
    const settings = await getSettings();

    if (settings.autoScenarioDetection) {
      const detected = detectScenarioFromURL(window.location.href);
      // 缓存检测结果
      await saveDetectedScenario(detected);
      currentScenario = detected;
      return detected;
    }

    // 手动模式：使用用户设置的场景
    currentScenario = settings.scenario;
    return settings.scenario;
  } catch {
    // 存储读取失败时使用缓存或默认值
    return currentScenario;
  }
}

// ============ 策略应用 ============

/** 获取指定场景的策略配置 */
export function getStrategyForScenario(scenario: Scenario): ScenarioStrategy {
  return SCENARIO_STRATEGIES[scenario];
}

/** 应用场景策略（调整阈值、自动开关功能） */
export async function applyScenarioStrategy(strategy: ScenarioStrategy): Promise<void> {
  currentStrategy = strategy;

  try {
    const settings = await getSettings();

    // 根据策略调整触发阈值
    const adjustedDuration = Math.round(settings.durationThreshold * strategy.triggerMultiplier);
    const adjustedConsecutive = Math.max(1, Math.round(settings.consecutiveThreshold * strategy.triggerMultiplier));

    // 构建需要更新的设置
    const updates: Partial<import('../lib/types').UserSettings> = {
      durationThreshold: adjustedDuration,
      consecutiveThreshold: adjustedConsecutive,
    };

    // 自动开启引导模式
    if (strategy.guidedModeAutoOn && !settings.guidedModeEnabled) {
      updates.guidedModeEnabled = true;
      // 通过内部事件通知 L2 层
      document.dispatchEvent(new CustomEvent('echo-breaker-guided-mode-change', {
        detail: { enabled: true },
      }));
    }

    // 自动开启强制思考输入
    if (strategy.forceThoughtAutoOn && !settings.forceThoughtInput) {
      updates.forceThoughtInput = true;
    }

    // 更新认知墙设置
    if (strategy.cognitiveWallEnabled !== settings.cognitiveWallEnabled) {
      updates.cognitiveWallEnabled = strategy.cognitiveWallEnabled;
    }
    if (strategy.similarityThreshold !== settings.cognitiveWallThreshold) {
      updates.cognitiveWallThreshold = strategy.similarityThreshold;
    }

    // 保存更新后的设置
    await saveSettings(updates);

    // 通知 background 场景已变更
    sendMessage('SCENARIO_CHANGED', {
      scenario: strategy.scenario,
      mode: strategy.mode,
      triggerMultiplier: strategy.triggerMultiplier,
      promptStyle: strategy.promptStyle,
    });

    console.log(`[EchoBreaker-L5] 已应用场景策略: ${strategy.scenario} (${strategy.mode})`);
  } catch (err) {
    // 存储操作失败时静默处理，不影响核心功能
    console.warn('[EchoBreaker-L5] 应用场景策略时存储操作失败，策略已在内存中生效');
    // 即使存储失败，策略仍在内存中生效
    sendMessage('SCENARIO_CHANGED', {
      scenario: strategy.scenario,
      mode: strategy.mode,
      triggerMultiplier: strategy.triggerMultiplier,
      promptStyle: strategy.promptStyle,
    });
  }
}

// ============ UI: 场景指示器 ============

/** 注入 L5 层样式 */
function injectStyles(): void {
  if (document.getElementById('echo-breaker-l5-style')) return;

  const style = document.createElement('style');
  style.id = 'echo-breaker-l5-style';
  style.textContent = `
    @keyframes echoL5FadeIn {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes echoL5Pulse {
      0%, 100% { box-shadow: 0 2px 8px rgba(91, 155, 213, 0.3); }
      50% { box-shadow: 0 2px 16px rgba(91, 155, 213, 0.6); }
    }
    #echo-breaker-scenario-indicator {
      animation: echoL5FadeIn 0.3s ease-out forwards;
    }
    #echo-breaker-scenario-indicator:hover {
      box-shadow: 0 2px 16px rgba(91, 155, 213, 0.6) !important;
      transform: scale(1.05);
    }
    .echo-l5-dropdown-item:hover {
      background: #f0f5fa !important;
    }
    .echo-l5-dropdown-item.active {
      background: rgba(91, 155, 213, 0.12) !important;
    }
  `;
  document.head.appendChild(style);
}

/** 创建场景指示器（右上角药丸形） */
function createIndicator(): HTMLDivElement {
  const indicator = document.createElement('div');
  indicator.id = 'echo-breaker-scenario-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483644;
    background: rgba(255, 255, 255, 0.95);
    color: #2c3e50;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 8px rgba(91, 155, 213, 0.3);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    user-select: none;
    transition: box-shadow 0.2s, transform 0.2s;
    border: 1px solid #dce6f0;
  `;

  updateIndicatorContent(indicator);

  indicator.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  return indicator;
}

/** 更新指示器显示内容 */
function updateIndicatorContent(indicator: HTMLDivElement): void {
  const icon = SCENARIO_ICONS[currentScenario];
  const label = SCENARIO_LABELS[currentScenario];
  indicator.innerHTML = `
    <span style="font-size: 14px;">${icon}</span>
    <span style="font-weight: 500;">${label}</span>
    <span style="color: #7f8c9b; font-size: 10px;">▼</span>
  `;
}

/** 切换下拉选择框 */
function toggleDropdown(): void {
  if (dropdownEl) {
    closeDropdown();
    return;
  }

  openDropdown();
}

/** 打开场景选择下拉框 */
function openDropdown(): void {
  if (dropdownEl) return;
  if (!indicatorEl) return;

  const indicatorRect = indicatorEl.getBoundingClientRect();

  const dropdown = document.createElement('div');
  dropdown.id = 'echo-breaker-scenario-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    top: ${indicatorRect.bottom + 6}px;
    right: 12px;
    z-index: 2147483644;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(44, 62, 80, 0.15), 0 0 0 1px #dce6f0;
    padding: 8px 0;
    min-width: 220px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    animation: echoL5FadeIn 0.2s ease-out forwards;
  `;

  const scenarios: Scenario[] = ['thesis', 'homework', 'reading', 'exam', 'default'];

  for (const scenario of scenarios) {
    const item = document.createElement('div');
    const isActive = scenario === currentScenario;
    item.className = `echo-l5-dropdown-item${isActive ? ' active' : ''}`;
    item.style.cssText = `
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background 0.15s;
      ${isActive ? 'background: rgba(91, 155, 213, 0.12);' : ''}
    `;

    const icon = SCENARIO_ICONS[scenario];
    const label = SCENARIO_LABELS[scenario];
    const desc = SCENARIO_DESCRIPTIONS[scenario];

    item.innerHTML = `
      <span style="font-size: 18px; flex-shrink: 0;">${icon}</span>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 500; color: #2c3e50;">${label}</div>
        <div style="font-size: 11px; color: #7f8c9b; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc}</div>
      </div>
      ${isActive ? '<span style="color: #3a7cc3; font-size: 14px; flex-shrink: 0;">✓</span>' : ''}
    `;

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectScenario(scenario);
    });

    dropdown.appendChild(item);
  }

  // 底部提示
  const hint = document.createElement('div');
  hint.style.cssText = `
    padding: 8px 16px 4px;
    border-top: 1px solid #dce6f0;
    margin-top: 4px;
    font-size: 10px;
    color: #7f8c9b;
    text-align: center;
  `;
  hint.textContent = '点击切换场景，自动调整干预策略';
  dropdown.appendChild(hint);

  document.body.appendChild(dropdown);
  dropdownEl = dropdown;

  // 点击外部关闭
  const closeOnOutsideClick = (e: MouseEvent): void => {
    if (dropdownEl && !dropdownEl.contains(e.target as Node) && indicatorEl && !indicatorEl.contains(e.target as Node)) {
      closeDropdown();
      document.removeEventListener('click', closeOnOutsideClick, true);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeOnOutsideClick, true);
  }, 0);
}

/** 关闭下拉选择框 */
function closeDropdown(): void {
  if (dropdownEl) {
    dropdownEl.remove();
    dropdownEl = null;
  }
}

/** 选择场景 */
async function selectScenario(scenario: Scenario): Promise<void> {
  closeDropdown();

  if (scenario === currentScenario) return;

  currentScenario = scenario;

  // 保存到设置（同时关闭自动检测，表示用户手动选择了）
  try {
    await saveSettings({
      scenario,
      autoScenarioDetection: false,
    });
    await saveDetectedScenario(scenario);
  } catch {
    // 存储操作失败时静默处理
  }

  // 应用策略
  const strategy = getStrategyForScenario(scenario);
  await applyScenarioStrategy(strategy);

  // 更新指示器内容
  if (indicatorEl) {
    updateIndicatorContent(indicatorEl);
  }

  console.log(`[EchoBreaker-L5] 用户手动切换场景: ${scenario}`);
}

// ============ 消息监听 ============

/** 监听来自 background 的 SCENARIO_DETECTED 消息 */
function listenForBackgroundMessages(): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (contextInvalidated) return;

    if (message.type === 'SCENARIO_DETECTED' && message.payload) {
      const scenario = message.payload.scenario as Scenario | undefined;
      if (scenario && scenario !== currentScenario) {
        handleScenarioDetected(scenario);
      }
    }
  });
}

/** 处理从 background 推送的场景检测结果 */
async function handleScenarioDetected(scenario: Scenario): Promise<void> {
  currentScenario = scenario;

  try {
    await saveDetectedScenario(scenario);
  } catch {
    // 静默处理
  }

  const strategy = getStrategyForScenario(scenario);
  await applyScenarioStrategy(strategy);

  // 更新指示器
  if (indicatorEl) {
    updateIndicatorContent(indicatorEl);
  }

  console.log(`[EchoBreaker-L5] 收到 background 场景检测: ${scenario}`);
}

// ============ 初始化 ============

/** 初始化 L5 情境适应层 */
async function init(): Promise<void> {
  injectStyles();

  // 检测当前场景
  const scenario = await getCurrentScenario();
  currentScenario = scenario;

  // 应用策略
  const strategy = getStrategyForScenario(scenario);
  await applyScenarioStrategy(strategy);

  // 创建场景指示器
  indicatorEl = createIndicator();
  document.body.appendChild(indicatorEl);

  // 监听 background 消息
  listenForBackgroundMessages();

  console.log(`[EchoBreaker] L5 情境适应层已启动 - 场景: ${scenario}`);
}

init();
