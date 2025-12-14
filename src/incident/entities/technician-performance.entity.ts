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
// new fields
  @Column({ type: 'int', nullable: true })
  responseTimeMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  responseTimeLabel: string;

  @Column({ type: 'int', nullable: true })
  resolutionTimeMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  resolutionTimeLabel: string;

}
