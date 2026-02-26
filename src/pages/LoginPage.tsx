import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { hasSeenIntro, resetIntroGate } from '../lib/introGate';
import type { LoginPayload } from '../types/auth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isBootstrapping } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (payload: LoginPayload) => {
    setError(null);
    setIsLoading(true);

    try {
      await login(payload);
      resetIntroGate();
      navigate('/intro', { replace: true });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Error de autenticacion';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isBootstrapping) {
    return <div className="screen-loader">Cargando...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to={hasSeenIntro() ? '/dashboard' : '/intro'} replace />;
  }

  return (
    <div className="login-screen">
      <div className="login-screen__backdrop" />
      <LoginForm isLoading={isLoading} error={error} onSubmit={handleSubmit} />
    </div>
  );
};
