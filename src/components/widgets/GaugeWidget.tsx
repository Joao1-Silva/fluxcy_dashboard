import { formatMetric, safeNumber } from '../../lib/formatters';
import type { GaugeWidgetConfig } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface GaugeWidgetProps {
  config: GaugeWidgetConfig;
  value: number | string | null | undefined;
}

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
};

const resolveGaugeColor = (config: GaugeWidgetConfig, numericValue: number): string => {
  if (!config.thresholds?.length) {
    return '#3fb950';
  }

  for (const threshold of config.thresholds) {
    if (numericValue <= threshold.value) {
      return threshold.color;
    }
  }

  return config.thresholds[config.thresholds.length - 1].color;
};

export const GaugeWidget = ({ config, value }: GaugeWidgetProps) => {
  const numeric = safeNumber(value ?? null);
  const min = config.min;
  const max = config.max;
  const clamped = numeric === null ? min : Math.min(Math.max(numeric, min), max);
  const ratio = (clamped - min) / (max - min);
  const angleStart = -120;
  const angleEnd = 120;
  const endAngle = angleStart + (angleEnd - angleStart) * ratio;
  const color = resolveGaugeColor(config, clamped);

  return (
    <WidgetCard title={config.title} subtitle={config.subtitle}>
      <div className="gauge">
        <svg viewBox="0 0 220 140" className="gauge__svg" role="img" aria-label={config.title}>
          <path
            d={describeArc(110, 120, 84, angleStart, angleEnd)}
            stroke="#1f2937"
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={describeArc(110, 120, 84, angleStart, endAngle)}
            stroke={color}
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <div className="gauge__value">
          {formatMetric(value ?? null, {
            decimals: config.decimals,
            unit: config.unit,
          })}
        </div>
      </div>
    </WidgetCard>
  );
};
