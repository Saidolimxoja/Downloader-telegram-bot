// src/modules/downloader/ytdlp.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { VideoInfoDto, FormatDto } from './dto/video-info.dto';

const execAsync = promisify(exec);

@Injectable()
export class YtdlpService {
  private readonly logger = new Logger(YtdlpService.name);
  private readonly ytdlpPath: string;

  constructor(private config: ConfigService) {
    this.ytdlpPath = this.config.get<string>('YTDLP_PATH') || 'yt-dlp';
  }

  /**
   * Получить информацию о видео
   */
  async getVideoInfo(url: string): Promise<VideoInfoDto> {
    this.logger.log(`Получение информации: ${url}`);

    try {
      const { stdout } = await execAsync(
        `${this.ytdlpPath} --remote-components ejs:github --dump-json --no-playlist "${url}"`,
      );
      // ... остальной код

      const data = JSON.parse(stdout);

      // Парсим форматы
      const formats = this.getBestFormats(data.formats || []);

      return {
        id: data.id,
        url: data.webpage_url || url, // ДОБАВЬ ЭТУ СТРОКУ (убирает ошибку TS2741)
        title: data.title,
        uploader: data.uploader || data.channel || null,
        duration: data.duration || null,
        viewCount: data.view_count || null,
        likeCount: data.like_count || null,
        uploadDate: data.upload_date || null,
        thumbnail: data.thumbnail || null,
        formats,
      };
    } catch (error) {
      this.logger.error(`Ошибка получения информации: ${error}`);
      throw new Error('Не удалось получить информацию о видео');
    }
  }

  /**
   * Получить лучшие форматы (без 144p/240p)
   */
  private getBestFormats(formats: any[]): FormatDto[] {
    const videoFormats = new Map<number, FormatDto>();
    const audioFormats: FormatDto[] = [];

    formats.forEach((f) => {
      const hasVideo = f.vcodec && f.vcodec !== 'none';
      const hasAudio = f.acodec && f.acodec !== 'none';

      if (!hasAudio && !hasVideo) return;

      // Только аудио
      if (!hasVideo && hasAudio) {
        audioFormats.push({
          formatId: f.format_id,
          ext: 'm4a',
          resolution: 'audio',
          filesize: f.filesize || f.filesize_approx || null,
          quality: 0,
          hasAudio: true,
        });
      }
      // Видео
      else if (hasVideo && f.height) {
        const height = f.height;

        // Пропускаем низкое качество
        if (height < 360) return;

        const filesize = f.filesize || f.filesize_approx || null;

        // Сохраняем лучший формат для каждого разрешения
        if (
          !videoFormats.has(height) ||
          filesize > (videoFormats.get(height)?.filesize || 0)
        ) {
          videoFormats.set(height, {
            formatId: f.format_id,
            ext: 'mp4',
            resolution: `${height}p`,
            filesize: filesize,
            quality: height,
            hasAudio: hasAudio,
          });
        }
      }
    });

    // Сортируем по качеству (от высокого к низкому)
    const videoList = Array.from(videoFormats.values())
      .sort((a, b) => b.quality - a.quality)
      .slice(0, 7); // Макс 7 вариантов

    // Добавляем лучший аудио формат
    const bestAudio = audioFormats.sort(
      (a, b) => (b.filesize || 0) - (a.filesize || 0),
    )[0];

    const result = [...videoList];
    if (bestAudio) result.push(bestAudio);

    return result;
  }

  /**
   * Скачать видео с прогрессом
   */
  async downloadVideo(
    url: string,
    formatId: string,
    outputPath: string,
    isAudio: boolean,
    onProgress: (progress: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.logger.log(`Начало загрузки: ${url} (формат: ${formatId})`);

      const isInstagram = url.includes('instagram.com');
      const outputPathWithoutExt = outputPath.replace(/\.[^.]+$/, '');

      // 1. Базовые аргументы
      const args = [
        '--no-update',
        '--newline',
        '--restrict-filenames',
        '--no-playlist',
      ];

      // 2. COOKIES — Для Instagram это ОБЯЗАТЕЛЬНО
      // Убедись, что файл лежит в корне проекта
      args.push('--cookies', './youtube_cookies.txt');

      // 3. Настройка формата
      if (isInstagram) {
        // В Инсте просто берем лучшее видео с аудио
        args.push('-f', 'bestvideo+bestaudio/best');
      } else {
        // Для YouTube оставляем твою логику
        const format = formatId.includes('+')
          ? formatId
          : `${formatId}+bestaudio/best`;
        args.push('-f', format);
        args.push('--remote-components', 'ejs:github');
        args.push('--extractor-args', 'youtube:player-client=ios,web');
      }

      // 4. Обработка Аудио / Видео
      if (isAudio) {
        args.push('--extract-audio', '--audio-format', 'm4a');
      } else {
        args.push(
          '--merge-output-format',
          'mp4',
          '--postprocessor-args',
          'ffmpeg:-c:v libx264 -pix_fmt yuv420p -movflags +faststart',
        );
      }

      // Финальный путь и URL
      args.push('-o', outputPathWithoutExt + '.%(ext)s');
      args.push(url);

      const process = spawn(this.ytdlpPath, args, {
        windowsHide: true,
        shell: false,
      });

      let lastProgress = 0;
      let actualFilePath: string | null = null;

      const extractFilePath = (text: string): string | null => {
        const patterns = [
          /\[ExtractAudio\] Destination: (.+)/,
          /\[Merger\] Merging formats into "(.+)"/,
          /\[ffmpeg\] Destination: (.+)/,
          /\[download\] Destination: (.+)/,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) return match[1].trim();
        }
        return null;
      };

      process.stdout.on('data', (data) => {
        const output = data.toString();

        const detectedPath = extractFilePath(output);
        if (detectedPath) {
          actualFilePath = detectedPath;
        }

        const match = output.match(/(\d+\.\d+)%/);
        if (match) {
          const progress = parseFloat(match[1]);
          if (progress - lastProgress >= 5 || progress === 100) {
            onProgress(progress);
            lastProgress = progress;
          }
        }
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        this.logger.debug(`[yt-dlp stderr]: ${output}`); // Добавьте это!
        const detectedPath = extractFilePath(output);
        if (detectedPath) {
          actualFilePath = detectedPath;
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          const finalPath =
            actualFilePath ||
            outputPathWithoutExt + (isAudio ? '.m4a' : '.mp4');
          this.logger.log(`✅ Загрузка завершена: ${finalPath}`);
          resolve(finalPath);
        } else {
          this.logger.error(`❌ yt-dlp завершился с кодом ${code}`);
          reject(new Error(`yt-dlp завершился с ошибкой (код ${code})`));
        }
      });

      process.on('error', (error) => {
        this.logger.error(`❌ Ошибка процесса yt-dlp: ${error.message}`);
        reject(error);
      });
    });
  }
}
