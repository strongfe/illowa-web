# 일로와 호텔 관리 시스템 작업 로그

## 개요
일로와 호텔 관리 시스템의 판매입력, 연박현황, 예약현황, 대시보드, 일일마감 등 전반적인 개선 작업 내역입니다.

---

## 1. 판매 입력 그리드 개선

### 메뉴 구조 개편
- 메인 네비게이션: 판매입력 / 연박현황 / 예약현황 (3개)
- 관리자 드롭다운: 대시보드 / 일일마감 / 객실현황 / 인보이스 / 컴플레인 / 변경이력 / 챗봇관리
- 미수관리 메뉴는 제거 (판매입력에서 결재=미수로 직접 관리)

### SelectCell (구분/결재/추결) 개선
- `datalist` → 커스텀 드롭다운으로 교체 (브라우저 호환성)
- 클릭 시 옵션 목록 즉시 표시, 타이핑으로 필터링
- 컬럼 폭 조정: 구분 36→50, 타입 26→36, 결재 40→50, 성명 130→100

### 컬럼 필터 기능
- 기타 패널 결재/구분/추결 헤더 클릭 → 드롭다운 필터
- 값 선택 시 해당 결재수단 행만 표시
- 필터 활성 시 헤더 파란색 + ✕ 표시, 재클릭으로 해제

### 퇴실 컬럼
- ✓(녹색) / □(회색) 표시, 컬럼 폭 확대

### 행 삭제 기능 (Del × 2)
- 1st Del: 행 빨간 배경 + 🗑️ 아이콘 + 3초 자동취소
- 2nd Del: DELETE API 호출 → 행 빈 행으로 초기화
- 연박/예약금 행은 삭제 불가 (안전장치)
- 이후 단순화: 셀 내용 전부 비우고 커서 이동 시 자동 삭제 + 재정렬

### 패널 소계 표시
- 소계: N건 / 금액 / 추금액 / 합계 순서로 표시

---

## 2. 한글 IME 버그 수정 (중요)

### 근본 원인
- `div` 요소는 브라우저 IME를 지원하지 않음
- 한글 키보드에서 'ㄱ'을 누르면 div에서는 `keyCode=229`가 아니라 원시 ASCII 키(`r`)가 발생
- 결과: 성명/결재 셀에 한글 대신 영문자 입력

### 해결책
**포커스된 셀에 숨겨진 투명 proxy input 렌더링**
- `position: absolute; opacity: 0`으로 셀 위에 덮음
- proxy input이 키보드 이벤트 수신 → IME 정상 작동
- `compositionEnd` 이벤트로 composed 텍스트 캡처 → 값에 반영 + edit 모드 전환
- TextCell, SelectCell 모두 적용

### UTC→로컬 시간 변환 버그
- `toISOString().split('T')[0]`이 KST(+9)에서 하루 밀림
- 대시보드 모바일 ◀ 버튼이 2일씩 점프
- 연박 분배 날짜가 입실일보다 하루 앞서 시작
- 8개 파일(SalesPageLegacy, BookingsPage, ClosingPage, SalesGridPage, ReservationsPage, InvoicesPage, RoomsPage, GridDemo) 모두 로컬 시간 기반 날짜 생성으로 교체

---

## 3. OTA 패널 저장 버그 수정

### 원인
- 야놀자/여기어때 패널에는 `channel` 컬럼이 없음
- 새 행의 `channel=''`이라 `isRowReadyForCreate`의 필수 체크에 걸림
- POST 실행되지 않아 F5 누르면 데이터 사라짐

### 수정
- 빈 행 생성 시(`buildRow`) OTA 패널이면 channel을 패널 타이틀(야놀자/여기어때)로 미리 채움
- `runValidation`에서도 OTA 패널은 channel 필수 에러 건너뜀

---

## 4. 빠른 입력 시 데이터 소실 방지

### 원인
- 리싱크 로직에서 `dirty/saving` 행만 보호
- 빠른 입력 시 Row A 저장 성공 → `sales` prop 변경 → 리싱크 실행 → Row B가 아직 dirty set되기 전에 덮어써짐

### 수정
리싱크에서 보호하는 행 범위 확대:
- `dirty > 0` (편집 중)
- `saving` (저장 중)
- **`focusedRow`** (현재 포커스)
- **`savedAt !== null`** (방금 저장 완료 — green flash 중)

### 호실 중복 오탐 수정
- 새 행(`original=null`)에서는 호실 중복 체크 건너뜀
- 서버측 고유 제약으로 실제 중복 검증

---

