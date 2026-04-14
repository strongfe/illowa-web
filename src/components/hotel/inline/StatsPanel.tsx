'use client';

// ═══════════════════════════════════════════════════════════════
// StatsPanel — 공실 현황 + 채널별 매출 (판매 입력 페이지 하단)
//
// sales[] state 를 그대로 받아 클라이언트에서 집계합니다.
// PUT/POST 성공 → onRowSaved → setSales → 이 컴포넌트 리렌더 →
// 통계 실시간 갱신. 추가 API 호출 없음.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import type { Sale, RoomType } from '@/types/hotel';
import { ROOM_TYPE_CAPACITY } from '@/types/hotel';

// ─────────────────────────────────────────────────────────────
// 공실 현황
// ─────────────────────────────────────────────────────────────

const DISPLAY_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

interface VacancyRow {
  rt: RoomType;
  capacity: number;
  /** 평일 = capacity - (전체건수 - 퇴실건수) = 현재 전체 공실 */
  pyeongil: number;
  /** 주대 = capacity - (대실active + 조숙) = 대실 가능 객실 */
  judae: number;
  /** 주숙 = capacity - 숙박전체 = 숙박 가능 객실 */
  jusuk: number;
}

function computeVacancy(sales: Sale[]): VacancyRow[] {
  return DISPLAY_TYPES.map((rt) => {
    const cap = ROOM_TYPE_CAPACITY[rt];
    const typeSales = sales.filter((s) => s.room_type === rt);

    const allCount = typeSales.length;
    const checkedOutCount = typeSales.filter(
      (s) => s.status === 'checked_out',
    ).length;

    const daesilActive = typeSales.filter(
      (s) => s.sale_type === '대실' && s.status !== 'checked_out',
    ).length;
    const josuk = typeSales.filter(
      (s) =>
        s.sale_type === '숙박' &&
        s.check_in_time != null &&
        s.check_in_time < 16,
    ).length;
    const sukbakAll = typeSales.filter(
      (s) => s.sale_type === '숙박',
    ).length;

    return {
      rt,
      capacity: cap,
      pyeongil: cap - (allCount - checkedOutCount),
      judae: cap - (daesilActive + josuk),
      jusuk: cap - sukbakAll,
    };
  });
}

function numColor(n: number): string {
  if (n <= 1) return 'text-red-600 font-bold';
  if (n === 2) return 'text-orange-600 font-bold';
  return '';
}

export function VacancyTable({ sales }: { sales: Sale[] }) {
  const rows = useMemo(() => computeVacancy(sales), [sales]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        pyeongil: acc.pyeongil + r.pyeongil,
        judae: acc.judae + r.judae,
        jusuk: acc.jusuk + r.jusuk,
      }),
      { pyeongil: 0, judae: 0, jusuk: 0 },
    );
  }, [rows]);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-2 py-1.5 border-b border-gray-200">
        <h3 className="font-bold text-xs text-gray-800">공실 현황</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-100 text-gray-500 text-[10px]">
            <th className="px-1 py-0.5 text-left w-8">타입</th>
            <th className="px-1 py-0.5 text-center w-8">평일</th>
            <th className="px-1 py-0.5 text-center w-8">주대</th>
            <th className="px-1 py-0.5 text-center w-8">주숙</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rt} className="border-t border-gray-100">
              <td className="px-1 py-0.5 font-medium">{r.rt}</td>
              <td className={`px-1 py-0.5 text-center ${numColor(r.pyeongil)}`}>
                {r.pyeongil}
              </td>
              <td className={`px-1 py-0.5 text-center ${numColor(r.judae)}`}>
                {r.judae}
              </td>
              <td className={`px-1 py-0.5 text-center ${numColor(r.jusuk)}`}>
                {r.jusuk}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-300 font-bold">
            <td className="px-1 py-0.5">합계</td>
            <td className={`px-1 py-0.5 text-center ${numColor(totals.pyeongil)}`}>
              {totals.pyeongil}
            </td>
            <td className={`px-1 py-0.5 text-center ${numColor(totals.judae)}`}>
              {totals.judae}
            </td>
            <td className={`px-1 py-0.5 text-center ${numColor(totals.jusuk)}`}>
              {totals.jusuk}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 채널별 매출
// ─────────────────────────────────────────────────────────────

/** Channels classified as OTA — routed by `sale.channel` or
 *  `sale.payment_method`. Each entry lists ALL known aliases so
 *  that '호텔스토리' (types/hotel.ts) AND '호스' (DB shorthand)
 *  both match. The first alias is used as the display label. */
const OTA_ENTRIES: { label: string; aliases: string[] }[] = [
  { label: '야자', aliases: ['야놀자'] },
  { label: '여기', aliases: ['여기어때'] },
  { label: '호스', aliases: ['호텔스토리', '호스'] },
  { label: '꿀테', aliases: ['꿀스테이', '꿀테'] },
];
/** Payment methods shown as "direct" rows when the channel is NOT
 *  an OTA (워킹/연장/예약 etc.). */
const DIRECT_LIST = ['현금', '계좌', '미수'] as const;
/** Card brands shown individually. */
const CARD_LIST = [
  '국민', '농협', '롯데', '비씨', '삼성', '신한', '하나', '현대',
] as const;

