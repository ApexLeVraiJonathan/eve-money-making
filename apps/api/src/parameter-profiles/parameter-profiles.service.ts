import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { ParameterProfileScope } from '@eve/prisma';

@Injectable()
export class ParameterProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProfileDto, userId?: string) {
    // Check if a profile with the same name and scope already exists
    const existing = await this.prisma.parameterProfile.findUnique({
      where: {
        scope_name: {
          scope: dto.scope,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A profile with name "${dto.name}" already exists for scope ${dto.scope}`,
      );
    }

    return this.prisma.parameterProfile.create({
      data: {
        name: dto.name,
        description: dto.description,
        scope: dto.scope,
        params: dto.params,
        createdBy: userId,
      },
    });
  }

  async findAll(scope?: ParameterProfileScope) {
    return this.prisma.parameterProfile.findMany({
      where: scope ? { scope } : undefined,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.parameterProfile.findUnique({
      where: { id },
    });

    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }

    return profile;
  }

  async update(id: string, dto: UpdateProfileDto) {
    // Check if the profile exists
    const existing = await this.findOne(id);

    // If name is being changed, check for conflicts
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.parameterProfile.findUnique({
        where: {
          scope_name: {
            scope: existing.scope,
            name: dto.name,
          },
        },
      });

      if (conflict) {
        throw new ConflictException(
          `A profile with name "${dto.name}" already exists for scope ${existing.scope}`,
        );
      }
    }

    return this.prisma.parameterProfile.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        params: dto.params,
      },
    });
  }

  async remove(id: string) {
    // Check if the profile exists
    await this.findOne(id);

    return this.prisma.parameterProfile.delete({
      where: { id },
    });
  }
}
