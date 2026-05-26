// 回声破除者 - Background Service Worker

import { THRESHOLDS, STORAGE_KEYS, ALARM_NAMES, BADGE_DEFINITIONS, SCENARIO_URL_RULES } from '../lib/constants';
import type { AIWebsite, DailyRecord, TriggerType, BiasAnalysis, CognitiveWallBlock, Scenario, Badge } from '../lib/types';
import { SCENARIO_STRATEGIES } from '../lib/types';
import {
  getUsageData,
  getTodayRecord,
  addDuration,
  addActiveDuration,
  incrementConsecutiveRounds,
  incrementCopyPasteCount,
  incrementQuestionCount,
  resetConsecutiveRounds,
  recordTrigger,
  getWeeklyData,
  getSettings,
  getLastTriggerTime,
  setLastTriggerTime,
  getTodayApiCallCount,
  saveThoughtLog,
  updateThoughtLog,
  getThoughtLogs,
  saveCognitiveWallBlock,
  getDetectedScenario,
  saveDetectedScenario,
  calculateCDI,
  getRecentCDI,
  getEarnedBadges,
  saveBadge,
  getFindFaultSubmissions,
  getCognitiveWallBlocks,
} from '../lib/storage';
import { callLLM, generateGuidedPrompt, analyzeBias, evaluateFindFault } from '../lib/llm';

/** 已加载的 AI 网站配置列表 */
let aiWebsites: AIWebsite[] = [];

/** CDI 计算计数器（每5分钟计算一次） */
let cdiTimerCounter = 0;

/** 生成文本的 trigram 集合 */
function getTrigrams(text: string): Set<string> {
  const trigrams = new Set<string>();
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.substring(i, i + 3));
  }
  return trigrams;
}

/** 使用 trigram 方法计算两段文本的相似度 (0~1) */
function calculateTrigramSimilarity(textA: string, textB: string): number {
  const trigramsA = getTrigrams(textA);
  const trigramsB = getTrigrams(textB);
  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 检查并授予徽章，返回新获得的徽章列表 */
async function checkAndAwardBadges(): Promise<Badge[]> {
  const earnedBadges = await getEarnedBadges();
  const earnedIds = new Set(earnedBadges.map((b) => b.id));
  const thoughtLogs = await getThoughtLogs();
  const findFaultSubs = await getFindFaultSubmissions();
  const wallBlocks = await getCognitiveWallBlocks();
  const usageData = await getUsageData();

  // 统计触发次数
  let totalTriggers = 0;
  for (const dayKey of Object.keys(usageData)) {
    totalTriggers += (usageData[dayKey].triggers || []).length;
  }

  // 统计连续低使用天数
  const today = new Date();
  let consecutiveLowUsage = 0;
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const record = usageData[key];
    if (record && record.total_seconds < 3600) {
      consecutiveLowUsage++;
    } else if (i > 0) {
      break;
    }
  }

  // 找茬平均分
  const avgFindFaultScore = findFaultSubs.length > 0
    ? findFaultSubs.reduce((sum, s) => sum + s.matchScore, 0) / findFaultSubs.length
    : 0;

  // 条件映射
  const conditionValues: Record<string, number> = {
    consecutive_low_usage_3: consecutiveLowUsage >= 3 ? 1 : 0,
    consecutive_low_usage_7: consecutiveLowUsage >= 7 ? 1 : 0,
    consecutive_low_usage_30: consecutiveLowUsage >= 30 ? 1 : 0,
    thought_logs_10: thoughtLogs.length,
    thought_logs_50: thoughtLogs.length,
    thought_logs_200: thoughtLogs.length,
    triggers_5: totalTriggers,
    triggers_20: totalTriggers,
    triggers_50: totalTriggers,
    find_fault_3: findFaultSubs.length,
    find_fault_10: findFaultSubs.length,
    find_fault_30: findFaultSubs.length >= 30 && avgFindFaultScore > 70 ? 30 : findFaultSubs.length,
    wall_blocks_5: wallBlocks.length,
    wall_blocks_20: wallBlocks.length,
    wall_blocks_50: wallBlocks.length,
  };

  const conditionTargets: Record<string, number> = {
    consecutive_low_usage_3: 1,
    consecutive_low_usage_7: 1,
    consecutive_low_usage_30: 1,
    thought_logs_10: 10,
    thought_logs_50: 50,
    thought_logs_200: 200,
    triggers_5: 5,
    triggers_20: 20,
    triggers_50: 50,
    find_fault_3: 3,
    find_fault_10: 10,
    find_fault_30: 30,
    wall_blocks_5: 5,
    wall_blocks_20: 20,
    wall_blocks_50: 50,
  };

  const newlyEarned: Badge[] = [];

  for (const def of BADGE_DEFINITIONS) {
    if (earnedIds.has(def.id)) continue;
    const value = conditionValues[def.condition] ?? 0;
    const target = conditionTargets[def.condition] ?? 1;
    if (value >= target) {
      const badge: Badge = {
        id: def.id,
        name: def.name,
        description: def.description,
        icon: def.icon,
        tier: def.tier,
        condition: def.condition,
        earned: true,
        earnedAt: Date.now(),
      };
      await saveBadge(badge);
      newlyEarned.push(badge);
    }
  }

  return newlyEarned;
}

