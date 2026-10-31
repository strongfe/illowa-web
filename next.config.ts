import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // www 없는 주소(illowa-hotel.com)로 들어오면 www 로 보낸다 (Vercel 시절과 같은 동작).
  // 구글 광고 최종 URL 이 https://illowa-hotel.com/ 이라 경로·쿼리(gclid 등)를 그대로 넘긴다.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host' as const, value: 'illowa-hotel.com' }],
        destination: 'https://www.illowa-hotel.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
