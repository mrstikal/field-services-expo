'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-provider';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Login failed. Please try again.';
  }

  const msg = error.message.toLowerCase();
  if (msg.includes('invalid api key')) {
    return 'Login failed: invalid Supabase API key. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
  }
  if (msg.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }

  return error.message;
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'dispatcher1@demo.cz',
      password: 'demo123',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn(data.email, data.password);
      const nextPath = searchParams?.get('next') || '/dashboard';
      window.location.assign(nextPath);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Field Service
          </CardTitle>
          <p className="text-center text-sm text-gray-500">Dispatcher login</p>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                placeholder="dispatcher@demo.cz"
                type="email"
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                placeholder="••••••"
                type="password"
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-sm text-red-600">
                  {errors.password.message}
                </p>
              ) : null}
            </div>
            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Demo accounts:</p>
            <p>dispatcher1@demo.cz / demo123</p>
            <p>dispatcher2@demo.cz / demo123</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Field Service</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-gray-500">Loading login...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
