import crypto from 'node:crypto';
import type postgres from 'postgres';
import { db } from '@/lib/db';
import { sendSms, hotelNotifyPhones } from '@/lib/sms';
import {
  RESERVE_ROOMS, PAY_LABELS, addDays, daesilSlot, findRoom, fmtDay, fmtDuration, isDaesilTime, isPastTime,
  isSellable, nightsBetween, normalizePhone, occupiedDates, priceOf, todayKST, validateDates, won, PHONE_RE,
  type AvailabilityItem, type Mode, type ReservationRequest, type ReservationStatus,
} from '@/lib/reserveCore';

// 객실을 차지하는 상태 (취소·노쇼는 객실을 돌려준다)
const HOLDING: ReservationStatus[] = ['pending', 'confirmed'];
const HOTEL_TEL = '031-464-9661';

type Sql = postgres.Sql | postgres.TransactionSql;

export interface ReservationRow {
  id: number;
  code: string;
  mode: Mode;
  room_key: string;
  room_name: string;
  check_in: string;
  check_out: string;
  daesil_time: string | null;
  daesil_hours: number | null;
  daesil_end: string | null;
  guest_name: string;
  phone: string;
  visit: 'walk' | 'car';
  car_no: string;
  request: string;
  pay_method: 'onsite' | 'transfer';
  amount: number;
  status: ReservationStatus;
  admin_memo: string;
  created_at: string;
}

/** 날짜별·타입별 남은 객실 = 배정량 − 점유 중인 예약 수 (여러 박이면 가장 적은 날 기준) */
async function remainingMap(sql: Sql, mode: Mode, dates: string[], roomKeys: string[]) {
  const first = dates[0];
  const last = dates[dates.length - 1];

  const allotRows = await sql<{ stay_date: string; room_key: string; qty: number }[]>`
    SELECT stay_date, room_key, qty FROM web_allotments
    WHERE mode = ${mode} AND stay_date BETWEEN ${first} AND ${last} AND room_key IN ${sql(roomKeys)}
  `;
  const usedRows = await sql<{ day: string; room_key: string; n: number }[]>`
    SELECT d::date::text AS day, r.room_key, count(*)::int AS n
    FROM generate_series(${first}::date, ${last}::date, interval '1 day') AS d
    JOIN web_reservations r
      ON r.check_in <= d::date AND d::date < r.check_out
    WHERE r.mode = ${mode} AND r.status IN ${sql(HOLDING)} AND r.room_key IN ${sql(roomKeys)}
    GROUP BY 1, 2
  `;

  const allot = new Map(allotRows.map((r) => [`${r.stay_date}|${r.room_key}`, r.qty]));
  const used = new Map(usedRows.map((r) => [`${r.day}|${r.room_key}`, r.n]));

  const result = new Map<string, number>();
  for (const key of roomKeys) {
    const base = findRoom(key)?.allotment ?? 0;
    const perDay = dates.map((d) => (allot.get(`${d}|${key}`) ?? base) - (used.get(`${d}|${key}`) ?? 0));
    result.set(key, Math.max(0, Math.min(...perDay)));
  }
  return result;
}

export async function getAvailability(mode: Mode, checkIn: string, checkOut: string): Promise<AvailabilityItem[]> {
  const today = todayKST();
  // 대실은 시각과 무관하게 그날 대실 판매 타입 전부의 잔여를 돌려준다 (시각 필터는 화면에서)
  const rooms = RESERVE_ROOMS.filter((r) => isSellable(r, mode, checkIn, checkOut, today));
  if (rooms.length === 0) return [];
  const remaining = await remainingMap(db(), mode, occupiedDates(mode, checkIn, checkOut), rooms.map((r) => r.key));
  return rooms.map((r) => ({
    key: r.key,
    remaining: remaining.get(r.key) ?? 0,
    price: priceOf(r, mode, checkIn, checkOut),
  }));
}

export class ReserveError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function createReservation(input: Partial<ReservationRequest>, ip: string) {
  const today = todayKST();
  const mode: Mode = input.mode === 'daesil' ? 'daesil' : 'stay';
  const room = findRoom(clean(input.roomKey, 20));
  const checkIn = clean(input.checkIn, 10);
  const checkOut = mode === 'daesil' ? addDays(checkIn, 1) : clean(input.checkOut, 10);
  const guestName = clean(input.guestName, 30);
  const phoneRaw = clean(input.phone, 20);
  const visit = input.visit === 'car' ? 'car' : 'walk';
  const carNo = visit === 'car' ? clean(input.carNo, 20) : '';
  const request = clean(input.request, 300);
  const payMethod = input.payMethod === 'transfer' ? 'transfer' : 'onsite';

