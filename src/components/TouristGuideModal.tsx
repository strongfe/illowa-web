'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

const LABEL: Record<string, Record<string, string>> = {
  title: {
    ko: '안양역 관광 가이드',
    en: 'Anyang Station Travel Guide',
    ja: '安養駅 観光ガイド',
    zh: '安养站旅游指南',
    ru: 'Путеводитель по Анян',
    es: 'Guía Turística de Anyang',
    fr: 'Guide Touristique d\'Anyang',
    pt: 'Guia Turístico de Anyang',
    id: 'Panduan Wisata Anyang',
    hi: 'अनयांग पर्यटन गाइड',
  },
  subtitle: {
    ko: '호텔에서 도보권 내 즐길거리',
    en: 'Things to do within walking distance',
    ja: 'ホテルから徒歩圏内の観光スポット',
    zh: '步行即可到达的景点',
    ru: 'Достопримечательности в пешей доступности',
    es: 'Atracciones a pie desde el hotel',
    fr: 'Attractions à pied depuis l\'hôtel',
    pt: 'Atrações a pé do hotel',
    id: 'Tempat wisata yang bisa dijangkau dengan berjalan kaki',
    hi: 'होटल से पैदल दूरी पर आकर्षण',
  },
  btn: {
    ko: '관광 가이드',
    en: 'Travel Guide',
    ja: '観光ガイド',
    zh: '旅游指南',
    ru: 'Путеводитель',
    es: 'Guía',
    fr: 'Guide',
    pt: 'Guia',
    id: 'Panduan',
    hi: 'गाइड',
  },
};

const TABS = [
  { tabId: 'market', emoji: '🍱', ko: '시장 & 음식', en: 'Market & Food', ja: '市場 & 食べ物', zh: '市场 & 美食', ru: 'Рынок & Еда', es: 'Mercado & Comida', fr: 'Marché & Nourriture', pt: 'Mercado & Comida', id: 'Pasar & Makanan', hi: 'बाज़ार & खाना' },
  { tabId: 'beauty', emoji: '💄', ko: 'K-뷰티 & 쇼핑', en: 'K-Beauty & Shopping', ja: 'K-ビューティー', zh: 'K-美妆 & 购物', ru: 'K-Бьюти & Шопинг', es: 'K-Beauty & Compras', fr: 'K-Beauté & Shopping', pt: 'K-Beauty & Compras', id: 'K-Beauty & Belanja', hi: 'K-ब्यूटी & शॉपिंग' },
  { tabId: 'art', emoji: '🌳', ko: '예술 & 힐링', en: 'Art & Nature', ja: 'アート & 自然', zh: '艺术 & 自然', ru: 'Искусство & Природа', es: 'Arte & Naturaleza', fr: 'Art & Nature', pt: 'Arte & Natureza', id: 'Seni & Alam', hi: 'कला & प्रकृति' },
  { tabId: 'course', emoji: '📋', ko: '추천 코스', en: 'Recommended Course', ja: 'おすすめコース', zh: '推荐路线', ru: 'Рекомендуемый маршрут', es: 'Ruta Recomendada', fr: 'Itinéraire Recommandé', pt: 'Roteiro Recomendado', id: 'Rute yang Direkomendasikan', hi: 'अनुशंसित मार्ग' },
];

const MARKET_ITEMS = [
  {
    img: 'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&q=80',
    title: '안양중앙시장',
    en: 'Anyang Central Market',
    desc: '673개 점포 · 도보 7분',
    edesc: '673 shops · 7 min walk',
    tags: ['김밥로', '곱창골목', '떡볶이골목'],
    map: 'https://map.naver.com/v5/search/안양중앙시장',
  },
  {
    img: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=80',
    title: '누룽지',
    en: 'Nurungji (Rice Crust)',
    desc: '3,000~5,000원 · K-디저트',
    edesc: '₩3,000~5,000 · K-Dessert',
    tags: ['바삭', '고소', '포토제닉'],
    map: 'https://map.naver.com/v5/search/안양중앙시장',
  },
  {
    img: 'https://images.unsplash.com/photo-1635363638580-c2809d049eee?w=600&q=80',
    title: '떡볶이 & 어묵',
    en: 'Tteokbokki & Fish Cake',
    desc: '3,000~5,000원',
    edesc: '₩3,000~5,000',
    tags: ['골목 먹방', '길거리음식'],
    map: 'https://map.naver.com/v5/search/안양중앙시장',
  },
  {
    img: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80',
    title: '순대국 & 칼국수',
    en: 'Sundaeguk & Kalguksu',
    desc: '5,500~9,000원',
    edesc: '₩5,500~9,000',
    tags: ['노포', '가성비', '24h 일부'],
    map: 'https://map.naver.com/v5/search/안양중앙시장+순대국',
  },
];

