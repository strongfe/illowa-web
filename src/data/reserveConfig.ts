// ═══════════════════════════════════════════════════════════════
// 홈페이지 직접 예약 — 객실/요금/배정량/취소 규정 설정
//
// • 숙박 요금·사진·특징은 rooms.json(홈페이지 객실 소개와 같은 원본)을 쓴다.
// • 대실 요금·이용시간은 야놀자 대실 "판매" 상품 기준 (2026-11 확인).
//   주말 = 토·일 (금요일은 대실 평일 요금).
//   open/close = 입실 가능 시작 ~ 퇴실 마감 시각, hours = 최대 이용 시간.
// • 배정량 = 날짜·타입별로 홈페이지에서 판매할 기본 방 수 (타입별 전체 객실 수).
//   관리자 "판매 객실 수" 화면에서 날짜별로 바꾼 값이 우선한다.
// ═══════════════════════════════════════════════════════════════

import roomsData from '@/data/rooms.json';
import type { RoomType } from '@/types/hotel';

type RoomJson = (typeof roomsData)[keyof typeof roomsData];

export interface DaesilPlan {
  price: number;
  open: number;  // 입실 가능 시작 (시)
  close: number; // 퇴실 마감 (시)
  hours: number; // 최대 이용 시간
}

export interface ReserveRoom {
  key: keyof typeof roomsData;
  code: RoomType;
  name: string;
  sub: string;
  badge: string;
  feats: string[];
  checkInfo: string;
  photos: string[];
  /** 숙박 1박 요금 (요일별) */
  stayPrice: { weekday: number; fri: number; sat: number; sun: number };
  /** 대실. null 이면 대실 판매 안 함 */
  daesil: { weekday: DaesilPlan; weekend: DaesilPlan } | null;
  /** 홈페이지 기본 배정량 */
  allotment: number;
  /** 연박 상품: 이 박수 이상 선택했을 때만 노출 */
  minNights: number;
  /** 당일특가: 이용일이 오늘일 때만 노출 */
  todayOnly: boolean;
  /** 도보 전용 (차량 방문 불가) */
  walkOnly: boolean;
}

const toNum = (s: string) => Number(s.replace(/,/g, ''));
const plan = (price: number, open: number, close: number, hours: number): DaesilPlan => ({ price, open, close, hours });

// 홈페이지(rooms.json)에 있는 타입을 그대로 판매한다.
const SELLABLE: {
  key: keyof typeof roomsData;
  code: RoomType;
  daesil: { weekday: DaesilPlan; weekend: DaesilPlan } | null;
  allotment: number;
  minNights?: number;
  todayOnly?: boolean;
  walkOnly?: boolean;
}[] = [
  { key: 'dj', code: 'T', allotment: 1, todayOnly: true, walkOnly: true,
    daesil: { weekday: plan(25000, 13, 20, 5), weekend: plan(30000, 13, 20, 4) } },
  { key: 'std', code: 'S', allotment: 14,
    daesil: { weekday: plan(30000, 13, 21, 6), weekend: plan(35000, 13, 21, 5) } },
  { key: 'gstd', code: 'GS', allotment: 8,
    daesil: { weekday: plan(30000, 13, 21, 6), weekend: plan(35000, 13, 21, 5) } },
  { key: 'dlx', code: 'D', allotment: 5,
    daesil: { weekday: plan(35000, 13, 21, 7), weekend: plan(40000, 13, 21, 6) } }, // 토요일은 14시부터 (아래 SAT_OPEN)
  { key: 'gdlx', code: 'GD', allotment: 5,
    daesil: { weekday: plan(35000, 13, 21, 7), weekend: plan(40000, 13, 21, 6) } },
  { key: 'pm', code: 'P', allotment: 5,
    daesil: { weekday: plan(40000, 13, 21, 6), weekend: plan(45000, 13, 21, 7) } },
  { key: 'pmt', code: 'PT', allotment: 5,
    daesil: { weekday: plan(45000, 14, 21, 6), weekend: plan(50000, 13, 21, 7) } },
  { key: 'lstd', code: 'S', daesil: null, allotment: 1, minNights: 2 },
  { key: 'ldlx', code: 'D', daesil: null, allotment: 1, minNights: 2 },
  { key: 'lpm', code: 'P', daesil: null, allotment: 1, minNights: 2 },
  { key: 'lpmt', code: 'PT', daesil: null, allotment: 1, minNights: 2 },
];

/** 토요일만 입실 시작 시각이 다른 타입 (야놀자 기준: 디럭스 토 14시~) */
export const SAT_OPEN: Partial<Record<keyof typeof roomsData, number>> = { dlx: 14 };

export const RESERVE_ROOMS: ReserveRoom[] = SELLABLE.map(({
  key, code, daesil, allotment, minNights = 1, todayOnly = false, walkOnly = false,
}) => {
  const r: RoomJson = roomsData[key];
  return {
    key,
    code,
    name: r.name,
    sub: r.sub,
    badge: r.badge,
    feats: r.feats,
    checkInfo: r.ci,
    photos: r.photos,
    stayPrice: {
      weekday: toNum(r.prices['평일']),
      fri: toNum(r.prices['금']),
      sat: toNum(r.prices['토']),
      sun: toNum(r.prices['일']),
    },
    daesil,
    allotment,
    minNights,
    todayOnly,
    walkOnly,
  };
});

/** 대실 입실 시각 선택지 (30분 단위). 타입별로 입실 가능 시간 안의 것만 판매한다. */
export const DAESIL_START_TIMES = Array.from({ length: 13 }, (_, i) => {
  const m = 13 * 60 + i * 30; // 13:00 ~ 19:00
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`;
});
/** 퇴실 마감까지 최소 이용 시간 (분) — 이보다 짧게 남으면 그 시각엔 팔지 않는다 */
export const DAESIL_MIN_MINUTES = 120;

/** 온라인 결제창을 연 동안 객실을 잡아 두는 시간 (분). 결제를 마치지 않으면 풀린다 */
export const CARD_HOLD_MINUTES = 20;

/** 무통장 입금 기한 (분). 이 안에 입금 확인(확정)이 안 되면 자동 취소 */
export const TRANSFER_DEADLINE_MINUTES = 120;

/** 예약 가능 기간 (오늘부터 N일) */
export const BOOKABLE_DAYS = 60;

// 취소·환불 규정 — 야놀자 규정과 같게 운영 (2026-10 기준)
export const CANCEL_POLICY = [
  '입실 1일 전까지 취소 가능 (취소 수수료 없음)',
  '예약 후 60분 이내 취소 가능 (취소 수수료 없음, 입실 시간 전까지)',
  '입실 시간 이후 또는 실제 입실 이후에는 취소할 수 없습니다',
  '입실 시간이 지난 뒤 예약한 경우 취소할 수 없으나, 예약 후 15분 이내에는 취소할 수 있습니다',
  '상품이 안내된 내용과 다르거나 약속과 다르게 제공된 경우, 입실 이후라도 취소할 수 있습니다',
  '무통장 입금은 신청 후 2시간 안에 입금해 주세요. 기한이 지나면 예약이 자동 취소됩니다',
  '취소는 호텔(031-464-9661)로 전화 주세요. 무통장 입금 건은 입금하신 계좌로 환불해 드립니다',
];
