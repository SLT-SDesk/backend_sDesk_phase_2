import {
  IsString,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  IsIn
} from 'class-validator';

export class CreateTechnicianDto {
  @IsString()
  @IsNotEmpty()
  serviceNum: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  team: string;

  @IsString()
  @IsNotEmpty()
  cat1: string;

  @IsOptional()
  @IsString()
  cat2?: string;

  @IsOptional()
  @IsString()
  cat3?: string;

  @IsOptional()
  @IsString()
  cat4?: string;

  @IsOptional()
  @IsIn(['technician', 'teamLeader'])
  position?: 'technician' | 'teamLeader';

  @IsBoolean()
  @IsNotEmpty()
  active: boolean;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  tier: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  contactNumber: string;
}
