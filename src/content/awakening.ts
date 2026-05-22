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

/** 创建"认知柔光"UI */
function createAwakeningUI(prompt: string): HTMLDivElement {
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
    background: rgba(30, 27, 75, 0.95);
    color: #e0e7ff;
    border-radius: 16px;
    padding: 32px 40px;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 0 60px rgba(99, 102, 241, 0.4), 0 0 120px rgba(129, 140, 248, 0.2);
    animation: echoBreathe 3s ease-in-out infinite;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;

  card.innerHTML = `
    <div style="font-size: 28px; margin-bottom: 12px;">🧠</div>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${prompt}</p>
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="echo-dismiss" style="
        padding: 8px 20px;
        border-radius: 8px;
        border: 1px solid rgba(129, 140, 248, 0.3);
        background: transparent;
        color: #a5b4fc;
        cursor: pointer;
        font-size: 14px;
      ">继续使用</button>
      <button id="echo-pause" style="
        padding: 8px 20px;
        border-radius: 8px;
        border: none;
        background: #6366f1;
        color: white;
        cursor: pointer;
        font-size: 14px;
      ">暂停思考</button>
    </div>
  `;

  overlay.appendChild(card);

  // 注入呼吸动画
  if (!document.getElementById('echo-breaker-style')) {
    const style = document.createElement('style');
    style.id = 'echo-breaker-style';
    style.textContent = `
      @keyframes echoBreathe {
        0%, 100% { opacity: 0.9; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.02); }
      }
    `;
    document.head.appendChild(style);
  }

  // 绑定按钮事件
  setTimeout(() => {
    document.getElementById('echo-dismiss')?.addEventListener('click', () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(() => overlay.remove(), 500);
      chrome.runtime.sendMessage({ type: 'USER_DISMISSED_TRIGGER' });
    });

    document.getElementById('echo-pause')?.addEventListener('click', () => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(() => overlay.remove(), 500);
      chrome.runtime.sendMessage({ type: 'USER_DISMISSED_TRIGGER' });
    });
  }, 0);

  return overlay;
}

/** 随机获取一条文案 */
function getRandomPrompt(): string {
  return SOCRATIC_PROMPTS[Math.floor(Math.random() * SOCRATIC_PROMPTS.length)];
}

/** 监听唤醒事件 */
document.addEventListener('echo-breaker-awaken', () => {
  // 避免重复弹窗
  if (document.getElementById('echo-breaker-awakening')) return;

  const prompt = getRandomPrompt();
  const ui = createAwakeningUI(prompt);
  document.body.appendChild(ui);
});

console.log('[EchoBreaker] L1 唤醒层已启动');
