import { Controller, Get } from '@nestjs/common';
import { Public } from '../characters/decorators/public.decorator';

/**
 * Temporary placeholder controller for the skill farm product.
 *
 * Routes here will serve the dedicated Skill Farm app, focused on SP/ISK
 * optimization and planning. They should delegate to shared domain services
 * rather than embedding EVE or math logic directly.
 */
@Controller('skill-farm')
export class SkillFarmController {
  @Public()
  @Get('preview')
  preview() {
    // Minimal stub endpoint to verify wiring; will be replaced by real routes.
    return { ok: true, scope: 'skill-farm' };
  }
}
