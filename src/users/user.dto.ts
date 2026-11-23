import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt hanya membaca 72 byte pertama, sisanya diam-diam diabaikan
  password!: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
