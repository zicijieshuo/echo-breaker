// 回声破除者 - 侧边栏脚本（L3 元认知外显层）

import { getThoughtLogs, saveThoughtLog, updateThoughtLog } from '../lib/storage';
import { ThoughtLog, BiasAnalysis } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';

// ============ 状态 ============

let currentQuestion = '';
let currentAiAnswer = '';
let currentLogId: string | null = null;
let thoughtSaved = false;

// ============ DOM 元素 ============

const questionText = document.getElementById('question-text') as HTMLSpanElement;
const questionPlaceholder = document.getElementById('question-placeholder') as HTMLSpanElement;
const myThoughtInput = document.getElementById('myThought') as HTMLTextAreaElement;
const keyPointsInput = document.getElementById('keyPoints') as HTMLInputElement;
const saveThoughtBtn = document.getElementById('save-thought-btn') as HTMLButtonElement;
const saveSuccess = document.getElementById('save-success') as HTMLDivElement;
const thoughtReminder = document.getElementById('thought-reminder') as HTMLDivElement;
const analysisSection = document.getElementById('analysis-section') as HTMLElement;
const requestAnalysisBtn = document.getElementById('request-analysis-btn') as HTMLButtonElement;
const analysisLoading = document.getElementById('analysis-loading') as HTMLDivElement;
const analysisResult = document.getElementById('analysis-result') as HTMLDivElement;
const scoreCircle = document.getElementById('score-circle') as HTMLDivElement;
const missingList = document.getElementById('missing-list') as HTMLUListElement;
const strengthList = document.getElementById('strength-list') as HTMLUListElement;
const suggestionList = document.getElementById('suggestion-list') as HTMLUListElement;
const historyList = document.getElementById('history-list') as HTMLDivElement;
const historyEmpty = document.getElementById('history-empty') as HTMLParagraphElement;

// ============ 工具函数 ============

/** 生成唯一 ID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/** 根据分数获取颜色 */
function getScoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#fbbf24';
  if (score >= 40) return '#fb923c';
  return '#f87171';
}

/** 格式化时间戳 */
function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

