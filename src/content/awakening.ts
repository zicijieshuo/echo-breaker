// 回声破除者 - L1 主动唤醒层

/** 苏格拉底式反问文案库 */
const SOCRATIC_PROMPTS = [
  '在AI给出答案之前，你有没有先想想自己会怎么回答？',
  '这个问题你真正想弄清楚的是什么？',
  '如果让你只用一句话回答，你会说什么？',
  '你问这个问题时，心里是否已经有一个模糊的猜测？',
  '试着先写下你的第一反应，再看看AI怎么说。',
  '你是在寻求确认，还是在探索未知？',
  '如果AI的回答和你想的不一样，你会怎么判断谁对？',
  '这个问题的核心矛盾是什么？',
  '你有没有试过换个角度来想这个问题？',
  '先暂停一下，闭上眼睛，给自己30秒——你的直觉答案是什么？',
  '你是在思考，还是在寻找捷径？',
  '如果今天没有AI，你会怎么解决这个问题？',
  '这个问题有没有你忽略的前提条件？',
  '你真的理解了问题本身吗？试着用自己的话重新描述一遍。',
  'AI可以给你答案，但只有你能决定它是否值得相信。',
  '思考是一种肌肉记忆，越用越强——现在就是锻炼的时候。',
  '你上一次独立解决一个难题是什么时候？那种感觉还记得吗？',
  '别急，让子弹飞一会儿——你的大脑需要那几秒钟的启动时间。',
  'AI的回答是起点，不是终点。你的思考才是。',
  '每一个好问题背后，都有一个更好的问题在等着你。',
];

/** 向 background 发送消息的封装 */
function sendMessage(type: string, payload?: Record<string, unknown>): void {
  try {
    chrome.runtime.sendMessage({ type, payload });
  } catch {
    // 扩展上下文可能已失效，静默忽略
  }
}

/** 注入全局样式（仅一次） */
function injectStyles(): void {
  if (document.getElementById('echo-breaker-style')) return;

  const style = document.createElement('style');
  style.id = 'echo-breaker-style';
  style.textContent = `
    /* 边缘柔光动画 */
    @keyframes echoEdgeGlow {
      0% { opacity: 0; }
      30% { opacity: 1; }
      70% { opacity: 1; }
      100% { opacity: 0; }
    }

    /* 卡片淡入动画 */
    @keyframes echoCardFadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* 呼吸动画 */
    @keyframes echoBreathe {
      0%, 100% { opacity: 0.9; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.02); }
    }

    /* 关闭按钮悬停 */
    #echo-breaker-close:hover {
      background: #dce6f0;
    }
  `;
  document.head.appendChild(style);
}

/** 创建屏幕边缘柔光效果 */
function createEdgeGlow(): HTMLDivElement {
  const glow = document.createElement('div');
  glow.id = 'echo-breaker-edge-glow';
  glow.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow:
      inset 0 80px 60px -40px rgba(58, 124, 195, 0.25),
      inset 0 -80px 60px -40px rgba(58, 124, 195, 0.25),
      inset 80px 0 60px -40px rgba(58, 124, 195, 0.25),
      inset -80px 0 60px -40px rgba(58, 124, 195, 0.25);
    animation: echoEdgeGlow 2s ease-in-out;
  `;
  return glow;
}

/** 创建唤醒卡片 UI */
function createAwakeningCard(prompt: string): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.id = 'echo-breaker-awakening';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const card = document.createElement('div');
  card.style.cssText = `
    pointer-events: auto;
    position: relative;
    background: rgba(240, 245, 250, 0.95);
    color: #2c3e50;
    border-radius: 16px;
    padding: 32px 40px;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 0 60px rgba(58, 124, 195, 0.4), 0 0 120px rgba(91, 155, 213, 0.2);
    animation: echoCardFadeIn 0.5s ease-out forwards, echoBreathe 3s ease-in-out 0.5s infinite;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  // 关闭按钮（右上角 X）
  const closeBtn = document.createElement('div');
  closeBtn.id = 'echo-breaker-close';
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 14px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    cursor: pointer;
    color: #5b9bd5;
    font-size: 16px;
    line-height: 1;
    user-select: none;
    transition: background 0.2s;
  `;
  closeBtn.textContent = '✕';

  const content = document.createElement('div');
  content.innerHTML = `
    <div style="font-size: 28px; margin-bottom: 12px;">🧠</div>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${prompt}</p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="echo-dismiss" style="
        padding: 8px 20px;
        border-radius: 8px;
        border: 1px solid rgba(91, 155, 213, 0.3);
        background: transparent;
        color: #5b9bd5;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      ">继续使用</button>
      <button id="echo-pause" style="
        padding: 8px 20px;
        border-radius: 8px;
        border: none;
        background: #3a7cc3;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
      ">暂停思考</button>
    </div>
  `;

  card.appendChild(closeBtn);
  card.appendChild(content);
  overlay.appendChild(card);

  // 关闭弹窗的通用方法
  function dismissOverlay(): void {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s';
    setTimeout(() => overlay.remove(), 500);
  }

  // 绑定按钮事件
  setTimeout(() => {
    // "继续使用"：关闭弹窗，记录 dismiss，重置连续轮数
    document.getElementById('echo-dismiss')?.addEventListener('click', () => {
      dismissOverlay();
      sendMessage('TRIGGER_DISMISSED');
    });

    // "暂停思考"：关闭弹窗，记录 pause，重置连续轮数，5分钟后再次提醒
    document.getElementById('echo-pause')?.addEventListener('click', () => {
      dismissOverlay();
      sendMessage('TRIGGER_PAUSED');
    });

    // 关闭按钮：等同于"继续使用"
    document.getElementById('echo-breaker-close')?.addEventListener('click', () => {
      dismissOverlay();
      sendMessage('TRIGGER_DISMISSED');
    });
  }, 0);

  return overlay;
}

/** 随机获取一条文案 */
function getRandomPrompt(): string {
  return SOCRATIC_PROMPTS[Math.floor(Math.random() * SOCRATIC_PROMPTS.length)];
}

/** 显示唤醒 UI（含边缘柔光前置效果） */
function showAwakening(): void {
  // 避免重复弹窗
  if (document.getElementById('echo-breaker-awakening')) return;
  if (document.getElementById('echo-breaker-edge-glow')) return;

  injectStyles();

  // 先显示边缘柔光，1秒后显示卡片
  const glow = createEdgeGlow();
  document.body.appendChild(glow);

  setTimeout(() => {
    // 移除柔光效果
    glow.remove();

    // 再次检查避免竞态
    if (document.getElementById('echo-breaker-awakening')) return;

    const prompt = getRandomPrompt();
    const card = createAwakeningCard(prompt);
    document.body.appendChild(card);
  }, 1000);
}

/** 监听唤醒事件 */
document.addEventListener('echo-breaker-awaken', () => {
  showAwakening();
});

console.log('[EchoBreaker] L1 唤醒层已启动');
