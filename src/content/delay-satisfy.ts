// 回声破除者 - L2 延迟满足层

/** 长按检测时间阈值（毫秒） */
const LONG_PRESS_DURATION = 3000;

let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let isGuidedMode = false;

/** 进入引导教育模式 */
function enterGuidedMode(): void {
  isGuidedMode = true;

  // 在输入框上方显示模式标签
  const label = document.createElement('div');
  label.id = 'echo-breaker-guided-label';
  label.style.cssText = `
    position: fixed;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483646;
    background: rgba(99, 102, 241, 0.9);
    color: white;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
  `;
  label.textContent = '🧠 引导教育模式已开启';
  document.body.appendChild(label);

  // 修改生成按钮样式
  const sendButtons = document.querySelectorAll('button[type="submit"], [data-testid="send-button"], .send-button');
  sendButtons.forEach((btn) => {
    (btn as HTMLElement).style.background = '#6366f1';
    (btn as HTMLElement).style.boxShadow = '0 0 12px rgba(99, 102, 241, 0.5)';
  });
}

/** 退出引导教育模式 */
function exitGuidedMode(): void {
  isGuidedMode = false;
  document.getElementById('echo-breaker-guided-label')?.remove();
}

/** 监听长按"生成"按钮 */
function monitorLongPress(): void {
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const sendButton = target.closest('button[type="submit"], [data-testid="send-button"], .send-button');
    if (sendButton) {
      longPressTimer = setTimeout(() => {
        if (!isGuidedMode) {
          enterGuidedMode();
        } else {
          exitGuidedMode();
        }
      }, LONG_PRESS_DURATION);
    }
  }, true);

  document.addEventListener('mouseup', () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }, true);
}

/** 引导模式 Prompt 模板 */
export function getGuidedPrompt(userQuestion: string): string {
  return `你是一个"思维教练"。用户问："${userQuestion}"。请先不要给出答案，而是按以下规则反问：
1. 请指出用户可能忽略的原文细节，并问："你注意到……吗？"
2. 请要求用户先摘录三个关键词语。
3. 请追问一个概念辨析问题（例如为什么用A而不是B）。
确保提问语气鼓励思考，不评判。`;
}

// 初始化长按监听
monitorLongPress();

console.log('[EchoBreaker] L2 延迟满足层已启动');
