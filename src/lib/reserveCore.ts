// ═══════════════════════════════════════════════════════════════
// 홈페이지 직접 예약 — 화면과 서버가 함께 쓰는 순수 계산 모듈
//
// • 날짜는 'YYYY-MM-DD' 문자열(한국 시간 기준)로만 다룬다. 서버(Railway)는
//   UTC 로 돌기 때문에 Date 의 로컬 시간대에 의존하지 않도록 UTC 연산만 쓴다.
// • 요금은 서버에서 이 함수로 다시 계산한다 (화면이 보낸 금액은 믿지 않음).
// ═══════════════════════════════════════════════════════════════

import {
  RESERVE_ROOMS, DAESIL_START_TIMES, DAESIL_MIN_MINUTES, BOOKABLE_DAYS, SAT_OPEN, type DaesilPlan, type ReserveRoom,
} from '@/data/reserveConfig';

export type Mode = 'stay' | 'daesil';
export type PayMethod = 'onsite' | 'transfer' | 'card';
export type ReservationStatus = 'awaiting_payment' | 'pending' | 'confirmed' | 'cancelled' | 'no_show';

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  awaiting_payment: '결제 중',
  pending: '확인 대기',
  confirmed: '확정',
  cancelled: '취소',
  no_show: '노쇼',
};
export const PAY_LABELS: Record<PayMethod, string> = { onsite: '현장 결제', transfer: '무통장 입금', card: '온라인 결제' };

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
/** 대실 주말 = 토·일 (금요일은 평일 요금) */
export const isDaesilWeekend = (k: string) => [0, 6].includes(dayOfWeek(k));

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000);
/** 한국 시간 기준 오늘 */
export const todayKST = () => keyOf(kstNow());
/** 한국 시간 기준 지금 (자정부터 분) */
export const nowMinutesKST = () => {
  const d = kstNow();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const fmtDuration = (min: number) =>
  min % 60 === 0 ? `${min / 60}시간` : `${Math.floor(min / 60)}시간 ${min % 60}분`;

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

/** 그날의 대실 조건 (요금·입실 가능 시간·최대 이용 시간) */
export function daesilPlan(room: ReserveRoom, k: string): DaesilPlan | null {
  if (!room.daesil) return null;
  const p = isDaesilWeekend(k) ? room.daesil.weekend : room.daesil.weekday;
  const satOpen = dayOfWeek(k) === 6 ? SAT_OPEN[room.key] : undefined;
  return satOpen ? { ...p, open: satOpen } : p;
}

/** 이 시각에 입실하면 언제까지 쓸 수 있나. 입실 가능 시간 밖이면 null */
export function daesilSlot(room: ReserveRoom, k: string, time: string) {
  const p = daesilPlan(room, k);
  if (!p) return null;
  const start = toMin(time);
  const close = p.close * 60;
  if (start < p.open * 60 || close - start < DAESIL_MIN_MINUTES) return null;
  const end = Math.min(start + p.hours * 60, close);
  return { end: toTime(end), minutes: end - start, plan: p };
}

export function priceOf(room: ReserveRoom, mode: Mode, checkIn: string, checkOut: string) {
  if (mode === 'daesil') return daesilPlan(room, checkIn)?.price ?? 0;
  return occupiedDates('stay', checkIn, checkOut).reduce((sum, k) => sum + stayNightPrice(room, k), 0);
}

/** 이 조건에서 노출(판매)되는 타입인가. 대실은 입실 시각(daesilTime)까지 본다 */
export function isSellable(
  room: ReserveRoom, mode: Mode, checkIn: string, checkOut: string, today: string, daesilTime?: string | null,
) {
  if (room.todayOnly && checkIn !== today) return false;
  if (mode === 'daesil') return !!room.daesil && (!daesilTime || !!daesilSlot(room, checkIn, daesilTime));
  const nights = nightsBetween(checkIn, checkOut);
  return nights >= room.minNights;
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
    // 서비스 제공기간(결제일 ~ 퇴실일)을 최대 BOOKABLE_DAYS 일로 맞춘다 (PG 심사 기재 항목)
    if (checkOut > addDays(today, BOOKABLE_DAYS)) return `퇴실일은 오늘부터 ${BOOKABLE_DAYS}일 이내여야 합니다`;
  }
  return null;
}

export const isDaesilTime = (t: unknown): t is string =>
  typeof t === 'string' && DAESIL_START_TIMES.includes(t);

/** 오늘 대실이면 이미 지난 입실 시각은 고를 수 없다 */
export const isPastTime = (checkIn: string, time: string, today: string) =>
  checkIn === today && toMin(time) <= nowMinutesKST();

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
