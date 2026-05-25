// 回声破除者 - 设置页面逻辑

import { getSettings, saveSettings, getLLMConfigs, saveLLMConfig, deleteLLMConfig, getMembership, saveMembership } from '../lib/storage';
import { LLM_PROVIDER_DEFAULTS } from '../lib/constants';
import { UserSettings, LLMApiConfig, LLMProvider, MembershipTier, TIER_QUOTAS } from '../lib/types';

// ============ 工具函数 ============

/** 防抖 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

/** 获取供应商配置输入框的值 */
function getProviderInputs(provider: string): { apiKey: string; baseUrl: string; model: string } {
  const card = document.querySelector(`.provider-card[data-provider="${provider}"]`);
  if (!card) return { apiKey: '', baseUrl: '', model: '' };
  const apiKey = (card.querySelector('.api-key-input') as HTMLInputElement)?.value?.trim() || '';
  const baseUrl = (card.querySelector('.base-url-input') as HTMLInputElement)?.value?.trim() || '';
  const model = (card.querySelector('.model-input') as HTMLInputElement)?.value?.trim() || '';
  return { apiKey, baseUrl, model };
}

/** 设置供应商配置输入框的值 */
function setProviderInputs(provider: string, config: LLMApiConfig): void {
  const card = document.querySelector(`.provider-card[data-provider="${provider}"]`);
  if (!card) return;
  const apiKeyInput = card.querySelector('.api-key-input') as HTMLInputElement;
  const baseUrlInput = card.querySelector('.base-url-input') as HTMLInputElement;
  const modelInput = card.querySelector('.model-input') as HTMLInputElement;
  if (apiKeyInput) apiKeyInput.value = config.apiKey;
  if (baseUrlInput) baseUrlInput.value = config.baseUrl;
  if (modelInput) modelInput.value = config.model;
}

/** 清空供应商配置输入框 */
function clearProviderInputs(provider: string): void {
  const defaults = LLM_PROVIDER_DEFAULTS[provider];
  const card = document.querySelector(`.provider-card[data-provider="${provider}"]`);
  if (!card) return;
  const apiKeyInput = card.querySelector('.api-key-input') as HTMLInputElement;
  const baseUrlInput = card.querySelector('.base-url-input') as HTMLInputElement;
  const modelInput = card.querySelector('.model-input') as HTMLInputElement;
  if (apiKeyInput) apiKeyInput.value = '';
  if (baseUrlInput) baseUrlInput.value = defaults?.baseUrl || '';
  if (modelInput) modelInput.value = defaults?.model || '';
}

/** 显示连接状态 */
function showConnectionStatus(provider: string, success: boolean, message: string): void {
  const statusEl = document.querySelector(`.connection-status[data-provider="${provider}"]`) as HTMLElement;
  if (!statusEl) return;
  statusEl.style.display = 'inline-flex';
  statusEl.style.alignItems = 'center';
  statusEl.style.gap = '4px';
  if (success) {
    statusEl.innerHTML = `<span style="color: #4ade80;">✓</span> <span style="color: #4ade80;">${message}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color: #ef4444;">✗</span> <span style="color: #ef4444;">${message}</span>`;
  }
  // 5秒后自动隐藏
  setTimeout(() => {
    statusEl.style.display = 'none';
  }, 5000);
}

/** 会员等级显示名称 */
function getTierDisplayName(tier: MembershipTier): string {
  const names: Record<MembershipTier, string> = {
    free: '免费版',
    deep_thinker: '深度思考者',
    pro: '专业版',
  };
  return names[tier] || '免费版';
}

// ============ 初始化 ============

async function init(): Promise<void> {
  // 加载用户设置
  const settings = await getSettings();
  populateSettings(settings);

  // 加载 LLM 配置
  const configs = await getLLMConfigs();
  populateLLMConfigs(configs);

  // 加载会员信息
  const membership = await getMembership();
  populateMembership(membership);

  // 绑定事件
  bindEvents();
}

