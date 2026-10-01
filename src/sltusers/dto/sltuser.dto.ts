import { IsString, IsEmail, IsOptional, IsNotEmpty } from 'class-validator';

export class SLTUserDto {
  @IsString()
  @IsNotEmpty()
  azureId!: string;

  @IsString()
  @IsNotEmpty()
  serviceNum!: string;

  @IsString()
  @IsNotEmpty()
  display_name!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  role?: 'user' | 'admin' | 'technician' | 'teamLeader' | 'superAdmin';
}