/** 截断文本 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

// ============ 当前问题显示 ============

function displayQuestion(question: string): void {
  currentQuestion = question;
  if (question) {
    questionText.textContent = question;
    questionText.style.display = 'inline';
    questionPlaceholder.style.display = 'none';
  } else {
    questionText.style.display = 'none';
    questionPlaceholder.style.display = 'inline';
  }
}

// ============ 想法提醒 ============

function updateReminder(): void {
  if (thoughtSaved || myThoughtInput.value.trim().length > 0) {
    thoughtReminder.style.display = 'none';
  } else {
    thoughtReminder.style.display = 'block';
  }
}

// ============ 保存想法 ============

async function handleSaveThought(): Promise<void> {
  const myThought = myThoughtInput.value.trim();
  const keyPoints = keyPointsInput.value.trim();

  if (!myThought) {
    thoughtReminder.style.display = 'block';
    thoughtReminder.style.animation = 'none';
    // 触发 reflow 以重启动画
    void thoughtReminder.offsetHeight;
    thoughtReminder.style.animation = '';
    return;
  }

  const log: ThoughtLog = {
    id: generateId(),
    timestamp: Date.now(),
    question: currentQuestion,
    myThought,
    keyPoints,
    aiAnswer: currentAiAnswer || undefined,
  };

  await saveThoughtLog(log);
  currentLogId = log.id;
  thoughtSaved = true;

  // 更新 UI
  updateReminder();
  saveSuccess.style.display = 'block';
  setTimeout(() => {
    saveSuccess.style.display = 'none';
  }, 2000);

  // 如果已有 AI 回答，显示偏差分析区
  if (currentAiAnswer) {
    showAnalysisSection();
  }

  // 刷新历史
  await loadHistory();
}

// ============ 偏差分析 ============

function showAnalysisSection(): void {
  analysisSection.style.display = 'block';
}

function requestBiasAnalysis(): void {
  if (!currentLogId) return;

  analysisLoading.style.display = 'block';
  analysisResult.style.display = 'none';
  requestAnalysisBtn.disabled = true;
  requestAnalysisBtn.style.opacity = '0.5';

  // 发送请求到 background
  chrome.runtime.sendMessage({
    type: 'REQUEST_BIAS_ANALYSIS',
    payload: {
      thoughtLogId: currentLogId,
      question: currentQuestion,
      myThought: myThoughtInput.value.trim(),
      keyPoints: keyPointsInput.value.trim(),
      aiAnswer: currentAiAnswer,
    },
  });
}

function displayBiasAnalysis(analysis: BiasAnalysis): void {
  analysisLoading.style.display = 'none';
  analysisResult.style.display = 'block';
  requestAnalysisBtn.disabled = false;
  requestAnalysisBtn.style.opacity = '1';

  // 分数圆环
  const score = analysis.overallScore;
  const color = getScoreColor(score);
  scoreCircle.textContent = score.toString();
  scoreCircle.style.borderColor = color;
  scoreCircle.style.color = color;

  // 缺失维度
  missingList.innerHTML = '';
  if (analysis.missingDimensions.length === 0) {
    missingList.innerHTML = '<li style="font-size:12px;color:#94a3b8;padding:2px 0;">无</li>';
  } else {
    for (const dim of analysis.missingDimensions) {
      const li = document.createElement('li');
      li.style.cssText = 'font-size:12px;color:#f87171;padding:3px 0;padding-left:8px;position:relative;';
      li.innerHTML = `<span style="position:absolute;left:0;top:8px;width:4px;height:4px;background:#f87171;border-radius:50%;"></span>${dim}`;
      missingList.appendChild(li);
    }
  }

  // 亮点
  strengthList.innerHTML = '';
  if (analysis.strengthAreas.length === 0) {
    strengthList.innerHTML = '<li style="font-size:12px;color:#94a3b8;padding:2px 0;">无</li>';
  } else {
    for (const area of analysis.strengthAreas) {
      const li = document.createElement('li');
      li.style.cssText = 'font-size:12px;color:#34d399;padding:3px 0;padding-left:8px;position:relative;';
      li.innerHTML = `<span style="position:absolute;left:0;top:8px;width:4px;height:4px;background:#34d399;border-radius:50%;"></span>${area}`;
      strengthList.appendChild(li);
    }
  }

  // 建议
  suggestionList.innerHTML = '';
  if (analysis.suggestions.length === 0) {
    suggestionList.innerHTML = '<li style="font-size:12px;color:#94a3b8;padding:2px 0;">无</li>';
  } else {
    for (const sug of analysis.suggestions) {
      const li = document.createElement('li');
      li.style.cssText = 'font-size:12px;color:#60a5fa;padding:3px 0;padding-left:8px;position:relative;';
      li.innerHTML = `<span style="position:absolute;left:0;top:8px;width:4px;height:4px;background:#60a5fa;border-radius:50%;"></span>${sug}`;
      suggestionList.appendChild(li);
    }
  }

  // 更新存储中的日志
  if (currentLogId) {
    updateThoughtLog(currentLogId, { biasAnalysis: analysis });
  }
}

// ============ 历史记录 ============

async function loadHistory(): Promise<void> {
  const logs = await getThoughtLogs();

  if (logs.length === 0) {
    historyEmpty.style.display = 'block';
    return;
  }

  historyEmpty.style.display = 'none';

  // 清除旧的历史条目（保留 history-empty）
  const existingItems = historyList.querySelectorAll('.history-item');
  existingItems.forEach((item) => item.remove());

  // 最多显示最近 20 条
  const recentLogs = logs.slice(0, 20);

  for (const log of recentLogs) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:background 0.2s;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

    const questionSpan = document.createElement('span');
    questionSpan.style.cssText = 'font-size:12px;color:#cbd5e1;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    questionSpan.textContent = log.question ? truncate(log.question, 30) : '(无问题)';

    const timeSpan = document.createElement('span');
    timeSpan.style.cssText = 'font-size:10px;color:#64748b;margin-left:8px;white-space:nowrap;';
    timeSpan.textContent = formatTime(log.timestamp);

    header.appendChild(questionSpan);
    header.appendChild(timeSpan);

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:11px;color:#94a3b8;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    summary.textContent = truncate(log.myThought, 40);

    const scoreBadge = document.createElement('div');
    scoreBadge.style.cssText = 'margin-top:4px;';
    if (log.biasAnalysis) {
      const score = log.biasAnalysis.overallScore;
      const color = getScoreColor(score);
      scoreBadge.innerHTML = `<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;background:${color}22;color:${color};font-weight:600;">${score}分</span>`;
    } else {
      scoreBadge.innerHTML = `<span style="display:inline-block;font-size:10px;padding:1px 6px;border-radius:4px;background:rgba(100,116,139,0.2);color:#64748b;">未分析</span>`;
    }

    item.appendChild(header);
    item.appendChild(summary);
    item.appendChild(scoreBadge);

    // 展开详情区域（初始隐藏）
    const detail = document.createElement('div');
    detail.style.cssText = 'display:none;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);';

    if (log.question) {
      detail.innerHTML += `<p style="margin:0 0 4px;font-size:11px;color:#94a3b8;"><strong style="color:#5b9bd5;">问题：</strong>${log.question}</p>`;
    }
    detail.innerHTML += `<p style="margin:0 0 4px;font-size:11px;color:#94a3b8;"><strong style="color:#e8a838;">想法：</strong>${log.myThought}</p>`;
    if (log.keyPoints) {
      detail.innerHTML += `<p style="margin:0 0 4px;font-size:11px;color:#94a3b8;"><strong style="color:#5b9bd5;">关键点：</strong>${log.keyPoints}</p>`;
    }
    if (log.biasAnalysis) {
      const a = log.biasAnalysis;
      detail.innerHTML += `<p style="margin:4px 0 0;font-size:11px;color:${getScoreColor(a.overallScore)};"><strong>得分：${a.overallScore}</strong></p>`;
      if (a.missingDimensions.length > 0) {
        detail.innerHTML += `<p style="margin:2px 0 0;font-size:11px;color:#f87171;">缺失：${a.missingDimensions.join('、')}</p>`;
      }
      if (a.strengthAreas.length > 0) {
        detail.innerHTML += `<p style="margin:2px 0 0;font-size:11px;color:#34d399;">亮点：${a.strengthAreas.join('、')}</p>`;
      }
      if (a.suggestions.length > 0) {
        detail.innerHTML += `<p style="margin:2px 0 0;font-size:11px;color:#60a5fa;">建议：${a.suggestions.join('；')}</p>`;
      }
    }

    item.appendChild(detail);

    // 点击展开/收起
    let expanded = false;
    item.addEventListener('click', () => {
      expanded = !expanded;
      detail.style.display = expanded ? 'block' : 'none';
      item.style.background = expanded ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
    });

    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(255,255,255,0.07)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = expanded ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)';
    });

    historyList.appendChild(item);
  }
}

// ============ 消息监听 ============

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case 'CURRENT_QUESTION': {
      const payload = message.payload as { question: string } | undefined;
      if (payload?.question) {
        displayQuestion(payload.question);
        // 新问题到来时重置状态
        thoughtSaved = false;
        currentLogId = null;
        myThoughtInput.value = '';
        keyPointsInput.value = '';
        analysisSection.style.display = 'none';
        analysisResult.style.display = 'none';
        analysisLoading.style.display = 'none';
        updateReminder();
      }
      break;
    }

    case 'AI_ANSWER_CAPTURED': {
      const payload = message.payload as { answer: string } | undefined;
      if (payload?.answer) {
        currentAiAnswer = payload.answer;
        // 如果已保存想法，显示偏差分析区
        if (thoughtSaved && currentLogId) {
          showAnalysisSection();
          // 更新日志中的 AI 回答
          updateThoughtLog(currentLogId, { aiAnswer: currentAiAnswer });
        }
      }
      break;
    }

    case 'BIAS_ANALYSIS_RESULT': {
      const payload = message.payload as { analysis: BiasAnalysis } | undefined;
      if (payload?.analysis) {
        displayBiasAnalysis(payload.analysis);
      }
      break;
    }
  }
});

// ============ 事件绑定 ============

saveThoughtBtn.addEventListener('click', handleSaveThought);

requestAnalysisBtn.addEventListener('click', requestBiasAnalysis);

myThoughtInput.addEventListener('input', updateReminder);

// ============ 初始化 ============

async function init(): Promise<void> {
  // 加载历史记录
  await loadHistory();

  // 尝试从 storage 恢复当前问题（页面刷新场景）
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.THOUGHT_LOGS);
    const logs: ThoughtLog[] = result[STORAGE_KEYS.THOUGHT_LOGS] || [];
    if (logs.length > 0) {
      const latest = logs[0];
      // 如果最近一条日志没有偏差分析且没有 AI 回答，可能是当前会话
      if (!latest.biasAnalysis && !latest.aiAnswer) {
        displayQuestion(latest.question);
        currentLogId = latest.id;
        myThoughtInput.value = latest.myThought;
        keyPointsInput.value = latest.keyPoints;
        thoughtSaved = true;
        updateReminder();
      }
    }
  } catch {
    // storage 不可用时静默处理
  }

  console.log('[EchoBreaker] L3 元认知外显层已加载');
}

init();
