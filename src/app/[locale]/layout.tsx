import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import ChatWidget from '@/components/ChatWidget';

type Locale = (typeof routing.locales)[number];

type LocaleMeta = {
  title: string;
  description: string;
  keywords: string;
  openGraphTitle: string;
  openGraphDescription: string;
  openGraphLocale: string;
  twitterTitle: string;
  twitterDescription: string;
};

const localeMetadata: Record<Locale, LocaleMeta> = {
  ko: {
    title: '일로와 호텔 | ILLOWA HOTEL — 안양역 5분 거리 프리미엄 숙소',
    description:
      '안양역 1호선 도보 5분 거리의 프리미엄 부티크 호텔. 전 객실 OTT 무료, 13개의 고사양 게이밍 스위트룸, 100여 종 라면 무제한 스낵바 완비.',
    keywords: '안양역 호텔, 안양 숙소, 안양역 모텔, 안양 컴퓨터 2대 모텔, 안양 게이밍 숙소, 일로와 호텔',
    openGraphTitle: '일로와 호텔 | 안양역 프리미엄 숙소',
    openGraphDescription:
      '전 객실 OTT 무료, 고사양 게이밍 스위트룸, 무제한 스낵바 완비. 일로와 호텔에서 특별한 휴식을 경험하세요.',
    openGraphLocale: 'ko_KR',
    twitterTitle: '일로와 호텔 | 안양역 5분 프리미엄 숙소',
    twitterDescription: '무료 OTT, 게이밍 스위트, 100여 종 스낵바를 갖춘 안양역 도보 5분 숙소',
  },
  en: {
    title: 'ILLOWA HOTEL | Premium stay 5 minutes from Anyang Station',
    description:
      'A premium boutique hotel 5 minutes on foot from Anyang Station (Line 1). Free OTT in all rooms, high-spec gaming suites and an unlimited snack bar.',
    keywords:
      'Anyang hotel, Anyang station hotel, boutique hotel Anyang, gaming hotel Anyang, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Premium stay near Anyang Station',
    openGraphDescription:
      'Free OTT in all rooms, high-spec gaming suites and an unlimited snack bar at ILLOWA HOTEL.',
    openGraphLocale: 'en_US',
    twitterTitle: 'ILLOWA HOTEL | Premium Stay in Anyang',
    twitterDescription: '5 minutes from Anyang Station with free OTT, gaming suites and a 100+ snack bar.',
  },
  ja: {
    title: 'ILLOWA HOTEL | 安養駅から徒歩5分のプレミアムステイ',
    description:
      '安養駅（1号線）から徒歩5分。全室無料OTT、ハイスペックゲーミングスイート、100種類以上のラーメンスナックバーを備えたプレミアムホテル。',
    keywords:
      '安養 ホテル, 安養駅 ホテル, 韓国 ブティックホテル, ゲーミングホテル, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | 安養駅近くのプレミアムホテル',
    openGraphDescription:
      '全室無料OTT、ハイスペックゲーミングスイート、100種類以上のスナックバーを完備したILLOWA HOTEL。',
    openGraphLocale: 'ja_JP',
    twitterTitle: 'ILLOWA HOTEL | 安養駅5分のプレミアムステイ',
    twitterDescription: '無料OTT、ゲーミングスイート、100種類以上のスナックバーを備えた滞在。',
  },
  zh: {
    title: 'ILLOWA HOTEL | 距离安养站步行5分钟的高端酒店',
    description:
      '位于安养站（1号线）步行5分钟处。全客房免费OTT，配备高性能电竞套房与100多种拉面无限量零食吧。',
    keywords:
      '安养酒店, 安养站酒店, 韩国精品酒店, 电竞酒店, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | 安养站附近高端住宿',
    openGraphDescription:
      '全客房免费OTT、高性能电竞套房与100多种拉面零食吧，尽在ILLOWA HOTEL。',
    openGraphLocale: 'zh_CN',
    twitterTitle: 'ILLOWA HOTEL | 安养站5分钟高端住宿',
    twitterDescription: '免费OTT、高性能电竞套房、100+拉面零食吧，步行即达安养站。',
  },
  ru: {
    title: 'ILLOWA HOTEL | Премиальный отдых в 5 минутах от станции Anyang',
    description:
      'Премиальный бутик-отель в 5 минутах пешком от станции Anyang (линия 1). Бесплатный OTT (онлайн-стриминг) во всех номерах, игровые сьюты и снек-бар с 100+ видами лапши.',
    keywords:
      'отель Anyang, отель у станции Anyang, бутик-отель Корея, игровой отель, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Премиальный отель рядом со станцией Anyang',
    openGraphDescription:
      'Бесплатный OTT (онлайн-стриминг), игровые сьюты высокой производительности и снек-бар 100+ в ILLOWA HOTEL.',
    openGraphLocale: 'ru_RU',
    twitterTitle: 'ILLOWA HOTEL | Премиальный отдых в Anyang',
    twitterDescription: '5 минут от станции Anyang: OTT бесплатно, игровые сьюты и снек-бар 100+.',
  },
  es: {
    title: 'ILLOWA HOTEL | Estancia premium a 5 minutos de Anyang Station',
    description:
      'Hotel boutique premium a 5 minutos a pie de Anyang Station (Línea 1). OTT gratis en todas las habitaciones, suites gaming de alto rendimiento y snack bar ilimitado con más de 100 ramen.',
    keywords:
      'hotel Anyang, hotel cerca de Anyang Station, hotel boutique Corea, hotel gaming, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Estancia premium cerca de Anyang Station',
    openGraphDescription:
      'OTT gratis en todas las habitaciones, suites gaming de alto rendimiento y snack bar ilimitado en ILLOWA HOTEL.',
    openGraphLocale: 'es_ES',
    twitterTitle: 'ILLOWA HOTEL | Estancia premium en Anyang',
    twitterDescription: 'A 5 minutos de Anyang Station con OTT gratis, suites gaming y snack bar ilimitado.',
  },
  fr: {
    title: 'ILLOWA HOTEL | Séjour premium à 5 minutes de la gare d’Anyang',
    description:
      'Hôtel boutique premium à 5 minutes à pied de la gare d’Anyang (ligne 1). OTT gratuit dans toutes les chambres, suites gaming hautes performances et snack-bar illimité avec plus de 100 nouilles.',
    keywords:
      'hôtel Anyang, hôtel gare Anyang, hôtel boutique Corée, hôtel gaming, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Séjour premium près de la gare d’Anyang',
    openGraphDescription:
      'OTT gratuit dans toutes les chambres, suites gaming hautes performances et snack-bar illimité à ILLOWA HOTEL.',
    openGraphLocale: 'fr_FR',
    twitterTitle: 'ILLOWA HOTEL | Séjour premium à Anyang',
    twitterDescription: 'À 5 minutes de la gare d’Anyang avec OTT gratuit, suites gaming et snack-bar illimité.',
  },
  pt: {
    title: 'ILLOWA HOTEL | Estadia premium a 5 minutos da estação Anyang',
    description:
      'Hotel boutique premium a 5 minutos a pé da estação Anyang (Linha 1). OTT grátis em todos os quartos, suítes gaming de alto desempenho e snack bar ilimitado com mais de 100 tipos de ramen.',
    keywords:
      'hotel Anyang, hotel perto da estação Anyang, hotel boutique Coreia, hotel gaming, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Estadia premium perto da estação Anyang',
    openGraphDescription:
      'OTT grátis em todos os quartos, suítes gaming de alto desempenho e snack bar ilimitado no ILLOWA HOTEL.',
    openGraphLocale: 'pt_PT',
    twitterTitle: 'ILLOWA HOTEL | Estadia premium em Anyang',
    twitterDescription: 'A 5 minutos da estação Anyang com OTT grátis, suítes gaming e snack bar ilimitado.',
  },
  id: {
    title: 'ILLOWA HOTEL | Penginapan premium 5 menit dari Stasiun Anyang',
    description:
      'Hotel butik premium 5 menit berjalan kaki dari Stasiun Anyang (Jalur 1). OTT (layanan streaming online) gratis di semua kamar, suite gaming berspesifikasi tinggi, dan snack bar mi instan 100+ pilihan.',
    keywords:
      'hotel Anyang, hotel dekat Stasiun Anyang, hotel butik Korea, hotel gaming, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | Penginapan premium dekat Stasiun Anyang',
    openGraphDescription:
      'OTT (layanan streaming online) gratis di semua kamar, suite gaming high-spec, dan snack bar 100+ pilihan di ILLOWA HOTEL.',
    openGraphLocale: 'id_ID',
    twitterTitle: 'ILLOWA HOTEL | Penginapan premium di Anyang',
    twitterDescription: '5 menit dari Stasiun Anyang dengan OTT gratis, suite gaming, dan snack bar 100+ pilihan.',
  },
  hi: {
    title: 'ILLOWA HOTEL | अनयांग स्टेशन से 5 मिनट की प्रीमियम स्टे',
    description:
      'अनयांग स्टेशन (लाइन 1) से 5 मिनट पैदल दूरी पर प्रीमियम बुटीक होटल। सभी कमरों में मुफ्त OTT (ऑनलाइन स्ट्रीमिंग सेवा), हाई-स्पेक गेमिंग सुइट्स और 100+ प्रकार के नूडल्स वाला अनलिमिटेड स्नैक बार।',
    keywords:
      'Anyang hotel, Anyang station hotel, Korea boutique hotel, gaming hotel, ILLOWA HOTEL',
    openGraphTitle: 'ILLOWA HOTEL | अनयांग स्टेशन के पास प्रीमियम होटल',
    openGraphDescription:
      'सभी कमरों में मुफ्त OTT (ऑनलाइन स्ट्रीमिंग सेवा), हाई-स्पेक गेमिंग सुइट्स और 100+ स्नैक बार के साथ ILLOWA HOTEL।',
    openGraphLocale: 'hi_IN',
    twitterTitle: 'ILLOWA HOTEL | अनयांग में प्रीमियम स्टे',
    twitterDescription: 'अनयांग स्टेशन से 5 मिनट, मुफ्त OTT, गेमिंग सुइट्स और 100+ स्नैक बार के साथ।',
  },
};

const localeTags: Record<Locale, string> = {
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

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

function resolveLocale(input: string): Locale | null {
  const candidate = input.toLowerCase().split('-')[0];
  return hasLocale(routing.locales, candidate) ? (candidate as Locale) : null;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale) ?? routing.defaultLocale;
  const meta = localeMetadata[resolvedLocale] ?? localeMetadata[routing.defaultLocale];
  const languages = Object.fromEntries(
    routing.locales.map((l) => [localeTags[l], `/${l}`])
  );

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: {
      canonical: `/${resolvedLocale}`,
      languages: {
        ...languages,
        'x-default': '/ko',
      },
    },
    openGraph: {
      title: meta.openGraphTitle,
      description: meta.openGraphDescription,
      url: `https://illowa-hotel.com/${resolvedLocale}`,
      siteName: 'ILLOWA HOTEL',
      locale: meta.openGraphLocale,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: meta.twitterTitle,
      description: meta.twitterDescription,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  const resolvedLocale = resolveLocale(locale);

  if (!resolvedLocale) {
    notFound();
  }

  setRequestLocale(resolvedLocale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
      {children}
      <ChatWidget />
    </NextIntlClientProvider>
  );
}
