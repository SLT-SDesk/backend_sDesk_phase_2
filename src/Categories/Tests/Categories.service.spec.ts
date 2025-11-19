import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CategoryService } from '../Categories.service';
import { MainCategory, SubCategory, CategoryItem } from '../Entities/Categories.entity';
import { MainCategoryDto } from '../dto/main-category.dto';
import { SubCategoryDto } from '../dto/sub-category.dto';
import { CategoryItemDto } from '../dto/category-item.dto';

describe('CategoryService', () => {
  let service: CategoryService;
  let mainCategoryRepository: Repository<MainCategory>;
  let subCategoryRepository: Repository<SubCategory>;
  let categoryItemRepository: Repository<CategoryItem>;

  // Mock query builder
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getOne: jest.fn(),
  };

  // Mock repositories
  const mockMainCategoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    merge: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockSubCategoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockCategoryItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        {
          provide: getRepositoryToken(MainCategory),
          useValue: mockMainCategoryRepository,
        },
        {
          provide: getRepositoryToken(SubCategory),
          useValue: mockSubCategoryRepository,
        },
        {
          provide: getRepositoryToken(CategoryItem),
          useValue: mockCategoryItemRepository,
        },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    mainCategoryRepository = module.get<Repository<MainCategory>>(getRepositoryToken(MainCategory));
    subCategoryRepository = module.get<Repository<SubCategory>>(getRepositoryToken(SubCategory));
    categoryItemRepository = module.get<Repository<CategoryItem>>(getRepositoryToken(CategoryItem));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createMainCategory', () => {
    it('should create a main category successfully', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      const expectedMainCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        category_code: 'MAIN001',
        name: 'Electronics',
        createdAt: new Date(),
        updatedAt: new Date(),
        subCategories: [],
      };

      // Mock the query builder chain for duplicate check
      mockQueryBuilder.getOne.mockResolvedValue(null);
      // Mock the query builder for code generation
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: null });

      mockMainCategoryRepository.create.mockReturnValue(expectedMainCategory);
      mockMainCategoryRepository.save.mockResolvedValue(expectedMainCategory);

      // Act
      const result = await service.createMainCategory(createMainCategoryDto);

      // Assert
      expect(mockMainCategoryRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockMainCategoryRepository.create).toHaveBeenCalledWith({
        ...createMainCategoryDto,
        category_code: 'MAIN001',
      });
      expect(mockMainCategoryRepository.save).toHaveBeenCalledWith(expectedMainCategory);
      expect(result).toEqual(expectedMainCategory);
    });

    it('should throw error when category name already exists', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      const existingCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Electronics',
      };

      // Mock the query builder to return existing category
      mockQueryBuilder.getOne.mockResolvedValue(existingCategory);

      // Act & Assert
      await expect(service.createMainCategory(createMainCategoryDto)).rejects.toThrow(
        "Main category with name 'Electronics' already exists",
      );
    });

    it('should generate incremental category codes', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      // Mock existing max code
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: 5 });
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const expectedMainCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        category_code: 'MAIN006',
        name: 'Electronics',
        createdAt: new Date(),
        updatedAt: new Date(),
        subCategories: [],
      };

      mockMainCategoryRepository.create.mockReturnValue(expectedMainCategory);
      mockMainCategoryRepository.save.mockResolvedValue(expectedMainCategory);

      // Act
      const result = await service.createMainCategory(createMainCategoryDto);

      // Assert
      expect(result.category_code).toBe('MAIN006');
    });
  });

  describe('findAllMainCategories', () => {
    it('should return all main categories with sub categories and category items', async () => {
      // Arrange
      const expectedCategories = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          category_code: 'MAIN001',
          name: 'Electronics',
          subCategories: [],
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          category_code: 'MAIN002',
          name: 'Clothing',
          subCategories: [],
        },
      ];

      mockMainCategoryRepository.find.mockResolvedValue(expectedCategories);

      // Act
      const result = await service.findAllMainCategories();

      // Assert
      expect(mockMainCategoryRepository.find).toHaveBeenCalledWith({
        relations: ['subCategories', 'subCategories.categoryItems'],
      });
      expect(result).toEqual(expectedCategories);
    });

    it('should return empty array when no categories exist', async () => {
      // Arrange
      mockMainCategoryRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.findAllMainCategories();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findMainCategoryById', () => {
    it('should return a main category when found', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedCategory = {
        id: categoryId,
        category_code: 'MAIN001',
        name: 'Electronics',
        subCategories: [],
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(expectedCategory);

      // Act
      const result = await service.findMainCategoryById(categoryId);

      // Assert
      expect(mockMainCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId },
        relations: ['subCategories'],
      });
      expect(result).toEqual(expectedCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockMainCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findMainCategoryById(categoryId)).rejects.toThrow(
        new NotFoundException(`Main category with ID ${categoryId} not found`),
      );
    });
  });

  describe('updateMainCategory', () => {
    it('should update a main category successfully', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const updateMainCategoryDto: MainCategoryDto = {
        name: 'Updated Electronics',
      };

      const existingCategory = {
        id: categoryId,
        category_code: 'MAIN001',
        name: 'Electronics',
        subCategories: [],
      };

      const updatedCategory = {
        ...existingCategory,
        name: 'Updated Electronics',
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(existingCategory);
      mockMainCategoryRepository.merge.mockImplementation((target, source) => {
        Object.assign(target, source);
        return target;
      });
      mockMainCategoryRepository.save.mockResolvedValue(updatedCategory);

      // Act
      const result = await service.updateMainCategory(categoryId, updateMainCategoryDto);

      // Assert
      expect(mockMainCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId },
        relations: ['subCategories'],
      });
      expect(mockMainCategoryRepository.merge).toHaveBeenCalledWith(existingCategory, updateMainCategoryDto);
      expect(mockMainCategoryRepository.save).toHaveBeenCalledWith(existingCategory);
      expect(result).toEqual(updatedCategory);
    });

    it('should throw NotFoundException when updating non-existent category', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      const updateMainCategoryDto: MainCategoryDto = {
        name: 'Updated Electronics',
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateMainCategory(categoryId, updateMainCategoryDto)).rejects.toThrow(
        new NotFoundException(`Main category with ID ${categoryId} not found`),
      );
    });
  });

  describe('deleteMainCategory', () => {
    it('should delete a main category successfully', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      mockMainCategoryRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      await service.deleteMainCategory(categoryId);

      // Assert
      expect(mockMainCategoryRepository.delete).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when deleting non-existent category', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockMainCategoryRepository.delete.mockResolvedValue({ affected: 0 });

      // Act & Assert
      await expect(service.deleteMainCategory(categoryId)).rejects.toThrow(
        new NotFoundException(`Main category with ID ${categoryId} not found`),
      );
    });
  });

  describe('createSubCategory', () => {
    it('should create a sub category successfully', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const mainCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Electronics',
      };

      const expectedSubCategory = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        category_code: 'SUB001',
        name: 'Laptops',
        mainCategory,
        categoryItems: [],
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(mainCategory);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: null });
      mockSubCategoryRepository.create.mockReturnValue(expectedSubCategory);
      mockSubCategoryRepository.save.mockResolvedValue(expectedSubCategory);

      // Act
      const result = await service.createSubCategory(createSubCategoryDto);

      // Assert
      expect(mockMainCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: createSubCategoryDto.mainCategoryId },
      });
      expect(mockSubCategoryRepository.save).toHaveBeenCalledWith(expectedSubCategory);
      expect(result).toEqual(expectedSubCategory);
    });

    it('should throw NotFoundException when main category not found', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: 'non-existent-id',
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createSubCategory(createSubCategoryDto)).rejects.toThrow(
        new NotFoundException(`Main category with ID non-existent-id not found`),
      );
    });

    it('should throw error when sub category name already exists under main category', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const mainCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Electronics',
      };

      const existingSubCategory = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Laptops',
      };

      mockMainCategoryRepository.findOne.mockResolvedValue(mainCategory);
      mockQueryBuilder.getOne.mockResolvedValue(existingSubCategory);

      // Act & Assert
      await expect(service.createSubCategory(createSubCategoryDto)).rejects.toThrow(
        "Sub category with name 'Laptops' already exists under this main category",
      );
    });
  });

  describe('findAllSubCategories', () => {
    it('should return all sub categories with relations', async () => {
      // Arrange
      const expectedSubCategories = [
        {
          id: '223e4567-e89b-12d3-a456-426614174000',
          category_code: 'SUB001',
          name: 'Laptops',
          mainCategory: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Electronics',
          },
          categoryItems: [],
        },
      ];

      mockSubCategoryRepository.find.mockResolvedValue(expectedSubCategories);

      // Act
      const result = await service.findAllSubCategories();

      // Assert
      expect(mockSubCategoryRepository.find).toHaveBeenCalledWith({
        relations: ['mainCategory', 'categoryItems'],
      });
      expect(result).toEqual(expectedSubCategories);
    });
  });

  describe('findSubCategoryById', () => {
    it('should return a sub category when found', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      const expectedCategory = {
        id: categoryId,
        category_code: 'SUB001',
        name: 'Laptops',
        mainCategory: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Electronics',
        },
        categoryItems: [],
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(expectedCategory);

      // Act
      const result = await service.findSubCategoryById(categoryId);

      // Assert
      expect(mockSubCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId },
        relations: ['mainCategory', 'categoryItems'],
      });
      expect(result).toEqual(expectedCategory);
    });

    it('should throw NotFoundException when sub category not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockSubCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findSubCategoryById(categoryId)).rejects.toThrow(
        new NotFoundException(`Sub category with ID ${categoryId} not found`),
      );
    });
  });

  describe('updateSubCategory', () => {
    it('should update a sub category successfully', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      const updateSubCategoryDto: SubCategoryDto = {
        name: 'Updated Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const existingCategory = {
        id: categoryId,
        category_code: 'SUB001',
        name: 'Laptops',
        mainCategory: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Electronics',
        },
        categoryItems: [],
      };

      const newMainCategory = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Electronics',
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(existingCategory);
      mockMainCategoryRepository.findOne.mockResolvedValue(newMainCategory);
      mockSubCategoryRepository.save.mockResolvedValue({
        ...existingCategory,
        name: 'Updated Laptops',
      });

      // Act
      const result = await service.updateSubCategory(categoryId, updateSubCategoryDto);

      // Assert
      expect(mockSubCategoryRepository.findOne).toHaveBeenCalled();
      expect(mockMainCategoryRepository.findOne).toHaveBeenCalled();
      expect(result.name).toBe('Updated Laptops');
    });

    it('should throw NotFoundException when updating non-existent sub category', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      const updateSubCategoryDto: SubCategoryDto = {
        name: 'Updated Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateSubCategory(categoryId, updateSubCategoryDto)).rejects.toThrow(
        new NotFoundException(`Sub category with ID ${categoryId} not found`),
      );
    });
  });

  describe('deleteSubCategory', () => {
    it('should delete a sub category successfully', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      mockSubCategoryRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      await service.deleteSubCategory(categoryId);

      // Assert
      expect(mockSubCategoryRepository.delete).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when deleting non-existent sub category', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockSubCategoryRepository.delete.mockResolvedValue({ affected: 0 });

      // Act & Assert
      await expect(service.deleteSubCategory(categoryId)).rejects.toThrow(
        new NotFoundException(`Sub category with ID ${categoryId} not found`),
      );
    });
  });

  describe('createCategoryItem', () => {
    it('should create a category item successfully', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      const subCategory = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Laptops',
      };

      const expectedCategoryItem = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        category_code: 'CAT001',
        name: 'Dell XPS 15',
        subCategory,
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(subCategory);
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockQueryBuilder.getRawOne.mockResolvedValue({ max: null });
      mockCategoryItemRepository.create.mockReturnValue(expectedCategoryItem);
      mockCategoryItemRepository.save.mockResolvedValue(expectedCategoryItem);

      // Act
      const result = await service.createCategoryItem(createCategoryItemDto);

      // Assert
      expect(mockSubCategoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: createCategoryItemDto.subCategoryId },
      });
      expect(mockCategoryItemRepository.save).toHaveBeenCalledWith(expectedCategoryItem);
      expect(result).toEqual(expectedCategoryItem);
    });

    it('should throw NotFoundException when sub category not found', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: 'non-existent-id',
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createCategoryItem(createCategoryItemDto)).rejects.toThrow(
        new NotFoundException(`Sub category with ID non-existent-id not found`),
      );
    });

    it('should throw error when category item name already exists under sub category', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      const subCategory = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Laptops',
      };

      const existingCategoryItem = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        name: 'Dell XPS 15',
      };

      mockSubCategoryRepository.findOne.mockResolvedValue(subCategory);
      mockQueryBuilder.getOne.mockResolvedValue(existingCategoryItem);

      // Act & Assert
      await expect(service.createCategoryItem(createCategoryItemDto)).rejects.toThrow(
        "Category item with name 'Dell XPS 15' already exists under this sub category",
      );
    });
  });

  describe('findAllCategoryItems', () => {
    it('should return all category items with relations', async () => {
      // Arrange
      const expectedCategoryItems = [
        {
          id: '323e4567-e89b-12d3-a456-426614174000',
          category_code: 'CAT001',
          name: 'Dell XPS 15',
          subCategory: {
            id: '223e4567-e89b-12d3-a456-426614174000',
            name: 'Laptops',
            mainCategory: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Electronics',
            },
          },
        },
      ];

      mockCategoryItemRepository.find.mockResolvedValue(expectedCategoryItems);

      // Act
      const result = await service.findAllCategoryItems();

      // Assert
      expect(mockCategoryItemRepository.find).toHaveBeenCalledWith({
        relations: ['subCategory', 'subCategory.mainCategory'],
      });
      expect(result).toEqual(expectedCategoryItems);
    });
  });

  describe('findCategoryItemById', () => {
    it('should return a category item when found', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      const expectedCategory = {
        id: categoryId,
        category_code: 'CAT001',
        name: 'Dell XPS 15',
        subCategory: {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Laptops',
        },
      };

      mockCategoryItemRepository.findOne.mockResolvedValue(expectedCategory);

      // Act
      const result = await service.findCategoryItemById(categoryId);

      // Assert
      expect(mockCategoryItemRepository.findOne).toHaveBeenCalledWith({
        where: { id: categoryId },
        relations: ['subCategory'],
      });
      expect(result).toEqual(expectedCategory);
    });

    it('should throw NotFoundException when category item not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockCategoryItemRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findCategoryItemById(categoryId)).rejects.toThrow(
        new NotFoundException(`Category item with ID ${categoryId} not found`),
      );
    });
  });

  describe('updateCategoryItem', () => {
    it('should update a category item successfully', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      const updateCategoryItemDto: CategoryItemDto = {
        name: 'Updated Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      const existingCategory = {
        id: categoryId,
        category_code: 'CAT001',
        name: 'Dell XPS 15',
        subCategory: {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Laptops',
        },
      };

      const newSubCategory = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        name: 'Laptops',
      };

      mockCategoryItemRepository.findOne.mockResolvedValue(existingCategory);
      mockSubCategoryRepository.findOne.mockResolvedValue(newSubCategory);
      mockCategoryItemRepository.save.mockResolvedValue({
        ...existingCategory,
        name: 'Updated Dell XPS 15',
      });

      // Act
      const result = await service.updateCategoryItem(categoryId, updateCategoryItemDto);

      // Assert
      expect(mockCategoryItemRepository.findOne).toHaveBeenCalled();
      expect(mockSubCategoryRepository.findOne).toHaveBeenCalled();
      expect(result.name).toBe('Updated Dell XPS 15');
    });

    it('should throw NotFoundException when updating non-existent category item', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      const updateCategoryItemDto: CategoryItemDto = {
        name: 'Updated Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryItemRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateCategoryItem(categoryId, updateCategoryItemDto)).rejects.toThrow(
        new NotFoundException(`Category item with ID ${categoryId} not found`),
      );
    });
  });

  describe('deleteCategoryItem', () => {
    it('should delete a category item successfully', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      mockCategoryItemRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      await service.deleteCategoryItem(categoryId);

      // Assert
      expect(mockCategoryItemRepository.delete).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when deleting non-existent category item', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockCategoryItemRepository.delete.mockResolvedValue({ affected: 0 });

      // Act & Assert
      await expect(service.deleteCategoryItem(categoryId)).rejects.toThrow(
        new NotFoundException(`Category item with ID ${categoryId} not found`),
      );
    });
  });

  describe('findSubCategoriesByMainCategoryId', () => {
    it('should return sub categories by main category id', async () => {
      // Arrange
      const mainCategoryId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedSubCategories = [
        {
          id: '223e4567-e89b-12d3-a456-426614174000',
          category_code: 'SUB001',
          name: 'Laptops',
          mainCategory: {
            id: mainCategoryId,
            name: 'Electronics',
          },
        },
      ];

      mockSubCategoryRepository.find.mockResolvedValue(expectedSubCategories);

      // Act
      const result = await service.findSubCategoriesByMainCategoryId(mainCategoryId);

      // Assert
      expect(mockSubCategoryRepository.find).toHaveBeenCalledWith({
        where: { mainCategory: { id: mainCategoryId } },
        relations: ['mainCategory'],
      });
      expect(result).toEqual(expectedSubCategories);
    });
  });
});