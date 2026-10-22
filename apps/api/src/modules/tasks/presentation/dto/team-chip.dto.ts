import { ApiProperty } from '@nestjs/swagger';

/** A team embedded in a task, enough to render its color chip (api-contracts → Task resource). */
export class TeamChipDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mobile' }) name!: string;
  @ApiProperty({ example: '#7C3AED', description: '`#RRGGBB`, upper case.' })
  colorHex!: string;
}
