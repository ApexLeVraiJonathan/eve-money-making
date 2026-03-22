import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn } from 'class-validator';
import { ConfirmListingRequest } from './confirm-listing.dto';
import { ConfirmRepriceRequest } from './confirm-reprice.dto';

export class ScriptConfirmRequest {
  @ApiProperty({
    description: 'Confirmation mode for this update.',
    enum: ['reprice', 'listing'],
    example: 'reprice',
  })
  @IsIn(['reprice', 'listing'])
  mode: 'reprice' | 'listing';

  @ApiProperty({
    description: 'Payload for listing mode.',
    required: false,
    type: ConfirmListingRequest,
  })
  @Type(() => ConfirmListingRequest)
  listing?: ConfirmListingRequest;

  @ApiProperty({
    description: 'Payload for reprice mode.',
    required: false,
    type: ConfirmRepriceRequest,
  })
  @Type(() => ConfirmRepriceRequest)
  reprice?: ConfirmRepriceRequest;
}
