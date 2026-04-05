import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => {
          const cookie = req.cookies.get(key);
          return cookie?.value ?? '';
        },
        set: (key, value, options) => {
          res.cookies.set({
            name: key,
            value,
            ...options,
          });
        },
        remove: (key, options) => {
          res.cookies.delete({
            name: key,
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const hasDemoSession = req.cookies.get('demo-auth')?.value === '1';

  const pathname = req.nextUrl.pathname;

  // Redirect to login if accessing protected routes without session
  const protectedRoutes = ['/dashboard', '/tasks', '/technicians'];
  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !session && !hasDemoSession) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing login page with session
  if (pathname === '/login' && (session || hasDemoSession)) {
    const dashboardUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
