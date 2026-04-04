import { NextRequest, NextResponse } from 'next/server';

// Protected routes that require authentication
const protectedRoutes = ['/dashboard', '/tasks', '/technicians'];

// Public routes that don't require authentication
const publicRoutes = ['/login', '/'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.includes(pathname);

  // Get auth token from cookies
  const authToken = request.cookies.get('auth-token')?.value;
  const sessionData = request.cookies.get('auth-session')?.value;

  // If trying to access protected route without auth, redirect to login
  if (isProtectedRoute && !authToken && !sessionData) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If trying to access login page while authenticated, redirect to dashboard
  if (pathname === '/login' && (authToken || sessionData)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
