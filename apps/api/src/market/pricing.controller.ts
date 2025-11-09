import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../characters/decorators/roles.decorator';
import { RolesGuard } from '../characters/guards/roles.guard';
import { Public } from '../characters/decorators/public.decorator';
import { PricingService } from './services/pricing.service';
import { SellAppraiseRequest } from './dto/sell-appraise.dto';
import { UndercutCheckRequest } from './dto/undercut-check.dto';
import { ConfirmListingRequest } from './dto/confirm-listing.dto';
import { ConfirmRepriceRequest } from './dto/confirm-reprice.dto';
import { SellAppraiseByCommitRequest } from './dto/sell-appraise-by-commit.dto';

@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Post('sell-appraise')
  @ApiOperation({ summary: 'Appraise sell orders for items' })
  async sellAppraise(@Body() body: SellAppraiseRequest) {
    return this.pricing.sellAppraise(body);
  }

  @Public()
  @Post('undercut-check')
  @ApiOperation({ summary: 'Check for undercut orders' })
  async undercutCheck(@Body() body: UndercutCheckRequest) {
    return this.pricing.undercutCheck(body);
  }

  @Post('confirm-listing')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a listing was created' })
  async confirmListing(@Body() body: ConfirmListingRequest) {
    return this.pricing.confirmListing(body);
  }

  @Post('confirm-reprice')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a reprice was executed' })
  async confirmReprice(@Body() body: ConfirmRepriceRequest) {
    return this.pricing.confirmReprice(body);
  }

  @Public()
  @Post('sell-appraise-by-commit')
  @ApiOperation({ summary: 'Appraise all items for a cycle commit' })
  async sellAppraiseByCommit(@Body() body: SellAppraiseByCommitRequest) {
    return this.pricing.sellAppraiseByCommit(body);
  }
}
