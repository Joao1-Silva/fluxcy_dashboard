import dayjs from 'dayjs';
import type { PropsWithChildren } from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import type { ConnectionStatus as Status } from '../../realtime/dashboardSocket';

interface AppShellProps extends PropsWithChildren {
  title: string;
  username?: string;
  status: Status;
  lastUpdated: string;
  error?: string | null;
  onRefresh: () => void;
  onLogout: () => void;
}

export const AppShell = ({
  title,
  username,
  status,
  lastUpdated,
  error,
  onRefresh,
  onLogout,
  children,
}: AppShellProps) => (
  <div className="app-shell">
    <header className="topbar">
      <div className="topbar__left">
        <h1>{title}</h1>
        <p>Ultima actualizacion: {dayjs(lastUpdated).format('YYYY-MM-DD HH:mm:ss')}</p>
      </div>

      <div className="topbar__right">
        <ConnectionStatus status={status} />
        <button type="button" className="ghost-btn" onClick={onRefresh}>
          Recargar
        </button>
        <button type="button" className="ghost-btn" onClick={onLogout}>
          Salir
        </button>
        <span className="topbar__user">{username || 'Operador'}</span>
      </div>
    </header>

    {error ? (
      <div role="alert" className="top-error">
        {error}
      </div>
    ) : null}

    <main>{children}</main>
  </div>
);
