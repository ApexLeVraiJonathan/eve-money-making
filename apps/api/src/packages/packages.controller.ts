import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { PackagesService } from './packages.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  GetPackagesQuerySchema,
  type GetPackagesQuery,
} from './dto/get-packages-query.dto';
import {
  MarkFailedRequestSchema,
  type MarkFailedRequest,
} from './dto/mark-failed-request.dto';

@Controller('packages')
@UseGuards(RolesGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(GetPackagesQuerySchema))
  async getPackages(@Query() query: GetPackagesQuery) {
    return await this.packagesService.getCommittedPackages(
      query.cycleId,
      query.status,
    );
  }

  @Get(':packageId')
  @Roles('ADMIN')
  async getPackageDetails(@Param('packageId') packageId: string) {
    return await this.packagesService.getPackageDetails(packageId);
  }

  @Post(':packageId/mark-failed')
  @Roles('ADMIN')
  @UsePipes(new ZodValidationPipe(MarkFailedRequestSchema))
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
