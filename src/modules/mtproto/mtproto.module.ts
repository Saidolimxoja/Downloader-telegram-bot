import { Module } from '@nestjs/common';
import { MtprotoService } from './mtproto.service';

@Module({
  providers: [MtprotoService],
  exports: [MtprotoService],
})
export class MtprotoModule {}