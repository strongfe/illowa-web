import { useLocale, useTranslations } from 'next-intl';
import { contactByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Information() {
    const t = useTranslations('Information');
    const locale = useLocale();
    const contactData = resolveLocalized(contactByLocale, locale);

    return (
        <section id="contact" className="py-24 px-5 bg-black border-t border-[#111]">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-12">
                {/* Map Placeholder */}
                <div className="md:w-1/2 h-[400px] bg-[#1a1a1a] rounded-sm relative border border-gold/30 flex items-center justify-center flex-col">
                    <div className="text-gold text-4xl mb-4">📍</div>
                    <p className="text-white2 font-noto-kr">{t('map_placeholder')}</p>
                    <div className="flex gap-4 mt-6">
                        <a href={contactData.map_links.naver} target="_blank" rel="noreferrer" className="text-black bg-gold py-2 px-6 text-sm font-noto-kr">{t('map_naver')}</a>
                        <a href={contactData.map_links.kakao} target="_blank" rel="noreferrer" className="text-black bg-white py-2 px-6 text-sm font-noto-kr">{t('map_kakao')}</a>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="md:w-1/2 flex flex-col justify-center">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4">{t('eyebrow')}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light mb-10">{t('title')}</h2>

                    <div className="space-y-6">
                        <div>
                            <h4 className="text-gray text-[11px] tracking-[2px] uppercase mb-1 font-montserrat">{t('label_address')}</h4>
                            <p className="text-white2 font-noto-kr font-light tracking-wide">{contactData.address}</p>
                        </div>
                        <div>
                            <h4 className="text-gray text-[11px] tracking-[2px] uppercase mb-1 font-montserrat">{t('label_transport')}</h4>
                            <p className="text-white2 font-noto-kr font-light tracking-wide">{contactData.transport}</p>
                        </div>
                        <div>
                            <h4 className="text-gray text-[11px] tracking-[2px] uppercase mb-1 font-montserrat">{t('label_contact_frontdesk')}</h4>
                            <p className="text-gold text-xl font-montserrat tracking-wider mb-1">{contactData.phone}</p>
                            <p className="text-white2 font-noto-kr font-light tracking-wide">{contactData.front_desk}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
