import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('main_categories')
export class MainCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 20, unique: true})
  category_code!: string;

  @Column({ length: 100, unique: true })
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => SubCategory, (subCategory) => subCategory.mainCategory)
  subCategories!: SubCategory[];
}

@Index(['name', 'mainCategory'], { unique: true })
@Entity('sub_categories')
export class SubCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 20, unique: true })
  category_code!: string;

  @Column({ length: 100 })
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => MainCategory, (mainCategory) => mainCategory.subCategories, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  mainCategory!: MainCategory;

  @OneToMany(() => CategoryItem, (categoryItem) => categoryItem.subCategory)
  categoryItems!: CategoryItem[];
}

@Index(['name', 'subCategory'], { unique: true })
@Entity('category_items')
export class CategoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 20, unique: true })
  category_code!: string;

  @Column({ length: 150 })
  name!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => SubCategory, (subCategory) => subCategory.categoryItems, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  subCategory!: SubCategory;
}
