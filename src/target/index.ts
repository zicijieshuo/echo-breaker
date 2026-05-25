// 回声破除者 - L4 逆向重构层 · AI结论靶场

import { getTargetTexts, saveFindFaultSubmission, saveEvidenceMap, getEvidenceMaps } from '../lib/storage';
import { TargetText, FindFaultSubmission, EvidenceMap, EvidenceNode, EvidenceEdge } from '../lib/types';
import { evaluateFindFault } from '../lib/llm';

// ============ 工具函数 ============

/** 生成唯一 ID */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/** 将文本按句子拆分（支持中英文标点） */
function splitSentences(text: string): string[] {
  // 按中文句号、问号、感叹号、英文句号+空格、换行等拆分
  const raw = text.split(/(?<=[。！？\n])|(?<=[.!?]\s)/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

/** 计算两个字符串的简单相似度（0-1） */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.length === 0) return 1;
  // 检查子串包含
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // 简单的字符重叠度
  let matchCount = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matchCount++;
  }
  return matchCount / longer.length;
}

// ============ 内置样本靶子 ============

const BUILTIN_TARGETS: TargetText[] = [
  {
    id: 'builtin_climate',
    title: 'AI关于气候变化的结论',
    category: '自然科学',
    difficulty: 'easy',
    content: '根据最新研究，全球气温在过去100年中上升了约1.1摄氏度。科学家们普遍认为这是人类活动导致的。有人说太阳活动的变化才是主要原因，因为中世纪暖期也是太阳活动增强的结果。另外，有研究表明某些地区的植被覆盖率反而在增加，说明二氧化碳增加对植物生长是有好处的。因此，气候变化可能并没有那么严重，我们不需要过于担心。人类应该继续发展经济，等科技更发达了再解决环境问题也不迟。',
    proEvidence: [
      '全球气温在过去100年中上升了约1.1摄氏度',
      '科学家们普遍认为这是人类活动导致的',
    ],
    conEvidence: [
      '气候变化可能并没有那么严重',
      '等科技更发达了再解决环境问题也不迟',
    ],
    weakPoints: [
      '有人说太阳活动的变化才是主要原因，因为中世纪暖期也是太阳活动增强的结果',
      '有研究表明某些地区的植被覆盖率反而在增加，说明二氧化碳增加对植物生长是有好处的',
      '气候变化可能并没有那么严重，我们不需要过于担心',
      '人类应该继续发展经济，等科技更发达了再解决环境问题也不迟',
    ],
  },
  {
    id: 'builtin_study',
    title: 'AI关于学习方法的建议',
    category: '教育心理',
    difficulty: 'medium',
    content: '研究表明，间隔重复法是最有效的记忆策略之一。根据艾宾浩斯遗忘曲线，在学习后的第1天、第3天、第7天和第30天进行复习，可以显著提高长期记忆保持率。很多成功人士都使用番茄工作法来提高专注力，据说达芬奇就是用类似的方法工作的。此外，有实验证明听莫扎特的音乐可以让人变得更聪明，这被称为"莫扎特效应"。因此，我建议你同时使用间隔重复、番茄工作法和听古典音乐来学习，这样一定能取得最好的效果。不过，每个人的学习方式不同，你也可以选择自己觉得舒服的方法。',
    proEvidence: [
      '间隔重复法是最有效的记忆策略之一',
      '根据艾宾浩斯遗忘曲线进行复习可以显著提高长期记忆保持率',
    ],
    conEvidence: [
      '听莫扎特的音乐可以让人变得更聪明',
      '同时使用所有方法一定能取得最好的效果',
    ],
    weakPoints: [
      '据说达芬奇就是用类似的方法工作的',
      '有实验证明听莫扎特的音乐可以让人变得更聪明，这被称为"莫扎特效应"',
      '我建议你同时使用间隔重复、番茄工作法和听古典音乐来学习，这样一定能取得最好的效果',
      '你也可以选择自己觉得舒服的方法',
    ],
  },
  {
    id: 'builtin_history',
    title: 'AI关于历史事件的解读',
    category: '历史人文',
    difficulty: 'hard',
    content: '关于明朝灭亡的原因，历史学界有多种观点。一种主流看法认为，小冰河期导致的农业减产是根本原因，因为气候变冷直接造成了粮食危机。有学者指出，当时白银流入减少导致通货紧缩，这与全球贸易体系的变化密切相关。然而，也有观点认为明朝的灭亡主要是政治腐败和制度僵化的结果，因为同样的气候条件下清朝却成功建立了稳定的政权。值得注意的是，一些民间传说将明朝灭亡归因于"天命"，认为这是历史的必然。从全球视角来看，17世纪的普遍危机理论认为，同时期欧亚多国都经历了政权更迭，这暗示了某种系统性因素的存在。综合来看，明朝的灭亡是多种因素共同作用的结果，但制度因素可能被低估了。',
    proEvidence: [
      '小冰河期导致的农业减产是根本原因',
      '白银流入减少导致通货紧缩，这与全球贸易体系的变化密切相关',
      '17世纪的普遍危机理论认为同时期欧亚多国都经历了政权更迭',
    ],
    conEvidence: [
      '同样的气候条件下清朝却成功建立了稳定的政权',
      '制度因素可能被低估了',
    ],
    weakPoints: [
      '因为气候变冷直接造成了粮食危机',
      '同样的气候条件下清朝却成功建立了稳定的政权',
      '一些民间传说将明朝灭亡归因于"天命"，认为这是历史的必然',
      '这暗示了某种系统性因素的存在',
      '综合来看，明朝的灭亡是多种因素共同作用的结果，但制度因素可能被低估了',
    ],
  },
];

