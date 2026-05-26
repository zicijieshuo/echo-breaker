// 回声破除者 - Popup 数据看板脚本

import * as echarts from 'echarts';

/** ECharts 实例缓存 */
let weeklyChartInstance: echarts.ECharts | null = null;
let ratioChartInstance: echarts.ECharts | null = null;
let hourlyChartInstance: echarts.ECharts | null = null;
let cdiChartInstance: echarts.ECharts | null = null;

/** 自动刷新定时器 */
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** 格式化秒数为可读格式 */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m`;
}

/** 获取最近7天日期列表 */
function getRecentDays(count: number): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/** 格式化日期为 MM/DD */
function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[1]}/${parts[2]}`;
}

/** 初始化本周趋势柱状图 */
function initWeeklyChart(dates: string[], minutes: number[]): void {
  const container = document.getElementById('weekly-chart');
  if (!container) return;

  try {
    if (!weeklyChartInstance) {
      weeklyChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
    }
    weeklyChartInstance.resize();
  } catch (err) {
    console.error('[EchoBreaker] weekly-chart ECharts初始化失败:', err);
    return;
  }

  const hasData = minutes.some((v) => v > 0);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: hasData ? undefined : {
      text: '暂无数据',
      left: 'center',
      top: 'center',
      textStyle: { color: 'rgba(44,62,80,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    grid: { top: 15, right: 12, bottom: 24, left: 36 },
    xAxis: {
      type: 'category',
      data: dates.map(formatDateLabel),
      axisLine: { lineStyle: { color: '#dce6f0' } },
      axisLabel: { color: '#7f8c9b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#7f8c9b', fontSize: 10, formatter: '{value}m' },
      minInterval: 1,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(240,245,250,0.9)',
      borderColor: 'rgba(58,124,195,0.3)',
      textStyle: { color: '#2c3e50', fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: minutes,
      barWidth: '50%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#5b9bd5' },
          { offset: 1, color: '#3a7cc3' },
        ]),
      },
    }],
    animation: true,
    animationDuration: 600,
  };

  weeklyChartInstance.setOption(option, true);
}