const BEAUTY_ITEMS = [
  {
    img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&q=80',
    title: '올리브영 안양사거리점',
    en: 'Olive Young Anyang',
    desc: '도보 10분 · Tax Free 즉시환급',
    edesc: '10 min walk · Tax Free Refund',
    tags: ['선크림', '세럼', '마스크팩'],
    map: 'https://map.naver.com/v5/search/올리브영+안양사거리점',
  },
  {
    img: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&q=80',
    title: '안양지하상가 일번가몰',
    en: 'Ilbeon-ga Mall (Underground)',
    desc: '500개 점포 · 백화점 대비 30~50% 저렴',
    edesc: '500 shops · 30-50% cheaper',
    tags: ['의류', '액세서리', '화장품'],
    map: 'https://map.naver.com/v5/search/안양지하상가+일번가몰',
  },
  {
    img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&q=80',
    title: '엔터식스 & 2001아울렛',
    en: 'Enter6 & 2001 Outlet',
    desc: '안양역 직결 · 30~70% 할인',
    edesc: 'Connected to station · 30-70% off',
    tags: ['SPAO', 'Nike', 'Adidas'],
    map: 'https://map.naver.com/v5/search/엔터식스+안양',
  },
];

const ART_ITEMS = [
  {
    img: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
    title: '안양예술공원 (APAP)',
    en: 'Anyang Art Park (APAP)',
    desc: '입장 무료 · 세계 건축가 60여명 참여',
    edesc: 'Free entry · 60+ world architects',
    tags: ['알바루 시자', 'MVRDV', '스탬프투어'],
    map: 'https://map.naver.com/v5/search/안양예술공원',
  },
  {
    img: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=600&q=80',
    title: '안양천 벚꽃길',
    en: 'Anyangcheon Cherry Blossoms',
    desc: '4월 초 만개 · 약 10km 벚꽃 터널',
    edesc: 'Early April · 10km blossom tunnel',
    tags: ['봄 명소', '야간 조명', '산책로'],
    map: 'https://map.naver.com/v5/search/안양천',
  },
  {
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    title: '삼성산 트레킹',
    en: 'Samseongsan Trekking',
    desc: '왕복 2~3시간 · 계곡+작품 감상',
    edesc: '2~3 hrs round trip · Valley + Art',
    tags: ['등산', '계곡', '자연'],
    map: 'https://map.naver.com/v5/search/삼성산',
  },
];

const COURSE_STEPS = [
  { time: '10:00', icon: '🌿', place: '안양예술공원', en: 'Anyang Art Park', desc: 'APAP 작품 감상 + 스탬프투어 + 트레킹 (2~3시간)', edesc: 'Art viewing + Stamp tour + Trekking (2-3 hrs)', map: 'https://map.naver.com/v5/search/안양예술공원' },
  { time: '13:00', icon: '🍜', place: '안양중앙시장', en: 'Anyang Central Market', desc: '누룽지 + 호떡 + 어묵 + 순대국 먹방 투어', edesc: 'Street food tour: rice crust, hotteok, fish cake, sundaeguk', map: 'https://map.naver.com/v5/search/안양중앙시장' },
  { time: '15:00', icon: '💄', place: '올리브영', en: 'Olive Young', desc: 'K-뷰티 쇼핑 + Tax Free 즉시환급', edesc: 'K-Beauty shopping + instant Tax Free refund', map: 'https://map.naver.com/v5/search/올리브영+안양사거리점' },
  { time: '16:00', icon: '🛍️', place: '일번가몰 + 엔터식스', en: 'Ilbeon-ga + Enter6', desc: '패션 쇼핑 + 기념품 구매', edesc: 'Fashion shopping + souvenirs', map: 'https://map.naver.com/v5/search/안양지하상가+일번가몰' },
  { time: '17:30', icon: '🌸', place: '안양천 산책로', en: 'Anyangcheon Stream', desc: '계절별 산책 + 일몰 감상', edesc: 'Seasonal walk + sunset view', map: 'https://map.naver.com/v5/search/안양천' },
];

