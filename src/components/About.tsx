import { useLocale } from 'next-intl';
import { aboutByLocale, resolveLocalized } from '@/data/content/localeData';

export default function About() {
    const locale = useLocale();
    const content = resolveLocalized(aboutByLocale, locale);

    return (
        <section className="py-24 px-5 bg-black relative overflow-hidden" id="about">
            <div className="max-w-[800px] mx-auto text-center relative z-10">
                <p className="text-gold text-[10px] tracking-[4px] uppercase mb-6 font-light">{content.eyebrow}</p>
                <h2 className="font-noto-kr text-2xl md:text-4xl text-white font-light leading-relaxed mb-12">
                    {content.title}
                </h2>
                <p className="font-noto-kr text-sm md:text-base text-gray font-light leading-loose mb-16">
                    {content.description.map((line, i) => (
                        <span key={i}>
                            {line}
                            {i < content.description.length - 1 ? <><br className="hidden md:block" /></> : null}
                        </span>
                    ))}
                </p>
            </div>
        </section>
    );
}
