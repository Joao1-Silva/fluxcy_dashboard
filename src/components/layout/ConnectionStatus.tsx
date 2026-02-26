import type { ConnectionStatus as SocketConnectionStatus } from '../../realtime/dashboardSocket';

interface Props {
  status: SocketConnectionStatus;
}

const labels: Record<SocketConnectionStatus, string> = {
  connected: 'Conectado',
  connecting: 'Conectando',
  disconnected: 'Desconectado',
  error: 'Error',
};

export const ConnectionStatus = ({ status }: Props) => (
  <span className={`connection-chip connection-chip--${status}`}>
    <span className="connection-chip__dot" aria-hidden />
    {labels[status]}
  </span>
);
