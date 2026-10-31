import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentFail } from '@/components/reserve/PaymentResult';

export const metadata: Metadata = {
  title: '결제 결과 | 일로와 호텔',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <PaymentFail />
    </Suspense>
  );
}