// ============ 全局状态 ============

let allTargets: TargetText[] = [];
let currentTarget: TargetText | null = null;
let highlightedIndices: Set<number> = new Set();
let sentences: string[] = [];
let submitted = false;

// 证据链导图状态
let evidenceNodes: EvidenceNode[] = [];
let evidenceEdges: EvidenceEdge[] = [];
let currentEvidenceMap: EvidenceMap | null = null;
let draggingNode: EvidenceNode | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let connectMode = false;
let connectFromNode: EvidenceNode | null = null;
let canvasScale = 1;

// ============ 初始化 ============

async function init(): Promise<void> {
  await loadTargets();
  renderTargetGrid();
  bindGlobalEvents();
}

/** 加载靶子文本，若存储为空则使用内置样本 */
async function loadTargets(): Promise<void> {
  const stored = await getTargetTexts();
  if (stored && stored.length > 0) {
    allTargets = stored;
  } else {
    allTargets = [...BUILTIN_TARGETS];
  }
}

// ============ 靶子选择网格 ============

/** 渲染靶子选择网格 */
function renderTargetGrid(): void {
  const grid = document.getElementById('target-grid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const target of allTargets) {
    const card = document.createElement('div');
    card.style.cssText = 'background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; cursor: pointer; transition: background 0.2s, border-color 0.2s; border: 1px solid rgba(255,255,255,0.08);';
    card.onmouseover = () => {
      card.style.background = 'rgba(255,255,255,0.1)';
      card.style.borderColor = 'rgba(129,140,248,0.3)';
    };
    card.onmouseout = () => {
      card.style.background = 'rgba(255,255,255,0.05)';
      card.style.borderColor = 'rgba(255,255,255,0.08)';
    };

    const difficultyColors: Record<string, { bg: string; text: string; label: string }> = {
      easy: { bg: 'rgba(76,175,125,0.12)', text: '#4caf7d', label: '简单' },
      medium: { bg: 'rgba(232,168,56,0.12)', text: '#e8a838', label: '中等' },
      hard: { bg: 'rgba(224,85,85,0.12)', text: '#e05555', label: '困难' },
    };
    const diff = difficultyColors[target.difficulty] || difficultyColors.easy;

    card.innerHTML = `
      <div style="font-size: 15px; font-weight: 600; color: #2c3e50; margin-bottom: 10px;">${escapeHtml(target.title)}</div>
      <div style="display: flex; gap: 6px;">
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: rgba(91,155,213,0.1); color: #5b9bd5;">${escapeHtml(target.category)}</span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 10px; background: ${diff.bg}; color: ${diff.text};">${diff.label}</span>
      </div>
    `;

    card.addEventListener('click', () => selectTarget(target));
    grid.appendChild(card);
  }
}

