export type MetricValue = number | string | null;

export type MetricMap = Record<string, MetricValue>;

export type SeriesPoint = Record<string, number | string | null>;

export type SeriesMap = Record<string, SeriesPoint[]>;

export type TableRow = Record<string, number | string | null>;

export type TableMap = Record<string, TableRow[]>;

export interface DashboardSnapshot {
  timestamp: string;
  metrics: MetricMap;
  series: SeriesMap;
  tables: TableMap;
}

export interface DashboardUpdate {
  timestamp?: string;
  metrics?: MetricMap;
  series?: Record<string, SeriesPoint | SeriesPoint[]>;
  tables?: TableMap;
}

export interface WidgetBase {
  id: string;
  type: 'gauge' | 'metric' | 'chart' | 'table' | 'clock' | 'model';
  title: string;
  subtitle?: string;
  colSpan?: number;
  rowSpan?: number;
  minHeight?: number;
}

export interface GaugeThreshold {
  value: number;
  color: string;
}

export interface GaugeWidgetConfig extends WidgetBase {
  type: 'gauge';
  dataKey: string;
  min: number;
  max: number;
  unit?: string;
  decimals?: number;
  thresholds?: GaugeThreshold[];
}

export interface MetricWidgetConfig extends WidgetBase {
  type: 'metric';
  dataKey: string;
  unit?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export interface ChartLineConfig {
  dataKey: string;
  name: string;
  color: string;
}

export interface ChartWidgetConfig extends WidgetBase {
  type: 'chart';
  seriesKey: string;
  xKey: string;
  lines: ChartLineConfig[];
  yDomain?: [number | 'auto', number | 'auto'];
}

export interface TableColumnConfig {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface TableWidgetConfig extends WidgetBase {
  type: 'table';
  tableKey: string;
  columns: TableColumnConfig[];
}

export interface ClockWidgetConfig extends WidgetBase {
  type: 'clock';
  timezone?: string;
  timeFormat?: string;
  dateFormat?: string;
}

export interface ModelWidgetConfig extends WidgetBase {
  type: 'model';
  src: string;
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
}

export type DashboardWidgetConfig =
  | GaugeWidgetConfig
  | MetricWidgetConfig
  | ChartWidgetConfig
  | TableWidgetConfig
  | ClockWidgetConfig
  | ModelWidgetConfig;
