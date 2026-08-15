# 개발 PC 이식 가이드 (신규 노트북 셋업)

작성일: 2026-08-15 (Asia/Seoul)
대상 커밋: `9477483`
검증 환경: Windows 11 Pro / Node.js 22.19.0 / npm 10.9.3 / Git 2.40.1

기존 PC(`C:\illowa\web`, WSL 경로 `/mnt/c/illowa/web`)에서 신규 노트북(`D:\illowa-web`)으로 개발 환경을 옮기면서 수행한 전 과정과, 그 과정에서 발견·수정한 문제를 기록합니다. 새 PC를 셋업할 때는 [8. 재현 절차](#8-재현-절차-새-pc-셋업-체크리스트)만 따라도 됩니다.

---

## 1. 요약

| 구간 | 결과 |
|---|---|
| GitHub 소스 복제 | 정상 |
| 의존성 설치 (`npm ci`) | **잠금파일 보수 후** 정상 |
| TypeScript 검사 | 정상 |
| 프로덕션 빌드 | 정상 (41 routes) |
| 다국어 페이지 (10개 locale) | 정상 |
| SEO 메타데이터 | 정상 |
| 관리자 인증 게이트 | 정상 |
| Supabase 실데이터 읽기 | 정상 |
| Vercel Preview / Production | 정상 |

이식 과정에서 **저장소의 `package-lock.json`이 `package.json`과 동기화되지 않아 `npm ci`가 실패하는 결함**을 발견해 별도 PR로 수정했습니다 (→ [4장](#4-packagelockjson-재현성-결함과-보수)).

---

## 2. 사전 요구사항

- **Node.js 20.9 이상** — `next@16.1.6`이 `engines: { "node": ">=20.9.0" }`을 선언합니다. 검증은 22.19.0에서 수행했으며 Node 24는 필요 없습니다.
- **Git**
- **`.env.local`** — git에 포함되지 않습니다. 기존 PC에서 직접 복사해야 합니다 (→ [6장](#6-환경변수-envlocal)).

---

## 3. 소스 이식

```bash
git clone https://github.com/strongfe/illowa-web.git
cd illowa-web
npm ci
```

`.gitignore`가 `node_modules`, `.next`, `.env*`를 제외하므로 clone만으로는 **의존성과 환경변수가 따라오지 않습니다.**

---

## 4. `package-lock.json` 재현성 결함과 보수

### 증상

clean 상태에서 `npm ci`가 설치를 시작하지도 못하고 중단됩니다.

```
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json are in sync.
npm error Missing: @swc/helpers@0.5.23 from lock file
```

### 원인

```
next@16.1.6
  └─ @swc/helpers 0.5.15 로 고정  →  최상위(node_modules/@swc/helpers)로 호이스팅

next-intl@4.8.3
  └─ @swc/core@1.15.18
       └─ optional peer: @swc/helpers >=0.5.17
```

최상위 `0.5.15`가 `>=0.5.17`을 만족하지 못하므로 npm은 `node_modules/next-intl/node_modules/@swc/helpers`에 중첩 사본을 설치해야 합니다. 그런데 잠금파일에 **그 중첩 항목이 기록돼 있지 않았습니다.**

이 결함은 **검증 환경(Windows 11 Pro / Node.js 22.19.0 / npm 10.9.3)** 의 clean 상태에서 재현했고, 보수 후 동일 환경의 `npm ci`와 **Vercel Preview·Production 배포**에서 설치·빌드 성공을 확인했습니다. Vercel의 Install Command가 `npm install`(잠금파일을 자동 보수)이었기 때문에 배포에서는 드러나지 않았습니다.

### 조치

`npm install --package-lock-only`로 잠금파일만 재생성했습니다. 결과는 **추가 75줄 / 삭제 0줄**로, 기존 버전 핀은 하나도 바뀌지 않았습니다.

추가된 항목 7개:
- `next-intl/node_modules/@swc/helpers` — 실제 원인
- `@tailwindcss/oxide-wasm32-wasi` 하위 중첩 의존성 6개

### 검증

| 항목 | 결과 |
|---|---|
| `node_modules` 삭제 후 `npm ci` | 성공 (396 packages) |
| `npm ci` 후 잠금파일 재변경 | 없음 (해시 동일) |
| `npx tsc --noEmit` | 성공 |
| `npm run build` | 성공 (41 routes) |
| Vercel Preview | 성공 |
| Vercel Production | 성공 |

### 반영 경로

```
3618b78  fix: npm ci 재현성을 위한 package-lock 보수   (fix/package-lock-reproducibility)
   ↓ PR #1
9477483  merge into main  →  Vercel Production 자동 배포 성공
```

> **주의** — 앞으로 이 저장소에서 의존성을 변경할 때는 `npm install` 결과로 갱신된 `package-lock.json`을 반드시 함께 커밋해야 합니다. 잠금파일을 되돌리면 `npm ci`가 다시 깨집니다.

---

## 5. 빌드 시 환경변수 의존성

`.env.local` 없이 `npm run build`를 실행하면 **빌드가 실패합니다.**

```
Error: supabaseUrl is required.
> Build error occurred: Failed to collect page data for /api/admin/hotel/cash-expenses
```

[`src/lib/supabase.ts`](../src/lib/supabase.ts)가 모듈 로드 시점에 `createClient()`를 호출하기 때문에, 빌드 중 page data 수집 단계에서 즉시 터집니다. 즉 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`는 런타임뿐 아니라 **빌드 타임 필수**입니다.

---

## 6. 환경변수 (`.env.local`)

`.gitignore`의 `.env*` 규칙으로 git에 올라가지 않습니다. **값은 이 문서에 기록하지 않습니다.**

### 필수

| 변수명 | 사용 위치 | 용도 | 값 출처 |
|---|---|---|---|
| `SUPABASE_URL` | `lib/supabase.ts`, `api/chat`, `api/admin/logs` | Supabase REST 엔드포인트 | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SECRET_KEY` | 위와 동일 | RLS 우회 DB 접근 (Supabase Auth 미사용) | Supabase Dashboard → Project Settings → API keys |
| `ADMIN_PASSWORD` | `api/admin/login`, 관리자 API 20개의 `checkAuth`, `admin/hotel/layout.tsx`, `admin/dashboard/page.tsx` | 관리자 인증. 이 값이 그대로 `admin_session` 쿠키 값이 됨 | Vercel Environment Variables |
| `OPENAI_API_KEY` | `api/chat`, `api/admin/evaluate` | 챗봇 응답, 관리자 로그 자동 평가 | OpenAI Platform / Vercel Environment Variables |

### 선택

| 변수명 | 사용 위치 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_GADS_ID` | `layout.tsx`, `BookingCTA.tsx` | Google Ads 전환 추적 (`AW-…`) |
| `NEXT_PUBLIC_NAVER_ACCOUNT_ID` | `layout.tsx` | 네이버 공통 전환 스크립트(wcslog) |
| `NEXT_PUBLIC_USE_INLINE_EDIT` | `admin/hotel/sales/page.tsx` | 판매 입력 인라인 편집 토글. `'false'`일 때만 비활성 |
| `NEXT_PUBLIC_GA_ID` | `layout.tsx` | GA4 직접 로드 — 아래 참고로 **실질 미사용** |
| `NEXT_PUBLIC_META_PIXEL_ID` | `layout.tsx` | Meta Pixel 직접 로드 — **실질 미사용** |

> **참고** — `NEXT_PUBLIC_GTM_ID`는 코드가 읽지 않습니다. [`src/app/layout.tsx`](../src/app/layout.tsx)의 `GTM_ID` 상수에 컨테이너 ID가 하드코딩돼 있습니다. 그 결과 GA4·Meta Pixel 블록의 `&& !GTM_ID` 조건이 항상 false가 되어, 두 태그는 GTM을 통해서만 로드됩니다. 자세한 내용은 [AD_TRACKING.md](AD_TRACKING.md) 참고.

---

## 7. 검증 결과

### 7-1. 빌드·품질 게이트

| 항목 | 결과 |
|---|---|
| `npm ci` | 성공 (396 packages) |
| `npx tsc --noEmit` | 성공 (오류 0) |
| `npm run build` | 성공 (41 routes) |
| `npm run lint` | **실패** — error 23 / warning 16 (→ [9장](#9-미해결-과제)) |
| 번역 키 정합성 | 10개 locale 전부 117키 일치 |

### 7-2. 공개 페이지

- 10개 locale `/ko /en /ja /zh /ru /es /fr /pt /id /hi` → 전부 200
- `/ko/terms` · `/privacy` · `/cookies` → 200
- `/` → 307 → `/ko`
- `robots.txt` · `sitemap.xml` → 200
- canonical, hreflang 11개(10 locale + `x-default`), og 4종, `<html lang="ko-KR">` 정상
- `MISSING_MESSAGE` / `IntlError` 0건

### 7-3. 관리자 인증

- 미인증 관리자 API → 전부 401 (GET 핸들러가 없는 라우트는 405)
- 오답 로그인 → 401
- 미인증 `/admin/hotel/*` → 307 → `/admin`

### 7-4. 관리자 화면·실데이터 (읽기 전용)

관리자 로그인 후 12개 화면 전부 200, HTTP 500 **0건**.

| 화면 | 경로 |
|---|---|
| 관리자 로그인 | `/admin` |
| 관리자 대시보드(챗봇 로그) | `/admin/dashboard` |
| 호텔 실시간 통계 | `/admin/hotel/dashboard` |
| 객실 현황 보드 | `/admin/hotel/rooms` |
| 판매(매출) 입력 | `/admin/hotel/sales` |
| 예약 / 부킹 | `/admin/hotel/reservations` · `/bookings` |
| 일일 마감 | `/admin/hotel/closing` |
| 미수금 | `/admin/hotel/receivables` |
| 감사 로그 | `/admin/hotel/audit` |
| 컴플레인 | `/admin/hotel/complaints` |
| 인보이스 | `/admin/hotel/invoices` |

> `/admin/hotel`에는 `page.tsx`가 없고 `layout.tsx`만 있습니다.

API GET 13개도 전부 정상 조회(객실 42, 요금표 28, 부킹 46, 미수금 41, 감사로그 50, 챗봇로그 14). 두 가지는 오류가 아니라 설계된 동작입니다.

- `/api/admin/hotel/dashboard-weekly` → 파라미터 없으면 **400** (`start`/`end` 필수 검증). 파라미터를 주면 200.
- `/api/admin/hotel/sales` → 파라미터 없으면 **오늘 날짜**로 필터하므로 오늘 데이터가 없으면 0건.

### 7-5. Supabase

**이번 이식 과정에서 관찰한 사건 기록** — `.env.local`을 복원한 직후, Supabase API 호스트가 해석되지 않아 연결이 `ENOTFOUND`로 실패했습니다. KT·Google(8.8.8.8)·Cloudflare(1.1.1.1) 세 resolver 모두 NXDOMAIN을 반환했고, 대조군(`supabase.co`, `api.github.com`)은 정상이라 네트워크 문제는 아니었습니다. 이후 Supabase 프로젝트를 Healthy로 복구하자 동일한 `.env.local`로 즉시 정상 조회됐습니다.

당시 공개 페이지는 Supabase를 전혀 호출하지 않아 **정상 동작했고 관리자 기능만 실패**했습니다. Vercel Production도 같은 이유로 겉보기에는 멀쩡했습니다.

관리자 기능만 실패하는 증상이 나타나면 **Supabase Dashboard에서 프로젝트 상태(Healthy / Paused)를 먼저 확인**하세요.

---

## 8. 재현 절차 (새 PC 셋업 체크리스트)

```bash
# 1. Node.js 20.9 이상 설치 (검증본: 22.19.0)

# 2. 소스
git clone https://github.com/strongfe/illowa-web.git
cd illowa-web

# 3. 의존성 (재현 가능한 설치)
npm ci

# 4. .env.local 준비 (git 에 없음) — 아래 "환경변수 준비" 참고
#    필수 4개: SUPABASE_URL / SUPABASE_SECRET_KEY / ADMIN_PASSWORD / OPENAI_API_KEY

# 5. 검증
npx tsc --noEmit
npm run build

# 6. 실행
npm run dev        # → http://localhost:3000/ko
```

### 환경변수 준비

**1순위 — 기존 PC에서 파일째 안전하게 복사.** 가장 확실하고 값이 어긋날 여지가 없습니다. USB나 사내 보안 채널 등 외부에 노출되지 않는 경로를 쓰고, 복사 매체는 사용 후 정리하세요.

**2순위 — 기존 PC를 쓸 수 없으면 각 콘솔에서 재구성.**

| 변수 | 재구성 위치 |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Supabase Dashboard → Project Settings → API |
| `ADMIN_PASSWORD` | Vercel → 프로젝트 → Settings → Environment Variables |
| `OPENAI_API_KEY` | OpenAI Platform → API keys (기존 키를 볼 수 없으면 신규 발급 후 이전 키 폐기) |
| `NEXT_PUBLIC_*` | Vercel Environment Variables 또는 각 광고 플랫폼 |

**지켜야 할 것**

- 비밀값을 **GitHub에 커밋하지 않습니다.** `.gitignore`의 `.env*` 규칙이 1차 방어선이며, `git status`에 `.env.local`이 보이면 즉시 중단하세요.
- 비밀값을 **문서·이슈·PR·채팅·스크린샷에 남기지 않습니다.** 이 문서에도 변수 이름만 기록합니다.
- 비밀값을 **터미널에 출력하거나 로그로 남기지 않습니다.** 검증할 때는 값을 찍지 말고 연결 성공 여부(HTTP 상태 코드)만 확인하세요.
- 값이 외부에 노출됐다면 해당 키를 **재발급**하세요.

확인 포인트:

1. `npm ci`가 `EUSAGE`로 실패하면 잠금파일이 다시 깨진 것입니다 ([4장](#4-packagelockjson-재현성-결함과-보수) 참고)
2. 빌드가 `supabaseUrl is required`로 실패하면 `.env.local`이 없는 것입니다
3. 공개 페이지는 뜨는데 관리자만 실패하면 Supabase 프로젝트 상태를 확인하세요

---

## 9. 미해결 과제

이식 검증 범위 밖이라 **의도적으로 손대지 않은** 항목입니다. 각각 별도 브랜치에서 처리하는 것을 권장합니다.

### 9-1. ESLint 오류 23건 / 경고 16건

Next 16은 빌드 시 lint를 실행하지 않아 빌드는 통과하지만, 두 건은 실제 장애 가능성이 있습니다.

| 규칙 | 건수 | 비고 |
|---|---|---|
| `react-hooks/refs` | 9 | [`SalesGridPanel.tsx:2961`](../src/components/hotel/inline/SalesGridPanel.tsx) — 렌더 중 `ref.current.getBoundingClientRect()` 접근. 컨텍스트 메뉴 위치가 어긋날 수 있음 |
| `react-hooks/set-state-in-effect` | 9 | |
| `@typescript-eslint/no-explicit-any` | 4 | |
| `react-hooks/preserve-manual-memoization` | 1 | [`AuditPage.tsx:102-117`](../src/components/hotel/AuditPage.tsx) — `useCallback` 의존성에 `recordFilter` 누락. 해당 필터가 동작하지 않을 수 있음 |

### 9-2. 보안 취약점 12건 (high 9)

`npm audit` 기준이며 대부분 `next@16.1.6`에 몰려 있습니다. Middleware 우회, SSRF, DoS 계열이 포함되므로 운영 사이트에는 업그레이드를 권장합니다.

업그레이드할 때는 **그 시점의 최신 안정 버전을 다시 확인**하세요. 이 문서에 특정 버전을 고정해 두지 않습니다.

```bash
npm view next dist-tags     # latest 태그 확인
npm audit                   # 남은 취약점 재확인
```

`next`와 `eslint-config-next`는 **같은 버전으로 맞춰야** 합니다.

### 9-3. 문서 불일치

[DEPLOY_QA_CHECKLIST.md](DEPLOY_QA_CHECKLIST.md)에 기록된 전화번호는 `0503-5051-6355`인데 실제 렌더링은 `tel:031-464-9661`입니다. 어느 쪽이 최신인지 확인이 필요합니다.

---

## 10. 이번 작업에서 변경한 것

`package-lock.json` **한 개뿐**입니다 (+75 / −0, 커밋 `3618b78`, PR #1, merge `9477483`). 소스코드·Next.js 버전·ESLint 설정·Vercel 환경변수는 일절 변경하지 않았고, Supabase 운영 데이터도 읽기만 수행했습니다.