/** 初始化提问 vs 复制环形图 */
function initRatioChart(questions: number, copies: number): void {
  const container = document.getElementById('ratio-chart');
  if (!container) return;

  try {
    if (!ratioChartInstance) {
      ratioChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
    }
    ratioChartInstance.resize();
  } catch (err) {
    console.error('[EchoBreaker] ratio-chart ECharts初始化失败:', err);
    return;
  }

  const hasData = questions > 0 || copies > 0;
  const data = hasData
    ? [
        { value: questions, name: '提问次数', itemStyle: { color: '#3a7cc3' } },
        { value: copies, name: '复制次数', itemStyle: { color: '#e8a838' } },
      ]
    : [
        { value: 1, name: '暂无数据', itemStyle: { color: '#eef2f7' } },
      ];

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: hasData ? undefined : {
      text: '暂无数据',
      left: 'center',
      top: '35%',
      textStyle: { color: 'rgba(44,62,80,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    tooltip: hasData ? {
      trigger: 'item',
      backgroundColor: 'rgba(240,245,250,0.9)',
      borderColor: 'rgba(58,124,195,0.3)',
      textStyle: { color: '#2c3e50', fontSize: 12 },
    } : undefined,
    legend: hasData ? {
      bottom: 4,
      textStyle: { color: '#2c3e50', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
    } : undefined,
    series: [{
      type: 'pie',
      radius: ['40%', '68%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      label: {
        show: !hasData,
        position: 'center',
        formatter: '暂无数据',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
      },
      emphasis: hasData ? {
        label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#fff' },
      } : undefined,
      labelLine: { show: false },
      data,
      animation: true,
      animationDuration: 600,
    }],
  };

  ratioChartInstance.setOption(option, true);
}

/** 初始化高频使用时段横向条形图 */
function initHourlyChart(hourlyData: number[]): void {
  const container = document.getElementById('hourly-chart');
  if (!container) {
    console.error('[EchoBreaker] hourly-chart 容器不存在');
    return;
  }

  try {
    if (!hourlyChartInstance) {
      hourlyChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
    }
    hourlyChartInstance.resize();
  } catch (err) {
    console.error('[EchoBreaker] hourly-chart ECharts初始化失败:', err);
    return;
  }

  const periodLabels = ['0-4时', '4-8时', '8-12时', '12-16时', '16-20时', '20-24时'];
  const periodData = [
    hourlyData.slice(0, 4).reduce((a, b) => a + b, 0),
    hourlyData.slice(4, 8).reduce((a, b) => a + b, 0),
    hourlyData.slice(8, 12).reduce((a, b) => a + b, 0),
    hourlyData.slice(12, 16).reduce((a, b) => a + b, 0),
    hourlyData.slice(16, 20).reduce((a, b) => a + b, 0),
    hourlyData.slice(20, 24).reduce((a, b) => a + b, 0),
  ];

  const hasData = periodData.some((v) => v > 0);
  const maxVal = Math.max(...periodData, 1);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: hasData ? undefined : {
      text: '暂无数据',
      left: 'center',
      top: 'center',
      textStyle: { color: 'rgba(44,62,80,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    grid: { top: 8, right: 36, bottom: 8, left: 52 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#7f8c9b', fontSize: 9, formatter: '{value}m' },
    },
    yAxis: {
      type: 'category',
      data: periodLabels,
      axisLine: { lineStyle: { color: '#dce6f0' } },
      axisTick: { show: false },
      axisLabel: { color: '#7f8c9b', fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(240,245,250,0.9)',
      borderColor: 'rgba(58,124,195,0.3)',
      textStyle: { color: '#2c3e50', fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: periodData.map((val) => ({
        value: val,
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(58,124,195,0.6)' },
            { offset: 1, color: val >= maxVal * 0.8 ? '#e8a838' : '#5b9bd5' },
          ]),
        },
      })),
      barWidth: '55%',
      animation: true,
      animationDuration: 600,
    }],
  };

  hourlyChartInstance.setOption(option, true);
}

/** 初始化 CDI 趋势折线图 */
function initCDIChart(history: { date: string; cdi: number }[]): void {
  const container = document.getElementById('cdi-chart');
  if (!container) return;

  try {
    if (!cdiChartInstance) {
      cdiChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
    }
    cdiChartInstance.resize();
  } catch (err) {
    console.error('[EchoBreaker] cdi-chart ECharts初始化失败:', err);
    return;
  }

  const hasData = history.length > 0;
  const dates = history.map((h) => formatDateLabel(h.date));
  const cdiValues = history.map((h) => h.cdi);

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: hasData ? undefined : {
      text: '暂无数据',
      left: 'center',
      top: 'center',
      textStyle: { color: 'rgba(44,62,80,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    grid: { top: 10, right: 12, bottom: 24, left: 32 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#dce6f0' } },
      axisLabel: { color: '#7f8c9b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#eef2f7' } },
      axisLabel: { color: '#7f8c9b', fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(240,245,250,0.9)',
      borderColor: 'rgba(58,124,195,0.3)',
      textStyle: { color: '#2c3e50', fontSize: 12 },
    },
    series: [{
      type: 'line',
      data: cdiValues,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#5b9bd5', width: 2 },
      itemStyle: { color: '#5b9bd5' },
      areaStyle: { color: 'rgba(91,155,213,0.1)' },
      animation: true,
      animationDuration: 600,
    }],
  };

  cdiChartInstance.setOption(option, true);
}

