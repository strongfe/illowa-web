'use client';

import { useLocale, useTranslations } from 'next-intl';
import { amenitiesByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Amenities() {
    const locale = useLocale();
    const t = useTranslations('Amenities');
    const amenitiesData = resolveLocalized(amenitiesByLocale, locale);

    return (
        <section id="amenities" className="py-24 px-5 bg-black">
            <div className="max-w-[1200px] mx-auto">
                <div className="text-center mb-16">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4">{t('eyebrow')}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light">{t('title')}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-12">
                    {amenitiesData.map((item, i) => (
                        <div key={i} className="flex gap-5 group">
                            <div className="w-[60px] h-[60px] shrink-0 border border-gold/30 rounded-full flex items-center justify-center text-2xl group-hover:border-gold group-hover:bg-gold/5 transition-all">
                                {item.icon}
                            </div>
                            <div className="pt-2">
                                <h3 className="text-white font-noto-kr text-lg mb-2 group-hover:text-gold transition-colors">{item.title}</h3>
                                <p className="text-gray text-sm font-noto-kr font-light leading-relaxed whitespace-pre-line">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
