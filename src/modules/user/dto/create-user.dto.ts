import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateUserDto {
  id: bigint;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}