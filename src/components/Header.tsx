'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import LocaleSwitcher from './LocaleSwitcher';

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const locale = useLocale();
    const t = useTranslations('Header');

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 60);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            <nav
                className={`fixed top-0 left-0 right-0 z-50 flex justify-between items-center py-6 px-4 md:px-15 transition-all duration-400 ${scrolled
                        ? 'bg-[#0A0A0A]/95 py-4 border-b border-[#C9A84C]/15'
                        : 'bg-gradient-to-b from-[#0A0A0A]/95 to-transparent'
                    }`}
            >
                <Link href={`/${locale}`} className="font-cormorant text-[18px] md:text-[22px] font-light tracking-[4px] md:tracking-[6px] text-gold uppercase">
                    {t('brand_main')} <span className="italic text-white">{t('brand_sub')}</span>
                </Link>

                {/* Desktop Links */}
                <ul className="hidden md:flex gap-10 list-none">
                    <li><Link href="#rooms" className="text-white2 text-[11px] tracking-[3px] uppercase font-light hover:text-gold transition-colors">{t('nav_rooms')}</Link></li>
                    <li><Link href="#rates" className="text-white2 text-[11px] tracking-[3px] uppercase font-light hover:text-gold transition-colors">{t('nav_rates')}</Link></li>
                    <li><Link href="#amenities" className="text-white2 text-[11px] tracking-[3px] uppercase font-light hover:text-gold transition-colors">{t('nav_amenities')}</Link></li>
                    <li><Link href="#gallery" className="text-white2 text-[11px] tracking-[3px] uppercase font-light hover:text-gold transition-colors">{t('nav_gallery')}</Link></li>
                    <li><Link href="#contact" className="text-white2 text-[11px] tracking-[3px] uppercase font-light hover:text-gold transition-colors">{t('nav_contact')}</Link></li>
                </ul>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden md:block">
                        <LocaleSwitcher />
                    </div>
                    <a
                        href="tel:031-464-9661"
                        className="bg-transparent border border-gold text-gold py-2 px-3 md:py-2.5 md:px-7 text-[10px] tracking-[2px] md:tracking-[3px] uppercase font-montserrat hover:bg-gold hover:text-black transition-all whitespace-nowrap"
                        data-track="click_call_header"
                    >
                        {t('cta_call')}
                    </a>
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden flex w-10 h-10 border border-gold/35 bg-[#0A0A0A]/90 text-gold items-center justify-center"
                        aria-label={t('menu_aria')}
                        aria-expanded={mobileOpen}
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Nav Panel */}
            {mobileOpen && (
                <div className="fixed top-[74px] left-4 right-4 z-[160] p-4 bg-[#0A0A0A]/98 border border-gold/20 backdrop-blur-md shadow-2xl md:hidden">
                    <div className="mb-3">
                        <LocaleSwitcher />
                    </div>
                    <ul className="grid gap-2.5 list-none">
                        <li><Link href="#rooms" onClick={() => setMobileOpen(false)} className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_rooms')}</Link></li>
                        <li><Link href="#rates" onClick={() => setMobileOpen(false)} className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_rates')}</Link></li>
                        <li><Link href="#amenities" onClick={() => setMobileOpen(false)} className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_amenities')}</Link></li>
                        <li><Link href="#gallery" onClick={() => setMobileOpen(false)} className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_gallery')}</Link></li>
                        <li><Link href="#contact" onClick={() => setMobileOpen(false)} className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_contact')}</Link></li>
                        <li><a href="tel:031-464-9661" className="block py-3 px-3.5 text-white2 text-[12px] tracking-[2px] uppercase border border-gold/10 bg-white/5 hover:text-gold hover:border-gold/25">{t('mobile_call')}</a></li>
                    </ul>
                </div>
            )}
        </>
    );
}
