import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { WalletService } from '../wallet/wallet.service';
import { AllocationService } from '../reconciliation/allocation.service';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';
import { CreateCycleRequest } from './dto/create-cycle.dto';
import { PlanCycleRequest } from './dto/plan-cycle.dto';
import { OpenCycleRequest } from './dto/open-cycle.dto';
import { AppendEntryRequest } from './dto/append-entry.dto';
import { GetEntriesQuery } from './dto/get-entries-query.dto';
import { CreateParticipationManualRequest } from './dto/create-participation-manual.dto';
import { RefundParticipationRequest } from './dto/refund-participation.dto';
import { ValidatePaymentRequest } from './dto/validate-payment.dto';
import { GetCommitSummaryQuery } from './dto/get-commit-summary-query.dto';
import { SuggestPayoutsRequest } from './dto/suggest-payouts.dto';
import { CreateCycleLineManualRequest } from './dto/create-cycle-line-manual.dto';
import { UpdateCycleLineRequest } from './dto/update-cycle-line.dto';
import { AddFeeRequest } from './dto/add-fee.dto';
import { AddTransportFeeRequest } from './dto/add-transport-fee.dto';

@ApiTags('ledger')
@Controller('ledger')
export class LedgerController {
  private readonly logger = new Logger(LedgerController.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly wallet: WalletService,
    private readonly allocation: AllocationService,
  ) {}

  @Post('cycles')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new arbitrage cycle' })
  async createCycle(@Body() body: CreateCycleRequest) {
    return await this.ledger.createCycle(body);
  }

  @Post('cycles/plan')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Plan a future arbitrage cycle' })
  async planCycle(@Body() body: PlanCycleRequest): Promise<unknown> {
    return await this.ledger.planCycle(body);
  }

  @Public()
  @Get('cycles')
  @ApiOperation({ summary: 'List all arbitrage cycles' })
  async listCycles() {
    return await this.ledger.listCycles();
  }

  @Public()
  @Get('cycles/overview')
  @ApiOperation({ summary: 'Get cycles overview' })
  async cyclesOverview(): Promise<unknown> {
    return (await this.ledger.getCycleOverview()) as unknown;
  }