/** 更新 CDI 认知依赖指数 */
async function updateCDI(): Promise<void> {
  try {
    const result: any = await chrome.runtime.sendMessage({ type: 'GET_CDI' });
    const cdiValue = result?.cdi ?? 0;
    const history: { date: string; cdi: number }[] = result?.history || [];

    const cdiValueEl = document.getElementById('cdi-value');
    const cdiLevelEl = document.getElementById('cdi-level');

    if (cdiValueEl) {
      cdiValueEl.textContent = String(cdiValue);
    }

    if (cdiLevelEl) {
      let levelText = '独立思考';
      let levelColor = '#4caf7d';
      let bgColor = 'rgba(76,175,125,0.1)';

      if (cdiValue <= 30) {
        levelText = '独立思考';
        levelColor = '#4caf7d';
        bgColor = 'rgba(76,175,125,0.1)';
      } else if (cdiValue <= 50) {
        levelText = '轻度依赖';
        levelColor = '#5b9bd5';
        bgColor = 'rgba(91,155,213,0.1)';
      } else if (cdiValue <= 70) {
        levelText = '中度依赖';
        levelColor = '#e8a838';
        bgColor = 'rgba(232,168,56,0.1)';
      } else {
        levelText = '高度依赖';
        levelColor = '#e05555';
        bgColor = 'rgba(224,85,85,0.1)';
      }

      cdiLevelEl.textContent = levelText;
      cdiLevelEl.style.color = levelColor;
      cdiLevelEl.style.background = bgColor;
    }

    initCDIChart(history);
  } catch (err) {
    console.error('[EchoBreaker Popup] 更新CDI失败:', err);
  }
}

/** 更新徽章展示 */
async function updateBadges(): Promise<void> {
  const container = document.getElementById('badges-container');
  if (!container) return;

  try {
    const result: any = await chrome.runtime.sendMessage({ type: 'GET_BADGES' });
    const badges: any[] = result?.badges || [];

    container.innerHTML = '';

    if (badges.length === 0) {
      container.innerHTML = '<span style="font-size: 12px; color: #7f8c9b;">暂无徽章，继续努力！</span>';
      return;
    }

    const tierColors: Record<string, string> = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
    };
    const tierLabels: Record<string, string> = {
      bronze: '铜',
      silver: '银',
      gold: '金',
    };

    for (const badge of badges) {
      const tier = badge.tier || 'bronze';
      const tierColor = tierColors[tier] || '#cd7f32';
      const tierLabel = tierLabels[tier] || '铜';

      const badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'display: flex; flex-direction: column; align-items: center; width: 56px;';
      badgeEl.title = badge.description || '';
      badgeEl.innerHTML = `
        <span style="font-size: 24px;">${badge.icon || '🏅'}</span>
        <span style="font-size: 10px; color: #2c3e50; text-align: center; margin-top: 2px;">${badge.name || ''}</span>
        <span style="font-size: 8px; color: ${tierColor};">${tierLabel}</span>
      `;
      container.appendChild(badgeEl);
    }
  } catch (err) {
    console.error('[EchoBreaker Popup] 更新徽章失败:', err);
    container.innerHTML = '<span style="font-size: 12px; color: #7f8c9b;">暂无徽章，继续努力！</span>';
  }
}

/** 更新当前状态指示器（通过 background 查询） */
async function updateStatusIndicator(): Promise<void> {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  try {
    const result: any = await chrome.runtime.sendMessage({ type: 'CHECK_CURRENT_SITE' });
    if (result?.isAI) {
      dot.style.background = '#4caf7d';
      dot.style.animation = 'pulse 2s infinite';
      text.textContent = `正在监测 · ${result.siteName || ''}`;
      text.style.color = '#4caf7d';
    } else {
      dot.style.background = '#6b7280';
      dot.style.animation = '';
      text.textContent = '未监测';
      text.style.color = '#9ca3af';
    }
  } catch {
    dot.style.background = '#6b7280';
    text.textContent = '未监测';
  }
}

