import { useLocale, useTranslations } from 'next-intl';
import { contactByLocale, resolveLocalized } from '@/data/content/localeData';
import { Link } from '@/i18n/routing';

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
