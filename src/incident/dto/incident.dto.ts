import { IsString, IsBoolean, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { IncidentStatus, IncidentPriority } from '../entities/incident.entity';

export class IncidentDto {
  @IsString()
  @IsNotEmpty()
  informant!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsOptional()
  handler?: string | null;

  @IsString()
  @IsOptional()
  update_by?: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsOptional()
  update_on?: string;

  @IsEnum(IncidentStatus)
  @IsNotEmpty()
  status!: IncidentStatus;

  @IsEnum(IncidentPriority)
  @IsNotEmpty()
  priority!: IncidentPriority;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  notify_informant?: boolean;

  @IsString()
  @IsOptional()
  Attachment?: string;

  @IsString()
  @IsOptional()
  attachmentFilename?: string; // For storing server filename

  @IsString()
  @IsOptional()
  attachmentOriginalName?: string; // For storing original filename

  @IsOptional()
  attachmentBuffer?: Buffer; // For production memory storage

  @IsString()
  @IsOptional()
  attachmentMimetype?: string; // For storing file mimetype

  @IsOptional()
  attachmentSize?: number; // For storing file size

  @IsBoolean()
  @IsOptional()
  automaticallyAssignForTier2?: boolean;

  @IsBoolean()
  @IsOptional()
  automaticallyAssignForTier3?: boolean;

  @IsBoolean()
  @IsOptional()
  assignForTeamAdmin?: boolean;
}