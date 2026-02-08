import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminScene } from './admin.scene';
import { UserModule } from '../user/user.module';
import { AdvertisementModule } from '../advertisement/advertisement.module';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [UserModule, AdvertisementModule, ChannelModule],
  providers: [AdminService, AdminScene],
  exports: [AdminService, AdminScene],
})
export class AdminModule {} 