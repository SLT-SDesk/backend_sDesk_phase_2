import { PartialType } from '@nestjs/mapped-types';
import { SLTUserDto } from './sltuser.dto';

export class UpdateSLTUserDto extends PartialType(SLTUserDto) { }
