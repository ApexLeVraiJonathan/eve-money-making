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
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(200).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async listCommits(@Query() query: { limit?: number; offset?: number }) {
    return await this.svc.listCommits(query.limit ?? 25, query.offset ?? 0);
  }

  @Get('commits/:id')
  async getCommit(@Param('id') id: string) {
    return await this.svc.getCommit(id);
  }

  @Get('commits/:id/entries')
  @UsePipes(
    new ZodValidationPipe(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(1000).optional(),
          offset: z.coerce.number().int().min(0).optional(),
        })
        .strict(),
    ),
  )
  async listLinked(
    @Param('id') id: string,
    @Query() query: { limit?: number; offset?: number },
  ) {
    return await this.svc.listLinkedEntries(id, query.limit, query.offset);
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
