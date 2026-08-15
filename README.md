This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 문서

| 문서 | 내용 |
|---|---|
| [docs/PC_MIGRATION_KO.md](docs/PC_MIGRATION_KO.md) | **개발 PC 이식 가이드** — 새 노트북 셋업 절차, 환경변수 목록, `npm ci` 재현성 이슈, 검증 결과, 미해결 과제 |
| [docs/QUICKSTART_KO.md](docs/QUICKSTART_KO.md) | 빠른 시작 — 실행·검증 명령어, 자주 수정하는 파일 |
| [docs/PROGRAMMER_MANUAL_KO.md](docs/PROGRAMMER_MANUAL_KO.md) | 프로그래머 실무 매뉴얼 |
| [docs/DEPLOY_QA_CHECKLIST.md](docs/DEPLOY_QA_CHECKLIST.md) | 배포 전 QA 체크리스트 |
| [docs/AD_TRACKING.md](docs/AD_TRACKING.md) | 광고 트래킹(GTM/GA4/Meta Pixel/Google Ads/네이버) 가이드 |
| [docs/WORK_LOG.md](docs/WORK_LOG.md) | 관리 시스템 개선 작업 로그 |
| [CLAUDE.md](CLAUDE.md) | 프로젝트 구조·비즈니스 규칙 요약 |

새 PC에서 처음 셋업한다면 [docs/PC_MIGRATION_KO.md](docs/PC_MIGRATION_KO.md)의 재현 절차부터 보세요.

## Getting Started

> `.env.local`은 git에 포함되지 않습니다. 없으면 `Error: supabaseUrl is required`로 **빌드가 실패**합니다. 필요한 변수 목록은 [docs/PC_MIGRATION_KO.md](docs/PC_MIGRATION_KO.md#6-환경변수-envlocal) 참고.

First, install dependencies with `npm ci` (reproducible install), then run the development server:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. This project redirects `/` to `/ko` — see [http://localhost:3000/ko](http://localhost:3000/ko).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
