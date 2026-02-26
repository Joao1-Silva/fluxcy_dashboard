import { useState } from 'react';
import type { LoginPayload } from '../../types/auth';

interface LoginFormProps {
  isLoading: boolean;
  error: string | null;
  onSubmit: (payload: LoginPayload) => Promise<void>;
}

export const LoginForm = ({ isLoading, error, onSubmit }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ email, password });
  };

  return (
    <form className="login-card" onSubmit={handleSubmit}>
      <h1>Fluxcy Dashboard</h1>
      <p>Control y monitoreo en tiempo real</p>

      <label htmlFor="email">Usuario</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="operador@empresa.com"
        required
      />

      <label htmlFor="password">Contrasena</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="********"
        required
      />

      {error ? (
        <div role="alert" className="login-card__error">
          {error}
        </div>
      ) : null}

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
};
