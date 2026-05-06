import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type StoredOAuthState = {
  id: string;
  state: string;
  codeVerifier: string;
  userId: string | null;
  returnUrl: string | null;
  expiresAt: Date;
};

@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserLinkState(params: {
    state: string;
    codeVerifier: string;
    userId: string;
    returnUrl?: string | null;
  }): Promise<void> {
    await this.prisma.oAuthState.create({
      data: {
        state: params.state,
        codeVerifier: params.codeVerifier,
        userId: params.userId,
        returnUrl: params.returnUrl ?? null,
        expiresAt: this.expiresInTenMinutes(),
      },
    });
  }

  async createSystemLinkState(params: {
    state: string;
    codeVerifier: string;
    notes?: string | null;
    returnUrl?: string | null;
  }): Promise<void> {
    await this.prisma.oAuthState.create({
      data: {
        state: params.state,
        codeVerifier: params.codeVerifier,
        userId: null,
        returnUrl: JSON.stringify({
          notes: params.notes || null,
          returnUrl: params.returnUrl || null,
        }),
        expiresAt: this.expiresInTenMinutes(),
      },
    });
  }

  async findByState(state: string): Promise<StoredOAuthState | null> {
    return await this.prisma.oAuthState.findUnique({ where: { state } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.oAuthState.delete({ where: { id } });
  }

  async deleteByState(state: string): Promise<void> {
    await this.prisma.oAuthState.delete({ where: { state } });
  }

  isExpired(oauthState: StoredOAuthState): boolean {
    return oauthState.expiresAt < new Date();
  }

  private expiresInTenMinutes(): Date {
    return new Date(Date.now() + 10 * 60 * 1000);
  }
}
