// src/modules/downloader/queue.service.ts

import { Injectable, Logger } from '@nestjs/common';

interface QueueTask {
  task: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private queue: QueueTask[] = [];
  private active = 0;
  private maxParallel: number;

  constructor(maxParallel = 3) {
    this.maxParallel = maxParallel;
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  private async process() {
    while (this.queue.length > 0 && this.active < this.maxParallel) {
      const item = this.queue.shift();
      if (!item) continue;

      const { task, resolve, reject } = item;
      this.active++;

      this.logger.log(
        `⚙️ Обработка (активно: ${this.active}/${this.maxParallel}, очередь: ${this.queue.length})`
      );

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.active--;
          this.process();
        });
    }
  }

  getStatus() {
    return {
      active: this.active,
      queued: this.queue.length,
      total: this.active + this.queue.length,
    };
  }
}