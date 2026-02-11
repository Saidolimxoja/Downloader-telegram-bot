import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  channelId: string;

  @IsString()
  channelName: string;

  @IsNumber()
  priority: number;

  @IsOptional()
  @IsString()
  channelLink: string;
}