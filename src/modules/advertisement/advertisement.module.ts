import { Module } from '@nestjs/common';
import { AdvertisementService } from './advertisement.service';

@Module({
  providers: [AdvertisementService],
  exports: [AdvertisementService],
})
export class AdvertisementModule {} 