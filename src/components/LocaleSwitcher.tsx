'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

const LOCALES = ['ko', 'en', 'ja', 'zh', 'ru', 'es', 'fr', 'pt', 'id', 'hi'] as const;

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border border-gold/30 bg-black/40 px-1.5 py-1">
      {LOCALES.map((targetLocale) => {
        const active = locale === targetLocale;
        return (
          <Link
            key={targetLocale}
            href={pathname}
            locale={targetLocale}
            className={`px-2 py-1 text-[10px] tracking-[1.5px] uppercase transition-colors ${
              active ? 'bg-gold text-black' : 'text-gold hover:text-white'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {targetLocale}
          </Link>
        );
      })}
    </div>
  );
}
