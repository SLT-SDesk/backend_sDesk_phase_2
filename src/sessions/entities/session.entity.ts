import { Technician } from '../../technician/entities/technician.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'sessions' })
export class Session {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({nullable: false})
    technician_service_number: string;

    @Column({type: 'timestamp', nullable: false})
    login_time: Date;
    
    @Column({type: 'timestamp', nullable: true})
    logout_time: Date | null;

    @ManyToOne(() => Technician, (technician) => technician.sessions)
    @JoinColumn({ name: 'technician_service_number', referencedColumnName: 'serviceNum' })
    technician: Technician;
}
