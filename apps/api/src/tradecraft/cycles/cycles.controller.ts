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
import { CycleService } from './services/cycle.service';
import { CycleLineService } from './services/cycle-line.service';
import { FeeService } from './services/fee.service';
import { SnapshotService } from './services/snapshot.service';
import { ParticipationService } from './services/participation.service';
import { PayoutService } from './services/payout.service';
import { PaymentMatchingService } from './services/payment-matching.service';
import { CapitalService } from './services/capital.service';
import { ProfitService } from './services/profit.service';
import { WalletService } from '@api/tradecraft/wallet/services/wallet.service';
import { AllocationService } from '@api/tradecraft/wallet/services/allocation.service';
import { AppConfig } from '@api/common/config';
import {
  CurrentUser,
  type RequestUser,
} from '@api/characters/decorators/current-user.decorator';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { Public } from '@api/characters/decorators/public.decorator';
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
import { AddCollateralRecoveryFeeRequest } from './dto/add-collateral-recovery-fee.dto';
import {
  AddBulkBrokerFeesRequest,
  AddBulkRelistFeesRequest,
} from './dto/add-bulk-fees.dto';
import { UpdateBulkSellPricesRequest } from './dto/update-bulk-sell-prices.dto';
import { CreateJingleYieldParticipationRequest } from './dto/create-jingle-yield-participation.dto';
import { IncreaseParticipationRequest } from './dto/increase-participation.dto';
import { JingleYieldService } from './services/jingle-yield.service';
import { AutoRolloverSettingsService } from './services/auto-rollover-settings.service';
import {
  AutoRolloverSettingsResponseDto,
  UpdateAutoRolloverSettingsRequestDto,
} from './dto/auto-rollover-settings.dto';
import { BackfillJingleYieldRolloversRequestDto } from './dto/backfill-jingle-yield-rollovers.dto';

@ApiTags('ledger')
@Controller('ledger')
export class CyclesController {
  private readonly logger = new Logger(CyclesController.name);

  constructor(
    private readonly cycleService: CycleService,
    private readonly cycleLineService: CycleLineService,
    private readonly feeService: FeeService,
    private readonly snapshotService: SnapshotService,
    private readonly participationService: ParticipationService,
    private readonly payoutService: PayoutService,
    private readonly paymentMatchingService: PaymentMatchingService,
    private readonly capitalService: CapitalService,
    private readonly profitService: ProfitService,
    private readonly wallet: WalletService,
    private readonly allocation: AllocationService,
    private readonly jingleYieldService: JingleYieldService,
    private readonly autoRolloverSettings: AutoRolloverSettingsService,
  ) {}

  @Post('cycles')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new arbitrage cycle' })
  async createCycle(@Body() body: CreateCycleRequest) {
    return await this.cycleService.createCycle({
      ...body,
      startedAt: new Date(body.startedAt),
    });
  }

  @Post('cycles/plan')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Plan a future arbitrage cycle' })
  async planCycle(@Body() body: PlanCycleRequest): Promise<unknown> {
    return await this.cycleService.planCycle({
      ...body,
      startedAt: new Date(body.startedAt),
    });
  }

  @Public()
  @Get('cycles')
  @ApiOperation({ summary: 'List all arbitrage cycles' })
  async listCycles() {
    return await this.cycleService.listCycles();
  }

  @Public()
  @Get('cycles/history')
  @ApiOperation({ summary: 'Get public cycle history with profit metrics' })
  async getCycleHistory(): Promise<unknown> {
    return await this.cycleService.getCycleHistory();
  }

  @Public()
  @Get('cycles/overview')
  @ApiOperation({ summary: 'Get cycles overview' })
  async cyclesOverview(): Promise<unknown> {
    return (await this.cycleService.getCycleOverview()) as unknown;
  }

