import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TrackedStationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(stationId: number) {
    return this.prisma.trackedStation.create({
      data: { stationId },
      include: { station: true },
    });
  }

  async list() {
    return this.prisma.trackedStation.findMany({ include: { station: true } });
  }

  async get(id: string) {
    return this.prisma.trackedStation.findUnique({
      where: { id },
      include: { station: true },
    });
  }

  async remove(id: string) {
    return this.prisma.trackedStation.delete({ where: { id } });
  }
}
