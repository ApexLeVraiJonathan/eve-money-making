import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * FeeService handles fee tracking for cycle lines and cycles.
 * Responsibilities: Broker fees, relist fees, transport fees.
 */
@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add a broker fee to a cycle line
   */
  async addBrokerFee(input: { lineId: string; amountIsk: string }) {
    return await this.prisma.cycleLine.update({
      where: { id: input.lineId },
      data: {
        brokerFeesIsk: { increment: Number(input.amountIsk) },
      },
    });
  }

  /**
   * Add a relist fee to a cycle line
   */
  async addRelistFee(input: { lineId: string; amountIsk: string }) {
    return await this.prisma.cycleLine.update({
      where: { id: input.lineId },
      data: {
        relistFeesIsk: { increment: Number(input.amountIsk) },
      },
    });
  }

  /**
   * Add a transport fee to a cycle
   */
  async addTransportFee(input: {
    cycleId: string;
    amountIsk: string;
    memo?: string;
  }) {
    return await this.prisma.cycleFeeEvent.create({
      data: {
        cycleId: input.cycleId,
        feeType: 'transport',
        amountIsk: input.amountIsk,
        memo: input.memo ?? null,
        occurredAt: new Date(),
      },
    });
  }

  /**
   * List transport fees for a cycle
   */
  async listTransportFees(cycleId: string) {
    return await this.prisma.cycleFeeEvent.findMany({
      where: { cycleId, feeType: 'transport' },
      orderBy: { occurredAt: 'desc' },
    });
  }
}

