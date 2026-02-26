import type { TableRow, TableWidgetConfig } from '../../types/dashboard';
import { WidgetCard } from './WidgetCard';

interface TableWidgetProps {
  config: TableWidgetConfig;
  rows: TableRow[];
}

export const TableWidget = ({ config, rows }: TableWidgetProps) => (
  <WidgetCard title={config.title} subtitle={config.subtitle}>
    <div className="table-widget">
      {rows.length ? (
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <th key={column.key} className={`align-${column.align || 'left'}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${config.id}-${rowIndex}`}>
                {config.columns.map((column) => (
                  <td key={column.key} className={`align-${column.align || 'left'}`}>
                    {row[column.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="widget-empty">No data</div>
      )}
    </div>
  </WidgetCard>
);
