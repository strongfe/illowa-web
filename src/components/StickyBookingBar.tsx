'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import linksData from '@/data/bookingLinks.json';

const LABEL: Record<string, { book: string; call: string; tagline: string }> = {
  ko: { book: '지금 예약하기', call: '전화 예약', tagline: '오늘 일로와에서 특별한 하루를' },
  en: { book: 'Book Now', call: 'Call Us', tagline: 'Make today special at ILLOWA' },
  ja: { book: '今すぐ予約', call: '電話予約', tagline: 'ILLOWAで特別な一日を' },
  zh: { book: '立即预订', call: '电话预订', tagline: '在ILLOWA享受特别的一天' },
  ru: { book: 'Забронировать', call: 'Позвонить', tagline: 'Особый день в ILLOWA' },
  es: { book: 'Reservar', call: 'Llamar', tagline: 'Un día especial en ILLOWA' },
  fr: { book: 'Réserver', call: 'Appeler', tagline: 'Une journée spéciale à ILLOWA' },
  pt: { book: 'Reservar', call: 'Ligar', tagline: 'Um dia especial no ILLOWA' },
  id: { book: 'Pesan Sekarang', call: 'Hubungi', tagline: 'Hari istimewa di ILLOWA' },
  hi: { book: 'अभी बुक करें', call: 'कॉल करें', tagline: 'ILLOWA में खास दिन बिताएं' },
};

export default function StickyBookingBar() {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);
  const label = LABEL[locale] ?? LABEL.en;

  useEffect(() => {
    const onScroll = () => {
      // 히어로 영역(600px) 지나면 표시, 예약 섹션(페이지 끝 700px)에서 숨김
      const scrollY = window.scrollY;
      const nearBottom = document.body.scrollHeight - window.innerHeight - scrollY < 700;
      setVisible(scrollY > 600 && !nearBottom);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-3 md:px-8"
      style={{
        background: 'rgba(10,10,10,0.97)',
        borderTop: '1px solid rgba(201,168,76,0.3)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <p className="hidden md:block text-xs tracking-wide" style={{ color: '#888' }}>
        {label.tagline}
      </p>
      <div className="flex items-center gap-2 w-full md:w-auto">
        <a
          href={linksData.direct_call}
          className="flex-1 md:flex-none text-center py-2.5 px-5 text-sm font-semibold tracking-wide border transition-colors"
          style={{ borderColor: '#b8964a', color: '#b8964a' }}
          data-track="click_sticky_call"
        >
          {label.call}
        </a>
        <a
          href={linksData.booking}
          target="_blank"
          rel="noreferrer noopener"
          className="flex-1 md:flex-none text-center py-2.5 px-6 text-sm font-semibold tracking-wide transition-colors"
          style={{ background: '#b8964a', color: '#000' }}
          data-track="click_sticky_booking"
        >
          {label.book}
        </a>
      </div>
    </div>
  );
}
