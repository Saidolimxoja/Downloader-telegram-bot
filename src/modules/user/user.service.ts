import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '@prisma/client'

@Injectable()
export class UserService {
  private readonly adminUserId

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.adminUserId = this.config.get<number>('ADMIN_USER_ID');
  }

  /**
   * Создать или обновить пользователя
   */
  async createOrUpdate(dto: CreateUserDto): Promise<User> {
    const isAdmin = dto.id === this.adminUserId;

    return this.prisma.user.upsert({
      where: { id: dto.id },
      update: {
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        lastActiveAt: new Date(),
      },
      create: {
        id: dto.id,
        username: dto.username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isAdmin,
      },
    });
  }

  /**
   * Найти пользователя по ID
   */
  async findById(id: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Проверка на бан
   */
  async isBanned(userId: bigint): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.isBanned ?? false;
  }

  /**
   * Проверка на админа
   */
  async isAdmin(userId: bigint): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.isAdmin ?? false;
  }

  /**
   * Увеличить счётчик загрузок
   */
  async incrementDownloads(userId: bigint): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totalDownloads: { increment: 1 },
      },
    });
  }

  /**
   * Получить общую статистику
   */
  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const activeToday = await this.prisma.user.count({
      where: {
        lastActiveAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      totalUsers,
      activeToday,
    };
  }
}