/** 加载 AI 网站配置 */
async function loadAIWebsites(): Promise<void> {
  try {
    const url = chrome.runtime.getURL('data/ai_websites.json');
    const response = await fetch(url);
    aiWebsites = await response.json() as AIWebsite[];
    console.log(`[EchoBreaker] 已加载 ${aiWebsites.length} 个 AI 网站配置`);
  } catch (err) {
    console.error('[EchoBreaker] 加载 AI 网站配置失败:', err);
    aiWebsites = [];
  }
}

/** 根据 URL 匹配 AI 网站配置 */
function matchSiteConfig(url: string): AIWebsite | null {
  try {
    const hostname = new URL(url).hostname;
    for (const site of aiWebsites) {
      if (hostname.includes(site.domain)) {
        return site;
      }
    }
  } catch {
    // URL 解析失败
  }
  return null;
}

/** 判断 URL 是否为 AI 网站 */
function isAIWebsite(url: string): boolean {
  return matchSiteConfig(url) !== null;
}

/** 检查是否应该触发唤醒 */
function shouldTrigger(record: DailyRecord): TriggerType | null {
  if (record.total_seconds >= THRESHOLDS.DURATION_LIMIT) {
    return 'duration';
  }
  if (record.consecutive_rounds >= THRESHOLDS.CONSECUTIVE_LIMIT) {
    return 'consecutive';
  }
  return null;
}

/** 检查是否在冷却期内 */
async function isInCooldown(): Promise<boolean> {
  const lastTime = await getLastTriggerTime();
  if (lastTime === 0) return false;
  return Date.now() - lastTime < THRESHOLDS.TRIGGER_COOLDOWN;
}

/** 尝试触发唤醒（含防重复检查） */
async function tryTrigger(tabId: number, triggerType: TriggerType): Promise<void> {
  // 检查冷却期
  if (await isInCooldown()) return;

  // 检查用户设置是否启用
  const settings = await getSettings();
  if (!settings.enabled) return;

  // 记录触发时间
  await setLastTriggerTime(Date.now());

  // 发送唤醒消息到 content script
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TRIGGER_AWAKENING' });
  } catch {
    // 标签页可能已关闭或无 content script
  }
}

/** 向指定标签页发送消息（安全封装） */
async function sendTabMessage(tabId: number, message: Record<string, unknown>): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // 标签页可能已关闭
  }
}

/** 向所有 AI 网站标签页广播消息 */
async function broadcastToAITabs(message: Record<string, unknown>): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && isAIWebsite(tab.url) && tab.id) {
        await sendTabMessage(tab.id, message);
      }
    }
  } catch (err) {
    console.error('[EchoBreaker] 广播消息出错:', err);
  }
}

