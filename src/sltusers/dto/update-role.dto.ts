import { IsEnum, IsNotEmpty } from 'class-validator';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
  TEAM_LEADER = 'teamLeader',
  SUPER_ADMIN = 'superAdmin',
}

export class UpdateRoleDto {
  @IsNotEmpty()
  @IsEnum(UserRole, {
    message: 'Role must be one of: user, admin, technician, teamLeader, superAdmin',
  })
  role!: UserRole;
}
