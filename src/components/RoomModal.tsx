'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface RoomModalProps {
    room: any;
    onClose: () => void;
}

export default function RoomModal({ room, onClose }: RoomModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const t = useTranslations('RoomModal');

    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';

        // Focus trap setup
        const modalElement = modalRef.current;
        if (modalElement) {
            modalElement.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalStyle;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div
                ref={modalRef}
                tabIndex={-1}
                className="relative w-full max-w-4xl bg-dark overflow-y-auto max-h-[90vh] rounded-sm shadow-2xl border border-[#333] flex flex-col focus:outline-none"
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-gold hover:text-black transition-colors"
                    aria-label={t('close')}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="w-full h-[300px] md:h-[450px] relative">
                    <Image
                        src={room.photos[0]}
                        alt={room.name}
                        fill
                        className="object-cover"
                    />
                </div>

                <div className="p-8">
                    <h2 id="modal-title" className="text-3xl text-white font-noto-kr mb-4">{room.name}</h2>
                    <div className="text-gold text-sm tracking-[2px] uppercase mb-8">{room.sub}</div>

                    <div className="mb-8">
                        <h3 className="text-xl text-white2 font-noto-kr mb-4 border-b border-[#333] pb-2">{t('facilities')}</h3>
                        <ul className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                            {room.feats.map((feat: string, i: number) => (
                                <li key={i} className="text-gray text-sm flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 bg-gold rounded-full shrink-0" />
                                    {feat}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mb-8">
                        <h3 className="text-xl text-white2 font-noto-kr mb-4 border-b border-[#333] pb-2">{t('rate_info')}</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-black p-4 border border-[#222]">
                                <div className="text-gray text-xs mb-2">{t('weekday')}</div>
                                <div className="text-gold font-montserrat text-lg">{room.prices.weekday}</div>
                            </div>
                            <div className="bg-black p-4 border border-[#222]">
                                <div className="text-gray text-xs mb-2">{t('friday')}</div>
                                <div className="text-gold font-montserrat text-lg">{room.prices.fri}</div>
                            </div>
                            <div className="bg-black p-4 border border-[#222]">
                                <div className="text-gray text-xs mb-2">{t('saturday_holiday')}</div>
                                <div className="text-gold font-montserrat text-lg">{room.prices.sat}</div>
                            </div>
                        </div>
                    </div>

                    {room.desc && (
                        <div>
                            <h3 className="text-xl text-white2 font-noto-kr mb-4 border-b border-[#333] pb-2">{t('description')}</h3>
                            <p className="text-gray text-sm font-noto-kr leading-relaxed whitespace-pre-line">{room.desc}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
