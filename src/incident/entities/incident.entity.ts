import { Entity, Column } from 'typeorm';
import { Expose } from 'class-transformer';

export enum IncidentStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  HOLD = 'Hold',
  CLOSED = 'Closed',
  PENDING_ASSIGNMENT = 'Pending Assignment',
  PENDING_TIER2_ASSIGNMENT = 'Pending Tier2 Assignment',
}

export enum IncidentPriority {
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical',
}

@Entity()
export class Incident {
  @Column({ type: 'varchar', primary: true, unique: true })
  @Expose({ name: 'incident_number' })
  incident_number!: string;

  @Column('varchar')
  informant!: string;

  @Column()
  location!: string;

  @Column({ type: 'varchar', nullable: true })
  handler!: string | null;

  @Column()
  update_by!: string;

  @Column()
  category!: string;

  @Column({ type: 'date' })
  update_on!: string;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OPEN })
  status!: IncidentStatus;

  @Column({
    type: 'enum',
    enum: IncidentPriority,
    default: IncidentPriority.MEDIUM,
  })
  priority!: IncidentPriority;

  @Column({ nullable: true })
  description!: string;

  @Column({ type: 'boolean', default: false })
  notify_informant!: boolean;

  @Column({ nullable: true })
  Attachment!: string;

  @Column({ nullable: true })
  attachmentFilename?: string;

  @Column({ nullable: true })
  attachmentOriginalName?: string;
}
