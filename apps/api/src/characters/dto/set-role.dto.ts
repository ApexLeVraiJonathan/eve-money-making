import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class SetRoleRequest {
  @ApiProperty({
    description: 'User role',
    enum: ['ADMIN', 'USER'],
    example: 'USER',
  })
  @IsEnum(['ADMIN', 'USER'])
  role!: 'ADMIN' | 'USER';
}
