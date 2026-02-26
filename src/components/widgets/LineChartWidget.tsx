import dayjs from 'dayjs';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartWidgetConfig, SeriesPoint } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface LineChartWidgetProps {
  config: ChartWidgetConfig;
  rows: SeriesPoint[];
}

const formatXAxisValue = (value: number | string): string => {
  if (typeof value === 'number') {
    return dayjs(value).format('HH:mm');
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && value !== '') {
    return dayjs(numeric).format('HH:mm');
  }

  return String(value);
};

export const LineChartWidget = ({ config, rows }: LineChartWidgetProps) => (
  <WidgetCard title={config.title} subtitle={config.subtitle}>
    <div className="line-chart-widget">
      {rows.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2c44" />
            <XAxis
              dataKey={config.xKey}
              tick={{ fill: '#91a4c6', fontSize: 11 }}
              axisLine={{ stroke: '#20304a' }}
              tickLine={{ stroke: '#20304a' }}
              minTickGap={24}
              tickFormatter={formatXAxisValue}
            />
            <YAxis
              tick={{ fill: '#91a4c6', fontSize: 11 }}
              axisLine={{ stroke: '#20304a' }}
              tickLine={{ stroke: '#20304a' }}
              domain={config.yDomain}
              width={52}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1627',
                border: '1px solid #263754',
                color: '#dbe8ff',
                borderRadius: 12,
              }}
              labelStyle={{ color: '#c6dcff' }}
              labelFormatter={(label) => formatXAxisValue(label as number | string)}
            />
            <Legend wrapperStyle={{ color: '#9ab6e4', fontSize: 12 }} />

            {config.lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="widget-empty">No data</div>
      )}
    </div>
  </WidgetCard>
);
