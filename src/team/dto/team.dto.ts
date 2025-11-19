// src/team/dto/team.dto.ts
export class CreateTeamDto {
  name: string;
  description?: string;
  isActive?: boolean;
}

export class UpdateTeamDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export class TeamResponseDto {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
