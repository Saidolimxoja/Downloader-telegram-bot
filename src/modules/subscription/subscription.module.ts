import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [ChannelModule],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}