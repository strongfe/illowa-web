import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://illowa-hotel.com'),
};

const localeTags: Record<(typeof routing.locales)[number], string> = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
  ru: 'ru-RU',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-PT',
  id: 'id-ID',
  hi: 'hi-IN',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const localeFromHeader = requestHeaders.get('x-next-intl-locale');
  const locale: (typeof routing.locales)[number] = hasLocale(
    routing.locales,
    localeFromHeader ?? ''
  )
    ? (localeFromHeader as (typeof routing.locales)[number])
    : routing.defaultLocale;

  return (
    <html lang={localeTags[locale]} className="scroll-smooth">
      <body className="antialiased bg-[#0A0A0A] text-[#F5F2EC] font-montserrat overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