/** 填充用户设置到 UI */
function populateSettings(settings: UserSettings): void {
  // 功能开关
  setToggle('toggle-enabled', settings.enabled);
  setToggle('toggle-guidedModeEnabled', settings.guidedModeEnabled);
  setToggle('toggle-forceThoughtInput', settings.forceThoughtInput);
  setToggle('toggle-biasAnalysisEnabled', settings.biasAnalysisEnabled);
  setToggle('toggle-targetRangeEnabled', settings.targetRangeEnabled);

  // 阈值（存储单位是秒，显示为分钟）
  const durationInput = document.getElementById('input-durationThreshold') as HTMLInputElement;
  const consecutiveInput = document.getElementById('input-consecutiveThreshold') as HTMLInputElement;
  const dailyApiInput = document.getElementById('input-dailyApiLimit') as HTMLInputElement;
  if (durationInput) durationInput.value = String(Math.round(settings.durationThreshold / 60));
  if (consecutiveInput) consecutiveInput.value = String(settings.consecutiveThreshold);
  if (dailyApiInput) dailyApiInput.value = String(settings.dailyApiLimit);

  // 首选供应商
  const providerSelect = document.getElementById('select-preferredProvider') as HTMLSelectElement;
  if (providerSelect) providerSelect.value = settings.preferredProvider;
}

/** 填充 LLM 配置到 UI */
function populateLLMConfigs(configs: Record<string, LLMApiConfig>): void {
  const providers: LLMProvider[] = ['deepseek', 'zhipu', 'qwen', 'custom'];
  for (const provider of providers) {
    if (configs[provider]) {
      setProviderInputs(provider, configs[provider]);
    }
  }
}

/** 填充会员信息到 UI */
function populateMembership(membership: { tier: MembershipTier; licenseKey: string; expireAt: number | null }): void {
  const tierEl = document.getElementById('membership-tier') as HTMLElement;
  const licenseInput = document.getElementById('license-key-input') as HTMLInputElement;
  if (tierEl) tierEl.textContent = getTierDisplayName(membership.tier);
  if (licenseInput && membership.licenseKey) licenseInput.value = membership.licenseKey;
}

/** 设置 toggle 开关状态 */
function setToggle(id: string, checked: boolean): void {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  if (!checkbox) return;
  checkbox.checked = checked;
  updateToggleVisual(checkbox);
}

/** 更新 toggle 开关的视觉样式 */
function updateToggleVisual(checkbox: HTMLInputElement): void {
  const label = checkbox.parentElement;
  if (!label) return;
  const track = label.querySelector('span:nth-child(2)') as HTMLElement;
  const knob = label.querySelector('.toggle-knob') as HTMLElement;
  if (checkbox.checked) {
    if (track) track.style.background = '#818cf8';
    if (knob) knob.style.transform = 'translateX(20px)';
  } else {
    if (track) track.style.background = 'rgba(255,255,255,0.15)';
    if (knob) knob.style.transform = 'translateX(0)';
  }
}

// ============ 事件绑定 ============

