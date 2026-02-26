import type { CSSProperties } from 'react';
import type { DashboardSnapshot, DashboardWidgetConfig } from '../../types/dashboard';
import type { ChartTimeRange } from '../../types/timeRange';
import { WidgetRenderer } from './WidgetRenderer';

interface DashboardGridProps {
  widgets: DashboardWidgetConfig[];
  snapshot: DashboardSnapshot;
  chartTimeRange: ChartTimeRange;
}

export const DashboardGrid = ({
  widgets,
  snapshot,
  chartTimeRange,
}: DashboardGridProps) => (
  <section className="dashboard-grid">
    {widgets.map((widget) => {
      const style: CSSProperties = {
        gridColumn: `span ${widget.colSpan || 3}`,
        gridRow: `span ${widget.rowSpan || 1}`,
        minHeight: widget.minHeight || 140,
      };

      return (
        <div className="dashboard-grid__item" style={style} key={widget.id}>
          <WidgetRenderer
            config={widget}
            snapshot={snapshot}
            chartTimeRange={chartTimeRange}
          />
        </div>
      );
    })}
  </section>
);
