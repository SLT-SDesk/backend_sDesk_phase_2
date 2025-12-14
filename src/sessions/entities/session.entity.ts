import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}
