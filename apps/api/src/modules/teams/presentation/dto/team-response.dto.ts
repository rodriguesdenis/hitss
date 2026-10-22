/** A team in responses (api-contracts → Teams). `version` is also sent as the ETag. */
export class TeamResponseDto {
  id!: string;
  name!: string;
  /** `#RRGGBB`, upper case. */
  colorHex!: string;
  description!: string | null;
  /** Active tasks assigned to the team. */
  taskCount!: number;
  version!: number;
  createdAt!: string;
  updatedAt!: string;
}
