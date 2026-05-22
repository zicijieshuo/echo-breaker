// 回声破除者 - Popup 数据看板脚本

import * as echarts from 'echarts';

/** ECharts 实例缓存 */
let weeklyChartInstance: echarts.ECharts | null = null;
let ratioChartInstance: echarts.ECharts | null = null;
let hourlyChartInstance: echarts.ECharts | null = null;

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
      textStyle: { color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    grid: { top: 15, right: 12, bottom: 24, left: 36 },
    xAxis: {
      type: 'category',
      data: dates.map(formatDateLabel),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, formatter: '{value}m' },
      minInterval: 1,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30,27,75,0.9)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: minutes,
      barWidth: '50%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#818cf8' },
          { offset: 1, color: '#6366f1' },
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
        { value: questions, name: '提问次数', itemStyle: { color: '#6366f1' } },
        { value: copies, name: '复制次数', itemStyle: { color: '#f59e0b' } },
      ]
    : [
        { value: 1, name: '暂无数据', itemStyle: { color: 'rgba(255,255,255,0.06)' } },
      ];

  const option: echarts.EChartsOption = {
    backgroundColor: 'transparent',
    title: hasData ? undefined : {
      text: '暂无数据',
      left: 'center',
      top: '35%',
      textStyle: { color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    tooltip: hasData ? {
      trigger: 'item',
      backgroundColor: 'rgba(30,27,75,0.9)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 12 },
    } : undefined,
    legend: hasData ? {
      bottom: 4,
      textStyle: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
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
      textStyle: { color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 'normal' },
    },
    grid: { top: 8, right: 36, bottom: 8, left: 52 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, formatter: '{value}m' },
    },
    yAxis: {
      type: 'category',
      data: periodLabels,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30,27,75,0.9)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 12 },
    },
    series: [{
      type: 'bar',
      data: periodData.map((val) => ({
        value: val,
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: 'rgba(99,102,241,0.6)' },
            { offset: 1, color: val >= maxVal * 0.8 ? '#f59e0b' : '#818cf8' },
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

/** 更新当前状态指示器（通过 background 查询） */
async function updateStatusIndicator(): Promise<void> {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  try {
    const result: any = await chrome.runtime.sendMessage({ type: 'CHECK_CURRENT_SITE' });
    if (result?.isAI) {
      dot.style.background = '#4ade80';
      dot.style.animation = 'pulse 2s infinite';
      text.textContent = `正在监测 · ${result.siteName || ''}`;
      text.style.color = '#4ade80';
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

    const durationEl = document.getElementById('today-duration');
    const roundsEl = document.getElementById('today-rounds');
    const copiesEl = document.getElementById('today-copies');

    if (durationEl) durationEl.textContent = formatDuration(todayData?.total_seconds || 0);
    if (roundsEl) roundsEl.textContent = String(todayData?.consecutive_rounds || 0);
    if (copiesEl) copiesEl.textContent = String(todayData?.copy_paste_count || 0);

    const weeklyData: any = await chrome.runtime.sendMessage({ type: 'GET_WEEKLY_DATA' });

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

    const hourlyMinutes = weeklyData?.hourly || new Array(24).fill(0);
    initHourlyChart(hourlyMinutes);

    await updateStatusIndicator();
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

  // 然后获取数据并更新
  await updateDashboard();

  document.getElementById('settings-btn')?.addEventListener('click', openSidePanel);
  document.getElementById('clear-btn')?.addEventListener('click', clearTodayData);
  document.getElementById('export-btn')?.addEventListener('click', exportLogs);

  refreshTimer = setInterval(updateDashboard, 30000);
}

init();
