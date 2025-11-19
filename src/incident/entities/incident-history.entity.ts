import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class IncidentHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  incidentNumber: string; // Incident Number (foreign key-like)

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  updatedOn: Date;

  @Column({ nullable: true })
  comments: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  attachment: string; // Store attachment filename

  @Column({ nullable: true })
  attachmentOriginalName: string; // Store original filename for display
}