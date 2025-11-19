import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('team_admins')
@Unique(['serviceNumber'])
export class TeamAdmin {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  serviceNumber!: string;

  @Column()
  userName!: string;

  @Column()
  contactNumber!: string;

  @Column()
  designation!: string;

  @Column()
  email!: string;

  @Column({ default: true })
  active!: boolean; // true = Signed In, false = Signed Off

  @Column({ default: false })
  assignAfterSignOff!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  teamId!: string;

  @Column()
  teamName!: string;

  @CreateDateColumn()
  assignedAt!: Date;
}
