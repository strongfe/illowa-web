// ═══════════════════════════════════════════════════════════════
// 홈페이지 직접 예약 — 객실/요금/배정량 설정 (시안)
//
// • 숙박 요금·사진·특징은 rooms.json(홈페이지 객실 소개와 같은 원본)을 쓴다.
// • 대실 요금·이용시간, 배정량, 취소 규정은 아직 확정 전인 임시값이다.
//   실제 운영 전 호텔 확인 후 교체할 것. (TODO: 확정값으로 교체)
// • 배정량 = 날짜·타입별로 홈페이지에서 판매할 방 수. 시안에서는
//   남은 객실 수를 날짜 기반 가짜 값으로 보여준다 (DB 연동 전).
// ═══════════════════════════════════════════════════════════════

import roomsData from '@/data/rooms.json';
import type { RoomType } from '@/types/hotel';

type RoomJson = (typeof roomsData)[keyof typeof roomsData];

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
  /** 대실 요금 (임시). null 이면 대실 판매 안 함 */
  daesilPrice: { weekday: number; weekend: number } | null;
  /** 홈페이지 기본 배정량 (임시) */
  allotment: number;
  /** 연박 상품: 이 박수 이상 선택했을 때만 노출 */
  minNights: number;
  /** 당일특가: 입실일이 오늘일 때만 노출 */
  todayOnly: boolean;
  /** 도보 전용 (차량 방문 불가) */
  walkOnly: boolean;
}

const toNum = (s: string) => Number(s.replace(/,/g, ''));

// 홈페이지(rooms.json)에 있는 타입을 그대로 판매한다. 숙박 요금도 rooms.json 기준.
const SELLABLE: {
  key: keyof typeof roomsData;
  code: RoomType;
  daesil: { weekday: number; weekend: number } | null;
  allotment: number;
  minNights?: number;
  todayOnly?: boolean;
  walkOnly?: boolean;
}[] = [
  { key: 'dj', code: 'T', daesil: null, allotment: 1, todayOnly: true, walkOnly: true },
  { key: 'std', code: 'S', daesil: { weekday: 30000, weekend: 35000 }, allotment: 3 },
  { key: 'gstd', code: 'GS', daesil: { weekday: 35000, weekend: 40000 }, allotment: 2 },
  { key: 'dlx', code: 'D', daesil: { weekday: 35000, weekend: 40000 }, allotment: 1 },
  { key: 'gdlx', code: 'GD', daesil: { weekday: 40000, weekend: 45000 }, allotment: 1 },
  { key: 'pm', code: 'P', daesil: { weekday: 40000, weekend: 45000 }, allotment: 1 },
  { key: 'pmt', code: 'PT', daesil: { weekday: 45000, weekend: 50000 }, allotment: 1 },
  { key: 'lstd', code: 'S', daesil: null, allotment: 1, minNights: 2 },
  { key: 'ldlx', code: 'D', daesil: null, allotment: 1, minNights: 2 },
  { key: 'lpm', code: 'P', daesil: null, allotment: 1, minNights: 2 },
  { key: 'lpmt', code: 'PT', daesil: null, allotment: 1, minNights: 2 },
];

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
    daesilPrice: daesil,
    allotment,
    minNights,
    todayOnly,
    walkOnly,
  };
});

// 대실: 30분 단위 입실 12:00~18:00 (비즈니스 규칙). 이용시간은 임시값.
export const DAESIL_START_TIMES = Array.from({ length: 13 }, (_, i) => {
  const m = 12 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 === 0 ? '00' : '30'}`;
});
export const DAESIL_HOURS = { weekday: 5, weekend: 4 };

/** 예약 가능 기간 (오늘부터 N일) */
export const BOOKABLE_DAYS = 60;

export const CANCEL_POLICY = [
  '이용일 전날 18시까지: 무료 취소',
  '이용일 전날 18시 이후 ~ 이용 당일: 취소 불가',
  '노쇼(연락 없이 미입실) 시 재예약이 제한될 수 있습니다',
];
