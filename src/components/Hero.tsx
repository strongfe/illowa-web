import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function Hero() {
    const t = useTranslations('Hero');

    return (
        <section className="relative flex items-center justify-center min-h-[100svh] overflow-hidden pt-[120px] pb-20 px-5 md:p-0">
            {/* Background Gradients */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse at 30% 50%, rgba(201,168,76,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(201,168,76,0.04) 0%, transparent 50%), linear-gradient(135deg, #0A0A0A 0%, #141414 50%, #0D0D0D 100%)'
                }}
            />
            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-50"
                style={{
                    backgroundImage: 'linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }}
            />
            {/* Vertical Lines (Desktop only) */}
            <div className="hidden md:block absolute left-[60px] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-gold/30 to-transparent" />
            <div className="hidden md:block absolute right-[60px] top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-gold/30 to-transparent" />

            {/* Content */}
            <div className="relative z-10 text-center animate-fade-up">
                <p className="text-[9px] md:text-[10px] tracking-[4px] md:tracking-[8px] text-gold uppercase mb-[18px] md:mb-7 font-light">
                    {t('eyebrow')}
                </p>
                <h1 className="font-cormorant text-[clamp(56px,8vw,110px)] font-light leading-[0.9] text-white mb-2">
                    {t('title_il')}<em className="font-italic text-gold">{t('title_o')}</em>{t('title_wa')}
                </h1>
                <p className="font-noto-kr text-[clamp(14px,2vw,18px)] font-light text-gray tracking-[4px] md:tracking-[8px] mb-8 md:mb-12 mt-4">
                    {t('subtitle')}
                </p>
                <div className="w-[60px] h-[1px] bg-gold mx-auto mb-7 md:mb-12" />
                <p className="font-noto-kr text-[15px] max-md:text-[14px] text-gray font-light tracking-[3px] md:tracking-[3px] mb-12">
                    {t('desc_short')}
                </p>

                <div className="flex flex-wrap justify-center gap-3 md:gap-5">
                    <Link
                        href="#rooms"
                        className="w-full md:w-auto max-md:max-w-[320px] bg-gold text-black border-none py-3.5 px-[22px] md:py-4 md:px-12 text-[11px] tracking-[2px] md:tracking-[4px] uppercase font-montserrat font-medium hover:bg-gold-light hover:-translate-y-0.5 transition-all inline-block"
                    >
                        {t('btn_rooms')}
                    </Link>
                    <Link
                        href="#rates"
                        className="w-full md:w-auto max-md:max-w-[320px] bg-transparent text-white border border-[#F5F2EC]/30 py-3.5 px-[22px] md:py-4 md:px-12 text-[11px] tracking-[2px] md:tracking-[4px] uppercase font-montserrat font-light hover:border-gold hover:text-gold transition-all inline-block"
                    >
                        {t('btn_rates')}
                    </Link>
                </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-7 md:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-gray text-[9px] tracking-[4px] uppercase animate-bounce-slow after:content-[''] after:w-[1px] after:h-[40px] after:bg-gradient-to-b after:from-gold after:to-transparent">
                {t('scroll')}
            </div>
        </section>
    );
}
