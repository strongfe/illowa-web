import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { galleryByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Gallery() {
    const locale = useLocale();
    const t = useTranslations('Gallery');
    const galleryData = resolveLocalized(galleryByLocale, locale);

    return (
        <section id="gallery" className="py-24 px-5 bg-dark">
            <div className="max-w-[1200px] mx-auto">
                <div className="text-center mb-16">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4">{t('eyebrow')}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light">{t('title')}</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {galleryData.map((item, i) => (
                        <div key={i} className="group relative h-[200px] md:h-[280px] overflow-hidden rounded-sm cursor-pointer border border-[#222]">
                            <Image
                                src={item.src}
                                alt={item.label}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white font-noto-kr text-sm border border-gold/50 px-4 py-2">{item.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
