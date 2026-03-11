import type { Metadata } from 'next';
import { buildLegalMetadata, resolveLegalLocale } from '../legal-utils';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLegalMetadata(locale, 'cookies');
}

export default async function CookiesPage({ params }: Props) {
  const { locale } = await params;
  const lang = resolveLegalLocale(locale);
  const isKo = lang === 'ko';

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F5F2EC] px-5 py-16">
      <section className="max-w-[920px] mx-auto">
        <h1 className="font-cormorant text-4xl text-gold mb-3">
          {isKo ? '쿠키 정책' : 'Cookie Policy'}
        </h1>
        <p className="text-sm text-gray mb-10">
          {isKo ? '시행일: 2026년 3월 11일' : 'Effective Date: March 11, 2026'}
        </p>

        <div className="space-y-8 text-sm leading-7 text-white2 font-noto-kr">
          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '1. 쿠키란?' : '1. What Are Cookies?'}</h2>
            <p>
              {isKo
                ? '쿠키는 이용자의 브라우저에 저장되는 작은 텍스트 파일로, 사이트가 사용자를 인식하고 서비스 품질을 개선하는 데 사용됩니다.'
                : 'Cookies are small text files stored in your browser, used to recognize users and improve website quality.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '2. 사용 목적' : '2. Why We Use Cookies'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isKo ? '사이트 접속 상태 및 보안 유지' : 'Maintain access state and security'}</li>
              <li>{isKo ? '트래픽 분석 및 서비스 개선' : 'Analyze traffic and improve services'}</li>
              <li>{isKo ? 'Google Analytics 통계 수집' : 'Collect analytics through Google Analytics'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '3. 쿠키 유형' : '3. Cookie Categories'}</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                {isKo
                  ? '필수 쿠키: 사이트 기본 동작 및 보안에 필요한 쿠키'
                  : 'Essential cookies: required for core website functionality and security'}
              </li>
              <li>
                {isKo
                  ? '분석 쿠키: 방문 통계 및 이용 패턴 분석용 쿠키'
                  : 'Analytics cookies: used to measure traffic and usage patterns'}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '4. 쿠키 거부 방법' : '4. How to Manage Cookies'}</h2>
            <p>
              {isKo
                ? '이용자는 브라우저 설정에서 쿠키 저장을 거부하거나 삭제할 수 있습니다. 단, 일부 기능 사용에 제한이 있을 수 있습니다.'
                : 'You can block or delete cookies through your browser settings. Some site features may be limited if cookies are disabled.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '5. 제3자 도구' : '5. Third-Party Tools'}</h2>
            <p>
              {isKo
                ? '본 사이트는 Google Analytics를 사용할 수 있으며, 관련 쿠키는 Google 정책에 따라 처리될 수 있습니다.'
                : 'This site may use Google Analytics, and related cookies may be processed according to Google policies.'}
            </p>
          </section>

          <section>
            <h2 className="text-lg text-white mb-2">{isKo ? '6. 문의처' : '6. Contact'}</h2>
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