/** 插件安装时初始化 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[EchoBreaker] 插件已安装/更新');

  // 加载网站配置
  await loadAIWebsites();

  // 设置默认设置
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  if (!result[STORAGE_KEYS.SETTINGS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: {
        enabled: true,
        durationThreshold: THRESHOLDS.DURATION_LIMIT,
        consecutiveThreshold: THRESHOLDS.CONSECUTIVE_LIMIT,
        scenario: 'default',
        dataUploadConsent: false,
        dailyApiLimit: THRESHOLDS.DAILY_API_LIMIT,
        guidedModeEnabled: true,
        forceThoughtInput: true,
        biasAnalysisEnabled: true,
        targetRangeEnabled: true,
        preferredProvider: 'deepseek',
        cognitiveWallEnabled: true,
        cognitiveWallThreshold: 0.85,
        autoScenarioDetection: true,
        cloudSyncEnabled: false,
        cloudServerUrl: '',
        cloudAuthToken: '',
      },
    });
  }
});

/** Service Worker 启动时加载配置 */
chrome.runtime.onStartup.addListener(async () => {
  await loadAIWebsites();
});

/** 使用 chrome.alarms 实现持久化计时 */
chrome.alarms.create(ALARM_NAMES.TIMER, { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAMES.TIMER) {
    await handleTimerAlarm();
  } else if (alarm.name === ALARM_NAMES.PAUSE_REMIND) {
    await handlePauseRemindAlarm();
  }
});

/** 每分钟计时检查：遍历所有标签页，对活跃的 AI 网站标签页累加时长 */
async function handleTimerAlarm(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const activeAITabIds: number[] = [];

    for (const tab of tabs) {
      if (tab.url && isAIWebsite(tab.url) && tab.active) {
        activeAITabIds.push(tab.id!);
      }
    }

    if (activeAITabIds.length > 0) {
      // 累加总时长和活跃时长
      await addDuration(60);
      await addActiveDuration(60);

      // 检查是否触发
      const record = await getTodayRecord();
      const triggerType = shouldTrigger(record);
      if (triggerType) {
        // 对第一个活跃 AI 标签页触发
        await tryTrigger(activeAITabIds[0], triggerType);
      }
    }

    // CDI 每5分钟计算一次
    cdiTimerCounter++;
    if (cdiTimerCounter >= 5) {
      cdiTimerCounter = 0;
      try {
        const cdiRecord = await calculateCDI();
        await broadcastToAITabs({
          type: 'CDI_UPDATE',
          payload: { cdi: cdiRecord.cdi, dimensions: cdiRecord.dimensions },
        });
      } catch (cdiErr) {
        console.error('[EchoBreaker] CDI 计算出错:', cdiErr);
      }
    }
  } catch (err) {
    console.error('[EchoBreaker] 计时检查出错:', err);
  }
}

/** 暂停后再次提醒的 alarm 处理 */
async function handlePauseRemindAlarm(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.url && isAIWebsite(tab.url) && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AWAKENING' });
        } catch {
          // 标签页可能已关闭
        }
        break;
      }
    }
  } catch (err) {
    console.error('[EchoBreaker] 暂停提醒出错:', err);
  }
}

