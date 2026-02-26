'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';

export default function LoginPage() {
  const router = useRouter();

  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (user) {
      router.replace('/dashboard');
    }
  }, [hydrated, user, router]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const result = login({ username, password });
    if (!result.ok) {
      setError(result.message ?? 'No fue posible iniciar sesion.');
      return;
    }

    router.replace('/dashboard');
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Ingreso FLUXCY DEV V1</CardTitle>
            <CardDescription>Autenticacion local por rol (superadmin / supervisor).</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="username">Usuario</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="superadmin o supervisor"
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

              <Button className="w-full" type="submit">
                Ingresar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
