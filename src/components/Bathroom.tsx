import Image from 'next/image';
import { useLocale } from 'next-intl';
import { bathroomByLocale, resolveLocalized } from '@/data/content/localeData';

export default function Bathroom() {
    const locale = useLocale();
    const content = resolveLocalized(bathroomByLocale, locale);

    return (
        <section className="py-24 px-5 bg-black border-t border-[#222]">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row-reverse items-center gap-12">
                <div className="md:w-1/2">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4 font-light">{content.eyebrow}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light mb-6">{content.title}</h2>
                    <p className="font-noto-kr text-gray font-light leading-loose mb-8">
                        {content.description.map((line, i) => (
                            <span key={i}>
                                {line}
                                {i < content.description.length - 1 ? <><br /></> : null}
                            </span>
                        ))}
                    </p>
                    <ul className="text-white2 font-noto-kr font-light text-sm space-y-3">
                        {content.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-3"><span className="text-gold">✓</span>{feature}</li>
                        ))}
                    </ul>
                </div>
                <div className="md:w-1/2 w-full mt-8 md:mt-0 relative h-[400px] rounded-sm overflow-hidden border border-[#333]">
                    <Image
                        src={content.image.src}
                        alt={content.image.alt}
                        fill
                        className="object-cover"
                    />
                </div>
            </div>
        </section>
    );
}
