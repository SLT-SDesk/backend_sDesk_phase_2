import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class TechnicianPerformance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  incidentNumber: string;

  @Column({ type: 'varchar', nullable: true })
  responseTime: string;

  @Column({ type: 'varchar', nullable: true })
  resolveTime: string;

}
