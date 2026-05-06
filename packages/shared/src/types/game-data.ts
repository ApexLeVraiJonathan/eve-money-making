export interface TypeId {
  id: number;
  published: boolean;
  name: string;
  volume: string | null;
}

export interface StationId {
  id: number;
  solarSystemId: number;
  name: string;
}

export interface SolarSystemId {
  id: number;
  regionId: number;
  name: string;
}

export interface RegionId {
  id: number;
  name: string;
}

export interface TrackedStation {
  id: string;
  stationId: number;
  stationName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketOrderTradeDaily {
  scanDate: string;
  locationId: number;
  typeId: number;
  isBuyOrder: boolean;
  regionId: number;
  hasGone: boolean;
  amount: number;
  high: string;
  low: string;
  avg: string;
  orderNum: number;
  iskValue: string;
}
