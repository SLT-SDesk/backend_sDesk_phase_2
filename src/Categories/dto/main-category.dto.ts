import { IsString, IsNotEmpty } from 'class-validator';

export class MainCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