  @Post('cycles/:id/close')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Close a cycle' })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  async closeCycle(@Param('id') id: string): Promise<unknown> {
    return await this.cycleService.closeCycleWithFinalSettlement(
      id,
      this.wallet,
      this.allocation,
    );
  }

  @Post('cycles/:id/allocate')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Manually allocate wallet transactions to cycle lines',
  })
  @ApiParam({ name: 'id', description: 'Cycle ID' })
  async allocateTransactions(@Param('id') id: string): Promise<unknown> {
    return await this.allocation.allocateAll(id);
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
    return await this.cycleService.openPlannedCycle(
      {
        cycleId: id,
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
      },
      this.allocation, // Pass allocation service for automatic cycle closure
    );
  }

  @Post('cycles/:cycleId/rollovers/backfill-jingle-yield')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Admin: backfill missing JingleYield rollover participations into a target cycle and process them safely',
  })
  @ApiParam({ name: 'cycleId', description: 'Target cycle ID (OPEN or PLANNED)' })
  async backfillJingleYieldRollovers(
    @Param('cycleId') cycleId: string,
    @Body() body: BackfillJingleYieldRolloversRequestDto,
  ): Promise<unknown> {
    return await this.payoutService.backfillJingleYieldRolloversForTargetCycle({
      targetCycleId: cycleId,
      sourceClosedCycleId: body?.sourceClosedCycleId,
    });
  }

  @Post('entries')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Append a ledger entry' })
  async append(@Body() body: AppendEntryRequest): Promise<unknown> {
    return await this.cycleService.appendEntry(body);
  }

  @Public()
  @Get('entries')
  @ApiOperation({ summary: 'List ledger entries' })
  @ApiQuery({ name: 'cycleId', type: String, description: 'Cycle ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(@Query() query: GetEntriesQuery): Promise<unknown> {
    return await this.cycleService.listEntriesEnriched(
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
    return await this.capitalService.computeNav(cycleId);
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
    return await this.capitalService.computeCapital(cycleId, {
      force: shouldForce,
    });
  }

  // Participations
  @Get('participations/max-amount')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get maximum allowed participation amount for current user',
  })
  async getMaxParticipation(
    @CurrentUser() user: RequestUser | null,
    @Query('testUserId') testUserId?: string,
  ): Promise<{
    principalCapIsk: string;
    principalCapB: number;
    effectivePrincipalCapIsk: string;
    effectivePrincipalCapB: number;
    maximumCapIsk: string;
    maximumCapB: number;
  }> {
    // In dev/test mode, allow checking max amount for a specific testUserId
    let userIdToCheck: string | undefined;
    if (testUserId && process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `[getMaxParticipation] Using testUserId: ${testUserId} (dev mode)`,
      );
      userIdToCheck = testUserId;
    } else {
      userIdToCheck = user?.userId ?? undefined;
    }

    const caps =
      await this.participationService.getTradecraftCapsForUser(userIdToCheck);
    return {
      principalCapIsk: caps.principalCapIsk.toFixed(2),
      principalCapB: caps.principalCapIsk / 1_000_000_000,
      effectivePrincipalCapIsk: caps.effectivePrincipalCapIsk.toFixed(2),
      effectivePrincipalCapB: caps.effectivePrincipalCapIsk / 1_000_000_000,
      maximumCapIsk: caps.maximumCapIsk.toFixed(2),
      maximumCapB: caps.maximumCapIsk / 1_000_000_000,
    };
  }

  // ===== Automatic rollover settings (per-user) =====

  @Get('participations/auto-rollover-settings')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my automatic rollover settings (tradecraft)',
  })
  async getMyAutoRolloverSettings(
    @CurrentUser() user: RequestUser | null,
  ): Promise<AutoRolloverSettingsResponseDto> {
    // Keep the endpoint resilient for logged-out users (same pattern as /me),
    // but default to disabled.
    if (!user?.userId) {
      return { enabled: false, defaultRolloverType: 'INITIAL_ONLY' };
    }
    return await this.autoRolloverSettings.getForUser(user.userId);
  }

  @Patch('participations/auto-rollover-settings')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update my automatic rollover settings (tradecraft)',
  })
  async updateMyAutoRolloverSettings(
    @CurrentUser() user: RequestUser | null,
    @Body() body: UpdateAutoRolloverSettingsRequestDto,
  ): Promise<AutoRolloverSettingsResponseDto> {
    if (!user?.userId) {
      throw new Error('User not authenticated');
    }
    return await this.autoRolloverSettings.upsertForUser(user.userId, {
      enabled: body.enabled,
      defaultRolloverType: body.defaultRolloverType,
    });
  }

  @Post('cycles/:cycleId/participations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a participation in a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async createParticipation(
    @Param('cycleId') cycleId: string,
    @Body() body: CreateParticipationManualRequest,
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    // Prefer session identity when characterName not provided
    const characterName = body.characterName ?? user?.name ?? undefined;

    // In dev/test environments, allow testUserId to override the authenticated userId
    // This enables creating multiple test participations from a single dev API key
    let userId = user?.userId ?? undefined;
    const env = AppConfig.env();

    this.logger.debug(
      `Creating participation: testUserId=${body.testUserId}, env=${env}, isProd=${env === 'prod'}, userUserId=${user?.userId}`,
    );

    if (body.testUserId && env !== 'prod') {
      this.logger.debug(`Using testUserId: ${body.testUserId}`);
      userId = body.testUserId;
    } else {
      this.logger.debug(`Using authenticated userId: ${userId}`);
    }

    return await this.participationService.createParticipation({
      cycleId,
      characterName,
      amountIsk: body.amountIsk,
      userId,
      rollover: body.rollover,
    });
  }

  @Post('participations/:id/increase')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Increase principal for an existing participation in a planned cycle',
  })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async increaseParticipation(
    @Param('id') id: string,
    @Body() body: IncreaseParticipationRequest,
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    if (!user?.userId) {
      throw new Error('User not authenticated');
    }

    return await this.participationService.increaseParticipation({
      participationId: id,
      userId: user.userId,
      deltaAmountIsk: body.deltaAmountIsk,
    });
  }

  @Post('jingle-yield/participations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a JingleYield participation for a user (admin only)',
  })
  async createJingleYieldParticipation(
    @Body() body: CreateJingleYieldParticipationRequest,
  ): Promise<unknown> {
    return await this.participationService.createJingleYieldParticipation({
      userId: body.userId,
      cycleId: body.cycleId,
      adminCharacterId: body.adminCharacterId,
      characterName: body.characterName,
      principalIsk: body.principalIsk,
      minCycles: body.minCycles,
    });
  }

  // ===== JingleYield admin & user views =====

  @Get('jingle-yield/programs')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all JingleYield programs (admin only)' })
  async listJingleYieldPrograms(): Promise<unknown> {
    return await this.jingleYieldService.listPrograms();
  }

  @Get('jingle-yield/programs/:id')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single JingleYield program (admin only)' })
  @ApiParam({ name: 'id', description: 'JingleYield program ID' })
  async getJingleYieldProgram(@Param('id') id: string): Promise<unknown> {
    return await this.jingleYieldService.getProgramById(id);
  }

  @Get('jingle-yield/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my JingleYield status (if any)' })
  async myJingleYieldStatus(
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    if (!user?.userId) return null;
    return await this.jingleYieldService.getMyStatus(user.userId);
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
    return await this.participationService.listParticipations(cycleId, status);
  }

  @Get('cycles/:cycleId/participations/me')
  @ApiBearerAuth()
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
    const result = await this.participationService.getMyParticipation(
      cycleId,
      uid,
    );
    this.logger.log(
      `[GET /participations/me] Found participation: ${result ? `id=${result.id}, status=${result.status}` : 'null'}`,
    );
    return result as unknown;
  }

  @Get('participations/all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all participations (admin only)' })
  async allParticipations(): Promise<unknown> {
    return await this.participationService.getAllParticipations();
  }

  @Get('participations/my-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my participation history across all cycles' })
  async myParticipationHistory(
    @CurrentUser() user: RequestUser | null,
  ): Promise<unknown> {
    if (!user?.userId) {
      throw new Error('User not authenticated');
    }
    return await this.participationService.getUserParticipationHistory(
      user.userId,
    );
  }

  @Get('participations/unmatched-donations')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unmatched donations' })
  async unmatchedDonations(): Promise<unknown> {
    return await this.paymentMatchingService.getUnmatchedDonations();
  }

  @Post('participations/:id/mark-payout-sent')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark payout as sent' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async markPayoutSent(@Param('id') id: string): Promise<unknown> {
    return await this.participationService.markPayoutAsSent(id);
  }

  @Post('participations/:id/opt-out')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Opt out of a participation' })
  @ApiParam({ name: 'id', description: 'Participation ID' })
  async optOut(@Param('id') id: string): Promise<unknown> {
    return await this.participationService.optOutParticipation(id);
  }

  @Post('participations/match')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Match participation payments from wallet' })
  @ApiQuery({ name: 'cycleId', required: false, type: String })
  async matchPayments(@Query('cycleId') cycleId?: string): Promise<unknown> {
    return await this.paymentMatchingService.matchParticipationPayments(
      cycleId,
      (entry) => this.cycleService.appendEntry(entry),
    );
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
    return await this.participationService.adminValidatePayment(
      id,
      body.walletJournal ?? null,
      (entry) => this.cycleService.appendEntry(entry),
    );
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
    return await this.participationService.adminMarkRefund({
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
    return await this.payoutService.computePayouts(cycleId, p);
  }

  @Get('commits/summary')
  @ApiOperation({ summary: 'Get commit summaries for a cycle' })
  @ApiQuery({ name: 'cycleId', type: String, description: 'Cycle ID' })
  async commitSummaries(
    @Query() query: GetCommitSummaryQuery,
  ): Promise<unknown> {
    return (await this.cycleLineService.listCycleLines(
      query.cycleId,
    )) as unknown;
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
    return await this.payoutService.finalizePayouts(
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
    return await this.cycleLineService.createCycleLine({
      cycleId,
      ...body,
    });
  }

  @Get('cycles/:cycleId/lines')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List cycle lines' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async listCycleLines(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.cycleLineService.listCycleLines(cycleId);
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
    return await this.cycleLineService.updateCycleLine(lineId, body);
  }

  @Patch('lines/sell-prices/bulk')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update current sell prices for multiple lines in bulk',
  })
  async updateBulkSellPrices(
    @Body() body: UpdateBulkSellPricesRequest,
  ): Promise<unknown> {
    return await this.cycleLineService.updateBulkSellPrices(body);
  }

  @Delete('lines/:lineId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a cycle line' })
  @ApiParam({ name: 'lineId', description: 'Line ID' })
  async deleteCycleLine(@Param('lineId') lineId: string): Promise<unknown> {
    return await this.cycleLineService.deleteCycleLine(lineId);
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
    return await this.feeService.addBrokerFee({ lineId, ...body });
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
    return await this.feeService.addRelistFee({ lineId, ...body });
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
    return await this.feeService.addTransportFee({ cycleId, ...body });
  }

  @Post('cycles/:cycleId/collateral-recovery-fee')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a collateral recovery fee (income) to a cycle',
  })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async addCollateralRecoveryFee(
    @Param('cycleId') cycleId: string,
    @Body() body: AddCollateralRecoveryFeeRequest,
  ): Promise<unknown> {
    return await this.feeService.addCollateralRecoveryFee({ cycleId, ...body });
  }

  @Get('cycles/:cycleId/transport-fees')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List transport fees for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async listTransportFees(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.feeService.listTransportFees(cycleId);
  }

  @Post('fees/broker/bulk')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add broker fees to multiple lines in bulk' })
  async addBulkBrokerFees(
    @Body() body: AddBulkBrokerFeesRequest,
  ): Promise<unknown> {
    return await this.feeService.addBulkBrokerFees(body);
  }

  @Post('fees/relist/bulk')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add relist fees to multiple lines in bulk' })
  async addBulkRelistFees(
    @Body() body: AddBulkRelistFeesRequest,
  ): Promise<unknown> {
    return await this.feeService.addBulkRelistFees(body);
  }

  // ===== Cycle Profit & Snapshots =====

  @Get('cycles/:cycleId/profit')
  @ApiOperation({ summary: 'Get cycle profit' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getCycleProfit(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.profitService.computeCycleProfit(cycleId);
  }

  @Get('cycles/:cycleId/profit/breakdown')
  @ApiOperation({ summary: 'Get detailed profit breakdown (P&L statement)' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getProfitBreakdown(
    @Param('cycleId') cycleId: string,
  ): Promise<unknown> {
    return await this.profitService.getProfitBreakdown(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/profit/estimated')
  @ApiOperation({ summary: 'Get estimated profit for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getEstimatedProfit(
    @Param('cycleId') cycleId: string,
  ): Promise<unknown> {
    return await this.profitService.computeEstimatedProfit(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/profit/portfolio')
  @ApiOperation({ summary: 'Get portfolio value for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getPortfolioValue(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.profitService.computePortfolioValue(cycleId);
  }

  @Post('cycles/:cycleId/snapshot')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a cycle snapshot' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async createSnapshot(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.snapshotService.createCycleSnapshot(cycleId);
  }

  @Public()
  @Get('cycles/:cycleId/snapshots')
  @ApiOperation({ summary: 'Get cycle snapshots' })
  @ApiParam({ name: 'cycleId', description: 'Cycle ID' })
  async getSnapshots(@Param('cycleId') cycleId: string): Promise<unknown> {
    return await this.snapshotService.getCycleSnapshots(cycleId);
  }
}
