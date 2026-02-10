import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs'; // Для проверки cookie файла
import { VideoInfoDto, FormatDto } from './dto/video-info.dto';

const execAsync = promisify(exec);

@Injectable()
export class YtdlpService {
  private readonly logger = new Logger(YtdlpService.name);
  private readonly ytdlpPath: string;
  private readonly cookiesPath: string;

  constructor(private config: ConfigService) {
    this.ytdlpPath = this.config.get<string>('YTDLP_PATH') || 'yt-dlp';
    // Путь к куки файлу (должен лежать в корне проекта)
    this.cookiesPath = './youtube_cookies.txt';
  }

  /**
   * 1. ПОЛУЧЕНИЕ ИНФОРМАЦИИ
   */
async getVideoInfo(url: string): Promise<VideoInfoDto> {
  this.logger.log(`🔍 Анализ: ${url}`);

  try {
    const command = [
      `"${this.ytdlpPath}"`,
      `--dump-single-json`,
      `--no-playlist`,
      `--no-warnings`,
      `--no-check-certificate`,               // игнорировать проблемы с SSL (иногда помогает)
      `--prefer-free-formats`,                // отдавать предпочтение свободным форматам
      `--extractor-args`, `youtube:player_client=web,android`,  // эмуляция клиента браузера + Android
      `--user-agent`, `"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"`,
      `"${url}"`,
    ];

    // Добавляем куки, если файл существует
    if (existsSync(this.cookiesPath)) {
      this.logger.log(`Куки-файл найден и будет использован: ${this.cookiesPath}`);
      command.splice(1, 0, `--cookies "${this.cookiesPath}"`);
    }

    // Для отладки: логируем полную команду (можно закомментировать после тестов)
    this.logger.debug(`Выполняемая команда: ${command.join(' ')}`);

    const { stdout, stderr } = await execAsync(command.join(' '), { timeout: 45000 });

    if (stderr && stderr.includes('ERROR')) {
      this.logger.warn(`yt-dlp вывел предупреждения/ошибки в stderr: ${stderr.trim()}`);
    }

    const data = JSON.parse(stdout);

    return {
      id: data.id,
      url: data.webpage_url || url,
      title: data.title,
      uploader: data.uploader || data.channel || 'Unknown',
      duration: data.duration || 0,
      viewCount: data.view_count || 0,
      likeCount: data.like_count || 0,
      uploadDate: data.upload_date || '',
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
      formats: this.getBestFormats(data.formats || []),
    };
  } catch (error: any) {
    this.logger.error(`Ошибка при получении информации о видео: ${error.message || error}`);

    if (error.stdout) {
      this.logger.debug(`stdout ошибки: ${error.stdout}`);
    }
    if (error.stderr) {
      this.logger.debug(`stderr ошибки: ${error.stderr}`);
    }

    // Более информативное сообщение для пользователя
    const errMsg = error.message?.includes('Sign in to confirm') 
      ? 'Требуется авторизация (YouTube запрашивает подтверждение, что вы не бот). Попробуйте позже или другое видео.'
      : 'Видео недоступно, ссылка неверна или временно заблокировано на сервере.';

    throw new Error(errMsg);
  }
}

  /**
   * 2. ФИЛЬТРАЦИЯ ФОРМАТОВ
   * Исправил логику, чтобы точнее определять размер
   */
  private getBestFormats(formats: any[]): FormatDto[] {
    const videoFormats = new Map<number, FormatDto>();
    const audioFormats: FormatDto[] = [];

    formats.forEach((f) => {
      const hasVideo = f.vcodec && f.vcodec !== 'none';
      const hasAudio = f.acodec && f.acodec !== 'none';

      // Ищем размер: filesize (точный) > filesize_approx (примерный) > 0
      const size = f.filesize || f.filesize_approx || 0;

      // --- АУДИО ---
      if (!hasVideo && hasAudio) {
        audioFormats.push({
          formatId: f.format_id,
          ext: 'm4a',
          resolution: 'audio',
          filesize: size,
          quality: 0,
          hasAudio: true,
        });
      }
      // --- ВИДЕО ---
      else if (hasVideo) {
        const height = f.height || 0;
        if (height < 144) return; // Совсем мусор пропускаем

        // Логика: Если у нас уже есть такое качество (например 1080p),
        // мы заменяем его только если текущий файл "тяжелее" (значит битрейт выше)
        // НО! Для Telegram бота иногда лучше брать mp4 контейнер приоритетно.

        const existing: any = videoFormats.get(height);

        // Если формата еще нет ИЛИ новый формат больше (лучше качество)
        // Но исключаем форматы, которые весят неадекватно мало (глюк API)
        if (size > 0 && (!existing || size > existing.filesize)) {
          videoFormats.set(height, {
            formatId: f.format_id,
            ext: 'mp4', // Мы все равно сконвертируем в mp4
            resolution: `${height}p`,
            filesize: size, // Это размер ТОЛЬКО видеодорожки
            quality: height,
            hasAudio: hasAudio,
          });
        }
      }
    });

    // Сортировка: 1080p -> 720p -> ...
    const sortedVideos = Array.from(videoFormats.values()).sort(
      (a, b) => b.quality - a.quality,
    );

    // Берем лучшее аудио (обычно m4a)
    const bestAudio = audioFormats.sort(
      (a: any, b: any) => b.filesize - a.filesize,
    )[0];

    // Если есть аудио, добавляем его в конец списка (для кнопки "Скачать MP3")
    if (bestAudio) sortedVideos.push(bestAudio);

    return sortedVideos;
  }

