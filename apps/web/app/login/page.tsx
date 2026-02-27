import { LoginPageClient } from '@/components/auth/login-page-client';

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const expiredRaw = params.expired;
  const expiredValue = Array.isArray(expiredRaw) ? expiredRaw[0] : expiredRaw;

  return <LoginPageClient initialExpiredFromQuery={expiredValue === '1'} />;
}
