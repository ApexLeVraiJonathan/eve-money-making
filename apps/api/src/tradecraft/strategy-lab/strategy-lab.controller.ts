import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { StrategyLabService } from './strategy-lab.service';
import { CreateTradeStrategyDto } from './dto/create-strategy.dto';
import { UpdateTradeStrategyDto } from './dto/update-strategy.dto';
import { CreateTradeStrategyRunDto } from './dto/create-run.dto';
import { CreateTradeStrategyWalkForwardDto } from './dto/create-walk-forward.dto';
import { CreateTradeStrategyWalkForwardAllDto } from './dto/create-walk-forward-all.dto';
import { CreateTradeStrategyLabSweepDto } from './dto/create-lab-sweep.dto';
import { CreateTradeStrategyCycleWalkForwardAllDto } from './dto/create-cycle-walk-forward-all.dto';
import { CreateTradeStrategyCycleRobustnessDto } from './dto/create-cycle-robustness.dto';
import { ClearTradeStrategyRunsDto } from './dto/clear-runs.dto';
import { DeactivateTradeStrategiesDto } from './dto/deactivate-strategies.dto';
import { MarketDataCoverageQueryDto } from './dto/market-data-coverage.dto';
import { ClearTradeStrategiesDto } from './dto/clear-strategies.dto';

@ApiTags('strategy-lab')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('strategy-lab')
export class StrategyLabController {
  constructor(private readonly service: StrategyLabService) {}

  // ============================================================================
  // Strategies
  // ============================================================================

  @Get('strategies')
  @ApiOperation({ summary: 'List strategies' })
  async listStrategies() {
    return await this.service.listStrategies();
  }

  @Post('strategies')
  @ApiOperation({ summary: 'Create strategy' })
  async createStrategy(@Body() body: CreateTradeStrategyDto) {
    return await this.service.createStrategy(body);
  }

  @Get('strategies/:id')
  @ApiOperation({ summary: 'Get strategy by id' })
  @ApiParam({ name: 'id' })
  async getStrategy(@Param('id') id: string) {
    return await this.service.getStrategy(id);
  }

  @Patch('strategies/:id')
  @ApiOperation({ summary: 'Update strategy' })
  @ApiParam({ name: 'id' })
  async updateStrategy(
    @Param('id') id: string,
    @Body() body: UpdateTradeStrategyDto,
  ) {
    return await this.service.updateStrategy(id, body);
  }

  @Delete('strategies/:id')
  @ApiOperation({ summary: 'Delete strategy (soft delete)' })
  @ApiParam({ name: 'id' })
  async deleteStrategy(@Param('id') id: string) {
    return await this.service.deleteStrategy(id);
  }

  @Post('strategies/deactivate')
  @ApiOperation({ summary: 'Bulk deactivate strategies (set isActive=false)' })
  async deactivateStrategies(@Body() body: DeactivateTradeStrategiesDto) {
    return await this.service.deactivateStrategies(body);
  }

  @Post('strategies/clear')
  @ApiOperation({
    summary:
      'Hard delete strategies (and cascade-delete their runs/days/positions).',
  })
  async clearStrategies(@Body() body: ClearTradeStrategiesDto) {
    return await this.service.clearStrategies(body);
  }

  // ============================================================================
  // Runs
  // ============================================================================

  @Get('runs')
  @ApiOperation({ summary: 'List strategy runs' })
  async listRuns() {
    return await this.service.listRuns();
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get strategy run detail' })
  @ApiParam({ name: 'id' })
  async getRun(@Param('id') id: string) {
    return await this.service.getRun(id);
  }

  @Post('runs/clear')
  @ApiOperation({
    summary:
      'Clear strategy runs (deletes runs + their days/positions via cascade).',
  })
  async clearRuns(@Body() body: ClearTradeStrategyRunsDto) {
    return await this.service.clearRuns(body);
  }

  @Post('runs')
  @ApiOperation({
    summary:
      'Create a strategy run and execute it synchronously (MVP). Returns the completed run.',
  })
  async createRun(@Body() body: CreateTradeStrategyRunDto) {
    return await this.service.createAndExecuteRun(body);
  }

  @Post('walk-forward')
  @ApiOperation({
    summary:
      'Execute a walk-forward batch (multiple backtests) and return a report.',
  })
  async walkForward(@Body() body: CreateTradeStrategyWalkForwardDto) {
    return await this.service.createAndExecuteWalkForward(body);
  }

  @Post('walk-forward/all')
  @ApiOperation({
    summary:
      'Execute a walk-forward batch for all active strategies and return a consolidated report.',
  })
  async walkForwardAll(@Body() body: CreateTradeStrategyWalkForwardAllDto) {
    return await this.service.createAndExecuteWalkForwardAll(body);
  }

  @Post('lab-sweep')
  @ApiOperation({
    summary:
      'Run a multi-scenario lab sweep (priceModel x sellShare) across all active strategies and return a ranked report.',
  })
  async labSweep(@Body() body: CreateTradeStrategyLabSweepDto) {
    return await this.service.runLabSweep(body);
  }

  @Get('market-data-coverage')
  @ApiOperation({
    summary:
      'Preflight check: determine whether MarketOrderTradeDaily has full date coverage for a given window.',
  })
  async marketDataCoverage(@Query() q: MarketDataCoverageQueryDto) {
    return await this.service.getMarketDataCoverage(q);
  }

  @Post('cycle-walk-forward/all')
  @ApiOperation({
    summary:
      'Simulate multiple consecutive 14-day cycles (rebuy trigger + rollover-at-cost) across all active strategies and return a ranked report.',
  })
  async cycleWalkForwardAll(
    @Body() body: CreateTradeStrategyCycleWalkForwardAllDto,
  ) {
    return await this.service.createAndExecuteCycleWalkForwardAll(body);
  }

  @Post('cycle-walk-forward/robustness')
  @ApiOperation({
    summary:
      'Run single-buy simulations across many start dates and aggregate tail-risk metrics (p10/median/p90, loss rate).',
  })
  async cycleRobustness(@Body() body: CreateTradeStrategyCycleRobustnessDto) {
    return await this.service.createAndExecuteCycleRobustness(body);
  }
}
