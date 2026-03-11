import type { Metadata } from 'next';
import { buildLegalMetadata, resolveLegalLocale } from '../legal-utils';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLegalMetadata(locale, 'privacy');
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  const lang = resolveLegalLocale(locale);
  const isKo = lang === 'ko';

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F2EC] px-5 py-16">
      <section className="max-w-[920px] mx-auto">
        <h1 className="font-cormorant text-4xl text-gold mb-3">
          {isKo ? '개인정보처리방침' : 'Privacy Policy'}
        </h1>
        <p className="text-sm text-gray mb-10">
          {isKo ? '시행일: 2026년 3월 11일' : 'Effective Date: March 11, 2026'}
        </p>

        <div className="space-y-8 text-sm leading-7 text-white2 font-noto-kr">
          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '1. 총칙' : '1. Overview'}</h2>
            <p>
              {isKo
                ? '일로와호텔은 이용자의 개인정보를 중요하게 여기며, 관련 법령을 준수하여 개인정보를 처리합니다.'
                : 'Illowa Hotel values your personal information and processes it in accordance with applicable laws.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '2. 수집 항목' : '2. Data We May Collect'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                {isKo
                  ? '자동 수집 정보: 접속 로그, IP 주소, 쿠키, 브라우저/기기 정보'
                  : 'Automatically collected data: access logs, IP address, cookies, browser/device information'}
              </li>
              <li>
                {isKo
                  ? '문의 과정에서 제공되는 정보: 이름, 전화번호, 이메일 등 이용자가 직접 제공한 정보'
                  : 'Information voluntarily provided during inquiries: name, phone number, email, etc.'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '3. 이용 목적' : '3. Purpose of Processing'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isKo ? '사이트 운영 및 보안 관리' : 'Website operation and security management'}</li>
              <li>{isKo ? '고객 문의 응대' : 'Responding to customer inquiries'}</li>
              <li>{isKo ? '서비스 개선 및 통계 분석' : 'Service improvement and analytics'}</li>
              <li>
                {isKo
                  ? 'Google Analytics를 통한 방문 트래픽 분석'
                  : 'Traffic analytics via Google Analytics'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '4. 외부 예약 플랫폼' : '4. External Booking Platforms'}</h2>
            <p>
              {isKo
                ? '예약은 외부 플랫폼에서 진행되며, 해당 플랫폼에서의 개인정보 처리는 각 플랫폼의 개인정보처리방침이 적용됩니다.'
                : 'Reservations are completed on external platforms, and personal data processing there is governed by each platform’s privacy policy.'}
            </p>
            <p className="mt-2">
              Google Hotels, Booking.com, Agoda, Expedia, Trip.com, Tripadvisor, HotelsCombined,{' '}
              {isKo ? '야놀자, 여기어때' : 'Yanolja, Yeogi-eottae'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '5. 보유 및 이용기간' : '5. Retention Period'}</h2>
            <p>
              {isKo
                ? '법령에 따른 보존 의무가 있는 경우를 제외하고, 수집 목적 달성 후 지체 없이 파기합니다.'
                : 'Unless retention is required by law, personal data is deleted without delay once the processing purpose is fulfilled.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '6. 이용자 권리' : '6. Your Rights'}</h2>
            <p>
              {isKo
                ? '이용자는 개인정보 열람, 정정, 삭제, 처리정지 요구를 할 수 있으며 아래 담당자에게 문의할 수 있습니다.'
                : 'Users may request access, correction, deletion, or restriction of their personal data by contacting the person in charge below.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '7. 개인정보 보호책임자' : '7. Privacy Contact'}</h2>
            <p>
              {isKo ? '개인정보 담당자: 전무' : 'Privacy Officer: Jeonmu'}
              <br />
              {isKo ? '담당자 이메일: jun877358@gmail.com' : 'Contact Email: jun877358@gmail.com'}
              <br />
              {isKo ? '대표 이메일: ch8773@naver.com' : 'Representative Email: ch8773@naver.com'}
              <br />
              {isKo ? '대표 전화: 031-464-9661' : 'Phone: +82-31-464-9661'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '8. 호스팅' : '8. Hosting'}</h2>
            <p>{isKo ? '본 사이트는 Vercel에서 호스팅됩니다.' : 'This website is hosted on Vercel.'}</p>
          </section>
        </div>
      </section>
    </main>
  );
}