/** 监听来自 Content Script 和其他页面的消息 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    // ============ L0/L1 基础消息 ============
    case 'GET_SITE_CONFIG': {
      const tabUrl = sender.tab?.url || '';
      const config = matchSiteConfig(tabUrl);
      sendResponse(config);
      return false;
    }

    case 'USER_ACTIVE': {
      handleUserActive();
      sendResponse({ ok: true });
      return false;
    }

    case 'USER_PASTED': {
      handleUserPasted();
      sendResponse({ ok: true });
      return false;
    }

    case 'USER_SENT_QUESTION': {
      handleUserQuestion(sender.tab?.id);
      sendResponse({ ok: true });
      return false;
    }

    case 'TRIGGER_DISMISSED': {
      handleTriggerDismissed();
      sendResponse({ ok: true });
      return false;
    }

    case 'TRIGGER_PAUSED': {
      handleTriggerPaused();
      sendResponse({ ok: true });
      return false;
    }

    case 'GET_TODAY_DATA': {
      getTodayRecord().then(sendResponse);
      return true;
    }

    case 'GET_WEEKLY_DATA': {
      handleGetWeeklyData().then(sendResponse);
      return true;
    }

    case 'CHECK_CURRENT_SITE': {
      handleCheckCurrentSite().then(sendResponse);
      return true;
    }

    case 'CLEAR_TODAY_DATA': {
      handleClearTodayData().then(() => sendResponse({ success: true }));
      return true;
    }

    // ============ L2 延迟满足层消息 ============
    case 'GUIDED_MODE_TRIGGERED': {
      // 引导模式被切换
      console.log('[EchoBreaker] 引导教育模式切换:', message.payload);
      sendResponse({ ok: true });
      return false;
    }

    case 'REQUEST_GUIDED_PROMPT': {
      // 请求 LLM 生成个性化引导 Prompt
      handleRequestGuidedPrompt(message.payload, sender.tab?.id).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    // ============ L3 元认知外显层消息 ============
    case 'THOUGHT_LOG_SAVED': {
      // 思考日志已保存
      console.log('[EchoBreaker] 思考日志已保存:', message.payload?.thoughtLogId);
      sendResponse({ ok: true });
      return false;
    }

    case 'REQUEST_BIAS_ANALYSIS': {
      // 请求偏差分析
      handleRequestBiasAnalysis(message.payload).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    case 'GET_THOUGHT_LOGS': {
      // 获取思考日志列表
      getThoughtLogs().then((logs) => sendResponse({ logs }));
      return true;
    }

    // ============ L4 逆向重构层消息 ============
    case 'EVALUATE_FIND_FAULT': {
      // 评估找茬提交
      handleEvaluateFindFault(message.payload).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    // ============ L5 情境适应层消息 ============
    case 'SCENARIO_CHANGED': {
      handleScenarioChanged(message.payload).then(() => sendResponse({ ok: true }));
      return true;
    }

    case 'COGNITIVE_WALL_CHECK': {
      handleCognitiveWallCheck(message.payload).then((result) => sendResponse(result));
      return true;
    }

    case 'COGNITIVE_WALL_BLOCKED': {
      handleCognitiveWallBlocked(message.payload).then(() => sendResponse({ ok: true }));
      return true;
    }

    // ============ L6 社群唤醒层消息 ============
    case 'GET_CDI': {
      handleGetCDI().then((result) => sendResponse(result));
      return true;
    }

    case 'GET_BADGES': {
      handleGetBadges().then((result) => sendResponse(result));
      return true;
    }

    case 'SYNC_TO_CLOUD': {
      handleSyncToCloud().then((result) => sendResponse(result));
      return true;
    }

    // ============ 通用消息 ============
    case 'GET_API_CALL_COUNT': {
      getTodayApiCallCount().then((count) => sendResponse({ count }));
      return true;
    }

    case 'OPEN_TARGET_RANGE': {
      // 打开靶场页面
      chrome.tabs.create({ url: chrome.runtime.getURL('target.html') });
      sendResponse({ ok: true });
      return false;
    }

    case 'OPEN_SETTINGS': {
      // 打开设置页面
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }

    case 'TOGGLE_GUIDED_MODE_BROADCAST': {
      // Popup 请求转发引导模式切换到所有 AI 标签页
      broadcastToAITabs({ type: 'TOGGLE_GUIDED_MODE' }).then(() => {
        sendResponse({ ok: true });
      });
      return true;
    }
  }

  return false;
});

/** 处理用户活跃消息：同时累加总时长和活跃时长 */
async function handleUserActive(): Promise<void> {
  await addDuration(60);
  await addActiveDuration(60);
}

/** 处理用户粘贴消息 */
async function handleUserPasted(): Promise<void> {
  await incrementCopyPasteCount();
}

/** 处理用户发送问题 */
async function handleUserQuestion(tabId?: number): Promise<void> {
  await incrementConsecutiveRounds();
  await incrementQuestionCount();

  const record = await getTodayRecord();
  const triggerType = shouldTrigger(record);
  if (triggerType && tabId) {
    await tryTrigger(tabId, triggerType);
  }
}

/** 处理触发被关闭（继续使用） */
async function handleTriggerDismissed(): Promise<void> {
  await recordTrigger({
    timestamp: Date.now(),
    type: 'duration',
    action: 'dismissed',
  });
  await resetConsecutiveRounds();
}

