# 광고 추적 운영 가이드 (GA4 · GTM · Google Ads)

illowa-hotel.com의 광고 성과 분석 구조와 운영 체크리스트. 향후 광고 관리·디버깅 시 이 문서를 먼저 참조.

---

## ⚠ 가장 먼저 읽을 것: "기다리면 들어온다"는 함정

**GA4에 이벤트가 안 보일 때 "시간 지나면 수집되겠지"라고 기다리면 안 된다.** 2026-04-14 트러블슈팅에서 실제로 겪은 일이다. 사이트는 `booking_click`을 정상 발사하고 있었고 GTM도 이벤트를 받고 있었지만, **GTM → GA4 전송 태그가 비어 있어서** 며칠을 기다려도 절대 들어올 수 없는 상태였다. 그런데 외형상으로는 "GA4 설치 정상 + 다른 이벤트는 수집됨"이라 그냥 기다리기 쉽다.

원칙: **GA4 보고서 지연(24~48h)은 "이미 수신된 이벤트의 집계 지연"이지, "파이프라인이 알아서 고쳐지는 시간"이 아니다.** 새 이벤트가 안 보이면 지연이 아니라 **파이프라인 어딘가가 끊긴 것**이라고 가정하고 § 7 체크리스트로 즉시 진단한다.

빠른 1분 판정법: **GA4 DebugView**를 열고 브라우저에서 해당 버튼을 직접 클릭해본다. DebugView에 실시간으로 안 뜨면 100% 파이프라인 문제다. 기다려봐야 안 들어온다.

---

## 1. 전제: 이 사이트의 전환은 "예약 완료"가 아니라 "OTA 클릭"

illowa-hotel.com은 자체 결제가 없고, 예약은 전부 외부 OTA(Booking.com, Agoda, Google Hotels, Trip.com, Expedia, HotelsCombined, Yanolja, 여기어때, TripAdvisor)로 아웃바운드된다. 따라서 **1차 전환 = `booking_click`** 으로 정의한다. 예약 완료 측정은 불가능하며, `purchase` 이벤트를 전환으로 써서는 안 된다.

---

## 2. 추적 ID / 환경변수