/** HTML 转义 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ 靶子选择与展示 ============

/** 选择靶子 */
function selectTarget(target: TargetText): void {
  currentTarget = target;
  highlightedIndices = new Set();
  submitted = false;
  sentences = splitSentences(target.content);

  // 切换显示区域
  const selectSection = document.getElementById('section-target-select');
  const contentSection = document.getElementById('section-target-content');
  const resultSection = document.getElementById('section-find-fault-result');
  const mapSection = document.getElementById('section-evidence-map');

  if (selectSection) selectSection.style.display = 'none';
  if (contentSection) contentSection.style.display = 'block';
  if (resultSection) resultSection.style.display = 'none';
  if (mapSection) mapSection.style.display = 'none';

  // 更新标题
  const titleDisplay = document.getElementById('target-title-display');
  if (titleDisplay) titleDisplay.textContent = target.title;

  // 更新标签
  const categoryBadge = document.getElementById('target-category-badge');
  const difficultyBadge = document.getElementById('target-difficulty-badge');
  if (categoryBadge) categoryBadge.textContent = target.category;

  const difficultyColors: Record<string, { bg: string; text: string; label: string }> = {
    easy: { bg: 'rgba(76,175,125,0.12)', text: '#4caf7d', label: '简单' },
    medium: { bg: 'rgba(232,168,56,0.12)', text: '#e8a838', label: '中等' },
    hard: { bg: 'rgba(224,85,85,0.12)', text: '#e05555', label: '困难' },
  };
  const diff = difficultyColors[target.difficulty] || difficultyColors.easy;
  if (difficultyBadge) {
    difficultyBadge.textContent = diff.label;
    difficultyBadge.style.background = diff.bg;
    difficultyBadge.style.color = diff.text;
  }

  // 渲染句子
  renderSentences();
  updateHighlightCount();
}

/** 渲染句子列表 */
function renderSentences(): void {
  const container = document.getElementById('target-content-display');
  if (!container) return;
  container.innerHTML = '';

  sentences.forEach((sentence, index) => {
    const span = document.createElement('span');
    span.textContent = sentence;
    span.dataset.sentenceIndex = String(index);
    span.style.cssText = 'cursor: pointer; transition: background-color 0.2s; border-radius: 3px; padding: 1px 2px;';

    if (highlightedIndices.has(index)) {
      span.style.backgroundColor = 'rgba(250,204,21,0.35)';
    }

    span.addEventListener('click', () => toggleHighlight(index));
    span.addEventListener('mouseover', () => {
      if (!highlightedIndices.has(index)) {
        span.style.backgroundColor = 'rgba(250,204,21,0.12)';
      }
    });
    span.addEventListener('mouseout', () => {
      if (!highlightedIndices.has(index)) {
        span.style.backgroundColor = 'transparent';
      }
    });

    container.appendChild(span);
  });
}

/** 切换句子高亮 */
function toggleHighlight(index: number): void {
  if (submitted) return;

  if (highlightedIndices.has(index)) {
    highlightedIndices.delete(index);
  } else {
    highlightedIndices.add(index);
  }

  // 更新对应 span 的样式
  const container = document.getElementById('target-content-display');
  if (!container) return;
  const spans = container.querySelectorAll('span[data-sentence-index]');
  spans.forEach((span) => {
    const idx = parseInt((span as HTMLElement).dataset.sentenceIndex || '0', 10);
    if (idx === index) {
      if (highlightedIndices.has(index)) {
        (span as HTMLElement).style.backgroundColor = 'rgba(250,204,21,0.35)';
      } else {
        (span as HTMLElement).style.backgroundColor = 'transparent';
      }
    }
  });

  updateHighlightCount();
}

/** 更新高亮计数 */
function updateHighlightCount(): void {
  const countEl = document.getElementById('highlight-count');
  if (countEl) {
    countEl.textContent = `已高亮 ${highlightedIndices.size} 处`;
  }
}