/** 处理触发被暂停 */
async function handleTriggerPaused(): Promise<void> {
  await recordTrigger({
    timestamp: Date.now(),
    type: 'duration',
    action: 'paused',
  });
  await resetConsecutiveRounds();

  // 设置5分钟后再次提醒的 alarm
  chrome.alarms.create(ALARM_NAMES.PAUSE_REMIND, {
    delayInMinutes: THRESHOLDS.PAUSE_REMIND_DELAY,
  });
}

/** 处理获取周数据请求（格式化供 Popup 使用） */
async function handleGetWeeklyData(): Promise<{ dates: string[]; records: any[]; hourly: number[] }> {
  const data = await getUsageData();
  const now = new Date();
  const dates: string[] = [];
  const records: any[] = [];
  const hourly = new Array(24).fill(0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    dates.push(key);
    const record = data[key] || null;
    records.push(record);

    // 合并所有天的 hourly_data
    if (record?.hourly_data) {
      for (let h = 0; h < 24; h++) {
        hourly[h] += record.hourly_data[h] || 0;
      }
    }
  }

  return { dates, records, hourly };
}

/** 处理查询当前标签页是否为 AI 网站 */
async function handleCheckCurrentSite(): Promise<{ isAI: boolean; siteName?: string }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const config = matchSiteConfig(tab.url);
      if (config) {
        return { isAI: true, siteName: config.name };
      }
    }
  } catch {
    // 忽略错误
  }
  return { isAI: false };
}

/** 处理清除今日数据 */
async function handleClearTodayData(): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const usageData = data[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  delete usageData[today];
  await chrome.storage.local.set({ [STORAGE_KEYS.USAGE_DATA]: usageData });
}

// ============ L2 处理函数 ============

/** 处理请求引导 Prompt */
async function handleRequestGuidedPrompt(
  payload: Record<string, unknown> | undefined,
  tabId?: number
): Promise<{ success: boolean; prompt?: string; error?: string }> {
  if (!payload?.question) {
    return { success: false, error: '缺少问题参数' };
  }

  const userQuestion = String(payload.question);
  const context = payload.context ? String(payload.context) : '';

  const result = await generateGuidedPrompt(userQuestion, context);

  if (result.success && result.text && tabId) {
    // 将结果发送回 content script
    await sendTabMessage(tabId, {
      type: 'GUIDED_PROMPT_RESULT',
      payload: { prompt: result.text },
    });
  }

  return { success: result.success, prompt: result.text, error: result.success ? undefined : result.text };
}

// ============ L3 处理函数 ============

/** 处理请求偏差分析 */
async function handleRequestBiasAnalysis(
  payload: Record<string, unknown> | undefined
): Promise<{ success: boolean; analysis?: BiasAnalysis; error?: string }> {
  if (!payload?.myThought || !payload?.aiAnswer) {
    return { success: false, error: '缺少必要参数（myThought, aiAnswer）' };
  }

  const myThought = String(payload.myThought);
  const aiAnswer = String(payload.aiAnswer);
  const question = payload.question ? String(payload.question) : '';
  const thoughtLogId = payload.thoughtLogId ? String(payload.thoughtLogId) : '';

  const result = await analyzeBias(myThought, aiAnswer, question);

  if (result.success && result.analysis) {
    // 更新对应的思考日志
    if (thoughtLogId) {
      await updateThoughtLog(thoughtLogId, { biasAnalysis: result.analysis });
    }
    return { success: true, analysis: result.analysis };
  }

  return { success: false, error: result.error };
}

// ============ L4 处理函数 ============

/** 处理找茬评估 */
async function handleEvaluateFindFault(
  payload: Record<string, unknown> | undefined
): Promise<{ success: boolean; score?: number; feedback?: string; error?: string }> {
  if (!payload?.targetContent || !payload?.userHighlights) {
    return { success: false, error: '缺少必要参数' };
  }

  const targetContent = String(payload.targetContent);
  const userHighlights = payload.userHighlights as string[];
  const weakPoints = (payload.weakPoints as string[]) || [];

  const result = await evaluateFindFault(targetContent, userHighlights, weakPoints);

  if (result.success) {
    return {
      success: true,
      score: result.matchScore,
      feedback: result.feedback,
    };
  }

  return { success: false, error: result.error };
}

