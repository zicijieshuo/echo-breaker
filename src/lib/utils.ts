// 回声破除者 - 工具函数

/** 格式化秒数为 HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** 获取今日日期字符串 YYYY-MM-DD */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/** 从数组中随机取一个元素 */
export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 防抖 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

/** 判断当前URL是否匹配AI网站 */
export function isAIWebsite(url: string, domains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname;
    return domains.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}
