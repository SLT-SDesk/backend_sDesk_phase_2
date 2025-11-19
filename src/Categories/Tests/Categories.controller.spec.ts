import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from '../Categories.controller';
import { CategoryService } from '../Categories.service';
import { MainCategoryDto } from '../dto/main-category.dto';
import { SubCategoryDto } from '../dto/sub-category.dto';
import { CategoryItemDto } from '../dto/category-item.dto';

describe('CategoryController', () => {
  let controller: CategoryController;
  let service: CategoryService;

  // Mock service
  const mockCategoryService = {
    createMainCategory: jest.fn(),
    findAllMainCategories: jest.fn(),
    findMainCategoryById: jest.fn(),
    updateMainCategory: jest.fn(),
    deleteMainCategory: jest.fn(),
    createSubCategory: jest.fn(),
    findAllSubCategories: jest.fn(),
    findSubCategoryById: jest.fn(),
    updateSubCategory: jest.fn(),
    deleteSubCategory: jest.fn(),
    findSubCategoriesByMainCategoryId: jest.fn(),
    createCategoryItem: jest.fn(),
    findAllCategoryItems: jest.fn(),
    findCategoryItemById: jest.fn(),
    updateCategoryItem: jest.fn(),
    deleteCategoryItem: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        {
          provide: CategoryService,
          useValue: mockCategoryService,
        },
      ],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createMainCategory', () => {
    it('should create a main category', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      const expectedResult = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        category_code: 'MAIN001',
        name: 'Electronics',
        createdAt: new Date(),
        updatedAt: new Date(),
        subCategories: [],
      };

      mockCategoryService.createMainCategory.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createMainCategory(createMainCategoryDto);

      // Assert
      expect(service.createMainCategory).toHaveBeenCalledWith(createMainCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when duplicate name exists', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      mockCategoryService.createMainCategory.mockRejectedValue(
        new Error("Main category with name 'Electronics' already exists"),
      );

      // Act & Assert
      await expect(controller.createMainCategory(createMainCategoryDto)).rejects.toThrow();
    });

    it('should throw BadRequestException for non-duplicate errors', async () => {
      // Arrange
      const createMainCategoryDto: MainCategoryDto = {
        name: 'Electronics',
      };

      mockCategoryService.createMainCategory.mockRejectedValue(
        new Error('Some other error'),
      );

      // Act & Assert
      await expect(controller.createMainCategory(createMainCategoryDto)).rejects.toThrow();
    });
  });

  describe('findAllMainCategories', () => {
    it('should return all main categories', async () => {
      // Arrange
      const expectedResult = [
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

      mockCategoryService.findAllMainCategories.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllMainCategories();

      // Assert
      expect(service.findAllMainCategories).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException on service error', async () => {
      // Arrange
      mockCategoryService.findAllMainCategories.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.findAllMainCategories()).rejects.toThrow();
    });
  });

  describe('updateMainCategory', () => {
    it('should update a main category', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const updateMainCategoryDto: MainCategoryDto = {
        name: 'Updated Electronics',
      };

      const expectedResult = {
        id: categoryId,
        category_code: 'MAIN001',
        name: 'Updated Electronics',
        subCategories: [],
      };

      mockCategoryService.updateMainCategory.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateMainCategory(categoryId, updateMainCategoryDto);

      // Assert
      expect(service.updateMainCategory).toHaveBeenCalledWith(categoryId, updateMainCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when update fails', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const updateMainCategoryDto: MainCategoryDto = {
        name: 'Updated Electronics',
      };

      mockCategoryService.updateMainCategory.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(controller.updateMainCategory(categoryId, updateMainCategoryDto)).rejects.toThrow();
    });
  });

  describe('deleteMainCategory', () => {
    it('should delete a main category', async () => {
      // Arrange
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      mockCategoryService.deleteMainCategory.mockResolvedValue(undefined);

      // Act
      await controller.deleteMainCategory(categoryId);

      // Assert
      expect(service.deleteMainCategory).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockCategoryService.deleteMainCategory.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.deleteMainCategory(categoryId)).rejects.toThrow();
    });
  });

  describe('createSubCategory', () => {
    it('should create a sub category', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const expectedResult = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        category_code: 'SUB001',
        name: 'Laptops',
        createdAt: new Date(),
        updatedAt: new Date(),
        mainCategory: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Electronics',
        },
        categoryItems: [],
      };

      mockCategoryService.createSubCategory.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createSubCategory(createSubCategoryDto);

      // Assert
      expect(service.createSubCategory).toHaveBeenCalledWith(createSubCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when duplicate name exists', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.createSubCategory.mockRejectedValue(
        new Error("Sub category with name 'Laptops' already exists under this main category"),
      );

      // Act & Assert
      await expect(controller.createSubCategory(createSubCategoryDto)).rejects.toThrow();
    });

    it('should throw BadRequestException for non-duplicate errors', async () => {
      // Arrange
      const createSubCategoryDto: SubCategoryDto = {
        name: 'Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.createSubCategory.mockRejectedValue(
        new Error('Some other error'),
      );

      // Act & Assert
      await expect(controller.createSubCategory(createSubCategoryDto)).rejects.toThrow();
    });
  });

  describe('findAllSubCategories', () => {
    it('should return all sub categories', async () => {
      // Arrange
      const expectedResult = [
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

      mockCategoryService.findAllSubCategories.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllSubCategories();

      // Assert
      expect(service.findAllSubCategories).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException on service error', async () => {
      // Arrange
      mockCategoryService.findAllSubCategories.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.findAllSubCategories()).rejects.toThrow();
    });
  });

  describe('updateSubCategory', () => {
    it('should update a sub category', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      const updateSubCategoryDto: SubCategoryDto = {
        name: 'Updated Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const expectedResult = {
        id: categoryId,
        category_code: 'SUB001',
        name: 'Updated Laptops',
        mainCategory: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Electronics',
        },
        categoryItems: [],
      };

      mockCategoryService.updateSubCategory.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateSubCategory(categoryId, updateSubCategoryDto);

      // Assert
      expect(service.updateSubCategory).toHaveBeenCalledWith(categoryId, updateSubCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when update fails', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      const updateSubCategoryDto: SubCategoryDto = {
        name: 'Updated Laptops',
        mainCategoryId: '123e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.updateSubCategory.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(controller.updateSubCategory(categoryId, updateSubCategoryDto)).rejects.toThrow();
    });
  });

  describe('deleteSubCategory', () => {
    it('should delete a sub category', async () => {
      // Arrange
      const categoryId = '223e4567-e89b-12d3-a456-426614174000';
      mockCategoryService.deleteSubCategory.mockResolvedValue(undefined);

      // Act
      await controller.deleteSubCategory(categoryId);

      // Assert
      expect(service.deleteSubCategory).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when category not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockCategoryService.deleteSubCategory.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.deleteSubCategory(categoryId)).rejects.toThrow();
    });
  });

  describe('findSubCategoriesByMainCategoryId', () => {
    it('should return sub categories by main category id', async () => {
      // Arrange
      const mainCategoryId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedResult = [
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

      mockCategoryService.findSubCategoriesByMainCategoryId.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findSubCategoriesByMainCategoryId(mainCategoryId);

      // Assert
      expect(service.findSubCategoriesByMainCategoryId).toHaveBeenCalledWith(mainCategoryId);
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException on service error', async () => {
      // Arrange
      const mainCategoryId = '123e4567-e89b-12d3-a456-426614174000';
      mockCategoryService.findSubCategoriesByMainCategoryId.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.findSubCategoriesByMainCategoryId(mainCategoryId)).rejects.toThrow();
    });
  });

  describe('createCategoryItem', () => {
    it('should create a category item', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      const expectedResult = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        category_code: 'CAT001',
        name: 'Dell XPS 15',
        createdAt: new Date(),
        updatedAt: new Date(),
        subCategory: {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Laptops',
        },
      };

      mockCategoryService.createCategoryItem.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.createCategoryItem(createCategoryItemDto);

      // Assert
      expect(service.createCategoryItem).toHaveBeenCalledWith(createCategoryItemDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when duplicate name exists', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.createCategoryItem.mockRejectedValue(
        new Error("Category item with name 'Dell XPS 15' already exists under this sub category"),
      );

      // Act & Assert
      await expect(controller.createCategoryItem(createCategoryItemDto)).rejects.toThrow();
    });

    it('should throw BadRequestException for non-duplicate errors', async () => {
      // Arrange
      const createCategoryItemDto: CategoryItemDto = {
        name: 'Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.createCategoryItem.mockRejectedValue(
        new Error('Some other error'),
      );

      // Act & Assert
      await expect(controller.createCategoryItem(createCategoryItemDto)).rejects.toThrow();
    });
  });

  describe('findAllCategoryItems', () => {
    it('should return all category items', async () => {
      // Arrange
      const expectedResult = [
        {
          id: '323e4567-e89b-12d3-a456-426614174000',
          category_code: 'CAT001',
          name: 'Dell XPS 15',
          subCategory: {
            id: '223e4567-e89b-12d3-a456-426614174000',
            name: 'Laptops',
          },
        },
      ];

      mockCategoryService.findAllCategoryItems.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.findAllCategoryItems();

      // Assert
      expect(service.findAllCategoryItems).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should throw InternalServerErrorException on service error', async () => {
      // Arrange
      mockCategoryService.findAllCategoryItems.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(controller.findAllCategoryItems()).rejects.toThrow();
    });
  });

  describe('updateCategoryItem', () => {
    it('should update a category item', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      const updateCategoryItemDto: CategoryItemDto = {
        name: 'Updated Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      const expectedResult = {
        id: categoryId,
        category_code: 'CAT001',
        name: 'Updated Dell XPS 15',
        subCategory: {
          id: '223e4567-e89b-12d3-a456-426614174000',
          name: 'Laptops',
        },
      };

      mockCategoryService.updateCategoryItem.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.updateCategoryItem(categoryId, updateCategoryItemDto);

      // Assert
      expect(service.updateCategoryItem).toHaveBeenCalledWith(categoryId, updateCategoryItemDto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException when update fails', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      const updateCategoryItemDto: CategoryItemDto = {
        name: 'Updated Dell XPS 15',
        subCategoryId: '223e4567-e89b-12d3-a456-426614174000',
      };

      mockCategoryService.updateCategoryItem.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(controller.updateCategoryItem(categoryId, updateCategoryItemDto)).rejects.toThrow();
    });
  });

  describe('deleteCategoryItem', () => {
    it('should delete a category item', async () => {
      // Arrange
      const categoryId = '323e4567-e89b-12d3-a456-426614174000';
      mockCategoryService.deleteCategoryItem.mockResolvedValue(undefined);

      // Act
      await controller.deleteCategoryItem(categoryId);

      // Assert
      expect(service.deleteCategoryItem).toHaveBeenCalledWith(categoryId);
    });

    it('should throw NotFoundException when category item not found', async () => {
      // Arrange
      const categoryId = 'non-existent-id';
      mockCategoryService.deleteCategoryItem.mockRejectedValue(new Error('Not found'));

      // Act & Assert
      await expect(controller.deleteCategoryItem(categoryId)).rejects.toThrow();
    });
  });
});