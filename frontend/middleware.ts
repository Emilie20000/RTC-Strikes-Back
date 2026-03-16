import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'never'
});

export const config = {
  // Skip Next.js internals and all static files
  matcher: ['/((?!_next|api|.*\\..*).*)']
};