// ============ 找茬提交与评分 ============

/** 提交找茬结果 */
async function submitFindFault(): Promise<void> {
  if (!currentTarget || submitted) return;

  submitted = true;
  const userHighlights = Array.from(highlightedIndices).map(i => sentences[i]);

  // 尝试使用 LLM 评估
  let matchScore = 0;
  let matchedWeakPoints: string[] = [];
  let missedWeakPoints: string[] = [];
  let falseAlarms: string[] = [];
  let feedback = '';

  try {
    const llmResult = await evaluateFindFault(
      currentTarget.content,
      userHighlights,
      currentTarget.weakPoints,
    );

    if (llmResult.success && llmResult.matchScore !== undefined) {
      matchScore = llmResult.matchScore;
      matchedWeakPoints = llmResult.matchedWeakPoints || [];
      missedWeakPoints = llmResult.missedWeakPoints || [];
      falseAlarms = llmResult.falseAlarms || [];
      feedback = llmResult.feedback || '';
    } else {
      // LLM 评估失败，使用本地匹配
      const localResult = localEvaluate(userHighlights, currentTarget.weakPoints);
      matchScore = localResult.matchScore;
      matchedWeakPoints = localResult.matchedWeakPoints;
      missedWeakPoints = localResult.missedWeakPoints;
      falseAlarms = localResult.falseAlarms;
      feedback = localResult.feedback;
    }
  } catch {
    // LLM 调用异常，使用本地匹配
    const localResult = localEvaluate(userHighlights, currentTarget.weakPoints);
    matchScore = localResult.matchScore;
    matchedWeakPoints = localResult.matchedWeakPoints;
    missedWeakPoints = localResult.missedWeakPoints;
    falseAlarms = localResult.falseAlarms;
    feedback = localResult.feedback;
  }

  // 保存提交记录
  const submission: FindFaultSubmission = {
    id: generateId(),
    timestamp: Date.now(),
    targetId: currentTarget.id,
    highlightedWeakPoints: userHighlights,
    matchScore,
  };
  await saveFindFaultSubmission(submission);

  // 显示结果
  showResult(matchScore, matchedWeakPoints, missedWeakPoints, falseAlarms, feedback);
}

/** 本地字符串匹配评估 */
function localEvaluate(
  userHighlights: string[],
  weakPoints: string[],
): {
  matchScore: number;
  matchedWeakPoints: string[];
  missedWeakPoints: string[];
  falseAlarms: string[];
  feedback: string;
} {
  const SIMILARITY_THRESHOLD = 0.4;
  const matchedWeakPoints: string[] = [];
  const missedWeakPoints: string[] = [];
  const falseAlarms: string[] = [];

  // 检查每个薄弱点是否被用户命中
  for (const wp of weakPoints) {
    let found = false;
    for (const uh of userHighlights) {
      if (stringSimilarity(uh, wp) >= SIMILARITY_THRESHOLD || wp.includes(uh) || uh.includes(wp)) {
        found = true;
        break;
      }
    }
    if (found) {
      matchedWeakPoints.push(wp);
    } else {
      missedWeakPoints.push(wp);
    }
  }

  // 检查用户标注是否为误判
  for (const uh of userHighlights) {
    let isWeakPoint = false;
    for (const wp of weakPoints) {
      if (stringSimilarity(uh, wp) >= SIMILARITY_THRESHOLD || wp.includes(uh) || uh.includes(wp)) {
        isWeakPoint = true;
        break;
      }
    }
    if (!isWeakPoint) {
      falseAlarms.push(uh);
    }
  }

  // 计算得分
  const totalWeak = weakPoints.length;
  const hitCount = matchedWeakPoints.length;
  const precision = totalWeak > 0 ? hitCount / totalWeak : 0;
  const penalty = falseAlarms.length > 0 ? Math.min(0.3, falseAlarms.length * 0.1) : 0;
  const matchScore = Math.round(Math.max(0, (precision - penalty)) * 100);

  // 生成反馈
  let feedback = '';
  if (matchScore >= 80) {
    feedback = '非常出色！你精准地识别了大部分薄弱依据，批判性思维能力很强。';
  } else if (matchScore >= 60) {
    feedback = '不错的表现！你找到了不少薄弱点，但还有一些隐藏的问题被遗漏了，继续练习。';
  } else if (matchScore >= 40) {
    feedback = '还需要加强。部分薄弱依据被你识别出来了，但还有不少遗漏，试着关注那些"看似合理但缺乏支撑"的论述。';
  } else {
    feedback = '继续努力！试着寻找那些"以偏概全"、"因果倒置"或"引用不实"的论述，它们往往是薄弱依据。';
  }

  return { matchScore, matchedWeakPoints, missedWeakPoints, falseAlarms, feedback };
}

