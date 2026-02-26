import { formatMetric } from '../../lib/formatters';
import type { MetricWidgetConfig, MetricValue } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface MetricWidgetProps {
  config: MetricWidgetConfig;
  value: MetricValue;
}

export const MetricWidget = ({ config, value }: MetricWidgetProps) => (
  <WidgetCard title={config.title} subtitle={config.subtitle}>
    <div className="metric-widget">
      {formatMetric(value, {
        decimals: config.decimals,
        unit: config.unit,
        prefix: config.prefix,
        suffix: config.suffix,
      })}
    </div>
  </WidgetCard>
);
