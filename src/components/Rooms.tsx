'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import RoomModal from './RoomModal';
import linksData from '@/data/bookingLinks.json';
import {
    resolveLocalized,
    roomsByLocale as localizedRoomsByLocale
} from '@/data/content/localeData';

type RoomKey = keyof typeof localizedRoomsByLocale.ko;

const TABS = [
    { id: 'all', labelKey: 'tab_all' },
    { id: 'standard', labelKey: 'tab_standard' },
    { id: 'gaming', labelKey: 'tab_gaming' },
    { id: 'premier', labelKey: 'tab_premier' },
    { id: 'special', labelKey: 'tab_special' },
];

export default function Rooms() {
    const [activeTab, setActiveTab] = useState('all');
    const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
    const locale = useLocale();
    const t = useTranslations('Rooms');
    const roomsData = resolveLocalized(localizedRoomsByLocale, locale);

    const filterRooms = () => {
        const entries = Object.entries(roomsData) as [RoomKey, any][];
        switch (activeTab) {
            case 'standard':
                return entries.filter(([k]) => ['std', 'dlx'].includes(k));
            case 'gaming':
                return entries.filter(([k]) => ['gstd', 'gdlx'].includes(k));
            case 'premier':
                return entries.filter(([k]) => ['pm', 'pmt'].includes(k));
            case 'special':
                return entries.filter(([k]) => ['dj', 'lstd', 'ldlx', 'lpm', 'lpmt'].includes(k));
            default:
                return entries;
        }
    };

    const filtered = filterRooms();

    return (
        <section id="rooms" className="py-24 px-5 bg-black">
            <div className="max-w-[1200px] mx-auto">
                <div className="text-center mb-12">
                    <p className="text-gold text-[10px] tracking-[4px] uppercase mb-4">{t('eyebrow')}</p>
                    <h2 className="font-cormorant text-4xl text-white font-light">{t('title')}</h2>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap justify-center gap-2 mb-12" role="tablist">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-3 px-5 md:px-7 text-[12px] md:text-sm transition-all rounded-sm border ${activeTab === tab.id
                                ? 'border-gold bg-gold/10 text-gold font-medium'
                                : 'border-[#333] text-gray hover:text-white hover:border-gray'
                                }`}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>

                {/* Room Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(([key, room]) => (
                        <div
                            key={key}
                            className="bg-dark2 rounded-sm overflow-hidden group cursor-pointer border border-[#333] hover:border-gold/50 transition-all"
                            onClick={() => setSelectedRoom(room)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') setSelectedRoom(room); }}
                        >
                            <div className="relative h-[250px] w-full overflow-hidden">
                                <Image
                                    src={room.photos[0]}
                                    alt={room.name}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                                <div className="absolute top-4 left-4 bg-black/80 px-3 py-1 text-gold text-[10px] tracking-[2px] backdrop-blur-sm">
                                    {room.badge}
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="text-gray text-[10px] tracking-[2px] uppercase mb-2">{room.sub}</div>
                                <h3 className="text-xl text-white font-noto-kr mb-4">{room.name}</h3>
                                <ul className="grid grid-cols-2 gap-2 mb-6">
                                    {room.feats.slice(0, 4).map((feat: string, i: number) => (
                                        <li key={i} className="text-gray2 text-[12px] flex items-center gap-2">
                                            <span className="w-1 h-1 bg-gold rounded-full" />
                                            {feat}
                                        </li>
                                    ))}
                                </ul>
                                <div className="flex items-center justify-between pt-4 border-t border-[#333] group-hover:border-gold/30 transition-colors">
                                    <div className="flex items-center gap-1 text-gold text-sm font-noto-kr">
                                        {t('view_details')}
                                        <ChevronRight className="text-gold w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    <a
                                        href={linksData.booking}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-gold text-black text-[11px] font-semibold tracking-wide px-4 py-1.5 hover:bg-gold-light transition-colors"
                                        data-track="click_room_card_booking"
                                    >
                                        {t('book_now')}
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedRoom && (
                <RoomModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
            )}
        </section>
    );
}
