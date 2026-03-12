import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: 'refresh_token',
})
export class EntityRefreshToken {
  // Define your entity properties here
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({ type: 'text' })
  token: string;
  @Column({ type: 'uuid' })
  userId: string;
  @CreateDateColumn({ type: 'timestamp with time zone' })
  issuedDate: Date;
}