// ============ L5 处理函数 ============

/** 处理场景变更消息 */
async function handleScenarioChanged(
  payload: Record<string, unknown> | undefined
): Promise<void> {
  const scenario = payload?.scenario ? String(payload.scenario) : 'default';
  console.log('[EchoBreaker] 场景变更:', scenario);
  await saveDetectedScenario(scenario);
  await broadcastToAITabs({ type: 'SCENARIO_DETECTED', payload: { scenario } });
}

/** 处理认知墙检查消息 */
async function handleCognitiveWallCheck(
  payload: Record<string, unknown> | undefined
): Promise<{ blocked: boolean; similarity: number }> {
  const userText = payload?.userText ? String(payload.userText) : '';
  const aiText = payload?.aiText ? String(payload.aiText) : '';
  const scenario = (payload?.scenario as Scenario) || 'default';

  const similarity = calculateTrigramSimilarity(userText, aiText);

  const settings = await getSettings();
  const strategy = SCENARIO_STRATEGIES[scenario] || SCENARIO_STRATEGIES.default;
  const threshold = settings.cognitiveWallEnabled
    ? settings.cognitiveWallThreshold
    : strategy.similarityThreshold;

  const blocked = similarity >= threshold;

  if (blocked) {
    const block: CognitiveWallBlock = {
      id: `wall_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      scenario,
      similarity,
      userText: userText.substring(0, 200),
      aiText: aiText.substring(0, 200),
      action: 'blocked',
    };
    await saveCognitiveWallBlock(block);
  }

  return { blocked, similarity };
}

/** 处理认知墙拦截记录保存消息 */
async function handleCognitiveWallBlocked(
  payload: Record<string, unknown> | undefined
): Promise<void> {
  if (!payload) return;
  const block: CognitiveWallBlock = {
    id: (payload.id as string) || `wall_${Date.now()}`,
    timestamp: (payload.timestamp as number) || Date.now(),
    scenario: (payload.scenario as Scenario) || 'default',
    similarity: (payload.similarity as number) || 0,
    userText: (payload.userText as string) || '',
    aiText: (payload.aiText as string) || '',
    action: (payload.action as CognitiveWallBlock['action']) || 'blocked',
  };
  await saveCognitiveWallBlock(block);
}

// ============ L6 处理函数 ============

/** 处理获取 CDI 数据请求 */
async function handleGetCDI(): Promise<{ current: import('../lib/types').CDIRecord; history: import('../lib/types').CDIRecord[] }> {
  const current = await calculateCDI();
  const history = await getRecentCDI(30);
  return { current, history };
}

/** 处理获取徽章请求 */
async function handleGetBadges(): Promise<{ badges: Badge[] }> {
  await checkAndAwardBadges();
  const badges = await getEarnedBadges();
  return { badges };
}

/** 处理云端同步请求 */
async function handleSyncToCloud(): Promise<{ success: boolean; error?: string }> {
  const settings = await getSettings();
  if (!settings.cloudSyncEnabled) {
    return { success: false, error: '云端同步未启用' };
  }

  const cloudServerUrl = settings.cloudServerUrl;
  const cloudAuthToken = settings.cloudAuthToken;

  if (!cloudServerUrl) {
    return { success: false, error: '未配置云端服务地址' };
  }

  try {
    const usageData = await getUsageData();
    const thoughtLogs = await getThoughtLogs();
    const findFaultSubs = await getFindFaultSubmissions();
    const wallBlocks = await getCognitiveWallBlocks();
    const badges = await getEarnedBadges();

    const response = await fetch(`${cloudServerUrl}/api/sync/full`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudAuthToken}`,
      },
      body: JSON.stringify({
        usageData,
        thoughtLogs,
        findFaultSubmissions: findFaultSubs,
        cognitiveWallBlocks: wallBlocks,
        badges,
        syncedAt: Date.now(),
      }),
    });

    if (!response.ok) {
      return { success: false, error: `同步失败: HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `同步出错: ${errorMsg}` };
  }
}

// 初始化时加载配置
loadAIWebsites();

console.log('[EchoBreaker] Background Service Worker 已启动（v2.0 - 含L2/L3/L4/L5/L6支持）');
