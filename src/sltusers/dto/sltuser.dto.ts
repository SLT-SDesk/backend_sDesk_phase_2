import { IsString, IsEmail, IsOptional } from 'class-validator';

export class SLTUserDto {
  @IsString()
  azureId!: string;

  @IsString()
  serviceNum!: string;

  @IsString()
  display_name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  role?: 'user' | 'admin' | 'technician' | 'teamLeader' | 'superAdmin';
}
