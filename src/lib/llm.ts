// 回声破除者 - LLM API 网关模块
// 处理所有 LLM API 调用，支持多供应商、速率限制、统一接口

import { LLM_PROVIDER_DEFAULTS, STORAGE_KEYS } from './constants';
import { getLLMConfig, getTodayApiCallCount, incrementApiCallCount, getSettings, getMembership } from './storage';
import { LLMApiConfig, LLMProvider, TIER_QUOTAS, BiasAnalysis } from './types';

// ============ 类型定义 ============

/** callLLM 可选参数 */
export interface CallLLMOptions {
  /** 温度参数，默认 0.7 */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 覆盖默认模型 */
  model?: string;
}

/** API 调用结果 */
export interface LLMResult {
  success: boolean;
  text: string;
  /** 原始响应（调试用） */
  raw?: string;
  /** 本次调用后的今日累计次数 */
  callCount?: number;
}

// ============ 速率限制 ============

/** 获取当前会员等级对应的每日 API 上限 */
async function getDailyLimit(): Promise<number> {
  const [membership, settings] = await Promise.all([getMembership(), getSettings()]);
  const tierQuota = TIER_QUOTAS[membership.tier];
  // 用户设置中的 dailyApiLimit 优先，但不超过会员等级上限
  const userLimit = settings.dailyApiLimit;
  const tierLimit = tierQuota.dailyApiLimit;
  return Math.min(userLimit, tierLimit);
}

/** 检查是否超过每日调用上限，返回 true 表示允许调用 */
async function checkRateLimit(): Promise<{ allowed: boolean; current: number; limit: number }> {
  const [currentCount, limit] = await Promise.all([getTodayApiCallCount(), getDailyLimit()]);
  return {
    allowed: currentCount < limit,
    current: currentCount,
    limit,
  };
}

// ============ 核心 API 调用 ============

/** 解析供应商配置，合并默认值 */
function resolveConfig(config: LLMApiConfig): { baseUrl: string; model: string; apiKey: string } {
  const defaults = LLM_PROVIDER_DEFAULTS[config.provider] || LLM_PROVIDER_DEFAULTS.custom;
  return {
    baseUrl: config.baseUrl || defaults.baseUrl,
    model: config.model || defaults.model,
    apiKey: config.apiKey,
  };
}

/** 构建完整的 API 端点 URL */
function buildEndpoint(baseUrl: string): string {
  // 确保末尾没有斜杠，再拼接 /chat/completions
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

/** 统一 LLM 调用函数 */
export async function callLLM(
  provider: LLMProvider,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: CallLLMOptions,
): Promise<LLMResult> {
  // 1. 检查速率限制
  const rateCheck = await checkRateLimit();
  if (!rateCheck.allowed) {
    return {
      success: false,
      text: `今日 API 调用次数已达上限（${rateCheck.current}/${rateCheck.limit}），请明天再试或升级会员。`,
    };
  }

  // 2. 获取供应商配置
  const config = await getLLMConfig(provider);
  if (!config || !config.apiKey) {
    return {
      success: false,
      text: `未配置 ${provider} 的 API Key，请在设置中填写。`,
    };
  }

  const { baseUrl, model, apiKey } = resolveConfig(config);
  const useModel = options?.model || model;

  if (!baseUrl) {
    return {
      success: false,
      text: `${provider} 的 API 地址未配置，请在设置中填写。`,
    };
  }

  if (!useModel) {
    return {
      success: false,
      text: `${provider} 的模型名称未配置，请在设置中填写。`,
    };
  }

  // 3. 构建请求体
  const requestMessages = options?.systemPrompt
    ? [{ role: 'system' as const, content: options.systemPrompt }, ...messages]
    : messages;

  const requestBody: Record<string, unknown> = {
    model: useModel,
    messages: requestMessages,
    temperature: options?.temperature ?? 0.7,
  };

  if (options?.maxTokens) {
    requestBody.max_tokens = options.maxTokens;
  }

  // 4. 发起 API 请求
  const endpoint = buildEndpoint(baseUrl);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let errorMsg = `API 请求失败（HTTP ${response.status}）`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = `API 错误：${errorJson.error.message}`;
        } else if (errorJson.message) {
          errorMsg = `API 错误：${errorJson.message}`;
        }
      } catch {
        // 无法解析为 JSON，使用默认错误消息
        if (errorText) {
          errorMsg = `API 请求失败（HTTP ${response.status}）：${errorText.slice(0, 200)}`;
        }
      }
      return { success: false, text: errorMsg };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';

    if (!text) {
      return { success: false, text: 'API 返回了空内容，请稍后重试。' };
    }

    // 5. 调用成功，增加计数
    const callCount = await incrementApiCallCount();

    return {
      success: true,
      text,
      raw: JSON.stringify(data),
      callCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      text: `网络请求失败：${message}。请检查网络连接和 API 地址是否正确。`,
    };
  }
}

