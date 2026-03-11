import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlProxy = createMiddleware(routing);

export function proxy(request: Parameters<typeof intlProxy>[0]) {
  return intlProxy(request);
}

export const config = {
  // Exclude API routes, Next.js internals and static files with extensions.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
