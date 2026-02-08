import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateAdDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;

  @IsOptional()
  @IsString()
  buttonText?: string;

  @IsOptional()
  @IsString()
  buttonUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  showInterval?: number;
}   