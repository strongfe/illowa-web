// ═══════════════════════════════════════════════════════════════
// 홈페이지 직접 예약 — 화면과 서버가 함께 쓰는 순수 계산 모듈
//
// • 날짜는 'YYYY-MM-DD' 문자열(한국 시간 기준)로만 다룬다. 서버(Railway)는
//   UTC 로 돌기 때문에 Date 의 로컬 시간대에 의존하지 않도록 UTC 연산만 쓴다.
// • 요금은 서버에서 이 함수로 다시 계산한다 (화면이 보낸 금액은 믿지 않음).
// ═══════════════════════════════════════════════════════════════

import {
  RESERVE_ROOMS, DAESIL_START_TIMES, DAESIL_HOURS, BOOKABLE_DAYS, type ReserveRoom,
} from '@/data/reserveConfig';

export type Mode = 'stay' | 'daesil';
export type PayMethod = 'onsite' | 'transfer';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'no_show';

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: '확인 대기',
  confirmed: '확정',
  cancelled: '취소',
  no_show: '노쇼',
};
export const PAY_LABELS: Record<PayMethod, string> = { onsite: '현장 결제', transfer: '무통장 입금' };

// ── 날짜 ──
const pad = (n: number) => String(n).padStart(2, '0');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isDateKey = (k: unknown): k is string =>
  typeof k === 'string' && DATE_RE.test(k) && !Number.isNaN(Date.parse(`${k}T00:00:00Z`));

const utc = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const addDays = (k: string, n: number) => {
  const d = utc(k);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
export const nightsBetween = (a: string, b: string) =>
  Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000);
export const dayOfWeek = (k: string) => utc(k).getUTCDay();
export const isWeekend = (k: string) => [0, 5, 6].includes(dayOfWeek(k)); // 금·토·일

/** 한국 시간 기준 오늘 */
export const todayKST = () => keyOf(new Date(Date.now() + 9 * 3600 * 1000));

export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const fmtDay = (k: string) => {
  const d = utc(k);
  return `${d.getUTCMonth() + 1}.${pad(d.getUTCDate())} (${WEEK[d.getUTCDay()]})`;
};
export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** 숙박이 차지하는 날짜(박) 목록. 대실은 이용일 하루. */
export const occupiedDates = (mode: Mode, checkIn: string, checkOut: string) =>
  mode === 'daesil'
    ? [checkIn]
    : Array.from({ length: nightsBetween(checkIn, checkOut) }, (_, i) => addDays(checkIn, i));

// ── 요금 ──
export function stayNightPrice(room: ReserveRoom, k: string) {
  const day = dayOfWeek(k);
  if (day === 5) return room.stayPrice.fri;
  if (day === 6) return room.stayPrice.sat;
  if (day === 0) return room.stayPrice.sun;
  return room.stayPrice.weekday;
}

export function priceOf(room: ReserveRoom, mode: Mode, checkIn: string, checkOut: string) {
  if (mode === 'daesil') {
    if (!room.daesilPrice) return 0;
    return isWeekend(checkIn) ? room.daesilPrice.weekend : room.daesilPrice.weekday;
  }
  return occupiedDates('stay', checkIn, checkOut).reduce((sum, k) => sum + stayNightPrice(room, k), 0);
}

export const daesilHoursOn = (k: string) => (isWeekend(k) ? DAESIL_HOURS.weekend : DAESIL_HOURS.weekday);

/** 이 조건에서 노출(판매)되는 타입인가 */
export function isSellable(room: ReserveRoom, mode: Mode, checkIn: string, checkOut: string, today: string) {
  if (mode === 'daesil') return !!room.daesilPrice;
  const nights = nightsBetween(checkIn, checkOut);
  return nights >= room.minNights && (!room.todayOnly || checkIn === today);
}

export const findRoom = (key: string) => RESERVE_ROOMS.find((r) => r.key === key) ?? null;

/** 날짜 조건 검증. 문제가 있으면 오류 문구, 없으면 null */
export function validateDates(mode: Mode, checkIn: string, checkOut: string, today: string) {
  if (!isDateKey(checkIn)) return '이용일이 올바르지 않습니다';
  if (checkIn < today) return '지난 날짜는 예약할 수 없습니다';
  if (checkIn > addDays(today, BOOKABLE_DAYS)) return `${BOOKABLE_DAYS}일 이내 날짜만 예약할 수 있습니다`;
  if (mode === 'stay') {
    if (!isDateKey(checkOut)) return '퇴실일이 올바르지 않습니다';
    const n = nightsBetween(checkIn, checkOut);
    if (n < 1) return '퇴실일은 입실일 다음 날 이후여야 합니다';
    if (n > 14) return '14박 이하로 예약해 주세요';
  }
  return null;
}

export const isDaesilTime = (t: unknown): t is string =>
  typeof t === 'string' && DAESIL_START_TIMES.includes(t);

export const PHONE_RE = /^01[016789]-?\d{3,4}-?\d{4}$/;
export const normalizePhone = (p: string) => p.replace(/\D/g, '');
export const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};

export { RESERVE_ROOMS };
export type { ReserveRoom };

// ── API 주고받는 모양 ──
export interface AvailabilityItem {
  key: string;
  remaining: number;
  price: number;
}

export interface ReservationRequest {
  mode: Mode;
  roomKey: string;
  checkIn: string;
  checkOut: string;
  daesilTime: string | null;
  guestName: string;
  phone: string;
  visit: 'walk' | 'car';
  carNo: string;
  request: string;
  payMethod: PayMethod;
  agree: boolean;
  /** 봇 차단용 빈 칸 (사람은 비워 둔다) */
  website?: string;
}
