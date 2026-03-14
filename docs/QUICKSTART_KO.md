# QUICKSTART (한국어)

신규 개발자가 ILLOWA Hotel 웹 프로젝트를 빠르게 실행/검증하기 위한 요약 문서입니다.

## 1) 프로젝트 실행
```bash
cd /mnt/c/illowa/web
npm install
npm run dev
```

접속:
- 기본: `http://localhost:3000`
- locale 예시: `http://localhost:3000/ko`, `http://localhost:3000/en`

## 2) 필수 확인 명령어
```bash
# 타입 검사
npx tsc --noEmit

# 프로덕션 빌드
npm run build
```

## 3) 자주 수정하는 파일
- 다국어 라우팅: `src/i18n/routing.ts`
- 번역 텍스트: `messages/{locale}.json`
- 예약 링크: `src/data/bookingLinks.json`
- Footer 링크: `src/components/Footer.tsx`
- 법적 페이지:
  - `src/app/[locale]/terms/page.tsx`
  - `src/app/[locale]/privacy/page.tsx`
  - `src/app/[locale]/cookies/page.tsx`
- SEO:
  - locale 메타: `src/app/[locale]/layout.tsx`
  - robots/sitemap: `src/app/robots.ts`, `src/app/sitemap.ts`

## 4) 배포 전 최소 체크
1. `npx tsc --noEmit` 성공
2. `npm run build` 성공
3. `/{locale}` 페이지 정상 표시 (`ko`, `en` 우선)
4. Footer 법적 링크 동작:
   - `/{locale}/terms`
   - `/{locale}/privacy`
   - `/{locale}/cookies`
5. 외부 예약 링크 클릭 확인 (Booking/Agoda/Trip.com 등)
6. `robots.txt`, `sitemap.xml` 확인

## 5) Vercel 설정 핵심
- Root Directory: `web`
- Build Command: `npm run build`
- Install Command: `npm install`
- Domain: `https://illowa-hotel.com`

## 6) 참고 문서
- 상세 매뉴얼: `docs/PROGRAMMER_MANUAL_KO.md`
- 배포 QA: `docs/DEPLOY_QA_CHECKLIST.md`
- 배포 점검: `/mnt/c/illowa/DEPLOY_VERCEL.md`