[web/src/app/layout.tsx:27-31](../src/app/layout.tsx#L27-L31)

| 항목 | 값 / 출처 | 비고 |
|---|---|---|
| GTM 컨테이너 | `GTM-KS2PGX4` (하드코딩) | 항상 로드 |
| GA4 측정 ID | `G-ZKL5H9BCPQ` | GTM 내부 구성 태그에서 관리 |
| `NEXT_PUBLIC_GA_ID` | env | **GTM이 있으면 직접 로드 안 함** (`!GTM_ID` 분기, [layout.tsx:194](../src/app/layout.tsx#L194)) |
| `NEXT_PUBLIC_GADS_ID` | env | `AW-...` 형식. 비어 있으면 Ads 스크립트 로드 안 됨 |
| `NEXT_PUBLIC_META_PIXEL_ID` | env (선택) | GTM 미사용 시에만 직접 로드 |
| `NEXT_PUBLIC_NAVER_ACCOUNT_ID` | env (선택) | wcslog |

**운영 원칙**: GA4·Meta Pixel·Google Ads는 가능하면 **GTM 내부에서 관리**. 코드에서 직접 로드하면 이중 발사 위험.

---

## 3. 프론트엔드 이벤트 발사 지점

### 3-1. 실제 JS로 발사하는 곳 (한 곳뿐)

[web/src/components/BookingCTA.tsx:32-40](../src/components/BookingCTA.tsx#L32-L40) `trackConversion(platform)`:

```ts
dataLayer.push({ event: 'booking_click', platform })
gtag('event', 'conversion', { send_to: `${GADS_ID}/booking_click` })
wcs.event('send', 'booking_click', platform)
```

BookingCTA 섹션의 9개 OTA 버튼 + 직접 전화 버튼의 `onClick`에 연결되어 있다.

### 3-2. `data-track` 속성만 있는 곳 (GTM 설정에 의존)

다음 버튼들은 **JS 핸들러가 없고 `data-track` DOM 속성만 있다**. GTM의 "Click - All Elements" 트리거 + DOM 변수로 잡아야 이벤트가 생긴다. GTM 구성이 빠지면 통째로 누락된다.

- [Rooms.tsx:119](../src/components/Rooms.tsx#L119) — `click_room_card_booking` (객실 카드 Book Now)
- [StickyBookingBar.tsx:55](../src/components/StickyBookingBar.tsx#L55) — `click_sticky_call`
- [StickyBookingBar.tsx:65](../src/components/StickyBookingBar.tsx#L65) — `click_sticky_booking`
- [Header.tsx:51](../src/components/Header.tsx#L51) — `click_call_header`

**권장 개선**: 이 네 곳도 BookingCTA와 동일 패턴으로 `onClick={() => trackConversion(...)}`을 추가해 JS 레벨에서 직접 push 하는 것이 안전. 그러면 `section_name`(room_card / sticky / header / booking_cta)과 `room_type`도 파라미터로 함께 보낼 수 있다.

### 3-3. 이벤트 페이로드 구조

```js
{ event: 'booking_click', platform: 'Booking.com' }
```

현재는 `platform`만 보낸다. 확장 시 권장 파라미터:
- `platform` — OTA 명칭 (기존)
- `section_name` — 클릭 위치 (room_card / sticky / header / booking_cta_primary / booking_cta_secondary / booking_cta_support)
- `room_type` — 객실 카드 클릭 시 객실 타입 (T/GS/GD/S/D/P/PT)
- `click_url` — 이동 대상 URL
- `page_location` — 현재 페이지

---

## 4. GTM 컨테이너 구성 (GTM-KS2PGX4, 현재 게시 버전 5)

### 변수
- **DLV - platform** (Data Layer Variable, v2) — 데이터 영역 변수명 `platform`

### 트리거
- **CE - booking_click** — 커스텀 이벤트, 이벤트 이름 `booking_click`

### 태그
- **GA4 - booking_click**
  - 유형: GA4 이벤트
  - 측정 ID: `G-ZKL5H9BCPQ`
  - 이벤트 이름: `booking_click`
  - 매개변수: `platform = {{DLV - platform}}`
  - 트리거: `CE - booking_click`

### 기존 태그 (정리 대상 후보)
- `OTA_링크클릭` 트리거
- `OTA_예약클릭_전환` 태그

이 두 개는 초기에 만들어진 구조로, 현재의 `booking_click` 흐름과 **중복 또는 불일치** 가능성이 있다. 점검 시 반드시 `booking_click`과의 관계를 확인하고, 중복이면 제거하거나 통합한다.

---

## 5. Google Ads 전환 — ⚠ 주의

[BookingCTA.tsx:36](../src/components/BookingCTA.tsx#L36):
```ts
send_to: `${GADS_ID}/booking_click`
```

Google Ads 전환 라벨은 실제로는 `AbCdEfGh1J2kL3mN` 같은 **Ads가 발급한 난수 문자열**이다. 현재 코드의 `booking_click`은 사람이 읽는 placeholder이며, 이 상태로는 **Ads 전환이 유효하지 않을 수 있다**.

**해결 방법 (둘 중 택일, 권장은 B)**:

- **A.** Google Ads에서 전환 액션을 새로 만들고 발급받은 실제 라벨을 하드코딩하거나 env로 주입
- **B.** 코드의 gtag 호출(`w.gtag?.('event','conversion',...)`)을 **제거**하고 GTM 내부의 Google Ads 전환 태그(`booking_click` 트리거로 발화)만으로 관리. 이중 발사 방지 겸 운영 단일화.

둘 다 하지 않으면 Ads 전환 집계는 조용히 누락된다.

---

## 6. 과거 트러블슈팅: `booking_click`이 GA4에 안 보이던 건

### 증상
- GA4 획득 보고서에 Paid Search 유입은 있음
- 주요 이벤트 0, 세션 주요 이벤트 비율 0%
- 관리자 > 이벤트에는 `purchase`만 노출 (스트림 데이터 없음)
- 이벤트 보고서에 `page_view`, `scroll`, `click` 등만 있고 `booking_click` 부재
- DebugView에도 `booking_click` 미수신

### 원인
- 사이트 → `booking_click` 발사: **정상** (콘솔에서 `dataLayer.push` 감시로 확인)
- GTM → `booking_click` 수신: **정상** (Preview에서 이벤트 감지)
- GTM → GA4 전송: **여기가 비어 있었음**. `booking_click` 이벤트에 반응하는 태그가 0개였다.

### 해결
GTM에 § 4의 변수/트리거/태그 3종을 추가하고 게시(버전 5: "GA4 booking_click tracking 추가").

### 교훈
- **"코드에 로직이 있다" ≠ "GA4에 데이터가 들어온다"**. 프론트엔드 발사 / GTM 수신 / GA4 수신은 각각 별개의 검증 지점이다. 하나라도 빠지면 끝단 데이터는 0.
- 런타임 검증(Console → GTM Preview → GA4 DebugView)이 코드 리뷰보다 항상 우선.
- Preview 세션이 외부 OTA 링크 이동으로 끊기면, 콘솔에서 수동 push로 검증한다:
  ```js
  window.dataLayer.push({ event: 'booking_click', platform: 'Booking.com' })
  ```

---

## 7. 운영 체크리스트 (이상 증상 발생 시 이 순서로 점검)

### 7-1. 프론트엔드 발사 확인 (Console)
```js
// 1. dataLayer 존재
window.dataLayer
// 2. push 감시
const _origPush = window.dataLayer.push;
window.dataLayer.push = function(...a){ console.log('DL:', a); return _origPush.apply(this, a); };
// 3. OTA 버튼 클릭 → {event: 'booking_click', platform: '...'} 로그 확인
```

누락이면: [BookingCTA.tsx](../src/components/BookingCTA.tsx) 또는 `data-track` 전용 버튼의 핸들러 부재. § 3-2 참고.

### 7-2. GTM 수신 확인 (GTM Preview / Tag Assistant)
- `booking_click` 이벤트가 좌측 이벤트 목록에 뜨는가?
- "Variables" 탭에서 `DLV - platform` 값이 채워지는가?
- "Tags Fired"에 `GA4 - booking_click`이 있는가?

태그 Fired 0이면: § 4 구성 누락. 트리거 이벤트 이름 철자 확인 (`booking_click`).

### 7-3. GA4 수신 확인 (DebugView)
- 좌측 이벤트 스트림에 `booking_click` 나타나는가?
- 이벤트 클릭 시 `platform` 파라미터가 함께 있는가?

GA4 DebugView를 쓰려면 브라우저에 GA Debugger 확장을 설치하거나 GTM Preview 모드일 때 자동 디버그된다.

### 7-4. GA4 표준 보고서 확인
- 보고서 > 참여도 > 이벤트에 `booking_click` 노출 (최대 24~48시간 지연)
- 관리자 > 이벤트에 `booking_click` 노출 → **주요 이벤트로 표시** 토글 ON
- 획득 보고서에서 세션별 주요 이벤트 비율이 0이 아닌지 확인

### 7-5. Google Ads 연동 확인
- Ads > 도구 > 전환: `booking_click` 전환 액션 상태가 "기록됨"인가?
- § 5 주의사항에 따라 `send_to` 라벨과 실제 Ads 전환 라벨이 일치하는지 확인.

---

## 8. 분석 활용 (수집이 정상화된 이후)

GA4에서 가능해진 분석:
- 채널별 `booking_click` 수 (소스/매체 × `booking_click`)
- Paid Search 유입 → 어느 `platform`으로 아웃바운드되는지
- `platform` 분포 — 어느 OTA가 가장 많이 눌리는지
- (§ 3-3 확장 후) `section_name`, `room_type`별 분해 → 어느 객실 카드/어느 섹션이 가장 전환 기여도가 높은지 → 광고 랜딩·객실 상세 개선

권장 GA4 탐색 분석:
1. 자유 형식: 측정기준 `세션 소스/매체` × 측정항목 `booking_click 이벤트 수`
2. 자유 형식: 측정기준 `platform` × 측정항목 `이벤트 수` (`booking_click` 필터)
3. 유입경로: 첫 page_view → booking_click → OTA별 분기

---

## 9. 변경 이력

| 날짜 | 내용 | 담당 |
|---|---|---|
| 2026-04-14 | 이 문서 최초 작성 | — |
| (GTM v5) | `CE - booking_click`, `DLV - platform`, `GA4 - booking_click` 추가 및 게시 | — |

---

## 10. 남은 후속 작업

- [ ] § 3-2 네 곳(Rooms, StickyBookingBar×2, Header)에 `trackConversion` onClick 추가
- [ ] § 3-3 확장 파라미터(`section_name`, `room_type`) 발사
- [ ] § 5 Google Ads `send_to` 라벨을 실제 Ads 전환 라벨로 교체하거나 GTM 전용으로 전환
- [ ] § 4 기존 `OTA_링크클릭` / `OTA_예약클릭_전환` 태그 중복 여부 점검 및 정리
- [ ] GA4 관리자에서 `booking_click`을 **주요 이벤트**로 지정
- [ ] Ads와 GA4 속성 연결 상태 확인 (Ads 전환 가져오기 or 직접 전환)
