import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('slt_users')
@Unique(['azureId'])
export class SLTUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  azureId!: string;

  @Column()
  serviceNum!: string;

  @Column()
  display_name!: string;

  @Column()
  email!: string;

  @Column({ nullable: true })
  contactNumber?: string;

  @Column({
    type: 'enum',
    enum: ['user', 'admin', 'technician', 'teamLeader', 'superAdmin'],
    default: 'user',
  })
  role!: 'user' | 'admin' | 'technician' | 'teamLeader' | 'superAdmin';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
