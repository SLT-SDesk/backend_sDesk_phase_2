import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class TeamAdminDto {
  @IsNotEmpty({ message: 'Service Number is required' })
  @IsString()
  serviceNumber!: string;

  @IsNotEmpty({ message: 'User Name is required' })
  @IsString()
  userName!: string;

  @IsNotEmpty({ message: 'Contact Number is required' })
  @IsString()
  contactNumber!: string;

  @IsNotEmpty({ message: 'Designation is required' })
  @IsString()
  designation!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  assignAfterSignOff?: boolean;

  @IsNotEmpty({ message: 'Team ID is required' })
  @IsString({ message: 'Team ID must be a string' })
  teamId!: string;

  @IsNotEmpty({ message: 'Team Name is required' })
  @IsString({ message: 'Team Name must be a string' })
  teamName!: string;
}