/** 显示找茬结果 */
function showResult(
  matchScore: number,
  matchedWeakPoints: string[],
  missedWeakPoints: string[],
  falseAlarms: string[],
  feedback: string,
): void {
  const resultSection = document.getElementById('section-find-fault-result');
  const mapSection = document.getElementById('section-evidence-map');
  if (resultSection) resultSection.style.display = 'block';
  if (mapSection) mapSection.style.display = 'block';

  // 得分
  const scoreEl = document.getElementById('result-score');
  if (scoreEl) scoreEl.textContent = String(matchScore);

  // 反馈
  const feedbackEl = document.getElementById('result-feedback');
  if (feedbackEl) feedbackEl.textContent = feedback;

  // 正确识别
  const matchedEl = document.getElementById('result-matched');
  if (matchedEl) {
    matchedEl.innerHTML = matchedWeakPoints.length > 0
      ? matchedWeakPoints.map(p => `<div style="margin-bottom: 4px;">• ${escapeHtml(p)}</div>`).join('')
      : '<div style="color: #7f8c9b;">无</div>';
  }

  // 遗漏
  const missedEl = document.getElementById('result-missed');
  if (missedEl) {
    missedEl.innerHTML = missedWeakPoints.length > 0
      ? missedWeakPoints.map(p => `<div style="margin-bottom: 4px;">• ${escapeHtml(p)}</div>`).join('')
      : '<div style="color: #7f8c9b;">无</div>';
  }

  // 误判
  const falseAlarmsEl = document.getElementById('result-false-alarms');
  if (falseAlarmsEl) {
    falseAlarmsEl.innerHTML = falseAlarms.length > 0
      ? falseAlarms.map(p => `<div style="margin-bottom: 4px;">• ${escapeHtml(p)}</div>`).join('')
      : '<div style="color: #7f8c9b;">无</div>';
  }

  // 渲染带颜色的结果文本
  renderResultContent(matchedWeakPoints, missedWeakPoints, falseAlarms);

  // 初始化证据链导图
  initEvidenceMap();
}

/** 渲染结果文本（带颜色标注） */
function renderResultContent(
  matchedWeakPoints: string[],
  missedWeakPoints: string[],
  falseAlarms: string[],
): void {
  const container = document.getElementById('result-content-display');
  if (!container) return;
  container.innerHTML = '';

  sentences.forEach((sentence, index) => {
    const span = document.createElement('span');
    span.textContent = sentence;
    span.style.cssText = 'border-radius: 3px; padding: 1px 2px;';

    // 判断句子属于哪种结果类型
    let isMatched = false;
    let isMissed = false;
    let isFalseAlarm = false;

    for (const wp of matchedWeakPoints) {
      if (stringSimilarity(sentence, wp) >= 0.4 || wp.includes(sentence) || sentence.includes(wp)) {
        isMatched = true;
        break;
      }
    }
    if (!isMatched) {
      for (const wp of missedWeakPoints) {
        if (stringSimilarity(sentence, wp) >= 0.4 || wp.includes(sentence) || sentence.includes(wp)) {
          isMissed = true;
          break;
        }
      }
    }
    if (!isMatched && !isMissed && highlightedIndices.has(index)) {
      for (const fa of falseAlarms) {
        if (stringSimilarity(sentence, fa) >= 0.4 || fa.includes(sentence) || sentence.includes(fa)) {
          isFalseAlarm = true;
          break;
        }
      }
    }

    if (isMatched) {
      span.style.backgroundColor = 'rgba(74,222,128,0.3)';
    } else if (isMissed) {
      span.style.backgroundColor = 'rgba(239,68,68,0.3)';
    } else if (isFalseAlarm) {
      span.style.backgroundColor = 'rgba(156,163,175,0.25)';
    } else if (highlightedIndices.has(index)) {
      span.style.backgroundColor = 'rgba(250,204,21,0.2)';
    }

    container.appendChild(span);
  });
}

