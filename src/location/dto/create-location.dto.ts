import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Region } from '../enums/region.enum';

// Create DTO
export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  locationCode: string;

  @IsString()
  @IsNotEmpty()
  locationName: string;

  @IsNotEmpty()
  @IsEnum(Region, {
    message: 'Region must be one of: Metro, R1, R2, R3',
  })
  region: Region;

  @IsString()
  @IsNotEmpty()
  province: string;
}

// Update DTO extends Create DTO
export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  locationCode?: string;

  @IsString()
  @IsOptional()
  locationName?: string;

  @IsEnum(Region, {
    message: 'Region must be one of: Metro, R1, R2, R3',
  })
  @IsOptional()
  region?: Region;

  @IsString()
  @IsOptional()
  province?: string;
}
