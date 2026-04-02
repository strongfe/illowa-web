import type { Metadata } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import { hasLocale } from 'next-intl';
import { Analytics } from '@vercel/analytics/react';
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

/* ── 트래킹 ID ── */
const GTM_ID = 'GTM-KS2PGX4';
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';             // G-XXXXXXXXXX
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || ''; // 15자리 숫자

/* ── Schema.org 구조화 데이터 ── */
const HOTEL_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Hotel',
  name: '일로와 호텔 (ILLOWA HOTEL)',
  alternateName: 'illOwa Hotel',
  description:
    '안양역 1호선 도보 5분 거리의 프리미엄 부티크 호텔. 전 객실 무료 OTT(넷플릭스, 웨이브, 티빙), RTX 3060 고사양 게이밍 스위트룸 13개, 100여 종 컵라면 24시간 무제한 스낵바 완비.',
  url: 'https://www.illowa-hotel.com',
  telephone: '+82-503-5051-6355',
  email: 'chon9129@naver.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '안양로268번길 41',
    addressLocality: '안양시 만안구',
    addressRegion: '경기도',
    postalCode: '14070',
    addressCountry: 'KR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 37.4013,
    longitude: 126.9218,
  },
  numberOfRooms: 42,
  priceRange: '₩50,000 - ₩99,000',
  currenciesAccepted: 'KRW, CNY',
  paymentAccepted: 'Cash, Credit Card, UnionPay, Corporate Card',
  checkinTime: '18:00',
  checkoutTime: '12:00',
  starRating: { '@type': 'Rating', ratingValue: '3' },
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: '무료 OTT (넷플릭스, 웨이브, 티빙)', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'RTX 3060 게이밍 PC 2대 (듀얼모니터)', value: true },
    { '@type': 'LocationFeatureSpecification', name: '100여 종 컵라면 24시간 무제한 스낵바', value: true },
    { '@type': 'LocationFeatureSpecification', name: '안마의자 (프리미어 객실)', value: true },
    { '@type': 'LocationFeatureSpecification', name: '대형 욕조 & 레인샤워', value: true },
    { '@type': 'LocationFeatureSpecification', name: '무료 초고속 와이파이', value: true },
    { '@type': 'LocationFeatureSpecification', name: '웰컴 치즈케이크 & 원두커피', value: true },
    { '@type': 'LocationFeatureSpecification', name: '세스코 위생관리 & 매일 새 침구', value: true },
    { '@type': 'LocationFeatureSpecification', name: '24시간 중국어 응대', value: true },
  ],
  availableLanguage: [
    { '@type': 'Language', name: 'Korean' },
    { '@type': 'Language', name: 'English' },
    { '@type': 'Language', name: 'Chinese' },
    { '@type': 'Language', name: 'Japanese' },
  ],
  sameAs: [
    'https://www.instagram.com/illowa_hotel/',
    'https://nol.yanolja.com/stay/domestic/3013391',
    'https://www.yeogi.com/domestic-accommodations/2760',
  ],
};

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '일로와 호텔 체크인/체크아웃 시간은?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '체크인은 오후 6시, 체크아웃은 정오 12시입니다. 연박 상품의 경우 레이트 체크아웃이 가능합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '게이밍룸에 어떤 PC가 있나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'RTX 3060 그래픽카드, 12세대 Intel i5 프로세서, 듀얼모니터가 장착된 고사양 PC 2대가 구비되어 있습니다. 총 13개 게이밍 스위트룸을 운영합니다.',
      },
    },
    {
      '@type': 'Question',
      name: '스낵바는 무료인가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, B1층 100여 종 컵라면을 24시간 무제한 무료로 이용할 수 있습니다. 매일 아침에는 계란, 만두 조식도 제공됩니다.',
      },
    },
    {
      '@type': 'Question',
      name: '안양역에서 얼마나 걸리나요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '수도권 1호선 안양역 1번 출구에서 도보 약 5분(500m) 거리에 위치해 있습니다.',
      },
    },
    {
      '@type': 'Question',
      name: '법인카드 결제가 가능한가요?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '네, 법인카드 결제 및 세금계산서 발급이 모두 가능합니다.',
      },
    },
  ],
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
      <head>
        {/* ── Schema.org 구조화 데이터 ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(HOTEL_SCHEMA) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
        />
      </head>
      <body className="antialiased bg-[#0A0A0A] text-[#F5F2EC] font-montserrat overflow-x-hidden">
        {/* ── Google Tag Manager (noscript fallback) ── */}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}

        {children}
        <Analytics />

        {/* ── Google Tag Manager ── */}
        {GTM_ID && (
          <Script
            id="gtm"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}

        {/* ── Google Analytics 4 (GTM 미사용 시 직접 로드) ── */}
        {GA_ID && !GTM_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
                  gtag('js',new Date());gtag('config','${GA_ID}');`,
              }}
            />
          </>
        )}

        {/* ── Meta Pixel (GTM 미사용 시 직접 로드) ── */}
        {META_PIXEL_ID && !GTM_ID && (
          <Script
            id="meta-pixel"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
                n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
                (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`,
            }}
          />
        )}
      </body>
    </html>
  );
}
