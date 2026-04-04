import { useLocale, useTranslations } from 'next-intl';
import { contactByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Information() {
    const t = useTranslations('Information');
    const locale = useLocale();
    const contactData = resolveLocalized(contactByLocale, locale);

    return (
        <section id="contact" className="py-24 px-5 bg-black border-t border-[#111]">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-12">
                {/* Map Embed */}
                <div className="md:w-1/2 h-[400px] rounded-sm relative border border-gold/30 overflow-hidden">
                    <iframe
                        src="https://maps.google.com/maps?q=경기도+안양시+만안구+안양로268번길+41&z=17&hl=ko&output=embed"
                        width="100%"
                        height="100%"
                        style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title="ILLOWA Hotel Location"
                    />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                        <a href={contactData.map_links.naver} target="_blank" rel="noreferrer"
                            className="text-black bg-gold py-2 px-5 text-xs font-noto-kr shadow-lg hover:bg-gold-light transition-colors">
                            {t('map_naver')}
                        </a>
                        <a href={contactData.map_links.kakao} target="_blank" rel="noreferrer"
                            className="text-black bg-white py-2 px-5 text-xs font-noto-kr shadow-lg hover:bg-gray-100 transition-colors">
                            {t('map_kakao')}
                        </a>
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
