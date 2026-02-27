'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';

type LoginPageClientProps = {
  initialExpiredFromQuery: boolean;
};

export function LoginPageClient({ initialExpiredFromQuery }: LoginPageClientProps) {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const login = useAuthStore((state) => state.login);
  const clearLocalUser = useAuthStore((state) => state.clearLocalUser);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loginExpiredModal, setLoginExpiredModal] = useState(false);
  const [dismissedQueryExpiredModal, setDismissedQueryExpiredModal] = useState(false);

  const showExpiredModal = (initialExpiredFromQuery && !dismissedQueryExpiredModal) || loginExpiredModal;

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (initialExpiredFromQuery) {
      clearLocalUser();
      return;
    }

    if (user) {
      router.replace('/dashboard');
    }
  }, [clearLocalUser, hydrated, initialExpiredFromQuery, user, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login({ username, password });
    if (!result.ok) {
      setError(result.message);
      if (result.expired) {
        setLoginExpiredModal(true);
      }
      setSubmitting(false);
      return;
    }

    router.replace('/dashboard');
    setSubmitting(false);
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Ingreso FLUXCY DEV V1</CardTitle>
            <CardDescription>
              Autenticacion por rol (superadmin / supervisor / welltech trial).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="superadmin, supervisor o welltech"
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contrasena</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="********"
                  autoComplete="current-password"
                />
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}

              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? 'Validando...' : 'Ingresar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {showExpiredModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-700/70 bg-slate-900/95 p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Finalizo su prueba</h2>
            <p className="mt-2 text-sm text-slate-300">
              Contacte a FLUXCY para activar su licencia.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                if (initialExpiredFromQuery && !dismissedQueryExpiredModal) {
                  setDismissedQueryExpiredModal(true);
                } else {
                  setLoginExpiredModal(false);
                }
              }}
            >
              Entendido
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
