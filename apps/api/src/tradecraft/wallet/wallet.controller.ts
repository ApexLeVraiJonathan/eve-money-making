import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { WalletService } from './services/wallet.service';
import { WalletQueryDto } from './dto/wallet-query.dto';

@ApiTags('wallet')
@Controller('wallet-import')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('character')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import wallet data for a specific character' })
  @ApiQuery({ name: 'characterId', required: true, type: Number })
  async importCharacter(@Query('characterId') characterId: string) {
    const id = Number(characterId);
    return await this.wallet.importForCharacter(id);
  }

  @Get('transactions')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List wallet transactions' })
  async listTransactions(@Query() query: WalletQueryDto) {
    const id = query.characterId;
    const since = new Date(
      Date.now() - (query.sinceDays ?? 14) * 24 * 3600 * 1000,
    );
    return await this.wallet.listTransactions(
      id,
      since,
      query.limit,
      query.offset,
    );
  }

  @Get('journal')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List wallet journal entries' })
  async listJournal(@Query() query: WalletQueryDto) {
    const id = query.characterId;
    const since = new Date(
      Date.now() - (query.sinceDays ?? 14) * 24 * 3600 * 1000,
    );
    return await this.wallet.listJournal(id, since, query.limit, query.offset);
  }

  @Post('all')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import wallet data for all linked characters' })
  async importAll() {
    return await this.wallet.importAllLinked();
  }
}
