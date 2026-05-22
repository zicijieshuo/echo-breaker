// 回声破除者 - Popup 脚本

import { STORAGE_KEYS } from '../lib/constants';
import { formatDuration } from '../lib/utils';
import { DailyRecord } from '../lib/types';

/** 加载今日数据 */
async function loadTodayData(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.USAGE_DATA);
  const data = result[STORAGE_KEYS.USAGE_DATA] || {};
  const today = new Date().toISOString().split('T')[0];
  const record: DailyRecord = data[today] || { total_seconds: 0, consecutive_rounds: 0, copy_paste_count: 0, triggers: [] };

  document.getElementById('today-duration')!.textContent = formatDuration(record.total_seconds);
  document.getElementById('today-rounds')!.textContent = String(record.consecutive_rounds);
  document.getElementById('today-copies')!.textContent = String(record.copy_paste_count);
}

/** 加载本周趋势图（ECharts CDN 加载后初始化） */
async function loadWeeklyChart(): Promise<void> {
  // ECharts 将通过 CDN 在 popup.html 中加载
  // 此处为占位逻辑，后续集成 ECharts CDN
  const container = document.getElementById('weekly-chart');
  if (container) {
    container.innerHTML = '<p class="text-center text-gray-500 text-xs pt-12">图表加载中...</p>';
  }
}

/** 设置按钮 */
document.getElementById('settings-btn')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// 初始化
loadTodayData();
loadWeeklyChart();
