import { filterSeriesByTimeRange } from '../../lib/timeRange';
import type { ChartTimeRange } from '../../types/timeRange';
import { ClockWidget } from '../widgets/ClockWidget';
import { GaugeWidget } from '../widgets/GaugeWidget';
import { LineChartWidget } from '../widgets/LineChartWidget';
import { MetricWidget } from '../widgets/MetricWidget';
import { ModelWidget } from '../widgets/ModelWidget';
import { TableWidget } from '../widgets/TableWidget';
import type {
  DashboardSnapshot,
  DashboardWidgetConfig,
  GaugeWidgetConfig,
  MetricWidgetConfig,
  ChartWidgetConfig,
  TableWidgetConfig,
  ClockWidgetConfig,
  ModelWidgetConfig,
} from '../../types/dashboard';

interface WidgetRendererProps {
  config: DashboardWidgetConfig;
  snapshot: DashboardSnapshot;
  chartTimeRange: ChartTimeRange;
}

export const WidgetRenderer = ({
  config,
  snapshot,
  chartTimeRange,
}: WidgetRendererProps) => {
  switch (config.type) {
    case 'gauge':
      return (
        <GaugeWidget
          config={config as GaugeWidgetConfig}
          value={snapshot.metrics[(config as GaugeWidgetConfig).dataKey]}
        />
      );

    case 'metric':
      return (
        <MetricWidget
          config={config as MetricWidgetConfig}
          value={snapshot.metrics[(config as MetricWidgetConfig).dataKey]}
        />
      );

    case 'chart': {
      const chartConfig = config as ChartWidgetConfig;
      const rawRows = snapshot.series[chartConfig.seriesKey] || [];
      const filteredRows = filterSeriesByTimeRange(
        rawRows,
        chartConfig.xKey,
        chartTimeRange,
        snapshot.timestamp,
      );

      return <LineChartWidget config={chartConfig} rows={filteredRows} />;
    }

    case 'table':
      return (
        <TableWidget
          config={config as TableWidgetConfig}
          rows={snapshot.tables[(config as TableWidgetConfig).tableKey] || []}
        />
      );

    case 'clock':
      return <ClockWidget config={config as ClockWidgetConfig} />;

    case 'model':
      return <ModelWidget config={config as ModelWidgetConfig} />;

    default:
      return null;
  }
};
