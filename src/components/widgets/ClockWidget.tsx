import { useEffect, useMemo, useState } from 'react';
import type { ClockWidgetConfig } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface ClockWidgetProps {
  config: ClockWidgetConfig;
}

const formatDate = (date: Date, timezone?: string) => {
  const locale = 'es-MX';

  const dateText = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const timeText = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  return { dateText, timeText };
};

export const ClockWidget = ({ config }: ClockWidgetProps) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const { dateText, timeText } = useMemo(() => formatDate(now, config.timezone), [now, config.timezone]);

  return (
    <WidgetCard title={config.title} subtitle={config.subtitle || config.timezone}>
      <div className="clock-widget">
        <strong>{timeText}</strong>
        <span>{dateText}</span>
      </div>
    </WidgetCard>
  );
};
