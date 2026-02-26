export type ChartRangeMode =
  | 'all'
  | 'last_15m'
  | 'last_1h'
  | 'last_6h'
  | 'last_24h'
  | 'custom';

export interface ChartTimeRange {
  mode: ChartRangeMode;
  from?: string;
  to?: string;
}
