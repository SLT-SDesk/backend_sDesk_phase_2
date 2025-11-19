import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryController } from './Categories.controller';
import { CategoryService } from './Categories.service';
import {
  MainCategory,
  SubCategory,
  CategoryItem,
} from './Entities/Categories.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MainCategory, SubCategory, CategoryItem]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
