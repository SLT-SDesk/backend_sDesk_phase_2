import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'recipient_service_number' })
  recipientServiceNumber: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'incident_number', nullable: true })
  incidentNumber: string;

  @Column({ name: 'actor_name', nullable: true })
  actorName: string;

  @Column({ name: 'actor_service_number', nullable: true })
  actorServiceNum: string;

  @Column({ name: 'is_read', default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_on' })
  createdOn: Date;
}
