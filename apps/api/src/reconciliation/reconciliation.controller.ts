import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReconciliationService } from './reconciliation.service';

const LinkEntrySchema = z.object({
  entryId: z.string().uuid(),
  commitId: z.string().uuid(),
});
type LinkEntryRequest = z.infer<typeof LinkEntrySchema>;

@Controller('recon')
export class ReconciliationController {
  constructor(private readonly svc: ReconciliationService) {}

  @Get('commits')
  async listCommits(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const l = limit ? Number(limit) : 25;
    const o = offset ? Number(offset) : 0;
    return await this.svc.listCommits(l, o);
  }

  @Get('commits/:id')
  async getCommit(@Param('id') id: string) {
    return await this.svc.getCommit(id);
  }

  @Get('commits/:id/entries')
  async listLinked(@Param('id') id: string) {
    return await this.svc.listLinkedEntries(id);
  }

  @Post('link-entry')
  @UsePipes(new ZodValidationPipe(LinkEntrySchema))
  async link(@Body() body: LinkEntryRequest) {
    return await this.svc.linkEntryToCommit(body.entryId, body.commitId);
  }

  @Post('reconcile')
  async reconcile(@Query('cycleId') cycleId?: string) {
    return await this.svc.reconcileFromWalletStrict(cycleId ?? null);
  }

  @Get('commits/:id/status')
  async status(@Param('id') id: string) {
    return await this.svc.getCommitStatus(id);
  }
}