// ============ 证据链导图 ============

/** 初始化证据链导图 */
async function initEvidenceMap(): Promise<void> {
  if (!currentTarget) return;

  // 尝试加载已保存的导图
  const maps = await getEvidenceMaps();
  const existingMap = maps.find(m => m.targetId === currentTarget!.id);

  if (existingMap) {
    currentEvidenceMap = existingMap;
    evidenceNodes = [...existingMap.nodes];
    evidenceEdges = [...existingMap.edges];
  } else {
    // 根据靶子文本生成默认节点
    evidenceNodes = generateDefaultNodes(currentTarget);
    evidenceEdges = [];
    currentEvidenceMap = {
      id: generateId(),
      targetId: currentTarget.id,
      nodes: evidenceNodes,
      edges: evidenceEdges,
      createdAt: Date.now(),
    };
  }

  connectMode = false;
  connectFromNode = null;
  setupCanvas();
  drawEvidenceMap();
}

/** 根据靶子文本生成默认导图节点 */
function generateDefaultNodes(target: TargetText): EvidenceNode[] {
  const nodes: EvidenceNode[] = [];
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  const width = canvas ? canvas.width : 900;
  const height = canvas ? canvas.height : 500;

  // 证据节点（左侧）
  const allEvidence = [...target.proEvidence, ...target.conEvidence];
  allEvidence.forEach((text, i) => {
    nodes.push({
      id: `node_ev_${i}`,
      text: text.length > 30 ? text.slice(0, 30) + '...' : text,
      type: 'evidence',
      x: 60 + (i % 2) * 200,
      y: 60 + Math.floor(i / 2) * 100,
    });
  });

  // 推论节点（中间）
  target.weakPoints.forEach((text, i) => {
    nodes.push({
      id: `node_inf_${i}`,
      text: text.length > 30 ? text.slice(0, 30) + '...' : text,
      type: 'inference',
      x: width / 2 - 80 + (i % 2) * 200,
      y: 60 + Math.floor(i / 2) * 100,
    });
  });

  // 结论节点（右侧）
  nodes.push({
    id: 'node_con_0',
    text: target.title.length > 20 ? target.title.slice(0, 20) + '...' : target.title,
    type: 'conclusion',
    x: width - 200,
    y: height / 2 - 20,
  });

  return nodes;
}

/** 设置 Canvas 事件 */
function setupCanvas(): void {
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  // 计算缩放比例
  const rect = canvas.getBoundingClientRect();
  canvasScale = canvas.width / rect.width;

  // 移除旧事件（通过克隆替换）
  const newCanvas = canvas.cloneNode(true) as HTMLCanvasElement;
  canvas.parentNode?.replaceChild(newCanvas, canvas);

  newCanvas.addEventListener('mousedown', onCanvasMouseDown);
  newCanvas.addEventListener('mousemove', onCanvasMouseMove);
  newCanvas.addEventListener('mouseup', onCanvasMouseUp);
  newCanvas.addEventListener('mouseleave', onCanvasMouseUp);
}

/** 获取 Canvas 上的鼠标坐标 */
function getCanvasPos(e: MouseEvent): { x: number; y: number } {
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * canvasScale,
    y: (e.clientY - rect.top) * canvasScale,
  };
}

/** 查找坐标处的节点 */
function findNodeAt(x: number, y: number): EvidenceNode | null {
  const nodeWidth = 160;
  const nodeHeight = 50;
  // 反向遍历，优先选中上层节点
  for (let i = evidenceNodes.length - 1; i >= 0; i--) {
    const node = evidenceNodes[i];
    if (x >= node.x && x <= node.x + nodeWidth && y >= node.y && y <= node.y + nodeHeight) {
      return node;
    }
  }
  return null;
}