## 5. 예약/예약금 행 필터링

### 요구사항
`channel='예약'` 또는 `payment_timing !== '현장'`인 행은 **예약현황**에서만 관리하고 나머지 페이지에서 숨김:
- 판매입력 그리드
- 채널별 매출 통계
- 공실 현황
- 대실/숙박/합계 요약
- 일일마감 집계
- 대시보드 집계

모든 페이지에 동일한 필터 로직 적용으로 수치 일관성 확보.

---

## 6. 추금액 세부 집계 반영

### 기존 문제
- 추금액이 총계에만 합산되고 세부 채널에 미반영
- 예: 호스 50,000 + 추결=현금 10,000 → 현금 항목에 10,000이 빠짐

### 수정 (채널별 매출 + 일일마감)
- sale을 RevEntry 리스트로 분해 (primary + extra)
- `extra_payment_method`에 따라 해당 채널에 `extra_amount` 개별 합산
- 건수는 primary에서만 증가 (같은 거래의 추가 결제이므로)

---

## 7. 기타 개선사항

### 성명→차번호 자동입력
- 성명 2글자 이상 입력 시 500ms 디바운스 후 DB에서 같은 이름의 최근 차번호 조회
- `/api/admin/hotel/car-lookup` 엔드포인트 추가
- 차번호 칸 비어있을 때만 덮어쓰지 않음

### 연박현황 성명 검색
- 이름 필드 + 날짜 범위 + 상태 필터 복합 적용
- 부분 일치 검색

### 대시보드 주간/월간 재설계
- 주간 테이블 + 월간 예상 매출
- 요일별 가중치(월~목:180, 금:280, 토:400, 일:250)로 월말 예측

### 일일마감 개선
- OTA + 직접 / 카드 / 환불 3개 테이블
- 입력(자동) vs 실재(수동) vs 차이(자동)
- **건수/금액 가로 합계 컬럼 추가**
- 항상 렌더링 input 패턴 (conditional render 제거)

### 인보이스 관리
- 날짜 범위 + 성명 검색
- 연박 그룹핑 표시
- Georgia serif 스타일 인보이스 팝업 + window.print

### SalesGridPanel 무한 루프 수정
- `filteredOptions` 배열 참조 비교가 매 렌더마다 true → length 비교로 변경

---

## 주요 기술 이슈 요약

| 이슈 | 원인 | 해결 |
|------|------|------|
| 한글 첫 글자가 영어로 입력 | div는 IME 미지원 | 숨겨진 proxy input |
| 대시보드 ◀ 2일 점프 | toISOString UTC 변환 | 로컬 시간 기반 dateStr |
| OTA 새 행 저장 안 됨 | channel 필수 체크 실패 | 빈 행에 channel 주입 |
| 빠른 입력 시 행 소실 | 리싱크가 포커스 행 덮어씀 | focusedRow 보호 추가 |
| 호실 중복 오탐 | in-flight 중 occupiedRooms 미갱신 | 새 행은 체크 스킵 |
| 추금액 세부 미반영 | primary만 합산 | RevEntry 분해 처리 |
| SelectCell 무한루프 | 배열 참조 비교 | length 비교 |

---

## 파일 구조

```
web/src/
├── components/hotel/
│   ├── HotelAdminLayout.tsx      # 네비게이션 (메인 + 관리자 드롭다운)
│   ├── SalesPageLegacy.tsx       # 모바일 모달 기반 판매입력
│   ├── SalesPageInline.tsx       # 엔트리: 데스크톱=Grid, 모바일=Legacy
│   ├── BookingsPage.tsx          # 연박 현황
│   ├── ReservationsPage.tsx      # 예약 현황
│   ├── DashboardPage.tsx         # 대시보드 (주간/월간)
│   ├── ClosingPage.tsx           # 일일 마감
│   ├── InvoicesPage.tsx          # 인보이스 관리
│   └── inline/
│       ├── SalesGridPage.tsx     # 6패널 그리드 + 통계
│       ├── SalesGridPanel.tsx    # 단일 패널 (~2900 lines)
│       ├── EditableCell.tsx      # Text/Number/Time/Select/Check Cell
│       └── StatsPanel.tsx        # 공실 + 채널별 매출
└── app/api/admin/hotel/
    ├── sales/route.ts            # CRUD + DELETE 안전장치
    ├── bookings/route.ts
    ├── closing/route.ts
    ├── reconciliation/route.ts
    ├── dashboard-weekly/route.ts
    ├── dashboard-daily/route.ts
    └── car-lookup/route.ts       # 성명→차번호 조회
```
