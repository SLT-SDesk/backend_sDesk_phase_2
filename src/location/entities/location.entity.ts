import { Region } from '../enums/region.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('locations')
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  locationCode: string;

  @Column()
  locationName: string;

  @Column({
    type: 'enum',
    enum: Region,
  })
  region: Region;

  @Column()
  province: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
