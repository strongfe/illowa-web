import { useTranslations } from 'next-intl';

export default function ChineseSection() {
    const t = useTranslations('ChineseSection');

    return (
        <section className="py-24 px-5 bg-[#000] border-t border-[#111]">
            <div className="max-w-[800px] mx-auto text-center">
                <h2 className="font-noto-sc text-3xl md:text-4xl text-gold font-light mb-8">{t('title')}</h2>
                <p className="font-noto-sc text-gray text-sm md:text-base leading-loose mb-12">
                    {t('line1')}<br />
                    {t('line2')}<br />
                    {t('line3')}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                    <div className="bg-dark py-3 px-6 border border-gold/20 rounded-sm">
                        <span className="text-gold text-lg mr-2">✓</span>
                        <span className="text-white2 font-noto-sc text-sm">{t('badge_cn_service')}</span>
                    </div>
                    <div className="bg-dark py-3 px-6 border border-gold/20 rounded-sm">
                        <span className="text-gold text-lg mr-2">✓</span>
                        <span className="text-white2 font-noto-sc text-sm">{t('badge_anyang_5min')}</span>
                    </div>
                    <div className="bg-dark py-3 px-6 border border-gold/20 rounded-sm">
                        <span className="text-gold text-lg mr-2">✓</span>
                        <span className="text-white2 font-noto-sc text-sm">{t('badge_unionpay')}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
