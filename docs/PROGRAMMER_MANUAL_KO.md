# 프로그래머 사용자 매뉴얼 (ILLOWA Hotel Web)

이 문서는 `/mnt/c/illowa/web` 프로젝트를 유지보수하는 개발자를 위한 실무 매뉴얼입니다.

## 1. 프로젝트 개요
- 프레임워크: Next.js (App Router)
- 다국어: `next-intl`
- 기본 locale: `ko`
- 지원 locale: `ko, en, ja, zh, ru, es, fr, pt, id, hi`
- 배포 대상: Vercel
- 도메인: `https://illowa-hotel.com`

## 2. 빠른 시작
```bash
cd /mnt/c/illowa/web
npm install
npm run dev
```

브라우저 접속:
- 기본: `http://localhost:3000`
- locale 경로 예: `http://localhost:3000/ko`, `http://localhost:3000/en`

## 3. 자주 쓰는 명령어
```bash
# 타입 검사
npx tsc --noEmit

# 린트
npm run lint

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm run start
```

## 4. 주요 디렉터리 구조
```text
web/
  src/
    app/
      layout.tsx                 # 루트 레이아웃
      robots.ts                  # robots.txt 생성
      sitemap.ts                 # sitemap.xml 생성
      [locale]/
        layout.tsx               # locale별 메타/SEO
        page.tsx                 # 메인 페이지
        terms/page.tsx           # 이용약관
        privacy/page.tsx         # 개인정보처리방침
        cookies/page.tsx         # 쿠키 정책
        legal-utils.ts           # 법적 페이지 메타 공통 유틸
    components/                  # 화면 컴포넌트
    data/                        # 정적 데이터(JSON)
    i18n/                        # locale routing/request 설정
    proxy.ts                     # next-intl 미들웨어
  messages/                      # UI 번역 텍스트(JSON)
  docs/                          # 프로젝트 문서
```

## 5. 다국어(i18n) 수정 가이드

### 5.1 locale 목록 변경
- 파일: `src/i18n/routing.ts`
- `locales`, `defaultLocale` 수정

### 5.2 번역 문구 수정
- 파일: `messages/{locale}.json`
- 예: Footer 텍스트는 `Footer` 섹션 키 사용
- 키 일관성 유지 필수 (한 locale만 추가하면 런타임 오류 가능)

### 5.3 locale 처리 흐름
- `src/proxy.ts`: locale prefix 라우팅 처리
- `src/i18n/request.ts`: 요청 locale 확인 후 메시지 로딩

## 6. 콘텐츠/링크 수정 포인트

### 6.1 예약 채널 링크
- 파일: `src/data/bookingLinks.json`
- 사용 컴포넌트: `src/components/BookingCTA.tsx`
- 외부 링크는 `target="_blank"`, `rel="noreferrer noopener"` 유지

### 6.2 연락처/지도 링크
- 파일: `src/data/content/{locale}/contact.json`
- 사용 컴포넌트: `src/components/Information.tsx`, `src/components/Footer.tsx`

### 6.3 법적 페이지 내용
- 파일:
  - `src/app/[locale]/terms/page.tsx`
  - `src/app/[locale]/privacy/page.tsx`
  - `src/app/[locale]/cookies/page.tsx`
- SEO 메타 공통 처리: `src/app/[locale]/legal-utils.ts`

## 7. SEO/크롤링 관련
- 메인 locale 메타: `src/app/[locale]/layout.tsx`
- 사이트 기본 URL: `src/app/layout.tsx` (`metadataBase`)
- robots: `src/app/robots.ts`
- sitemap: `src/app/sitemap.ts`

확인 URL:
- `https://illowa-hotel.com/robots.txt`
- `https://illowa-hotel.com/sitemap.xml`

## 8. Vercel 배포 가이드

### 8.1 Vercel 프로젝트 설정
- Root Directory: `web`
- Build Command: `npm run build`
- Install Command: `npm install`

### 8.2 배포 전 체크
1. `npx tsc --noEmit` 성공
2. `npm run build` 성공
3. 주요 locale 경로 200 응답 확인 (`/ko`, `/en` 등)
4. 외부 예약 링크 클릭 동작 확인
5. `robots.txt`, `sitemap.xml` 확인

### 8.3 주의 사항
- 루트(`/mnt/c/illowa`)와 앱(`/mnt/c/illowa/web`)에 lockfile이 동시에 존재하면 빌드 경고가 발생할 수 있음
- 가능하면 Vercel Root Directory를 명시하고 lockfile 정책을 정리할 것

## 9. 장애 대응 / 트러블슈팅

### 9.1 이미지 404/invalid image
- `src/data/...` 이미지 경로와 `public/images` 실파일명을 대조
- 한글 파일명/특수문자 경로 오타 주의

### 9.2 다국어 키 누락
- 증상: 특정 locale 렌더 실패 또는 번역 키 노출
- 조치: `messages/ko.json` 기준으로 타 locale 키 동기화

### 9.3 빌드 시 Turbopack 권한/환경 이슈
- 로컬 샌드박스 환경에서 포트/권한 오류가 발생할 수 있음
- 동일 명령을 일반 로컬 터미널 또는 권한 허용 환경에서 재검증

## 10. 변경 작업 권장 절차
1. 기능/문구 수정
2. `npx tsc --noEmit`
3. `npm run build`
4. 수동 확인 (모바일/데스크톱, ko/en 최소 2개 locale)
5. 문서 업데이트 (`docs/`, `DEPLOY_VERCEL.md` 필요 시 반영)

## 11. 참고 문서
- 배포 QA 체크리스트: `docs/DEPLOY_QA_CHECKLIST.md`
- Vercel 점검 문서(상위 경로): `/mnt/c/illowa/DEPLOY_VERCEL.md`
