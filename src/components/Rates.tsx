'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ratesByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Rates() {
    const locale = useLocale();
    const t = useTranslations('Rates');
    const ratesData = resolveLocalized(ratesByLocale, locale);

    return (
        <section id="rates" className="py-24 px-5 bg-dark relative">
            <div className="max-w-[1000px] mx-auto relative z-10">
                <div className="text-center mb-16">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4">{t('eyebrow')}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light">{t('title')}</h2>
                </div>

                <p className="text-center text-sm font-noto-kr mb-8 px-2" style={{ color: '#b8964a' }}>
                    {t('note_inclusions')}
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-gold/30">
                                <th className="py-4 px-4 text-gold font-noto-kr font-medium">{t('table_room_type')}</th>
                                <th className="py-4 px-4 text-gray font-noto-kr font-light">{t('table_weekday')}</th>
                                <th className="py-4 px-4 text-gray font-noto-kr font-light">{t('table_friday')}</th>
                                <th className="py-4 px-4 text-gray font-noto-kr font-light">{t('table_saturday')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ratesData.map((room) => (
                                <tr key={room.key} className="border-b border-[#222] hover:bg-white/5 transition-colors">
                                    <td className="py-5 px-4 font-noto-kr text-white font-light">
                                        {room.name}
                                    </td>
                                    <td className="py-5 px-4 font-montserrat text-white2 font-light">
                                        {room.prices.weekday} <span className="text-[10px] text-gray">{t('currency')}</span>
                                    </td>
                                    <td className="py-5 px-4 font-montserrat text-white2 font-light">
                                        {room.prices.fri} <span className="text-[10px] text-gray">{t('currency')}</span>
                                    </td>
                                    <td className="py-5 px-4 font-montserrat text-white2 font-light">
                                        {room.prices.sat} <span className="text-[10px] text-gray">{t('currency')}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 text-center text-gray text-xs font-noto-kr font-light">
                    <p>{t('note_standard_occupancy')}</p>
                    <p>{t('note_seasonal_change')}</p>
                </div>
            </div>
        </section>
    );
}