  @Post('cycles/:id/close')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close a cycle' })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  async closeCycle(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.closeCycleWithFinalSettlement(
      id,
      this.wallet,
      this.allocation,
    );
  }

  @Post('cycles/:id/open')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a planned cycle' })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  async openCycle(
    @Param('id') id: string,
    @Body() body: OpenCycleRequest,
  ): Promise<unknown> {
    return await this.ledger.openPlannedCycle({
      cycleId: id,
      startedAt: body.startedAt,
    });
  }

  @Post('entries')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Append a ledger entry' })
  async append(@Body() body: AppendEntryRequest): Promise<unknown> {
    return await this.ledger.appendEntry(body);
  }

  @Public()
  @Get('entries')
  @ApiOperation({ summary: 'List ledger entries' })
  @ApiQuery({ name: 'cycleId', type: String, description: 'Cycle ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(@Query() query: GetEntriesQuery): Promise<unknown> {
    return await this.ledger.listEntriesEnriched(
      query.cycleId,
      query.limit,
      query.offset,
    );
  }

  @Public()
  @Get('nav/:cycleId')
  @ApiOperation({ summary: 'Compute Net Asset Value for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async nav(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.computeNav(cycleId);
  }

  @Public()
  @Get('capital/:cycleId')
  @ApiOperation({ summary: 'Compute capital for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  @ApiQuery({ name: 'force', required: false, type: String })
  async capital(
    @Param('cycleId') cycleId: string,
    @Query('force') force?: string,
  ): Promise<unknown> {
    const shouldForce = force === 'true' || force === '1' || force === 'yes';
    return await this.ledger.computeCapital(cycleId, { force: shouldForce });
  }

  // Participations
  @Post('cycles/:cycleId/participations')
  @ApiOperation({ summary: 'Create a participation in a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async createParticipation(
    @Param('cycleId') cycleId: string,
    @Body() body: CreateParticipationManualRequest,
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    // Prefer session identity when characterName not provided
    const characterName = body.characterName ?? user?.name ?? undefined;
    return await this.ledger.createParticipation({
      cycleId,
      characterName,
      amountIsk: body.amountIsk,
      userId: user?.userId ?? undefined, // Link to user if authenticated
    });
  }

  @Get('cycles/:cycleId/participations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List participations for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  @ApiQuery({ name: 'status', required: false, type: String })
  async listParticipations(
    @Param('cycleId') cycleId: string,
    @Query('status') status?: string,
  ): Promise<unknown> {
    return await this.ledger.listParticipations(cycleId, status);
  }

  @Get('cycles/:cycleId/participations/me')
  @ApiOperation({ summary: 'Get my participation for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async myParticipation(
    @Param('cycleId') cycleId: string,
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    const uid = user?.userId ?? null;
    this.logger.log(
      `[GET /participations/me] cycleId=${cycleId}, userId=${uid}, user=${JSON.stringify(user)}`,
    );
    if (!uid) {
      this.logger.warn('[GET /participations/me] No userId, returning null');
      return null;
    }
    const result = await this.ledger.getMyParticipation(cycleId, uid);
    this.logger.log(
      `[GET /participations/me] Found participation: ${result ? `id=${result.id}, status=${result.status}` : 'null'}`,
    );
    return result as unknown;
  }

  @Get('participations/all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all participations' })
  async allParticipations(): Promise<unknown> {
    return await this.ledger.getAllParticipations();
  }

  @Get('participations/unmatched-donations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unmatched donations' })
  async unmatchedDonations(): Promise<unknown> {
    return await this.ledger.getUnmatchedDonations();
  }

  @Post('participations/:id/mark-payout-sent')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark payout as sent' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async markPayoutSent(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.markPayoutAsSent(id);
  }

  @Post('participations/:id/opt-out')
  @ApiOperation({ summary: 'Opt out of a participation' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async optOut(@Param('id') id: string): Promise<unknown> {
    return await this.ledger.optOutParticipation(id);
  }

  @Post('participations/match')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Match participation payments from wallet' })
  @ApiQuery({ name: 'cycleId', required: false, type: String })
  async matchPayments(@Query('cycleId') cycleId?: string): Promise<unknown> {
    return await this.ledger.matchParticipationPayments(cycleId);
  }

  @Post('participations/:id/validate')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate a participation payment' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async validatePayment(
    @Param('id') id: string,
    @Body() body: ValidatePaymentRequest,
  ): Promise<unknown> {
    return await this.ledger.adminValidatePayment({
      participationId: id,
      walletJournal: body.walletJournal ?? null,
    });
  }

  @Post('participations/:id/refund')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark participation as refunded' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async refund(
    @Param('id') id: string,
    @Body() body: RefundParticipationRequest,
  ): Promise<unknown> {
    return await this.ledger.adminMarkRefund({
      participationId: id,
      amountIsk: body.amountIsk,
    });
  }

  // Payouts
  @Get('cycles/:cycleId/payouts/suggest')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suggest payouts for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  @ApiQuery({ name: 'profitSharePct', required: false, type: Number })
  async suggestPayouts(
    @Param('cycleId') cycleId: string,
    @Query('profitSharePct') pct?: string,
  ): Promise<unknown> {
    const p = pct ? Math.max(0, Math.min(1, Number(pct))) : 0.5;
    return await this.ledger.computePayouts(cycleId, p);
  }

  @Get('commits/summary')
  @ApiOperation({ summary: 'Get commit summaries for a cycle' })
  @ApiQuery({ name: 'cycleId', type: String, description: 'Cycle ID' })
  async commitSummaries(
    @Query() query: GetCommitSummaryQuery,
  ): Promise<unknown> {
    return (await this.ledger.getCommitSummaries(query.cycleId)) as unknown;
  }

  @Post('cycles/:cycleId/payouts/finalize')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize payouts for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async finalizePayouts(
    @Param('cycleId') cycleId: string,
    @Body() body: SuggestPayoutsRequest,
  ): Promise<unknown> {
    return await this.ledger.finalizePayouts(
      cycleId,
      body.profitSharePct ?? 0.5,
    );
  }

  // ===== Cycle Lines (Buy Commits) =====

  @Post('cycles/:cycleId/lines')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a cycle line (buy commit)' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async createCycleLine(
    @Param('cycleId') cycleId: string,
    @Body() body: CreateCycleLineManualRequest,
  ): Promise<unknown> {
    return await this.ledger.createCycleLine({
      cycleId,
      ...body,
    });
  }

  @Get('cycles/:cycleId/lines')
  @ApiOperation({ summary: 'List cycle lines' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async listCycleLines(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.listCycleLines(cycleId);
  }

  @Patch('lines/:lineId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a cycle line' })
  @ApiParam({ name: 'lineId', description: 'Line ID' })
  async updateCycleLine(
    @Param('lineId') lineId: string,
    @Body() body: UpdateCycleLineRequest,
  ): Promise<unknown> {
    return await this.ledger.updateCycleLine(lineId, body);
  }

  @Delete('lines/:lineId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a cycle line' })
  @ApiParam({ name: 'lineId', description: 'Line ID' })
  async deleteCycleLine(@Param('lineId') lineId: string): Promise<unknown> {
    return await this.ledger.deleteCycleLine(lineId);
  }

  // ===== Fees =====

  @Post('lines/:lineId/broker-fee')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a broker fee to a line' })
  @ApiParam({ name: 'lineId', description: 'Line ID' })
  async addBrokerFee(
    @Param('lineId') lineId: string,
    @Body() body: AddFeeRequest,
  ): Promise<unknown> {
    return await this.ledger.addBrokerFee({ lineId, ...body });
  }

  @Post('lines/:lineId/relist-fee')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a relist fee to a line' })
  @ApiParam({ name: 'lineId', description: 'Line ID' })
  async addRelistFee(
    @Param('lineId') lineId: string,
    @Body() body: AddFeeRequest,
  ): Promise<unknown> {
    return await this.ledger.addRelistFee({ lineId, ...body });
  }

  @Post('cycles/:cycleId/transport-fee')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a transport fee to a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async addTransportFee(
    @Param('cycleId') cycleId: string,
    @Body() body: AddTransportFeeRequest,
  ): Promise<unknown> {
    return await this.ledger.addTransportFee({ cycleId, ...body });
  }

  @Get('cycles/:cycleId/transport-fees')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List transport fees for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async listTransportFees(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.listTransportFees(cycleId);
  }

  // ===== Cycle Profit & Snapshots =====

  @Get('cycles/:cycleId/profit')
  @ApiOperation({ summary: 'Get cycle profit' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getCycleProfit(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.computeCycleProfit(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/profit/estimated')
  @ApiOperation({ summary: 'Get estimated profit for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getEstimatedProfit(
    @Param('cycleId') cycleId: string,
  ): Promise<unknown> {
    return await this.ledger.computeEstimatedProfit(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/profit/portfolio')
  @ApiOperation({ summary: 'Get portfolio value for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getPortfolioValue(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.computePortfolioValue(cycleId);
  }

  @Post('cycles/:cycleId/snapshot')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a cycle snapshot' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async createSnapshot(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.createCycleSnapshot(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/snapshots')
  @ApiOperation({ summary: 'Get cycle snapshots' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getSnapshots(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.ledger.getCycleSnapshots(cycleId);
  }
}
