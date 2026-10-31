import type { Metadata } from 'next';
import { REFUND_POLICY } from '@/data/refundPolicy';
import { buildLegalMetadata, resolveLegalLocale } from '../legal-utils';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLegalMetadata(locale, 'refund');
}

export default async function RefundPage({ params }: Props) {
  const { locale } = await params;
  const lang = resolveLegalLocale(locale);
  const isKo = lang === 'ko';

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F2EC] px-5 py-16">
      <section className="max-w-[920px] mx-auto">
        <h1 className="font-cormorant text-4xl text-gold mb-3">
          {isKo ? '취소·환불 정책' : 'Cancellation & Refund Policy'}
        </h1>
        <p className="text-sm text-gray mb-10">
          {isKo ? '시행일: 2026년 11월 1일' : 'Effective Date: November 1, 2026'}
        </p>

        <div className="space-y-8 text-sm leading-7 text-white2 font-noto-kr">
          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '1. 적용 범위' : '1. Scope'}</h2>
            <p>
              {isKo
                ? '이 정책은 일로와호텔 홈페이지에서 직접 예약·결제한 숙박 및 대실 상품에 적용됩니다. 야놀자, 여기어때 등 외부 예약 플랫폼에서 예약한 경우에는 해당 플랫폼의 취소·환불 규정이 적용됩니다.'
                : 'This policy applies to stays and day-use rooms booked and paid directly on the Illowa Hotel website. Bookings made through external platforms follow the cancellation and refund rules of that platform.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '2. 취소·환불 기준' : '2. Cancellation and Refunds'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              {REFUND_POLICY[lang].map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-gray text-xs">
              {isKo
                ? '취소 기준일은 입실일이며, 환불 금액은 최초 결제 금액을 기준으로 합니다.'
                : 'Cancellation deadlines are based on the check-in date, and refunds are based on the original payment amount.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '3. 문의' : '3. Contact'}</h2>
            <p>
              {isKo
                ? '일로와호텔 · 전화 031-464-9661 · 이메일 ch8773@naver.com · 경기도 안양시 만안구 안양로268번길 41'
                : 'Illowa Hotel · Tel +82-31-464-9661 · Email ch8773@naver.com · 41, Anyang-ro 268beon-gil, Manan-gu, Anyang-si, Gyeonggi-do, Korea'}
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
