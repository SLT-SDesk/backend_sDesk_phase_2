import { Entity, Column, PrimaryGeneratedColumn,OneToOne,JoinColumn } from 'typeorm';
import { SLTUser } from '../../sltusers/entities/sltuser.entity'; 

@Entity('technicians') 

export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;;


 @OneToOne(()=> SLTUser)
 @JoinColumn()//// this creates the userId foreign key in Technician table
 user: SLTUser;


 @Column({nullable: false})
serviceNum: string;


  @Column({ nullable: false})
  name: string;

  @Column()
  team: string;

  @Column({ type: 'enum', enum: ['technician', 'teamLeader'], default: 'technician' })
  position: 'technician' | 'teamLeader';

  @Column()
  cat1: string;

  @Column()
  cat2: string;

  @Column()
  cat3: string;

  @Column()
  cat4: string;

  @Column()
  active: boolean;
 

  @Column()
  tier: string;

  @Column()
  teamId: string;

  

  @Column({unique: true }) 
  email: string;

  @Column({})
  contactNumber: string;
}