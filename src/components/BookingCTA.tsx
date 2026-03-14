import linksData from '@/data/bookingLinks.json';
import { useTranslations } from 'next-intl';

export default function BookingCTA() {
    const t = useTranslations('BookingCTA');
    const groups = [
        {
            title: t('group_primary_title'),
            description: t('group_primary_description'),
            containerClass: 'border-gold/40 bg-gold/5',
            badgeClass: 'bg-gold text-black',
            buttons: [
                { href: linksData.google_hotels, label: t('btn_google_hotels'), subLabel: t('sub_google_hotels'), badge: t('badge_priority'), buttonClass: 'bg-[#188038] hover:bg-[#146C30]', track: 'click_booking_google_hotels' },
                { href: linksData.booking, label: t('btn_booking'), subLabel: t('sub_booking'), badge: t('badge_priority'), buttonClass: 'bg-[#003B95] hover:bg-[#003179]', track: 'click_booking_bookingdotcom' },
                { href: linksData.agoda, label: t('btn_agoda'), subLabel: t('sub_agoda'), badge: t('badge_priority'), buttonClass: 'bg-[#D61F3B] hover:bg-[#BA1A33]', track: 'click_booking_agoda' }
            ]
        },
        {
            title: t('group_secondary_title'),
            description: t('group_secondary_description'),
            containerClass: 'border-sky-500/35 bg-sky-500/5',
            badgeClass: 'bg-sky-500 text-white',
            buttons: [
                { href: linksData.tripcom, label: t('btn_tripcom'), subLabel: t('sub_tripcom'), badge: t('badge_secondary'), buttonClass: 'bg-[#287DFA] hover:bg-[#1F67D1]', track: 'click_booking_tripcom' },
                { href: linksData.expedia, label: t('btn_expedia'), subLabel: t('sub_expedia'), badge: t('badge_secondary'), buttonClass: 'bg-[#00355F] hover:bg-[#002B4D]', track: 'click_booking_expedia' },
                { href: linksData.hotelscombined, label: t('btn_hotelscombined'), subLabel: t('sub_hotelscombined'), badge: t('badge_secondary'), buttonClass: 'bg-[#0A9E9A] hover:bg-[#088884]', track: 'click_booking_hotelscombined' }
            ]
        },
        {
            title: t('group_support_title'),
            description: t('group_support_description'),
            containerClass: 'border-white/20 bg-white/[0.03]',
            badgeClass: 'bg-white/15 text-white',
            buttons: [
                { href: linksData.tripadvisor, label: t('btn_tripadvisor'), subLabel: t('sub_tripadvisor'), badge: t('badge_reference'), buttonClass: 'bg-[#34E0A1] hover:bg-[#2EC390] text-black', track: 'click_booking_tripadvisor' },
                { href: linksData.yanolja, label: t('btn_yanolja'), subLabel: t('sub_yanolja'), badge: t('badge_local'), buttonClass: 'bg-[#FF0055] hover:bg-[#E6004D]', track: 'click_booking_yanolja' },
                { href: linksData.yeogi, label: t('btn_yeogi'), subLabel: t('sub_yeogi'), badge: t('badge_local'), buttonClass: 'bg-[#F21F3A] hover:bg-[#D91C34]', track: 'click_booking_yeogi' }
            ]
        }
    ];

    return (
        <section className="py-24 px-5 bg-dark relative overflow-hidden border-t border-[#222]">
            {/* Background Gradients */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(circle at 50% 50%, rgba(201,168,76,0.1) 0%, transparent 50%)'
                }}
            />
            <div className="max-w-[800px] mx-auto text-center relative z-10">
                <h2 className="font-cormorant text-4xl md:text-5xl text-gold font-light mb-6">{t('title')}</h2>
                <p className="font-noto-kr text-gray font-light mb-12">
                    {t('description_line1')}<br />
                    {t('description_line2')}
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
                    {groups.map((group) => (
                        <article key={group.title} className={`rounded-xl border p-4 sm:p-5 text-left ${group.containerClass}`}>
                            <h3 className="text-white font-montserrat tracking-wide text-sm uppercase mb-2">{group.title}</h3>
                            <p className="text-gray text-xs font-noto-kr mb-4">{group.description}</p>
                            <div className="space-y-3">
                                {group.buttons.map((button) => (
                                    <a
                                        key={button.track}
                                        href={button.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        aria-label={t('aria_open_platform', { platform: button.label })}
                                        className={`block w-full rounded-lg px-4 py-3 transition-colors ${button.buttonClass}`}
                                        data-track={button.track}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-montserrat text-sm tracking-wide">{button.label}</span>
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide ${group.badgeClass}`}>
                                                {button.badge}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-[11px] font-noto-kr opacity-90">{button.subLabel}</p>
                                    </a>
                                ))}
                            </div>
                        </article>
                    ))}
                </div>

                <div className="mt-5">
                    <a
                        href={linksData.direct_call}
                        aria-label={t('aria_call')}
                        className="block w-full rounded-xl py-4 bg-gold text-black font-noto-kr tracking-wide text-sm font-medium hover:bg-gold-light transition-colors text-center"
                        data-track="click_call_footer"
                    >
                        {t('btn_call')}
                    </a>
                </div>
            </div>
        </section>
    );
}
