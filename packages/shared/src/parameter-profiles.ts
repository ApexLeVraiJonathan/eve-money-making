export type ParameterProfileScope = "LIQUIDITY" | "ARBITRAGE" | "PLANNER";

export type ParameterProfile = {
  id: string;
  name: string;
  description?: string;
  scope: ParameterProfileScope;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type CreateParameterProfileDto = {
  name: string;
  description?: string;
  scope: ParameterProfileScope;
  params: Record<string, unknown>;
};

export type UpdateParameterProfileDto = {
  name?: string;
  description?: string;
  params?: Record<string, unknown>;
};