interface RevenueRow {
  label: string;
  count: number;
  amount: number;
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/**
 * Match a sale to an OTA group by checking BOTH `channel` and
 * `payment_method` against ALL known aliases. e.g. a sale with
 * channel='워킹' + payment_method='호스' matches the 호스 group
 * because '호스' is an alias of the 호텔스토리/호스 entry.
 */
function matchesOtaEntry(
  s: Sale,
  aliases: string[],
): boolean {
  for (const a of aliases) {
    if (s.channel === a || s.payment_method === a) return true;
  }
  return false;
}

function computeChannelRevenue(sales: Sale[]): {
  ota: RevenueRow[];
  direct: RevenueRow[];
  card: RevenueRow[];
  otaSub: RevenueRow;
  directSub: RevenueRow;
  cardSub: RevenueRow;
  grandTotal: RevenueRow;
} {
  // Build a flat list of "revenue entries" — each sale produces 1 or 2
  // entries: the primary (amount + payment_method/channel) and an
  // optional extra (extra_amount + extra_payment_method).
  interface RevEntry {
    saleId: string;
    channel: string;
    paymentMethod: string;
    amount: number;
    isExtra: boolean;
  }
  const entries: RevEntry[] = [];
  for (const s of sales) {
    entries.push({
      saleId: s.id,
      channel: s.channel,
      paymentMethod: s.payment_method || '',
      amount: s.amount,
      isExtra: false,
    });
    if (s.extra_amount && s.extra_payment_method) {
      entries.push({
        saleId: s.id,
        channel: s.channel,
        paymentMethod: s.extra_payment_method,
        amount: s.extra_amount,
        isExtra: true,
      });
    }
  }

  // Each entry is claimed by the FIRST matching group so there are
  // no double-counts. Priority: OTA > direct > card.
  const claimed = new Set<number>(); // index into entries[]

  // OTA rows — match by channel OR payment_method against aliases
  const ota: RevenueRow[] = OTA_ENTRIES.map((entry) => {
    let count = 0;
    let amount = 0;
    entries.forEach((e, idx) => {
      if (claimed.has(idx)) return;
      const matches = entry.aliases.some(
        (a) => e.channel === a || e.paymentMethod === a,
      );
      if (!matches) return;
      claimed.add(idx);
      amount += e.amount;
      if (!e.isExtra) count += 1;
    });
    return { label: entry.label, count, amount };
  });

  // Remaining (unclaimed) entries → direct + card by paymentMethod
  const direct: RevenueRow[] = DIRECT_LIST.map((pm) => {
    let count = 0;
    let amount = 0;
    entries.forEach((e, idx) => {
      if (claimed.has(idx)) return;
      if (e.paymentMethod !== pm) return;
      claimed.add(idx);
      amount += e.amount;
      if (!e.isExtra) count += 1;
    });
    return { label: pm, count, amount };
  });

  const card: RevenueRow[] = CARD_LIST.map((pm) => {
    let count = 0;
    let amount = 0;
    entries.forEach((e, idx) => {
      if (claimed.has(idx)) return;
      if (e.paymentMethod !== pm) return;
      claimed.add(idx);
      amount += e.amount;
      if (!e.isExtra) count += 1;
    });
    return { label: pm, count, amount };
  });

  const sum = (rows: RevenueRow[]) => ({
    count: rows.reduce((acc, r) => acc + r.count, 0),
    amount: rows.reduce((acc, r) => acc + r.amount, 0),
  });

  const otaSum = sum(ota);
  const directSum = sum(direct);
  const cardSum = sum(card);

  const grandAmount = sales.reduce(
    (acc, r) => acc + r.amount + (r.extra_amount || 0),
    0,
  );

  return {
    ota,
    direct,
    card,
    otaSub: { label: 'OTA 소계', ...otaSum },
    directSub: { label: '직접 소계', ...directSum },
    cardSub: { label: '카드 소계', ...cardSum },
    grandTotal: { label: '총계', count: sales.length, amount: grandAmount },
  };
}

function RevRow({ r, bold }: { r: RevenueRow; bold?: boolean }) {
  return (
    <tr className={`border-t border-gray-100 ${bold ? 'font-bold bg-gray-50' : ''}`}>
      <td className="px-1 py-0.5 text-left">{r.label}</td>
      <td className="px-1 py-0.5 text-center w-7">{r.count || '-'}</td>
      <td className="px-1 py-0.5 text-right tabular-nums w-16">
        {r.amount ? fmt(r.amount) : '-'}
      </td>
    </tr>
  );
}

export function ChannelRevenueTable({ sales }: { sales: Sale[] }) {
  const data = useMemo(() => computeChannelRevenue(sales), [sales]);

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-2 py-1.5 border-b border-gray-200">
        <h3 className="font-bold text-xs text-gray-800">채널별 매출</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-100 text-gray-500 text-[10px]">
            <th className="px-1 py-0.5 text-left">채널</th>
            <th className="px-1 py-0.5 text-center w-7">건</th>
            <th className="px-1 py-0.5 text-right w-16">금액</th>
          </tr>
        </thead>
        <tbody>
          {data.ota.map((r) => (
            <RevRow key={r.label} r={r} />
          ))}
          {data.direct.map((r) => (
            <RevRow key={r.label} r={r} />
          ))}
          <RevRow r={data.otaSub} bold />
          {data.card.map((r) => (
            <RevRow key={r.label} r={r} />
          ))}
          <RevRow r={data.cardSub} bold />
          <tr className="border-t-2 border-gray-300 font-bold text-[#C9A84C]">
            <td className="px-1 py-0.5">총계</td>
            <td className="px-1 py-0.5 text-center w-7">{data.grandTotal.count}</td>
            <td className="px-1 py-0.5 text-right tabular-nums w-16">
              {fmt(data.grandTotal.amount)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
