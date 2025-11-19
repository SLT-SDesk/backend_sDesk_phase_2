import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class SubCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  mainCategoryId!: string;
}
