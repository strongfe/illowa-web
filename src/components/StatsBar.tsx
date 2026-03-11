import { useTranslations } from 'next-intl';

export default function StatsBar() {
    const t = useTranslations('StatsBar');

    return (
        <div className="flex bg-dark py-8 justify-center gap-8 md:gap-24 border-y border-gold/20">
            <div className="text-center">
                <div className="text-gold font-cormorant text-3xl md:text-5xl font-light mb-2">42</div>
                <div className="text-[10px] md:text-xs tracking-[3px] text-white2 font-light">{t('premium_suites')}</div>
            </div>
            <div className="text-center">
                <div className="text-gold font-cormorant text-3xl md:text-5xl font-light mb-2">13</div>
                <div className="text-[10px] md:text-xs tracking-[3px] text-white2 font-light">{t('gaming_rooms')}</div>
            </div>
            <div className="text-center">
                <div className="text-gold font-cormorant text-3xl md:text-5xl font-light mb-2">100<span className="text-2xl">+</span></div>
                <div className="text-[10px] md:text-xs tracking-[3px] text-white2 font-light">{t('snack_bar')}</div>
            </div>
        </div>
    );
}
