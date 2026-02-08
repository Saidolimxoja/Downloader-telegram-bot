/**
 * Форматирование длительности (секунды → MM:SS или HH:MM:SS)
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Форматирование чисел (1000 → 1K, 1000000 → 1M)
 */
export function formatNumber(num: number | null): string {
  if (!num) return '0';

  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }

  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }

  return num.toString();
}

/**
 * Создание прогресс-бара
 */
export function createProgressBar(percent: number): string {
  const total = 10;
  const filled = Math.round((percent / 100) * total);
  return '█'.repeat(filled) + '░'.repeat(total - filled);
}

/**
 * Форматирование даты загрузки (YYYYMMDD → DD.MM.YYYY)
 */
export function formatUploadDate(uploadDate: string | null): string {
  if (!uploadDate || uploadDate.length !== 8) return '—';

  const year = uploadDate.slice(0, 4);
  const month = uploadDate.slice(4, 6);
  const day = uploadDate.slice(6, 8);

  return `${day}.${month}.${year}`;
}