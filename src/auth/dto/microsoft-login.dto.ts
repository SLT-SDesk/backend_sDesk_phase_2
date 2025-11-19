import { IsString, IsNotEmpty } from 'class-validator';

export class MicrosoftLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  redirect_uri!: string;
}
