import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import fluxcySkidModel from '../assets/fluxcy_skid_proxy.glb?url';
import { useAuth } from '../hooks/useAuth';
import { hasSeenIntro, markIntroSeen } from '../lib/introGate';

export const IntroPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    void import('@google/model-viewer');
  }, []);

  if (isBootstrapping) {
    return <div className="screen-loader">Cargando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (hasSeenIntro()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleContinue = () => {
    markIntroSeen();
    navigate('/dashboard', { replace: true });
  };

  return (
    <section className="intro-screen">
      <div className="intro-screen__panel">
        <div className="intro-screen__content">
          <p className="intro-screen__eyebrow">Bienvenido</p>
          <h1>Centro de monitoreo Fluxcy</h1>
          <p>
            Este panel integra variables de proceso, tendencias y alertas en tiempo real.
            Revisa el modelo 3D para ubicar rapidamente el sistema antes de entrar al
            dashboard operativo.
          </p>

          <div className="intro-screen__actions">
            <button type="button" className="intro-btn" onClick={handleContinue}>
              Entrar al dashboard
            </button>
          </div>
        </div>

        <div className="intro-screen__viewer">
          <model-viewer
            src={fluxcySkidModel}
            alt="Modelo 3D Fluxcy"
            camera-controls
            auto-rotate
            loading="eager"
            reveal="auto"
            shadow-intensity="1"
            interaction-prompt="auto"
          />
        </div>
      </div>
    </section>
  );
};
