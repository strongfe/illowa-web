import { useLocale, useTranslations } from 'next-intl';
import { contactByLocale, resolveLocalized } from '@/data/content/localeData';
import { Link } from '@/i18n/routing';

function InstagramIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
    );
}

export default function Footer() {
    const t = useTranslations('Footer');
    const locale = useLocale();
    const contactData = resolveLocalized(contactByLocale, locale);

    return (
        <footer className="bg-black border-t border-[#111] py-16 px-5">
            <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-center md:text-left">
                    <h2 className="font-cormorant text-2xl text-gold font-light mb-4 tracking-widest uppercase">{t('brand')}</h2>
                    <p className="font-noto-kr text-gray text-xs leading-relaxed">
                        {t('company_name')} : {contactData.business_name} &nbsp;|&nbsp; {t('representative')} : {contactData.representative}<br />
                        {t('business_number')} : {contactData.business_number}<br />
                        {t('address')} : {contactData.address}<br />
                        {t('phone')} : {contactData.phone} &nbsp;|&nbsp; {t('email')} : {contactData.email}
                    </p>
                    {/* SNS Links */}
                    <div className="flex gap-4 mt-4 justify-center md:justify-start">
                        <a
                            href="https://www.instagram.com/illowa_hotel/"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Instagram"
                            className="text-gray hover:text-gold transition-colors"
                        >
                            <InstagramIcon />
                        </a>
                    </div>
                </div>
                <div className="text-gray text-[10px] tracking-[2px] font-montserrat flex flex-col items-center md:items-end gap-2">
                    <span>&copy; {new Date().getFullYear()} ILLOWA HOTEL. {t('rights_reserved')}</span>
                    <div className="flex gap-4 mt-2">
                        <Link href={{ pathname: '/terms' }} locale={locale} className="hover:text-white transition-colors">{t('terms')}</Link>
                        <Link href={{ pathname: '/privacy' }} locale={locale} className="hover:text-white transition-colors">{t('privacy')}</Link>
                        <Link href={{ pathname: '/cookies' }} locale={locale} className="hover:text-white transition-colors">{t('cookies')}</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