/** 更新整个看板数据 */
async function updateDashboard(): Promise<void> {
  try {
    const todayData: any = await chrome.runtime.sendMessage({ type: 'GET_TODAY_DATA' });
    console.log('[EchoBreaker Popup] 今日数据:', JSON.stringify(todayData));

    const durationEl = document.getElementById('today-duration');
    const roundsEl = document.getElementById('today-rounds');
    const copiesEl = document.getElementById('today-copies');

    if (durationEl) durationEl.textContent = formatDuration(todayData?.total_seconds || 0);
    if (roundsEl) roundsEl.textContent = String(todayData?.consecutive_rounds || 0);
    if (copiesEl) copiesEl.textContent = String(todayData?.copy_paste_count || 0);

    const weeklyData: any = await chrome.runtime.sendMessage({ type: 'GET_WEEKLY_DATA' });
    console.log('[EchoBreaker Popup] 周数据:', JSON.stringify(weeklyData));

    const dates = weeklyData?.dates || getRecentDays(7);
    const weekMinutes = (weeklyData?.records || []).map(
      (r: any) => Math.round((r?.total_seconds || 0) / 60)
    );
    initWeeklyChart(dates, weekMinutes);

    const totalQuestions = (weeklyData?.records || []).reduce(
      (sum: number, r: any) => sum + (r?.question_count || r?.consecutive_rounds || 0), 0
    );
    const totalCopies = (weeklyData?.records || []).reduce(
      (sum: number, r: any) => sum + (r?.copy_paste_count || 0), 0
    );
    initRatioChart(totalQuestions, totalCopies);

    const hourlyMinutes = (weeklyData?.hourly || new Array(24).fill(0)).map(
      (s: number) => Math.round(s / 60)
    );
    initHourlyChart(hourlyMinutes);

    await updateStatusIndicator();
    await updateCDI();
    await updateBadges();
  } catch (err) {
    console.error('[EchoBreaker Popup] 更新看板失败:', err);
  }
}

/** 设置版本号 */
function setVersion(): void {
  const el = document.getElementById('version-text');
  if (!el) return;
  try {
    const manifest = chrome.runtime.getManifest();
    el.textContent = `v${manifest.version}`;
  } catch {
    el.textContent = 'v0.3.1';
  }
}

/** 清除今日数据 */
async function clearTodayData(): Promise<void> {
  if (!confirm('确定要清除今日所有使用数据吗？此操作不可撤销。')) return;
  try {
    await chrome.runtime.sendMessage({ type: 'CLEAR_TODAY_DATA' });
    await updateDashboard();
  } catch (err) {
    console.error('[EchoBreaker Popup] 清除数据失败:', err);
  }
}

