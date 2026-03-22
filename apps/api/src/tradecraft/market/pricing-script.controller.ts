import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingService } from './services/pricing.service';
import { ScriptApiKeyGuard } from '@api/characters/guards/script-api-key.guard';
import { ScriptUndercutCheckRequest } from './dto/script-undercut-check.dto';
import { ScriptConfirmRequest } from './dto/script-confirm.dto';
import { ScriptConfirmBatchRequest } from './dto/script-confirm-batch.dto';
import { ScriptRunReportRequest } from './dto/script-run-report.dto';

@ApiTags('pricing-script')
@Controller('pricing/script')
@UseGuards(ScriptApiKeyGuard)
export class PricingScriptController {
  constructor(private readonly pricing: PricingService) {}

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
  async scriptConfirmBatch(@Body() body: ScriptConfirmBatchRequest) {
    return this.pricing.confirmBatchScript(body);
  }

  @Post('run-report')
  @ApiOperation({ summary: 'Send script run summary/failure DM alert' })
  async scriptRunReport(@Body() body: ScriptRunReportRequest) {
    return this.pricing.sendScriptRunReport(body);
  }
}
