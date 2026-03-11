import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';

export type LegalPageKey = 'terms' | 'privacy' | 'cookies';

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

const legalMeta = {
  ko: {
    terms: {
      title: '이용약관 | 일로와호텔',
      description: '일로와호텔 웹사이트 이용약관입니다. 외부 예약 플랫폼 연결 및 서비스 이용 조건을 안내합니다.',
    },
    privacy: {
      title: '개인정보처리방침 | 일로와호텔',
      description: '일로와호텔 개인정보처리방침입니다. 수집 항목, 처리 목적, 보관 기간, 이용자 권리를 안내합니다.',
    },
    cookies: {
      title: '쿠키 정책 | 일로와호텔',
      description: '일로와호텔 쿠키 정책입니다. 쿠키 사용 목적, 유형, 거부 방법을 안내합니다.',
    },
  },
  en: {
    terms: {
      title: 'Terms of Service | Illowa Hotel',
      description: 'Terms of Service for the Illowa Hotel website, including external booking platform links and usage conditions.',
    },
    privacy: {
      title: 'Privacy Policy | Illowa Hotel',
      description: 'Privacy Policy for Illowa Hotel, including data collection, processing purposes, retention, and user rights.',
    },
    cookies: {
      title: 'Cookie Policy | Illowa Hotel',
      description: 'Cookie Policy for Illowa Hotel, including cookie usage purposes, categories, and opt-out options.',
    },
  },
} as const;

export function resolveLegalLocale(input: string): 'ko' | 'en' {
  return input.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export function buildLegalMetadata(localeInput: string, page: LegalPageKey): Metadata {
  const resolvedRouteLocale = routing.locales.includes(localeInput as (typeof routing.locales)[number])
    ? (localeInput as (typeof routing.locales)[number])
    : routing.defaultLocale;
  const legalLocale = resolveLegalLocale(resolvedRouteLocale);
  const meta = legalMeta[legalLocale][page];
  const languages = Object.fromEntries(routing.locales.map((l) => [localeTags[l], `/${l}/${page}`]));

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `/${resolvedRouteLocale}/${page}`,
      languages: {
        ...languages,
        'x-default': `/ko/${page}`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `https://illowa-hotel.com/${resolvedRouteLocale}/${page}`,
      siteName: 'ILLOWA HOTEL',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: meta.title,
      description: meta.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