/** 导出完整日志 */
async function exportLogs(): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null);
    const manifest = chrome.runtime.getManifest();

    const logData = {
      exportTime: new Date().toISOString(),
      extensionVersion: manifest.version,
      extensionName: manifest.name,
      allStorageData: allData,
    };

    const jsonStr = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `echo-breaker-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('[EchoBreaker Popup] 导出日志失败:', err);
    alert('导出日志失败: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/** 打开侧边栏面板 */
async function openSidePanel(): Promise<void> {
  try {
    if ((chrome as any).sidePanel?.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await (chrome as any).sidePanel.open({ tabId: tab.id });
        window.close();
        return;
      }
    }
    chrome.windows.create({
      url: chrome.runtime.getURL('sidepanel.html'),
      type: 'panel',
      width: 400,
      height: 600,
    });
    window.close();
  } catch (err) {
    console.error('[EchoBreaker Popup] 打开侧边栏失败:', err);
    chrome.runtime.openOptionsPage();
  }
}

/** 更新 API 调用计数显示 */
async function updateApiCount(): Promise<void> {
  try {
    const result: any = await chrome.runtime.sendMessage({ type: 'GET_API_CALL_COUNT' });
    const count = result?.count || 0;
    const settings = await chrome.runtime.sendMessage({ type: 'GET_TODAY_DATA' });
    const el = document.getElementById('api-count-display');
    if (el) {
      el.textContent = `API: ${count}/50`;
    }
  } catch {
    // 忽略
  }
}

/** 打开靶场页面 */
async function openTargetRange(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_TARGET_RANGE' });
    window.close();
  } catch (err) {
    console.error('[EchoBreaker Popup] 打开靶场失败:', err);
  }
}

/** 打开设置页面 */
async function openOptionsPage(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
    window.close();
  } catch (err) {
    console.error('[EchoBreaker Popup] 打开设置失败:', err);
  }
}

/** 切换引导模式 */
async function toggleGuidedMode(): Promise<void> {
  try {
    // 向当前活跃的 AI 网站标签页发送引导模式切换消息
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_GUIDED_MODE',
        });
      } catch {
        // 当前标签页可能不是 AI 网站（没有内容脚本），通过 background 转发
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_GUIDED_MODE_BROADCAST',
        });
      }
    }
  } catch (err) {
    console.error('[EchoBreaker Popup] 切换引导模式失败:', err);
  }
}

/** 场景选择对话框 */
async function selectScenario(): Promise<void> {
  const scenarios = [
    { id: 'study', name: '学习研究', icon: '📚' },
    { id: 'work', name: '工作辅助', icon: '💼' },
    { id: 'creative', name: '创意写作', icon: '🎨' },
    { id: 'casual', name: '日常闲聊', icon: '☕' },
  ];

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 9999;';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background: #ffffff; border-radius: 16px; padding: 20px; width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);';
  dialog.innerHTML = `
    <h3 style="font-size: 16px; font-weight: 600; color: #2c3e50; margin: 0 0 16px 0; text-align: center;">选择当前场景</h3>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
      ${scenarios.map((s) => `
        <button data-scenario="${s.id}" style="background: rgba(91,155,213,0.08); border: 1px solid rgba(91,155,213,0.25); border-radius: 12px; padding: 12px 8px; cursor: pointer; text-align: center; color: #2c3e50; font-size: 12px;">
          <div style="font-size: 20px; margin-bottom: 4px;">${s.icon}</div>
          <div style="color: #5b9bd5;">${s.name}</div>
        </button>
      `).join('')}
    </div>
    <button id="scenario-cancel" style="width: 100%; margin-top: 12px; padding: 8px; background: none; border: 1px solid #dce6f0; border-radius: 8px; cursor: pointer; color: #7f8c9b; font-size: 12px;">取消</button>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const closeDialog = () => {
    document.body.removeChild(overlay);
  };

  dialog.querySelector('#scenario-cancel')?.addEventListener('click', closeDialog);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDialog();
  });

  const scenarioButtons = dialog.querySelectorAll('button[data-scenario]');
  scenarioButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const scenarioId = (btn as HTMLElement).dataset.scenario || 'casual';
      try {
        await chrome.runtime.sendMessage({
          type: 'SCENARIO_CHANGED',
          scenario: scenarioId,
        });
      } catch (err) {
        console.error('[EchoBreaker Popup] 切换场景失败:', err);
      }
      closeDialog();
    });
  });
}

/** 主初始化函数 */
async function init(): Promise<void> {
  setVersion();

  // 等待 DOM 完全渲染
  await new Promise<void>((resolve) => {
    if (document.readyState === 'complete') {
      setTimeout(resolve, 200);
    } else {
      window.addEventListener('load', () => setTimeout(resolve, 200));
    }
  });

  // 先初始化空图表（确保容器尺寸正确）
  initWeeklyChart(getRecentDays(7), [0, 0, 0, 0, 0, 0, 0]);
  initRatioChart(0, 0);
  initHourlyChart(new Array(24).fill(0));
  initCDIChart([]);

  // 然后获取数据并更新
  await updateDashboard();
  await updateApiCount();

  document.getElementById('settings-btn')?.addEventListener('click', openOptionsPage);
  document.getElementById('clear-btn')?.addEventListener('click', clearTodayData);
  document.getElementById('export-btn')?.addEventListener('click', exportLogs);
  document.getElementById('refresh-btn')?.addEventListener('click', updateDashboard);
  document.getElementById('guided-mode-btn')?.addEventListener('click', toggleGuidedMode);
  document.getElementById('thought-log-btn')?.addEventListener('click', openSidePanel);
  document.getElementById('target-range-btn')?.addEventListener('click', openTargetRange);
  document.getElementById('api-count-btn')?.addEventListener('click', openOptionsPage);
  document.getElementById('scenario-btn')?.addEventListener('click', selectScenario);

  refreshTimer = setInterval(() => {
    updateDashboard();
    updateApiCount();
    updateCDI();
    updateBadges();
  }, 30000);
}

init();
