import type { ChartTimeRange } from '../../types/timeRange';

interface TimeRangeToolbarProps {
  value: ChartTimeRange;
  onChange: (next: ChartTimeRange) => void;
}

const modeLabel: Array<{ value: ChartTimeRange['mode']; label: string }> = [
  { value: 'all', label: 'Todo' },
  { value: 'last_15m', label: 'Ultimos 15m' },
  { value: 'last_1h', label: 'Ultima 1h' },
  { value: 'last_6h', label: 'Ultimas 6h' },
  { value: 'last_24h', label: 'Ultimas 24h' },
  { value: 'custom', label: 'Personalizado' },
];

export const TimeRangeToolbar = ({ value, onChange }: TimeRangeToolbarProps) => {
  const isCustom = value.mode === 'custom';

  return (
    <section className="time-filter">
      <div className="time-filter__header">
        <h3>Rango de tiempo para graficas</h3>
        <p>Relojes y contadores continuan en tiempo real.</p>
      </div>

      <div className="time-filter__controls">
        <label>
          Rango
          <select
            value={value.mode}
            onChange={(event) =>
              onChange({
                mode: event.target.value as ChartTimeRange['mode'],
                from: value.from,
                to: value.to,
              })
            }
          >
            {modeLabel.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>

        {isCustom ? (
          <>
            <label>
              Desde
              <input
                type="datetime-local"
                value={value.from || ''}
                onChange={(event) => onChange({ ...value, from: event.target.value })}
              />
            </label>

            <label>
              Hasta
              <input
                type="datetime-local"
                value={value.to || ''}
                onChange={(event) => onChange({ ...value, to: event.target.value })}
              />
            </label>
          </>
        ) : null}
      </div>
    </section>
  );
};