/** Canvas 鼠标按下 */
function onCanvasMouseDown(e: MouseEvent): void {
  const pos = getCanvasPos(e);
  const node = findNodeAt(pos.x, pos.y);

  if (connectMode && node) {
    // 连线模式：选择节点
    if (!connectFromNode) {
      connectFromNode = node;
      drawEvidenceMap();
    } else {
      // 创建连线
      if (connectFromNode.id !== node.id) {
        const exists = evidenceEdges.some(
          edge => (edge.from === connectFromNode!.id && edge.to === node.id) ||
                  (edge.from === node.id && edge.to === connectFromNode!.id),
        );
        if (!exists) {
          evidenceEdges.push({ from: connectFromNode.id, to: node.id });
        }
      }
      connectFromNode = null;
      drawEvidenceMap();
    }
    return;
  }

  if (node) {
    draggingNode = node;
    dragOffsetX = pos.x - node.x;
    dragOffsetY = pos.y - node.y;
    const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
    if (canvas) canvas.style.cursor = 'grabbing';
  }
}

/** Canvas 鼠标移动 */
function onCanvasMouseMove(e: MouseEvent): void {
  const pos = getCanvasPos(e);

  if (draggingNode) {
    draggingNode.x = Math.max(0, pos.x - dragOffsetX);
    draggingNode.y = Math.max(0, pos.y - dragOffsetY);
    drawEvidenceMap();
    return;
  }

  // 更新鼠标样式
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  if (canvas) {
    const node = findNodeAt(pos.x, pos.y);
    canvas.style.cursor = connectMode ? 'crosshair' : (node ? 'grab' : 'default');
  }
}

/** Canvas 鼠标松开 */
function onCanvasMouseUp(): void {
  draggingNode = null;
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  if (canvas) canvas.style.cursor = connectMode ? 'crosshair' : 'grab';
}

/** 绘制证据链导图 */
function drawEvidenceMap(): void {
  const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制背景网格
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 绘制连线
  for (const edge of evidenceEdges) {
    const fromNode = evidenceNodes.find(n => n.id === edge.from);
    const toNode = evidenceNodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) continue;

    const fromCx = fromNode.x + 80;
    const fromCy = fromNode.y + 25;
    const toCx = toNode.x + 80;
    const toCy = toNode.y + 25;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(129,140,248,0.5)';
    ctx.lineWidth = 2;
    ctx.moveTo(fromCx, fromCy);
    ctx.lineTo(toCx, toCy);
    ctx.stroke();

    // 绘制箭头
    const angle = Math.atan2(toCy - fromCy, toCx - fromCx);
    const arrowLen = 12;
    const arrowX = toCx - Math.cos(angle) * 60;
    const arrowY = toCy - Math.sin(angle) * 30;

    ctx.beginPath();
    ctx.fillStyle = 'rgba(129,140,248,0.7)';
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(
      arrowX - arrowLen * Math.cos(angle - Math.PI / 6),
      arrowY - arrowLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      arrowX - arrowLen * Math.cos(angle + Math.PI / 6),
      arrowY - arrowLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();

    // 连线标签
    if (edge.label) {
      const midX = (fromCx + toCx) / 2;
      const midY = (fromCy + toCy) / 2;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'rgba(156,163,175,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, midX, midY - 6);
    }
  }

  // 绘制节点
  const nodeWidth = 160;
  const nodeHeight = 50;
  const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
    evidence: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.5)', text: '#93c5fd' },
    inference: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.5)', text: '#fcd34d' },
    conclusion: { bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.5)', text: '#86efac' },
  };

  for (const node of evidenceNodes) {
    const colors = nodeColors[node.type] || nodeColors.evidence;

    // 高亮选中节点（连线模式）
    const isSelected = connectMode && connectFromNode && connectFromNode.id === node.id;

    // 绘制圆角矩形
    const radius = 8;
    ctx.beginPath();
    ctx.roundRect(node.x, node.y, nodeWidth, nodeHeight, radius);
    ctx.fillStyle = isSelected ? 'rgba(129,140,248,0.3)' : colors.bg;
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#5b9bd5' : colors.border;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.stroke();

    // 绘制类型标签
    const typeLabels: Record<string, string> = { evidence: '证据', inference: '推论', conclusion: '结论' };
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left';
    ctx.fillText(typeLabels[node.type] || '', node.x + 8, node.y + 14);

    // 绘制文本
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#2c3e50';
    ctx.textAlign = 'left';

    // 文本截断
    const maxWidth = nodeWidth - 16;
    let displayText = node.text;
    while (ctx.measureText(displayText).width > maxWidth && displayText.length > 0) {
      displayText = displayText.slice(0, -1);
    }
    if (displayText.length < node.text.length) {
      displayText = displayText.slice(0, -1) + '…';
    }
    ctx.fillText(displayText, node.x + 8, node.y + 34);
  }
}