  if (!room) throw new ReserveError('객실을 다시 선택해 주세요');
  const dateErr = validateDates(mode, checkIn, checkOut, today);
  if (dateErr) throw new ReserveError(dateErr);
  if (mode === 'daesil') {
    if (!isDaesilTime(input.daesilTime)) throw new ReserveError('대실 입실 시간을 선택해 주세요');
    if (isPastTime(checkIn, input.daesilTime, today)) throw new ReserveError('이미 지난 입실 시간입니다. 다른 시간을 선택해 주세요');
  }
  if (!isSellable(room, mode, checkIn, checkOut, today, input.daesilTime)) {
    throw new ReserveError('선택하신 날짜·시간에는 판매하지 않는 객실입니다');
  }
  if (!guestName) throw new ReserveError('예약자 이름을 입력해 주세요');
  if (!PHONE_RE.test(phoneRaw)) throw new ReserveError('휴대폰 번호를 정확히 입력해 주세요');
  if (visit === 'car' && room.walkOnly) throw new ReserveError('이 객실은 도보 방문 전용입니다');
  if (visit === 'car' && !carNo) throw new ReserveError('차량번호를 입력해 주세요');
  if (!input.agree) throw new ReserveError('필수 약관에 동의해 주세요');

  const phone = normalizePhone(phoneRaw);
  const amount = priceOf(room, mode, checkIn, checkOut);
  const daesilTime = mode === 'daesil' ? (input.daesilTime as string) : null;
  const slot = daesilTime ? daesilSlot(room, checkIn, daesilTime) : null;
  const daesilHours = slot ? slot.plan.hours : null;
  const daesilEnd = slot ? slot.end : null;

  const row = await db().begin(async (tx) => {
    // 같은 타입 예약끼리는 한 줄로 세워서 마지막 1실을 두 명이 동시에 잡지 못하게 한다.
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`${mode}:${room.key}`}))`;
    const remaining = await remainingMap(tx, mode, occupiedDates(mode, checkIn, checkOut), [room.key]);
    if ((remaining.get(room.key) ?? 0) < 1) {
      throw new ReserveError('방금 예약이 마감되었습니다. 다른 객실이나 날짜를 선택해 주세요', 409);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `IW${checkIn.replace(/-/g, '').slice(2)}-${crypto.randomInt(1000, 10000)}`;
      const [r] = await tx<ReservationRow[]>`
        INSERT INTO web_reservations
          (code, mode, room_key, room_name, check_in, check_out, daesil_time, daesil_hours, daesil_end,
           guest_name, phone, visit, car_no, request, pay_method, amount, ip)
        VALUES
          (${code}, ${mode}, ${room.key}, ${room.name}, ${checkIn}, ${checkOut}, ${daesilTime}, ${daesilHours}, ${daesilEnd},
           ${guestName}, ${phone}, ${visit}, ${carNo}, ${request}, ${payMethod}, ${amount}, ${ip})
        ON CONFLICT (code) DO NOTHING
        RETURNING *
      `;
      if (r) return r;
    }
    throw new ReserveError('잠시 후 다시 시도해 주세요', 500);
  });

  // 문자는 예약 저장 뒤에 보낸다. 실패해도 예약은 유지된다.
  const usage = usageText(row);
  await Promise.all([
    sendSms(
      row.phone,
      `[일로와호텔] 예약 신청이 접수되었습니다.\n예약번호 ${row.code}\n${usage}\n금액 ${won(row.amount)} (${PAY_LABELS[row.pay_method]})\n호텔 확인 후 확정 문자를 보내드립니다. 문의 ${HOTEL_TEL}`,
      'request_guest',
      row.id,
    ),
    ...hotelNotifyPhones().map((p) =>
      sendSms(
        p,
        `[홈페이지 예약신청] ${row.guest_name} ${formatPhoneForText(row.phone)}\n${usage}\n${won(row.amount)} ${PAY_LABELS[row.pay_method]}${row.visit === 'car' ? ` / 차량 ${row.car_no}` : ''}\n관리자 화면에서 확정해 주세요.`,
        'request_hotel',
        row.id,
      ),
    ),
  ]);

  return row;
}

const minutesBetween = (a: string | null, b: string | null) => {
  if (!a || !b) return 0;
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(b) - m(a);
};

const formatPhoneForText = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

export function usageText(r: Pick<ReservationRow, 'mode' | 'room_name' | 'check_in' | 'check_out' | 'daesil_time' | 'daesil_end'>) {
  return r.mode === 'daesil'
    ? `${r.room_name} 대실 ${fmtDay(r.check_in)} ${r.daesil_time}~${r.daesil_end} (${fmtDuration(minutesBetween(r.daesil_time, r.daesil_end))})`
    : `${r.room_name} 숙박 ${fmtDay(r.check_in)}~${fmtDay(r.check_out)} ${nightsBetween(r.check_in, r.check_out)}박`;
}

// ─────────────────────────────────────────────────────────────
// 관리자
// ─────────────────────────────────────────────────────────────

export async function listReservations(from: string, to: string, status: string | null) {
  const sql = db();
  return sql<ReservationRow[]>`
    SELECT * FROM web_reservations
    WHERE check_in BETWEEN ${from} AND ${to}
      ${status ? sql`AND status = ${status}` : sql``}
    ORDER BY check_in, created_at
  `;
}

export async function updateReservation(id: number, next: { status?: ReservationStatus; adminMemo?: string }) {
  const sql = db();
  const [before] = await sql<ReservationRow[]>`SELECT * FROM web_reservations WHERE id = ${id}`;
  if (!before) throw new ReserveError('예약을 찾을 수 없습니다', 404);

  // 취소했던 예약을 되살릴 때는 객실이 남아 있는지 다시 확인한다.
  if (next.status && HOLDING.includes(next.status) && !HOLDING.includes(before.status)) {
    const remaining = await remainingMap(sql, before.mode, occupiedDates(before.mode, before.check_in, before.check_out), [before.room_key]);
    if ((remaining.get(before.room_key) ?? 0) < 1) throw new ReserveError('배정량이 남아 있지 않아 되살릴 수 없습니다', 409);
  }

  const [after] = await sql<ReservationRow[]>`
    UPDATE web_reservations SET
      status = ${next.status ?? before.status},
      admin_memo = ${next.adminMemo ?? before.admin_memo},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (next.status && next.status !== before.status) {
    const usage = usageText(after);
    if (next.status === 'confirmed') {
      const bank = process.env.RESERVE_BANK_ACCOUNT;
      const payLine =
        after.pay_method === 'transfer'
          ? `입금 계좌: ${bank || '호텔로 문의해 주세요'}\n입금자명은 예약자 이름으로 부탁드립니다.`
          : '결제는 입실 시 프런트에서 해 주세요.';
      await sendSms(
        after.phone,
        `[일로와호텔] 예약이 확정되었습니다.\n예약번호 ${after.code}\n${usage}\n금액 ${won(after.amount)}\n${payLine}\n문의 ${HOTEL_TEL}`,
        'confirmed',
        after.id,
      );
    } else if (next.status === 'cancelled') {
      await sendSms(
        after.phone,
        `[일로와호텔] 예약이 취소되었습니다.\n예약번호 ${after.code}\n${usage}\n문의 ${HOTEL_TEL}`,
        'cancelled',
        after.id,
      );
    }
  }
  return after;
}

