/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './Categories.service';
import { MainCategoryDto } from './dto/main-category.dto';
import { SubCategoryDto } from './dto/sub-category.dto';
import { CategoryItemDto } from './dto/category-item.dto';
import {
  MainCategory,
  SubCategory,
  CategoryItem,
} from './Entities/Categories.entity';
import { JwtAuthGuard } from '../middlewares/jwt-auth.guard';
import { RolesGuard } from '../middlewares/roles.guard';
import { Roles } from '../middlewares/roles.decorator';

@Controller('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // Main Category Endpoints
  @Post('main')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async createMainCategory(
    @Body() dto: MainCategoryDto,
  ): Promise<MainCategory> {
    try {
      return await this.categoryService.createMainCategory(dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        throw new BadRequestException({
          code: 'DUPLICATE_NAME',
          message,
        });
      }
      throw new BadRequestException(message);
    }
  }

  @Get('main')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findAllMainCategories(): Promise<MainCategory[]> {
    try {
      return await this.categoryService.findAllMainCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(message);
    }
  }

  @Put('main/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async updateMainCategory(
    @Param('id') id: string,
    @Body() dto: MainCategoryDto,
  ): Promise<MainCategory> {
    try {
      return await this.categoryService.updateMainCategory(id, dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(message);
    }
  }

  @Delete('main/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async deleteMainCategory(@Param('id') id: string): Promise<void> {
    try {
      await this.categoryService.deleteMainCategory(id);
    } catch (error) {
      throw new NotFoundException(`Main category with ID ${id} not found`);
    }
  }

  // Sub Category Endpoints
  @Post('sub')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async createSubCategory(@Body() dto: SubCategoryDto): Promise<SubCategory> {
    try {
      return await this.categoryService.createSubCategory(dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        throw new BadRequestException({
          code: 'DUPLICATE_NAME',
          message,
        });
      }
      throw new BadRequestException(message);
    }
  }

  @Get('sub')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findAllSubCategories(): Promise<SubCategory[]> {
    try {
      return await this.categoryService.findAllSubCategories();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(message);
    }
  }

  @Put('sub/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async updateSubCategory(
    @Param('id') id: string,
    @Body() dto: SubCategoryDto,
  ): Promise<SubCategory> {
    try {
      return await this.categoryService.updateSubCategory(id, dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(message);
    }
  }

  @Delete('sub/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async deleteSubCategory(@Param('id') id: string): Promise<void> {
    try {
      await this.categoryService.deleteSubCategory(id);
    } catch (error) {
      throw new NotFoundException(`Sub category with ID ${id} not found`);
    }
  }

  @Get('sub/by-main/:mainCategoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findSubCategoriesByMainCategoryId(
    @Param('mainCategoryId') mainCategoryId: string,
  ): Promise<SubCategory[]> {
    try {
      return await this.categoryService.findSubCategoriesByMainCategoryId(
        mainCategoryId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(message);
    }
  }

  // Category Item Endpoints
  @Post('item')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async createCategoryItem(
    @Body() dto: CategoryItemDto,
  ): Promise<CategoryItem> {
    try {
      return await this.categoryService.createCategoryItem(dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        throw new BadRequestException({
          code: 'DUPLICATE_NAME',
          message,
        });
      }
      throw new BadRequestException(message);
    }
  }

  @Get('item')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('user', 'admin', 'technician', 'teamLeader', 'superAdmin')
  async findAllCategoryItems(): Promise<CategoryItem[]> {
    try {
      return await this.categoryService.findAllCategoryItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(message);
    }
  }

  @Put('item/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async updateCategoryItem(
    @Param('id') id: string,
    @Body() dto: CategoryItemDto,
  ): Promise<CategoryItem> {
    try {
      return await this.categoryService.updateCategoryItem(id, dto);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(message);
    }
  }

  @Delete('item/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superAdmin')
  async deleteCategoryItem(@Param('id') id: string): Promise<void> {
    try {
      await this.categoryService.deleteCategoryItem(id);
    } catch (error) {
      throw new NotFoundException(`Category item with ID ${id} not found`);
    }
  }
}
