import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CategoryItemDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  subCategoryId!: string;
}
