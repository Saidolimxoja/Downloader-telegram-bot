import { Module } from '@nestjs/common';
import { UploaderService } from './uploader.service';
import { MtprotoModule } from '../mtproto/mtproto.module';

@Module({
  imports: [MtprotoModule],
  providers: [UploaderService],
  exports: [UploaderService],
})
export class UploaderModule {}