function dlPush(event: string, params?: Record<string, unknown>) {
  (window as unknown as { dataLayer?: object[] }).dataLayer?.push({ event, ...params });
}

export default function TouristGuideModal() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<string>('market');
  const openTimeRef = useRef<number | null>(null);

  function openGuide(source: string) {
    setOpen(true);
    openTimeRef.current = Date.now();
    dlPush('tourism_guide_open', { source });
  }

  function closeGuide() {
    setOpen(false);
    const duration_ms = openTimeRef.current ? Date.now() - openTimeRef.current : undefined;
    dlPush('tourism_guide_close', { duration_ms });
    openTimeRef.current = null;
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source ?? 'booking_cta';
      openGuide(source);
    };
    window.addEventListener('open-tourist-guide', handler);
    return () => window.removeEventListener('open-tourist-guide', handler);
  }, []);

  const isKo = locale === 'ko';
  const t = (ko: string, en: string) => (isKo ? ko : en);
  const tabLabel = (tabObj: typeof TABS[0]) => {
    const key = locale as keyof typeof tabObj;
    return (typeof tabObj[key] === 'string' ? tabObj[key] : tabObj.en) as string;
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => openGuide('fab')}
        className="fixed bottom-24 right-20 z-50 flex items-center gap-1.5 px-3 py-2.5 rounded-full shadow-lg text-xs font-semibold tracking-wide transition-transform hover:scale-105 active:scale-95"
        style={{ background: '#1a1a1a', color: '#b8964a', border: '1px solid #b8964a' }}
        aria-label="Tourist Guide"
      >
        <span>🗺️</span>
        <span>{LABEL.btn[locale] ?? LABEL.btn.en}</span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={(e) => e.target === e.currentTarget && closeGuide()}>
          <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ background: '#111' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10"
              style={{ background: 'linear-gradient(135deg, #1a1200, #2a1f00)' }}>
              <div>
                <h2 className="text-lg font-semibold tracking-wide" style={{ color: '#b8964a' }}>
                  {LABEL.title[locale] ?? LABEL.title.en}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                  {LABEL.subtitle[locale] ?? LABEL.subtitle.en}
                </p>
              </div>
              <button onClick={closeGuide}
                className="text-white/50 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {TABS.map((t) => (
                <button key={t.tabId} onClick={() => { setTab(t.tabId); dlPush('tourism_guide_tab_switch', { tab: t.tabId }); }}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    color: tab === t.tabId ? '#b8964a' : '#666',
                    borderBottom: tab === t.tabId ? '2px solid #b8964a' : '2px solid transparent',
                    background: tab === t.tabId ? 'rgba(184,150,74,0.06)' : 'transparent',
                  }}>
                  <span>{t.emoji}</span>
                  <span>{tabLabel(t)}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

              {/* Market Tab */}
              {tab === 'market' && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                    {t(
                      '안양역 도보 5~10분 거리. 673개 점포의 안양중앙시장에서 진짜 한국 길거리 음식을 체험하세요.',
                      'Walk 5-10 min from the hotel. Experience authentic Korean street food at Anyang Central Market with 673 shops.'
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {MARKET_ITEMS.map((item, i) => (
                      <div key={i} className="rounded-xl overflow-hidden cursor-pointer" style={{ background: '#1a1a1a', border: '1px solid #222' }}
                        onClick={() => dlPush('tourism_card_click', { card_name: item.en, tab: 'market' })}>
                        <div className="relative h-36 overflow-hidden">
                          <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
                          <p className="absolute bottom-2 left-3 text-white text-sm font-semibold">{isKo ? item.title : item.en}</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-xs mb-1.5" style={{ color: '#b8964a' }}>{isKo ? item.desc : item.edesc}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {item.tags.map((tag, j) => (
                              <span key={j} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#222', color: '#aaa' }}>{tag}</span>
                            ))}
                          </div>
                          <a href={item.map} target="_blank" rel="noreferrer noopener"
                            onClick={(e) => { e.stopPropagation(); dlPush('tourism_map_click', { destination: item.en, tab: 'market' }); }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                            style={{ background: 'rgba(3,199,90,0.15)', color: '#03C75A', border: '1px solid rgba(3,199,90,0.3)' }}>
                            📍 {isKo ? '네이버 지도' : 'Naver Map'}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4 text-xs leading-relaxed space-y-1" style={{ background: '#1a1a1a', color: '#aaa' }}>
                    <p className="font-semibold mb-2" style={{ color: '#b8964a' }}>💡 {t('이용 팁', 'Tips')}</p>
                    <p>• {t('영어 소통 제한적 → 파파고/Google 번역 앱 필수', 'Limited English → Use Papago/Google Translate app')}</p>
                    <p>• {t('일부 노점 카드 미사용 → 소액 현금 준비 권장', 'Some stalls are cash only → bring some cash')}</p>
                    <p>• {t('영업시간: 오전 9시~오후 7시 (일요일 일부 휴무)', 'Hours: 9AM~7PM (some closed Sundays)')}</p>
                  </div>
                </div>
              )}

              {/* Beauty Tab */}
              {tab === 'beauty' && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                    {t(
                      'K-뷰티 쇼핑과 패션 아울렛. 명동 대비 저렴하고 쾌적하게 쇼핑 가능합니다.',
                      'K-beauty and fashion shopping. More affordable and comfortable than Myeongdong.'
                    )}
                  </p>
                  <div className="space-y-3">
                    {BEAUTY_ITEMS.map((item, i) => (
                      <div key={i} className="flex gap-3 rounded-xl overflow-hidden cursor-pointer" style={{ background: '#1a1a1a', border: '1px solid #222' }}
                        onClick={() => dlPush('tourism_card_click', { card_name: item.en, tab: 'kbeauty' })}>
                        <div className="w-28 h-24 flex-shrink-0 overflow-hidden">
                          <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="py-3 pr-3 flex-1">
                          <p className="text-sm font-semibold text-white mb-1">{isKo ? item.title : item.en}</p>
                          <p className="text-xs mb-2" style={{ color: '#b8964a' }}>{isKo ? item.desc : item.edesc}</p>
                          <div className="flex flex-wrap items-center gap-1">
                            {item.tags.map((tag, j) => (
                              <span key={j} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#222', color: '#aaa' }}>{tag}</span>
                            ))}
                            <a href={item.map} target="_blank" rel="noreferrer noopener"
                              onClick={(e) => { e.stopPropagation(); dlPush('tourism_map_click', { destination: item.en, tab: 'kbeauty' }); }}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                              style={{ background: 'rgba(3,199,90,0.15)', color: '#03C75A', border: '1px solid rgba(3,199,90,0.3)' }}>
                              📍 {isKo ? '네이버 지도' : 'Naver Map'}
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4 text-xs leading-relaxed space-y-1" style={{ background: '#1a1a1a', color: '#aaa' }}>
                    <p className="font-semibold mb-2" style={{ color: '#b8964a' }}>💡 Tax Free {t('안내', 'Info')}</p>
                    <p>• {t('올리브영 1회 15,000원 이상 구매 시 부가세 즉시 환급 (6.7%)', 'Olive Young: Tax refund on purchases over ₩15,000 (6.7%)')}</p>
                    <p>• {t('여권 지참 필수', 'Bring your passport')}</p>
                  </div>
                </div>
              )}

              {/* Art Tab */}
              {tab === 'art' && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed" style={{ color: '#888' }}>
                    {t(
                      '국내 최초 공공예술 테마파크와 계절마다 다른 매력의 안양천을 즐기세요.',
                      'Enjoy Korea\'s first public art theme park and the seasonal beauty of Anyangcheon stream.'
                    )}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {ART_ITEMS.map((item, i) => (
                      <div key={i} className="rounded-xl overflow-hidden cursor-pointer" style={{ background: '#1a1a1a', border: '1px solid #222' }}
                        onClick={() => dlPush('tourism_card_click', { card_name: item.en, tab: 'art' })}>
                        <div className="relative h-44 overflow-hidden">
                          <img src={item.img} alt={item.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.1))' }} />
                          <div className="absolute bottom-3 left-4 right-4">
                            <p className="text-white font-semibold text-sm">{isKo ? item.title : item.en}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#b8964a' }}>{isKo ? item.desc : item.edesc}</p>
                          </div>
                        </div>
                        <div className="px-4 py-2.5 flex flex-wrap items-center gap-1.5">
                          {item.tags.map((tag, j) => (
                            <span key={j} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#222', color: '#aaa' }}>{tag}</span>
                          ))}
                          <a href={item.map} target="_blank" rel="noreferrer noopener"
                            onClick={(e) => { e.stopPropagation(); dlPush('tourism_map_click', { destination: item.en, tab: 'art' }); }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                            style={{ background: 'rgba(3,199,90,0.15)', color: '#03C75A', border: '1px solid rgba(3,199,90,0.3)' }}>
                            📍 {isKo ? '네이버 지도' : 'Naver Map'}
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Course Tab */}
              {tab === 'course' && (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed mb-4" style={{ color: '#888' }}>
                    {t('일로와 호텔을 베이스캠프로 안양을 하루에 알차게 즐기는 추천 코스입니다.', 'A recommended full-day itinerary using ILLOWA HOTEL as your base.')}
                  </p>
                  <div className="relative">
                    <div className="absolute left-[52px] top-0 bottom-0 w-px" style={{ background: '#333' }} />
                    <div className="space-y-4">
                      {COURSE_STEPS.map((step, i) => (
                        <div key={i} className="flex gap-4 items-start">
                          <div className="flex-shrink-0 text-right w-12">
                            <span className="text-xs font-mono" style={{ color: '#b8964a' }}>{step.time}</span>
                          </div>
                          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 text-base"
                            style={{ background: '#1a1200', border: '1px solid #b8964a40' }}>
                            {step.icon}
                          </div>
                          <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-white">{isKo ? step.place : step.en}</p>
                              <a href={step.map} target="_blank" rel="noreferrer noopener"
                                onClick={() => dlPush('tourism_map_click', { destination: step.en, tab: 'course' })}
                                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full transition-opacity hover:opacity-80"
                                style={{ background: 'rgba(3,199,90,0.15)', color: '#03C75A', border: '1px solid rgba(3,199,90,0.3)' }}>
                                📍 {isKo ? '지도' : 'Map'}
                              </a>
                            </div>
                            <p className="text-xs mt-0.5" style={{ color: '#888' }}>{isKo ? step.desc : step.edesc}</p>
                          </div>
                        </div>
                      ))}
                      {/* Return to hotel */}
                      <div className="flex gap-4 items-start">
                        <div className="flex-shrink-0 text-right w-12">
                          <span className="text-xs font-mono" style={{ color: '#b8964a' }}>19:00</span>
                        </div>
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 text-base"
                          style={{ background: '#1a1200', border: '2px solid #b8964a' }}>
                          🏨
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="text-sm font-semibold" style={{ color: '#b8964a' }}>
                            {t('일로와 호텔 귀환', 'Return to ILLOWA HOTEL')}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#888' }}>
                            {t('B1 스낵바 라면 + 넷플릭스로 마무리 🍜', 'Late-night ramen at B1 snack bar + Netflix 🍜')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
