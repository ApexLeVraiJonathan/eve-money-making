import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PricingService } from './services/pricing.service';
import { ScriptApiKeyGuard } from '@api/characters/guards/script-api-key.guard';
import { Public } from '@api/characters/decorators/public.decorator';
import { ScriptUndercutCheckRequest } from './dto/script-undercut-check.dto';
import { ScriptConfirmRequest } from './dto/script-confirm.dto';
import { ScriptConfirmBatchRequest } from './dto/script-confirm-batch.dto';
import { ScriptRunReportRequest } from './dto/script-run-report.dto';
import type { Request } from 'express';
import type { RequestUser } from '@api/characters/guards/jwt.strategy';

@ApiTags('pricing-script')
@ApiSecurity('scriptApiKey')
@ApiHeader({
  name: 'x-script-api-key',
  required: true,
  description: 'Script API key for script automation endpoints.',
})
@Public()
@Controller('pricing/script')
@UseGuards(ScriptApiKeyGuard)
export class PricingScriptController {
  constructor(private readonly pricing: PricingService) {}

  private authUserIdFromReq(req: Request): string | undefined {
    const auth = req.user as RequestUser | undefined;
    const userId = auth?.userId ?? undefined;
    return userId && userId.trim().length > 0 ? userId : undefined;
  }

  @Post('undercut-check')
  @ApiOperation({
    summary:
      'Script-only undercut check with deterministic UI target metadata.',
  })
  async scriptUndercutCheck(@Body() body: ScriptUndercutCheckRequest) {
    return this.pricing.undercutCheckScript(body);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Script-only unified confirm endpoint' })
  async scriptConfirm(@Body() body: ScriptConfirmRequest) {
    if (body.mode === 'listing') {
      if (!body.listing) {
        throw new BadRequestException(
          'listing payload is required when mode=listing',
        );
      }
      return this.pricing.confirmListing(body.listing);
    }
    if (!body.reprice) {
      throw new BadRequestException(
        'reprice payload is required when mode=reprice',
      );
    }
    return this.pricing.confirmReprice(body.reprice);
  }

  @Post('confirm-batch')
  @ApiOperation({
    summary:
      'Script-only batched confirm endpoint (idempotent with idempotencyKey).',
  })
  async scriptConfirmBatch(
    @Body() body: ScriptConfirmBatchRequest,
    @Req() req: Request,
  ) {
    return this.pricing.confirmBatchScript({
      ...body,
      notifyUserId: this.authUserIdFromReq(req),
    });
  }

  @Post('run-report')
  @ApiOperation({ summary: 'Send script run summary/failure DM alert' })
  async scriptRunReport(@Body() body: ScriptRunReportRequest, @Req() req: Request) {
    return this.pricing.sendScriptRunReport({
      ...body,
      userId: body.userId ?? this.authUserIdFromReq(req),
    });
  }
}
