import type { Metadata } from 'next';
import ReserveApp from '@/components/reserve/ReserveApp';

// 시안 단계 — 검색엔진에 노출하지 않는다.
export const metadata: Metadata = {
  title: '객실 예약 | 일로와 호텔',
  robots: { index: false, follow: false },
};

export default function ReservePage() {
  return <ReserveApp />;
}
