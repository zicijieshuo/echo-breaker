// 回声破除者 - Popup 数据看板脚本

/** AI 网站域名列表（用于状态检测） */
const AI_DOMAINS = [
  'deepseek.com',
  'kimi.moonshot.cn',
  'chatgpt.com',
  'chat.openai.com',
  'yiyan.baidu.com',
  'tongyi.aliyun.com',
  'doubao.com',
  'claude.ai',
];

/** ECharts 实例缓存 */
let weeklyChartInstance: any = null;
let ratioChartInstance: any = null;
let hourlyChartInstance: any = null;

/** 自动刷新定时器 */
let refreshTimer: ReturnType<typeof setInterval> | null = null;

/** 格式化秒数为 HH:MM */
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

/** 等待 ECharts 全局对象可用 */
function waitForECharts(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).echarts) {
      resolve();
      return;
    }
    const check = setInterval(() => {
      if ((window as any).echarts) {
        clearInterval(check);
        resolve();
      }
    }, 50);
    // 最多等5秒
    setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 5000);
  });
}

/** 初始化本周趋势柱状图 */
function initWeeklyChart(dates: string[], minutes: number[]): void {
  const container = document.getElementById('weekly-chart');
  if (!container) return;

  const echarts = (window as any).echarts;
  if (!echarts) return;

  if (!weeklyChartInstance) {
    weeklyChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
  }

  const option = {
    grid: { top: 15, right: 12, bottom: 24, left: 36 },
    xAxis: {
      type: 'category' as const,
      data: dates.map(formatDateLabel),
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, formatter: '{value}m' },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30,27,75,0.9)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name}<br/>使用时长：<b>${p.value}分钟</b>`;
      },
    },
    series: [{
      type: 'bar' as const,
      data: minutes,
      barWidth: '50%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#818cf8' },
          { offset: 1, color: '#6366f1' },
        ]),
      },
      emphasis: {
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#a5b4fc' },
            { offset: 1, color: '#818cf8' },
          ]),
        },
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

  const echarts = (window as any).echarts;
  if (!echarts) return;

  if (!ratioChartInstance) {
    ratioChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
  }

  // 无数据时显示占位
  const hasData = questions > 0 || copies > 0;
  const data = hasData
    ? [
        { value: questions, name: '提问次数', itemStyle: { color: '#6366f1' } },
        { value: copies, name: '复制次数', itemStyle: { color: '#f59e0b' } },
      ]
    : [
        { value: 1, name: '暂无数据', itemStyle: { color: 'rgba(255,255,255,0.08)' } },
      ];

  const option = {
    tooltip: hasData ? {
      trigger: 'item' as const,
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
      type: 'pie' as const,
      radius: ['40%', '68%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      label: {
        show: !hasData,
        position: 'center' as const,
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
  if (!container) return;

  const echarts = (window as any).echarts;
  if (!echarts) return;

  if (!hourlyChartInstance) {
    hourlyChartInstance = echarts.init(container, undefined, { renderer: 'canvas' });
  }

  // 将24小时分为6个时段，每个4小时
  const periodLabels = ['0-4时', '4-8时', '8-12时', '12-16时', '16-20时', '20-24时'];
  const periodData = [
    hourlyData.slice(0, 4).reduce((a, b) => a + b, 0),
    hourlyData.slice(4, 8).reduce((a, b) => a + b, 0),
    hourlyData.slice(8, 12).reduce((a, b) => a + b, 0),
    hourlyData.slice(12, 16).reduce((a, b) => a + b, 0),
    hourlyData.slice(16, 20).reduce((a, b) => a + b, 0),
    hourlyData.slice(20, 24).reduce((a, b) => a + b, 0),
  ];

  const maxVal = Math.max(...periodData, 1);

  const option = {
    grid: { top: 8, right: 36, bottom: 8, left: 52 },
    xAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, formatter: '{value}m' },
    },
    yAxis: {
      type: 'category' as const,
      data: periodLabels,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisTick: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30,27,75,0.9)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        return `${p.name}<br/>使用时长：<b>${p.value}分钟</b>`;
      },
    },
    series: [{
      type: 'bar' as const,
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

/** 更新当前状态指示器 */
async function updateStatusIndicator(): Promise<void> {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (!dot || !text) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const hostname = new URL(tab.url).hostname;
      const isAI = AI_DOMAINS.some((domain) => hostname.includes(domain));
      if (isAI) {
        dot.className = 'w-2 h-2 rounded-full bg-green-400';
        dot.style.animation = 'pulse 2s infinite';
        text.textContent = '正在监测';
        text.className = 'text-xs text-green-400';
      } else {
        dot.className = 'w-2 h-2 rounded-full bg-gray-500';
        dot.style.animation = '';
        text.textContent = '未监测';
        text.className = 'text-xs text-gray-400';
      }
    }
  } catch {
    dot.className = 'w-2 h-2 rounded-full bg-gray-500';
    dot.style.animation = '';
    text.textContent = '未监测';
    text.className = 'text-xs text-gray-400';
  }
}

/** 更新整个看板数据 */
async function updateDashboard(): Promise<void> {
  try {
    // 获取今日数据
    const todayData: any = await chrome.runtime.sendMessage({ type: 'GET_TODAY_DATA' });

    // 更新今日概览
    const durationEl = document.getElementById('today-duration');
    const roundsEl = document.getElementById('today-rounds');
    const copiesEl = document.getElementById('today-copies');

    if (durationEl) durationEl.textContent = formatDuration(todayData?.total_seconds || 0);
    if (roundsEl) roundsEl.textContent = String(todayData?.consecutive_rounds || 0);
    if (copiesEl) copiesEl.textContent = String(todayData?.copy_paste_count || 0);

    // 获取周数据
    const weeklyData: any = await chrome.runtime.sendMessage({ type: 'GET_WEEKLY_DATA' });

    // 本周趋势图
    const dates = weeklyData?.dates || getRecentDays(7);
    const weekMinutes = (weeklyData?.records || []).map(
      (r: any) => Math.round((r?.total_seconds || 0) / 60)
    );
    initWeeklyChart(dates, weekMinutes);

    // 提问 vs 复制比例图
    const totalQuestions = (weeklyData?.records || []).reduce(
      (sum: number, r: any) => sum + (r?.consecutive_rounds || 0), 0
    );
    const totalCopies = (weeklyData?.records || []).reduce(
      (sum: number, r: any) => sum + (r?.copy_paste_count || 0), 0
    );
    initRatioChart(totalQuestions, totalCopies);

    // 高频使用时段
    const hourlyMinutes = weeklyData?.hourly || new Array(24).fill(0);
    initHourlyChart(hourlyMinutes);

    // 更新状态指示器
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
    el.textContent = 'v0.1.0';
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

/** 打开侧边栏面板 */
async function openSidePanel(): Promise<void> {
  try {
    // 优先使用 sidePanel API（Chrome 114+）
    if (chrome.sidePanel?.open) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
        return;
      }
    }
    // 回退：使用 windows.create 打开 sidepanel
    chrome.windows.create({
      url: chrome.runtime.getURL('sidepanel.html'),
      type: 'panel',
      width: 400,
      height: 600,
    });
    window.close();
  } catch (err) {
    console.error('[EchoBreaker Popup] 打开侧边栏失败:', err);
    // 最终回退：打开选项页
    chrome.runtime.openOptionsPage();
  }
}

/** 主初始化函数 */
async function init(): Promise<void> {
  // 设置版本号
  setVersion();

  // 等待 ECharts 加载
  await waitForECharts();

  // 首次更新看板
  await updateDashboard();

  // 绑定事件
  document.getElementById('settings-btn')?.addEventListener('click', openSidePanel);
  document.getElementById('clear-btn')?.addEventListener('click', clearTodayData);

  // 每30秒自动刷新
  refreshTimer = setInterval(updateDashboard, 30000);
}

// 启动
init();
