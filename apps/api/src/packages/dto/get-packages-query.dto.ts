import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';

enum PackageStatus {
  ACTIVE = 'active',
  FAILED = 'failed',
  COMPLETED = 'completed',
}

export class GetPackagesQuery {
  @ApiProperty({
    description: 'Cycle ID to filter packages',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @IsString()
  @IsUUID()
  cycleId: string;

  @ApiPropertyOptional({
    description: 'Package status to filter by',
    enum: PackageStatus,
    example: 'active',
  })
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;
}