export interface AllotmentCell {
  date: string;
  roomKey: string;
  qty: number;      // 배정량
  isDefault: boolean;
  used: number;     // 점유 예약 수
}

export async function getAllotments(mode: Mode, from: string, days: number): Promise<AllotmentCell[]> {
  const sql = db();
  const to = addDays(from, days - 1);
  const keys = RESERVE_ROOMS.filter((r) => (mode === 'daesil' ? !!r.daesil : true)).map((r) => r.key);
  const allotRows = await sql<{ stay_date: string; room_key: string; qty: number }[]>`
    SELECT stay_date, room_key, qty FROM web_allotments
    WHERE mode = ${mode} AND stay_date BETWEEN ${from} AND ${to}
  `;
  const usedRows = await sql<{ day: string; room_key: string; n: number }[]>`
    SELECT d::date::text AS day, r.room_key, count(*)::int AS n
    FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS d
    JOIN web_reservations r ON r.check_in <= d::date AND d::date < r.check_out
    WHERE r.mode = ${mode} AND r.status IN ${sql(HOLDING)}
    GROUP BY 1, 2
  `;
  const allot = new Map(allotRows.map((r) => [`${r.stay_date}|${r.room_key}`, r.qty]));
  const used = new Map(usedRows.map((r) => [`${r.day}|${r.room_key}`, r.n]));

  const cells: AllotmentCell[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    for (const key of keys) {
      const v = allot.get(`${date}|${key}`);
      cells.push({
        date,
        roomKey: key,
        qty: v ?? findRoom(key)!.allotment,
        isDefault: v === undefined,
        used: used.get(`${date}|${key}`) ?? 0,
      });
    }
  }
  return cells;
}

export async function saveAllotments(mode: Mode, items: { date: string; roomKey: string; qty: number }[]) {
  const sql = db();
  await sql.begin(async (tx) => {
    for (const it of items) {
      await tx`
        INSERT INTO web_allotments (stay_date, room_key, mode, qty)
        VALUES (${it.date}, ${it.roomKey}, ${mode}, ${it.qty})
        ON CONFLICT (stay_date, room_key, mode) DO UPDATE SET qty = EXCLUDED.qty, updated_at = now()
      `;
    }
  });
}