  /**
   * 3. СКАЧИВАНИЕ
   * Вот здесь исправлена проблема с 800MB
   */
  async downloadVideo(
    url: string,
    formatId: string, // <-- Сюда придет, например, "137" (это видео 1080p весом 130мб)
    outputPath: string, // Полный путь c/без расширения
    isAudio: boolean,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.log(`🚀 Старт загрузки: ${url} | Format: ${formatId}`);

      // Убираем расширение из outputPath, yt-dlp сам добавит .mp4/.m4a
      // Если outputPath = "/downloads/video.mp4", делаем "/downloads/video"
      const outputPathBase = outputPath.replace(/\.(mp4|m4a|webm)$/, '');

      const args = [
        url,
        '--no-playlist',
        '--no-mtime', // Не сохранять дату изменения файла (важно для ТГ)
        '--no-part', // Не создавать .part файлы (сразу писать итог)
        '--output',
        `${outputPathBase}.%(ext)s`,

        // Для удобного парсинга прогресса
        '--newline',
        '--progress-template',
        '%(progress._percent_str)s',
      ];

      // 1. Cookies (если есть)
      if (existsSync(this.cookiesPath)) {
        args.push('--cookies', this.cookiesPath);
      }

      // 2. Выбор формата (САМОЕ ВАЖНОЕ)
      if (isAudio) {
        // Скачать лучшее аудио и конвертировать в m4a (легче для айфонов/тг)
        args.push('-f', 'bestaudio/best');
        args.push('--extract-audio', '--audio-format', 'm4a');
      } else {
        // --- МАГИЯ ЗДЕСЬ ---
        // formatId - это ID видеодорожки (например, 137).
        // Мы говорим: "Возьми видеодорожку 137 И приклей к ней лучший звук".
        // merge-output-format mp4 гарантирует, что на выходе будет MP4 (не MKV).
        args.push('-f', `${formatId}+bestaudio/best`);
        args.push('--merge-output-format', 'mp4');

        // Опционально: убедиться, что видео кодек совместим с Telegram
        // (обычно yt-dlp сам справляется, но если видео не грузится в тг, раскомментируй)
        // args.push('--postprocessor-args', 'ffmpeg:-c:v libx264 -c:a aac');
      }

      const child = spawn(this.ytdlpPath, args);

      let lastProgress = 0;
      let detectedFilename: string | null = null;

      // Парсинг вывода
      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();

        // 1. Пытаемся поймать имя файла
        // [Merger] Merging formats into "downloads/video.mp4"
        const mergeMatch = text.match(/Merging formats into "(.+?)"/);
        if (mergeMatch) detectedFilename = mergeMatch[1];

        // [download] Destination: downloads/video.m4a
        const destMatch = text.match(/Destination: (.+?)$/m);
        if (destMatch) detectedFilename = destMatch[1];

        // 2. Парсим проценты
        // Вывод благодаря --progress-template будет типа " 45.5%"
        const percentMatch = text.match(/(\d+\.?\d*)%/);
        if (percentMatch) {
          const percent = parseFloat(percentMatch[1]);
          if (!isNaN(percent)) {
            // Шлем обновление только если изменилось на >5% или финал, чтобы не спамить
            if (percent - lastProgress >= 5 || percent >= 99) {
              onProgress(percent);
              lastProgress = percent;
            }
          }
        }
      });

      child.stderr.on('data', (chunk) => {
        // yt-dlp иногда пишет варнинги в stderr, это ок.
        // Но критические ошибки тоже тут.
        const text = chunk.toString();
        if (text.toLowerCase().includes('error')) {
          this.logger.debug(`yt-dlp stderr: ${text}`);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          // Если мы не смогли распарсить имя, пробуем угадать
          const finalExt = isAudio ? '.m4a' : '.mp4';
          const finalPath = detectedFilename || `${outputPathBase}${finalExt}`;

          this.logger.log(`✅ Готово: ${finalPath}`);
          resolve(finalPath);
        } else {
          this.logger.error(`yt-dlp упал с кодом ${code}`);
          reject(new Error('Ошибка при скачивании файла'));
        }
      });

      child.on('error', (err) => {
        this.logger.error(`Ошибка запуска процесса: ${err}`);
        reject(err);
      });
    });
  }
}
