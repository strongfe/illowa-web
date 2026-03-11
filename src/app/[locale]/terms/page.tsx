import type { Metadata } from 'next';
import { buildLegalMetadata, resolveLegalLocale } from '../legal-utils';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLegalMetadata(locale, 'terms');
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  const lang = resolveLegalLocale(locale);
  const isKo = lang === 'ko';

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F2EC] px-5 py-16">
      <section className="max-w-[920px] mx-auto">
        <h1 className="font-cormorant text-4xl text-gold mb-3">
          {isKo ? '이용약관' : 'Terms of Service'}
        </h1>
        <p className="text-sm text-gray mb-10">
          {isKo ? '시행일: 2026년 3월 11일' : 'Effective Date: March 11, 2026'}
        </p>

        <div className="space-y-8 text-sm leading-7 text-white2 font-noto-kr">
          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '1. 목적' : '1. Purpose'}</h2>
            <p>
              {isKo
                ? '본 약관은 일로와호텔(이하 "호텔")이 운영하는 웹사이트(https://illowa-hotel.com)의 이용 조건과 절차, 이용자와 호텔의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.'
                : 'These Terms govern the conditions and procedures for using the Illowa Hotel website (https://illowa-hotel.com), including rights, obligations, and responsibilities between users and the hotel.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '2. 서비스 성격' : '2. Service Nature'}</h2>
            <p>
              {isKo
                ? '본 사이트는 호텔 소개 및 안내를 위한 웹사이트이며, 객실 예약은 외부 예약 플랫폼으로 연결되어 진행됩니다.'
                : 'This website is an informational hotel site. Room reservations are made through external booking platforms.'}
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Google Hotels</li>
              <li>Booking.com</li>
              <li>Agoda</li>
              <li>Expedia</li>
              <li>Trip.com</li>
              <li>Tripadvisor</li>
              <li>HotelsCombined</li>
              <li>{isKo ? '야놀자' : 'Yanolja'}</li>
              <li>{isKo ? '여기어때' : 'Yeogi-eottae'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '3. 외부 사이트 이용' : '3. External Site Usage'}</h2>
            <p>
              {isKo
                ? '외부 플랫폼으로 이동한 이후의 예약, 결제, 취소/환불, 회원정보 처리 등은 해당 플랫폼의 약관 및 정책이 적용되며 호텔은 해당 절차에 대해 직접적인 책임을 지지 않습니다.'
                : 'After you move to an external platform, reservations, payments, cancellations/refunds, and account/data handling are governed by that platform’s terms and policies. The hotel is not directly responsible for those procedures.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '4. 금지행위' : '4. Prohibited Conduct'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                {isKo
                  ? '서비스 운영을 방해하는 행위 또는 비정상적 접근'
                  : 'Interfering with service operation or abnormal access attempts'}
              </li>
              <li>
                {isKo
                  ? '허위 정보 기재, 타인 정보 도용'
                  : 'Providing false information or impersonating others'}
              </li>
              <li>
                {isKo
                  ? '관련 법령을 위반하는 행위'
                  : 'Any act violating applicable laws and regulations'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '5. 면책' : '5. Disclaimer'}</h2>
            <p>
              {isKo
                ? '호텔은 천재지변, 시스템 장애, 통신장애 등 불가항력 사유로 인한 서비스 제공 불가에 대해 책임을 지지 않습니다.'
                : 'The hotel is not liable for failure to provide services due to force majeure events such as natural disasters, system failures, or network outages.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '6. 사업자 정보' : '6. Business Information'}</h2>
            <p>
              {isKo ? '상호명: 일로와호텔 / 영문명: Illowa Hotel' : 'Business Name: Illowa Hotel'}
              <br />
              {isKo
                ? '주소: 경기도 안양시 만안구 안양로268번길 41 (안양동 622-19)'
                : 'Address: 41, Anyang-ro 268beon-gil, Manan-gu, Anyang-si, Gyeonggi-do, Korea (Anyang-dong 622-19)'}
              <br />
              {isKo ? '대표 전화: 031-464-9661' : 'Phone: +82-31-464-9661'}
              <br />
              {isKo ? '대표 이메일: ch8773@naver.com' : 'Email: ch8773@naver.com'}
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