// ============ L2: 引导教育 - 苏格拉底式反问 ============

const GUIDED_SYSTEM_PROMPT = `你是一位苏格拉底式思维导师。你的任务不是直接回答用户的问题，而是通过引导性的反问，帮助用户自己思考问题的本质。

规则：
1. 绝对不要直接给出答案
2. 用简短的反问引导用户深入思考
3. 每次只问1-2个问题，不要一次问太多
4. 语气友善但有启发性
5. 帮助用户发现思考中的盲点
6. 如果用户的问题涉及事实查询，引导他们思考"为什么需要这个信息"以及"如何验证"
7. 回复控制在100字以内`;

/**
 * L2 引导教育：生成苏格拉底式反问提示
 * @param userQuestion 用户提出的问题
 * @param context 对话上下文（可选）
 * @returns 引导性的反问文本
 */
export async function generateGuidedPrompt(userQuestion: string, context?: string): Promise<LLMResult> {
  const settings = await getSettings();

  // 检查引导模式是否启用
  if (!settings.guidedModeEnabled) {
    return { success: false, text: '引导教育模式未启用。' };
  }

  // 检查会员权益
  const membership = await getMembership();
  const tierQuota = TIER_QUOTAS[membership.tier];
  if (!tierQuota.guidedModeEnabled) {
    return { success: false, text: '当前会员等级不支持引导教育模式，请升级。' };
  }

  const provider = settings.preferredProvider;
  const userContent = context
    ? `对话上下文：\n${context}\n\n用户提出了以下问题：\n\n"${userQuestion}"\n\n请用苏格拉底式反问引导用户自己思考，不要直接回答。`
    : `用户提出了以下问题：\n\n"${userQuestion}"\n\n请用苏格拉底式反问引导用户自己思考，不要直接回答。`;
  const messages = [
    {
      role: 'user' as const,
      content: userContent,
    },
  ];

  return callLLM(provider, messages, {
    systemPrompt: GUIDED_SYSTEM_PROMPT,
    temperature: 0.8,
    maxTokens: 300,
  });
}

// ============ L3: 偏差分析 ============

const BIAS_SYSTEM_PROMPT = `你是一位认知偏差分析专家。你的任务是对比用户的思考和AI的回答，分析用户思考中可能存在的认知偏差和盲点。

请按以下JSON格式输出分析结果（不要输出其他内容）：
{
  "missingDimensions": ["用户忽略的维度1", "用户忽略的维度2"],
  "strengthAreas": ["用户思考的亮点1", "用户思考的亮点2"],
  "suggestions": ["改进建议1", "改进建议2"],
  "overallScore": 75
}

要求：
1. missingDimensions：列出用户思考中缺失的重要角度或维度（2-4个）
2. strengthAreas：列出用户思考中的亮点（1-3个）
3. suggestions：给出具体的改进建议（2-3个）
4. overallScore：综合评分0-100，反映思考的全面性和深度
5. 分析要客观公正，既指出不足也肯定亮点
6. 评分标准：完全未思考(0-30)、浅层思考(31-50)、有一定深度(51-70)、深入全面(71-85)、卓越(86-100)`;

/**
 * L3 偏差分析：对比用户思考与 AI 回答，生成偏差分析报告
 * @param myThought 用户的思考内容
 * @param aiAnswer AI 的回答
 * @param question 原始问题
 * @returns 偏差分析报告
 */
export async function analyzeBias(
  myThought: string,
  aiAnswer: string,
  question: string,
): Promise<{ success: boolean; analysis?: BiasAnalysis; error?: string }> {
  // 检查偏差分析是否启用
  const settings = await getSettings();
  if (!settings.biasAnalysisEnabled) {
    return { success: false, error: '偏差分析功能未启用。' };
  }

  // 检查会员权益
  const membership = await getMembership();
  const tierQuota = TIER_QUOTAS[membership.tier];
  if (!tierQuota.biasAnalysisEnabled) {
    return { success: false, error: '当前会员等级不支持偏差分析，请升级。' };
  }

  const provider = settings.preferredProvider;
  const messages = [
    {
      role: 'user' as const,
      content: `原始问题：${question}\n\n用户的思考：\n${myThought}\n\nAI的回答：\n${aiAnswer}\n\n请分析用户思考中的认知偏差和盲点。`,
    },
  ];

  const result = await callLLM(provider, messages, {
    systemPrompt: BIAS_SYSTEM_PROMPT,
    temperature: 0.5,
    maxTokens: 800,
  });

  if (!result.success) {
    return { success: false, error: result.text };
  }

  // 解析 LLM 返回的 JSON
  try {
    // 尝试提取 JSON 部分（可能被 markdown 代码块包裹）
    let jsonStr = result.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // 如果有花括号包裹的内容，提取最外层的
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    const analysis: BiasAnalysis = {
      id: `bias_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      thoughtLogId: '', // 由调用方设置
      missingDimensions: Array.isArray(parsed.missingDimensions) ? parsed.missingDimensions : [],
      strengthAreas: Array.isArray(parsed.strengthAreas) ? parsed.strengthAreas : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      overallScore: typeof parsed.overallScore === 'number'
        ? Math.max(0, Math.min(100, parsed.overallScore))
        : 50,
      rawResponse: result.raw,
    };

    return { success: true, analysis };
  } catch {
    // JSON 解析失败，返回原始文本作为分析结果
    const analysis: BiasAnalysis = {
      id: `bias_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      thoughtLogId: '',
      missingDimensions: [],
      strengthAreas: [],
      suggestions: [result.text],
      overallScore: 50,
      rawResponse: result.raw,
    };
    return { success: true, analysis };
  }
}

