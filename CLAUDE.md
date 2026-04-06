# 일로와 호텔 웹사이트 + 관리 시스템

## 프로젝트 구조
- Next.js 16 App Router + TypeScript
- Tailwind CSS v4 (postcss plugin)
- Supabase (DB + Realtime)
- Vercel 배포
- next-intl 다국어 (10개 언어)

## 주요 경로

### 공개 페이지
- `/[locale]` - 호텔 홈페이지 (다국어)
- `/[locale]/privacy`, `/terms`, `/cookies` - 정책 페이지

### 관리 페이지
- `/admin` - 관리자 로그인
- `/admin/dashboard` - 챗봇 로그 대시보드
- `/admin/hotel/sales` - 판매 입력
- `/admin/hotel/dashboard` - 호텔 실시간 통계
- `/admin/hotel/closing` - 일일 마감
- `/admin/hotel/rooms` - 객실 현황 보드

## 일로와 호텔 관리 시스템

### 프로젝트 컨텍스트
- 42객실 호텔 (화성시), OTA 채널: 야놀자(41%), 여기어때(19%), 호텔스토리, 꿀스테이
- 기존 Excel 관리 시스템을 웹앱으로 전환 중
- 객실타입: T(당특/1), GS(8), GD(5), S(14), D(5), P(5), PT(5)

### DB 구조 (Supabase)
- rooms: 42개 객실 마스터
- sales: 판매(거래) 기록
- daily_closings: 일일 마감 데이터
- customers: CRM (Phase 2)
- cash_expenses: 현금 지출 내역
- Views: v_daily_summary, v_daily_room_stats, v_daily_channel_revenue, v_room_status

### 비즈니스 규칙
- 대실: 30분 단위 입실 (12:00~18:00), 4~6시간
- 숙박: 15:00~21:00 입실, 익일 12:00~13:00 퇴실
- 공실 = 타입별 총실수 - (당일예약 - 퇴실완료)
- 마감: 채널별 매출집계 + 현금시재 + 전표대사

### 인증
- 비밀번호 기반 (admin_session 쿠키)
- Supabase Auth 미사용, service role key로 DB 접근

## 개발 명령어
```bash
npm run dev    # 개발 서버
npm run build  # 프로덕션 빌드
npm run lint   # ESLint
```
