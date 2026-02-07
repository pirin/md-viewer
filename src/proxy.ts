import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  const path = request.nextUrl.pathname;

  const response = NextResponse.next();
  response.headers.set('x-pathname', path);

  // If no password is set, allow all traffic
  if (!password) {
    return response;
  }

  // Allow login page and static assets
  if (path === '/login' || path.startsWith('/_next') || path.includes('.')) {
    return response;
  }

  const session = request.cookies.get('session')?.value;

  if (session !== password) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
