import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private userService: UserService) {}

  /**
   * Проверить является ли пользователь администратором
   */
  async isAdmin(userId: bigint): Promise<boolean> {
    return this.userService.isAdmin(userId);
  }
}