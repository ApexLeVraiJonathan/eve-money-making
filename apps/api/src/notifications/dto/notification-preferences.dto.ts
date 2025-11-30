import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const NOTIFICATION_CHANNELS = ['DISCORD_DM'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  'CYCLE_PLANNED',
  'CYCLE_STARTED',
  'CYCLE_RESULTS',
  'CYCLE_PAYOUT_SENT',
  'SKILL_PLAN_REMAP_REMINDER',
  'SKILL_PLAN_COMPLETION',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class NotificationPreferenceItemDto {
  @ApiProperty({ enum: NOTIFICATION_CHANNELS })
  @IsString()
  @IsIn(NOTIFICATION_CHANNELS)
  channel!: NotificationChannel;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsString()
  @IsIn(NOTIFICATION_TYPES)
  notificationType!: NotificationType;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [NotificationPreferenceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationPreferenceItemDto)
  preferences!: NotificationPreferenceItemDto[];
}
