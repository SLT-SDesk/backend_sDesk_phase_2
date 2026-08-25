import { IsString, IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { IncidentStatus, IncidentPriority } from '../entities/incident.entity';

export class IncidentDto {
  @IsString()
  informant!: string;

  @IsString()
  location!: string;

  @IsString()
  @IsOptional()
  handler?: string | null;

  @IsString()
  @IsOptional()
  update_by?: string;

  @IsString()
  category!: string;

  @IsString()
  @IsOptional()
  update_on?: string;

  @IsEnum(IncidentStatus)
  status!: IncidentStatus;

  @IsEnum(IncidentPriority)
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
  assignForTeamAdmin?: boolean;
}