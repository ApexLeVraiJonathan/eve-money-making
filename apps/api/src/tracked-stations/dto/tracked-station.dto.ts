import { z } from 'zod';

export const TrackedStationCreateSchema = z
  .object({ stationId: z.coerce.number().int().positive() })
  .strict();
export type TrackedStationCreate = z.infer<typeof TrackedStationCreateSchema>;