function bindEvents(): void {
  // Toggle 开关事件
  const toggleIds = [
    'toggle-enabled',
    'toggle-guidedModeEnabled',
    'toggle-forceThoughtInput',
    'toggle-biasAnalysisEnabled',
    'toggle-targetRangeEnabled',
  ];
  for (const id of toggleIds) {
    const checkbox = document.getElementById(id) as HTMLInputElement;
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        updateToggleVisual(checkbox);
        debouncedSaveToggleSettings();
      });
    }
  }

  // 阈值输入事件
  const thresholdIds = ['input-durationThreshold', 'input-consecutiveThreshold', 'input-dailyApiLimit'];
  for (const id of thresholdIds) {
    const input = document.getElementById(id) as HTMLInputElement;
    if (input) {
      input.addEventListener('input', () => {
        debouncedSaveThresholdSettings();
      });
    }
  }

  // 首选供应商事件
  const providerSelect = document.getElementById('select-preferredProvider') as HTMLSelectElement;
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      savePreferredProvider();
    });
  }

  // API Key 显示/隐藏按钮
  document.querySelectorAll('.toggle-key-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = (btn as HTMLElement).dataset.provider;
      if (!provider) return;
      const card = document.querySelector(`.provider-card[data-provider="${provider}"]`);
      const input = card?.querySelector('.api-key-input') as HTMLInputElement;
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        (btn as HTMLElement).textContent = '🔒';
      } else {
        input.type = 'password';
        (btn as HTMLElement).textContent = '👁';
      }
    });
  });

  // 测试连接按钮
  document.querySelectorAll('.test-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = (btn as HTMLElement).dataset.provider as LLMProvider;
      if (provider) testConnection(provider);
    });
  });

  // 保存按钮
  document.querySelectorAll('.save-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = (btn as HTMLElement).dataset.provider as LLMProvider;
      if (provider) saveProviderConfig(provider);
    });
  });

  // 删除按钮
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = (btn as HTMLElement).dataset.provider as LLMProvider;
      if (provider) deleteProviderConfig(provider);
    });
  });

  // 许可证激活按钮
  const activateBtn = document.getElementById('activate-license-btn');
  if (activateBtn) {
    activateBtn.addEventListener('click', () => {
      activateLicense();
    });
  }
}

// ============ 设置保存 ============

/** 保存 toggle 类设置 */
async function saveToggleSettings(): Promise<void> {
  const updates: Partial<UserSettings> = {
    enabled: getToggleValue('toggle-enabled'),
    guidedModeEnabled: getToggleValue('toggle-guidedModeEnabled'),
    forceThoughtInput: getToggleValue('toggle-forceThoughtInput'),
    biasAnalysisEnabled: getToggleValue('toggle-biasAnalysisEnabled'),
    targetRangeEnabled: getToggleValue('toggle-targetRangeEnabled'),
  };
  await saveSettings(updates);
}

const debouncedSaveToggleSettings = debounce(saveToggleSettings, 500);

/** 保存阈值类设置 */
async function saveThresholdSettings(): Promise<void> {
  const durationInput = document.getElementById('input-durationThreshold') as HTMLInputElement;
  const consecutiveInput = document.getElementById('input-consecutiveThreshold') as HTMLInputElement;
  const dailyApiInput = document.getElementById('input-dailyApiLimit') as HTMLInputElement;

  const durationMinutes = parseInt(durationInput?.value || '90', 10);
  const consecutive = parseInt(consecutiveInput?.value || '4', 10);
  const dailyApi = parseInt(dailyApiInput?.value || '50', 10);

  const updates: Partial<UserSettings> = {
    durationThreshold: Math.max(1, durationMinutes) * 60, // 转换为秒
    consecutiveThreshold: Math.max(1, consecutive),
    dailyApiLimit: Math.max(1, dailyApi),
  };
  await saveSettings(updates);
}

const debouncedSaveThresholdSettings = debounce(saveThresholdSettings, 500);

/** 保存首选供应商 */
async function savePreferredProvider(): Promise<void> {
  const providerSelect = document.getElementById('select-preferredProvider') as HTMLSelectElement;
  if (!providerSelect) return;
  await saveSettings({ preferredProvider: providerSelect.value as LLMProvider });
}

/** 获取 toggle 值 */
function getToggleValue(id: string): boolean {
  const checkbox = document.getElementById(id) as HTMLInputElement;
  return checkbox?.checked ?? false;
}

// ============ LLM 配置操作 ============

/** 保存供应商配置 */
async function saveProviderConfig(provider: LLMProvider): Promise<void> {
  const { apiKey, baseUrl, model } = getProviderInputs(provider);
  if (!apiKey) {
    showConnectionStatus(provider, false, '请输入 API Key');
    return;
  }
  if (!baseUrl) {
    showConnectionStatus(provider, false, '请输入 Base URL');
    return;
  }
  if (!model) {
    showConnectionStatus(provider, false, '请输入模型名称');
    return;
  }
  const config: LLMApiConfig = { provider, apiKey, baseUrl, model };
  await saveLLMConfig(config);
  showConnectionStatus(provider, true, '配置已保存');
}

