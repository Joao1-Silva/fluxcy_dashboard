import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { env } from './config/env';
import { AuthProvider } from './context/AuthContext';

const DashboardPage = lazy(async () => {
  const module = await import('./pages/DashboardPage');
  return { default: module.DashboardPage };
});

const IntroPage = lazy(async () => {
  const module = await import('./pages/IntroPage');
  return { default: module.IntroPage };
});

const LoginPage = lazy(async () => {
  const module = await import('./pages/LoginPage');
  return { default: module.LoginPage };
});

const routerBase = env.appBasePath === '/' ? undefined : env.appBasePath;

const PageLoader = () => <div className="screen-loader">Cargando...</div>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={routerBase}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/intro" element={<IntroPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