/** 保存证据链导图 */
async function saveCurrentEvidenceMap(): Promise<void> {
  if (!currentTarget) return;

  const map: EvidenceMap = {
    id: currentEvidenceMap?.id || generateId(),
    targetId: currentTarget.id,
    nodes: [...evidenceNodes],
    edges: [...evidenceEdges],
    createdAt: currentEvidenceMap?.createdAt || Date.now(),
  };

  await saveEvidenceMap(map);
  currentEvidenceMap = map;

  // 显示保存成功提示
  const btn = document.getElementById('btn-save-evidence-map');
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '✓ 已保存';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 1500);
  }
}

// ============ 全局事件绑定 ============

function bindGlobalEvents(): void {
  // 返回列表按钮
  const backBtn = document.getElementById('btn-back-to-grid');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const selectSection = document.getElementById('section-target-select');
      const contentSection = document.getElementById('section-target-content');
      const resultSection = document.getElementById('section-find-fault-result');
      const mapSection = document.getElementById('section-evidence-map');

      if (selectSection) selectSection.style.display = 'block';
      if (contentSection) contentSection.style.display = 'none';
      if (resultSection) resultSection.style.display = 'none';
      if (mapSection) mapSection.style.display = 'none';

      currentTarget = null;
      highlightedIndices = new Set();
      submitted = false;
    });
  }

  // 提交找茬按钮
  const submitBtn = document.getElementById('btn-submit-find-fault');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitFindFault);
  }

  // 重新挑战按钮
  const retryBtn = document.getElementById('btn-retry-find-fault');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (!currentTarget) return;
      highlightedIndices = new Set();
      submitted = false;

      const resultSection = document.getElementById('section-find-fault-result');
      const mapSection = document.getElementById('section-evidence-map');
      if (resultSection) resultSection.style.display = 'none';
      if (mapSection) mapSection.style.display = 'none';

      renderSentences();
      updateHighlightCount();
    });
  }

  // 连线模式按钮
  const connectBtn = document.getElementById('btn-toggle-connect-mode');
  const connectHint = document.getElementById('connect-mode-hint');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      connectMode = !connectMode;
      connectFromNode = null;
      if (connectMode) {
        connectBtn.style.background = 'rgba(129,140,248,0.35)';
        connectBtn.style.borderColor = 'rgba(129,140,248,0.6)';
        if (connectHint) connectHint.style.display = 'inline-flex';
      } else {
        connectBtn.style.background = 'rgba(129,140,248,0.15)';
        connectBtn.style.borderColor = 'rgba(129,140,248,0.3)';
        if (connectHint) connectHint.style.display = 'none';
      }
      const canvas = document.getElementById('evidence-map-canvas') as HTMLCanvasElement;
      if (canvas) canvas.style.cursor = connectMode ? 'crosshair' : 'grab';
      drawEvidenceMap();
    });
  }

  // 保存导图按钮
  const saveMapBtn = document.getElementById('btn-save-evidence-map');
  if (saveMapBtn) {
    saveMapBtn.addEventListener('click', saveCurrentEvidenceMap);
  }
}

// ============ 启动 ============

document.addEventListener('DOMContentLoaded', init);
