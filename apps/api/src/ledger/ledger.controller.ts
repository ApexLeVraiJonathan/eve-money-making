import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';

const CreateCycleSchema = z.object({
  name: z.string().min(1).optional(),
  startedAt: z.coerce.date(),
});
type CreateCycleRequest = z.infer<typeof CreateCycleSchema>;

const AppendEntrySchema = z.object({
  cycleId: z.string().uuid(),
  entryType: z.enum(['deposit', 'withdrawal', 'fee', 'execution']),
  amountIsk: z.string().regex(/^\d+\.\d{2}$/),
  occurredAt: z.coerce.date().optional(),
  memo: z.string().optional(),
  planCommitId: z.string().uuid().optional(),
});
type AppendEntryRequest = z.infer<typeof AppendEntrySchema>;

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Post('cycles')
  @UsePipes(new ZodValidationPipe(CreateCycleSchema))
  async createCycle(@Body() body: CreateCycleRequest) {
    return await this.ledger.createCycle(body);
  }

  @Get('cycles')
  async listCycles() {
    return await this.ledger.listCycles();
  }

  @Post('cycles/:id/close')
  async closeCycle(@Param('id') id: string) {
    return await this.ledger.closeCycle(id, new Date());
  }

  @Post('entries')
  @UsePipes(new ZodValidationPipe(AppendEntrySchema))
  async append(@Body() body: AppendEntryRequest) {
    return await this.ledger.appendEntry(body);
  }

  @Get('entries')
  async list(@Query('cycleId') cycleId: string) {
    return await this.ledger.listEntriesEnriched(cycleId);
  }

  @Get('nav/:cycleId')
  async nav(@Param('cycleId') cycleId: string) {
    return await this.ledger.computeNav(cycleId);
  }
}
