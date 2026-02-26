'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';
import type { AuthRole } from '@/types/auth';

type AuthGuardProps = {
  children: ReactNode;
  allowRoles?: AuthRole[];
  fallbackPath?: '/dashboard' | '/tasks';
};

export function AuthGuard({ children, allowRoles, fallbackPath = '/dashboard' }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (!user) {
      if (pathname !== '/login') {
        router.replace('/login');
      }
      return;
    }

    if (allowRoles && !allowRoles.includes(user.role)) {
      router.replace(fallbackPath);
    }
  }, [hydrated, user, allowRoles, fallbackPath, pathname, router]);

  if (!hydrated) {
    return (
      <main className="min-h-screen px-4 py-6">
        <Skeleton className="mx-auto h-[320px] w-full max-w-2xl rounded-2xl" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (allowRoles && !allowRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