// ============ L4: 找茬评估 ============

const FIND_FAULT_SYSTEM_PROMPT = `你是一位批判性思维评估专家。你的任务是评估用户在"找茬"任务中的表现——即用户是否正确识别了目标内容中的逻辑漏洞和薄弱环节。

请按以下JSON格式输出评估结果（不要输出其他内容）：
{
  "matchScore": 80,
  "matchedWeakPoints": ["匹配到的薄弱点1", "匹配到的薄弱点2"],
  "missedWeakPoints": ["遗漏的薄弱点1"],
  "falseAlarms": ["误判的标注1"],
  "feedback": "总体评价文字"
}

要求：
1. matchScore：匹配得分0-100，反映用户识别薄弱点的准确度
2. matchedWeakPoints：用户正确识别的薄弱点
3. missedWeakPoints：用户遗漏的薄弱点
4. falseAlarms：用户标注但实际不是薄弱点的内容
5. feedback：简短的评价和改进建议（100字以内）
6. 评分标准：完全未找到(0-20)、找到少量(21-40)、找到一半左右(41-60)、大部分找到(61-80)、精准识别(81-100)`;

/**
 * L4 找茬评估：评估用户在找茬任务中的提交
 * @param targetContent 靶子文本内容
 * @param userHighlights 用户标注的高亮文本片段
 * @param weakPoints 预置的薄弱点列表
 * @returns 评估结果
 */
export async function evaluateFindFault(
  targetContent: string,
  userHighlights: string[],
  weakPoints: string[],
): Promise<{
  success: boolean;
  matchScore?: number;
  matchedWeakPoints?: string[];
  missedWeakPoints?: string[];
  falseAlarms?: string[];
  feedback?: string;
  error?: string;
}> {
  // 检查靶场是否启用
  const settings = await getSettings();
  if (!settings.targetRangeEnabled) {
    return { success: false, error: '靶场功能未启用。' };
  }

  // 检查会员权益
  const membership = await getMembership();
  const tierQuota = TIER_QUOTAS[membership.tier];
  if (!tierQuota.targetRangeEnabled) {
    return { success: false, error: '当前会员等级不支持靶场功能，请升级。' };
  }

  const provider = settings.preferredProvider;
  const messages = [
    {
      role: 'user' as const,
      content: `靶子文本：\n${targetContent}\n\n预置薄弱点：\n${weakPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n用户标注的高亮片段：\n${userHighlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n请评估用户找茬的准确度。`,
    },
  ];

  const result = await callLLM(provider, messages, {
    systemPrompt: FIND_FAULT_SYSTEM_PROMPT,
    temperature: 0.3,
    maxTokens: 600,
  });

  if (!result.success) {
    return { success: false, error: result.text };
  }

  // 解析评估结果
  try {
    let jsonStr = result.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    return {
      success: true,
      matchScore: typeof parsed.matchScore === 'number' ? Math.max(0, Math.min(100, parsed.matchScore)) : 50,
      matchedWeakPoints: Array.isArray(parsed.matchedWeakPoints) ? parsed.matchedWeakPoints : [],
      missedWeakPoints: Array.isArray(parsed.missedWeakPoints) ? parsed.missedWeakPoints : [],
      falseAlarms: Array.isArray(parsed.falseAlarms) ? parsed.falseAlarms : [],
      feedback: typeof parsed.feedback === 'string' ? parsed.feedback : '',
    };
  } catch {
    return {
      success: true,
      matchScore: 50,
      matchedWeakPoints: [],
      missedWeakPoints: weakPoints,
      falseAlarms: [],
      feedback: result.text,
    };
  }
}
