import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PackageService } from './services/package.service';
import { Roles } from '@api/characters/decorators/roles.decorator';
import { RolesGuard } from '@api/characters/guards/roles.guard';
import { GetPackagesQuery } from './dto/get-packages-query.dto';
import { MarkFailedRequest } from './dto/mark-failed-request.dto';

@ApiTags('packages')
@Controller('packages')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class PackagesController {
  constructor(private readonly packagesService: PackageService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get committed packages for a cycle' })
  async getPackages(@Query() query: GetPackagesQuery) {
    return await this.packagesService.getCommittedPackages(
      query.cycleId,
      query.status,
    );
  }

  @Get(':packageId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get package details' })
  @ApiParam({ name: 'packageId', type: 'string', format: 'uuid' })
  async getPackageDetails(@Param('packageId') packageId: string) {
    return await this.packagesService.getPackageDetails(packageId);
  }

  @Post(':packageId/mark-failed')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Mark a package as failed' })
  @ApiParam({ name: 'packageId', type: 'string', format: 'uuid' })
  async markFailed(
    @Param('packageId') packageId: string,
    @Body() body: MarkFailedRequest,
  ) {
    return await this.packagesService.markPackageFailed({
      packageId,
      collateralRecoveredIsk: body.collateralRecoveredIsk,
      collateralProfitIsk: body.collateralProfitIsk,
      memo: body.memo,
    });
  }
}
