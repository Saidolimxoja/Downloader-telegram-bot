import * as crypto from 'crypto';





/**
 * Очистка имени файла от недопустимых символов
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Форматирование размера файла
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '? MB';
  
  const mb = bytes / (1024 * 1024);
  
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  
  return `${mb.toFixed(1)} MB`;
}

/**
 * Генерация ключа кеша
 */
export function generateCacheKey(
  url: string,
  formatId: string,
  resolution: string,
): string {
  return crypto
    .createHash('md5')
    .update(`${url}|${formatId}|${resolution}`)
    .digest('hex');
}