/** 删除供应商配置 */
async function deleteProviderConfig(provider: LLMProvider): Promise<void> {
  await deleteLLMConfig(provider);
  clearProviderInputs(provider);
  showConnectionStatus(provider, true, '配置已删除');
}

/** 测试 API 连接 */
async function testConnection(provider: LLMProvider): Promise<void> {
  const { apiKey, baseUrl, model } = getProviderInputs(provider);
  if (!apiKey) {
    showConnectionStatus(provider, false, '请先输入 API Key');
    return;
  }
  if (!baseUrl) {
    showConnectionStatus(provider, false, '请先输入 Base URL');
    return;
  }
  if (!model) {
    showConnectionStatus(provider, false, '请先输入模型名称');
    return;
  }

  // 显示测试中状态
  const statusEl = document.querySelector(`.connection-status[data-provider="${provider}"]`) as HTMLElement;
  if (statusEl) {
    statusEl.style.display = 'inline-flex';
    statusEl.style.alignItems = 'center';
    statusEl.style.gap = '4px';
    statusEl.innerHTML = '<span style="color: #9ca3af;">⏳</span> <span style="color: #9ca3af;">测试中...</span>';
  }

  // 禁用测试按钮
  const testBtn = document.querySelector(`.test-btn[data-provider="${provider}"]`) as HTMLButtonElement;
  if (testBtn) {
    testBtn.disabled = true;
    testBtn.style.opacity = '0.5';
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      // 验证返回数据格式
      if (data.choices || data.id || data.object) {
        showConnectionStatus(provider, true, '连接成功');
      } else {
        showConnectionStatus(provider, false, '响应格式异常');
      }
    } else {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMsg = errorData.error.message;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch {
        // 无法解析错误体，使用默认消息
      }
      showConnectionStatus(provider, false, errorMsg);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络错误';
    showConnectionStatus(provider, false, message);
  } finally {
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.style.opacity = '1';
    }
  }
}

// ============ 许可证激活 ============

/** 激活许可证密钥 */
async function activateLicense(): Promise<void> {
  const input = document.getElementById('license-key-input') as HTMLInputElement;
  const statusEl = document.getElementById('license-status') as HTMLElement;
  if (!input || !statusEl) return;

  const key = input.value.trim();
  if (!key) {
    statusEl.style.color = '#ef4444';
    statusEl.textContent = '请输入许可证密钥';
    return;
  }

  // 简单的本地验证逻辑
  // 密钥格式：EB-XXXX-XXXX-XXXX，其中 X 为字母数字
  const keyPattern = /^EB-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;
  const proKeyPattern = /^EB-PRO-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;

  let tier: MembershipTier = 'free';
  let expireAt: number | null = null;

  if (proKeyPattern.test(key)) {
    tier = 'pro';
    expireAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1年
  } else if (keyPattern.test(key)) {
    tier = 'deep_thinker';
    expireAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1年
  } else {
    statusEl.style.color = '#ef4444';
    statusEl.textContent = '无效的许可证密钥格式';
    return;
  }

  // 保存会员信息
  await saveMembership({ tier, expireAt, licenseKey: key });

  // 更新 UI
  const tierEl = document.getElementById('membership-tier') as HTMLElement;
  if (tierEl) tierEl.textContent = getTierDisplayName(tier);

  // 根据会员等级更新 API 调用上限
  const quota = TIER_QUOTAS[tier];
  if (quota) {
    const dailyApiInput = document.getElementById('input-dailyApiLimit') as HTMLInputElement;
    if (dailyApiInput) {
      dailyApiInput.value = String(quota.dailyApiLimit);
    }
    await saveSettings({ dailyApiLimit: quota.dailyApiLimit });
  }

  statusEl.style.color = '#4ade80';
  const expiryDate = expireAt ? new Date(expireAt).toLocaleDateString('zh-CN') : '永久';
  statusEl.textContent = `激活成功！等级：${getTierDisplayName(tier)}，有效期至：${expiryDate}`;
}

// ============ 启动 ============

document.addEventListener('DOMContentLoaded', init);
