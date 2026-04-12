'use client';

// ═══════════════════════════════════════════════════════════════
// 대시보드 — 주간/월간 매출 테이블 + 월매출예상액
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Sale } from '@/types/hotel';

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const WEIGHTS: Record<number, number> = {
  0: 250, 1: 180, 2: 180, 3: 180, 4: 180, 5: 280, 6: 400,
};

function getMonday(d: Date): Date {
  const r = new Date(d);
  const diff = r.getDay() === 0 ? -6 : 1 - r.getDay();
  r.setDate(r.getDate() + diff);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

// OTA alias matching
const OTA_ALIASES: { key: string; aliases: string[] }[] = [
  { key: '야놀자', aliases: ['야놀자'] },
  { key: '여기어때', aliases: ['여기어때'] },
  { key: '호텔스토리', aliases: ['호텔스토리', '호스'] },
  { key: '꿀스테이', aliases: ['꿀스테이', '꿀테'] },
];
const CARD_METHODS = new Set([
  '국민', '농협', '롯데', '비씨', '삼성', '신한', '하나', '현대',
]);

function matchesOta(s: Sale, aliases: string[]): boolean {
  return aliases.some((a) => s.channel === a || s.payment_method === a);
}

// Per-day aggregation
interface DayAgg {
  daesilCount: number;
  sukbakCount: number;
  daesilAmount: number;
  sukbakAmount: number;
  yanolja: number;
  yeogi: number;
  cash: number;
  hotelstory: number;
  kkul: number;
  transfer: number;
  card: number;
  totalRevenue: number;
}

const ZERO_AGG: DayAgg = {
  daesilCount: 0, sukbakCount: 0, daesilAmount: 0, sukbakAmount: 0,
  yanolja: 0, yeogi: 0, cash: 0, hotelstory: 0, kkul: 0, transfer: 0,
  card: 0, totalRevenue: 0,
};

function aggregateDay(daySales: Sale[]): DayAgg {
  const agg = { ...ZERO_AGG };
  const claimed = new Set<string>();

  for (const entry of OTA_ALIASES) {
    const matched = daySales.filter(
      (s) => !claimed.has(s.id) && matchesOta(s, entry.aliases),
    );
    for (const s of matched) claimed.add(s.id);
    const amt = matched.reduce((sum, s) => sum + s.amount, 0);
    if (entry.key === '야놀자') agg.yanolja = amt;
    else if (entry.key === '여기어때') agg.yeogi = amt;
    else if (entry.key === '호텔스토리') agg.hotelstory = amt;
    else if (entry.key === '꿀스테이') agg.kkul = amt;
  }

  const remaining = daySales.filter((s) => !claimed.has(s.id));
  for (const s of remaining) {
    const pm = s.payment_method || '';
    if (pm === '현금') agg.cash += s.amount;
    else if (pm === '계좌') agg.transfer += s.amount;
    else if (CARD_METHODS.has(pm)) agg.card += s.amount;
    const epm = s.extra_payment_method || '';
    const ea = s.extra_amount || 0;
    if (ea > 0 && CARD_METHODS.has(epm)) agg.card += ea;
    if (ea > 0 && epm === '계좌') agg.transfer += ea;
  }

  for (const s of daySales) {
    if (s.sale_type === '대실') {
      agg.daesilCount += 1;
      agg.daesilAmount += s.amount;
    } else {
      agg.sukbakCount += 1;
      agg.sukbakAmount += s.amount;
    }
  }

  agg.totalRevenue = daySales.reduce(
    (sum, s) => sum + s.amount + (s.extra_amount || 0), 0,
  );
  return agg;
}

interface DailyRecord {
  date: string;
  prev_cash: number;
  cash_out: number;
  cash_out_memo: string;
  note: string;
}

const DEFAULT_DAILY: Omit<DailyRecord, 'date'> = {
  prev_cash: 200000, cash_out: 0, cash_out_memo: '', note: '',
};

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const isMobile = useIsMobile();
  const [mobileDate, setMobileDate] = useState(() => dateStr(today));
  const [weekStart, setWeekStart] = useState(() => getMonday(today));
  const [monthMode, setMonthMode] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const viewDates = useMemo(() => {
    if (monthMode) {
      const y = weekStart.getFullYear();
      const m = weekStart.getMonth();
      return Array.from({ length: daysInMonth(y, m) }, (_, i) =>
        dateStr(new Date(y, m, i + 1)),
      );
    }
    return Array.from({ length: 7 }, (_, i) => dateStr(addDays(weekStart, i)));
  }, [weekStart, monthMode]);

  const rangeStart = viewDates[0];
  const rangeEnd = viewDates[viewDates.length - 1];

  const monthStart = useMemo(() => {
    const d = new Date(weekStart);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, [weekStart]);
  const monthEnd = useMemo(() => {
    const d = new Date(weekStart);
    const days = daysInMonth(d.getFullYear(), d.getMonth());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`;
  }, [weekStart]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Mobile: fetch just the single day + enough for forecast
      // Desktop: fetch the view range + the full month for forecast
      const fs = isMobile
        ? (mobileDate < monthStart ? mobileDate : monthStart)
        : (rangeStart < monthStart ? rangeStart : monthStart);
      const fe = isMobile
        ? (mobileDate > monthEnd ? mobileDate : monthEnd)
        : (rangeEnd > monthEnd ? rangeEnd : monthEnd);
      const res = await fetch(`/api/admin/hotel/dashboard-weekly?start=${fs}&end=${fe}`);
      if (res.ok) {
        const data = await res.json();
        setSales(data.sales ?? []);
        setDailyRecords(data.dailyData ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, monthStart, monthEnd, isMobile, mobileDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const salesByDate = useMemo(() => {
    const map = new Map<string, Sale[]>();
    for (const s of sales) {
      const arr = map.get(s.sale_date) ?? [];
      arr.push(s);
      map.set(s.sale_date, arr);
    }
    return map;
  }, [sales]);

  const dailyMap = useMemo(() => {
    const map = new Map<string, DailyRecord>();
    for (const r of dailyRecords) map.set(r.date, r);
    return map;
  }, [dailyRecords]);

  const aggByDate = useMemo(() => {
    const map = new Map<string, DayAgg>();
    for (const dt of viewDates) {
      map.set(dt, aggregateDay(salesByDate.get(dt) ?? []));
    }
    return map;
  }, [viewDates, salesByDate]);

  const forecast = useMemo(() => {
    const todayStr2 = dateStr(today);
    const y = weekStart.getFullYear();
    const m = weekStart.getMonth();
    const days = daysInMonth(y, m);
    let wDone = 0, wTotal = 0, actual = 0;
    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i);
      const ds = dateStr(d);
      wTotal += WEIGHTS[d.getDay()];
      if (ds <= todayStr2) {
        wDone += WEIGHTS[d.getDay()];
        actual += aggregateDay(salesByDate.get(ds) ?? []).totalRevenue;
      }
    }
    return wDone === 0 ? 0 : Math.round((actual / wDone) * wTotal);
  }, [weekStart, today, salesByDate]);

  const goPrevWeek = useCallback(() => setWeekStart((p) => addDays(p, -7)), []);
  const goNextWeek = useCallback(() => setWeekStart((p) => addDays(p, 7)), []);
  const toggleMonth = useCallback(() => {
    if (monthMode) setWeekStart(getMonday(today));
    setMonthMode((p) => !p);
  }, [monthMode, today]);

  // Mobile day navigation — hoisted to top level so the function
  // reference is stable across re-renders. Without this, a state
  // change during the touch→click lifecycle causes React to replace
  // the button DOM node mid-gesture, swallowing the click event.
  const goPrevDay = useCallback(
    () => setMobileDate((p) => dateStr(addDays(new Date(p + 'T00:00:00'), -1))),
    [],
  );
  const goNextDay = useCallback(
    () => setMobileDate((p) => dateStr(addDays(new Date(p + 'T00:00:00'), 1))),
    [],
  );

  const updateDaily = useCallback(
    async (dt: string, field: keyof Omit<DailyRecord, 'date'>, value: number | string) => {
      await fetch('/api/admin/hotel/dashboard-daily', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dt, [field]: value }),
      });
      setDailyRecords((prev) => {
        const idx = prev.findIndex((r) => r.date === dt);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], [field]: value };
          return next;
        }
        return [...prev, { date: dt, ...DEFAULT_DAILY, [field]: value }];
      });
    }, [],
  );

  const headerText = useMemo(() => {
    if (monthMode) {
      const d = new Date(weekStart);
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }
    const s = new Date(viewDates[0] + 'T00:00:00');
    const e = new Date(viewDates[6] + 'T00:00:00');
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일(${DAY_NAMES[s.getDay()]}) ~ ${e.getMonth() + 1}월 ${e.getDate()}일(${DAY_NAMES[e.getDay()]})`;
  }, [viewDates, monthMode, weekStart]);

  // Desktop: full loading screen on first load only
  // Mobile: never block the UI (date nav must stay clickable)
  const isFirstLoad = useRef(true);
  if (loading && isFirstLoad.current && !isMobile) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }
  if (!loading) isFirstLoad.current = false;

  // ── Mobile: single-day card view ──
  if (isMobile) {
    const mAgg = aggregateDay(salesByDate.get(mobileDate) ?? []);
    const mDaily: DailyRecord = dailyMap.get(mobileDate) ?? { date: mobileDate, ...DEFAULT_DAILY };
    const d = new Date(mobileDate + 'T00:00:00');
    const isWE = d.getDay() === 0 || d.getDay() === 6;

    const MobileRow = ({ label, value, bold, cashBg }: { label: string; value: number | string; bold?: boolean; cashBg?: boolean }) => (
      <div className={`flex justify-between px-3 py-1.5 ${cashBg ? 'bg-blue-50/50' : ''} ${bold ? 'font-bold' : ''}`}>
        <span className="text-gray-700">{label}</span>
        <span className={`tabular-nums ${value === 0 || value === '' ? 'text-gray-300' : ''}`}>
          {typeof value === 'number' ? (value === 0 ? '-' : fmt(value)) : (value || '-')}
        </span>
      </div>
    );

    const MobileEditRow = ({ label, value, isText, field, cashBg }: {
      label: string; value: number | string; isText?: boolean;
      field: keyof Omit<DailyRecord, 'date'>; cashBg?: boolean;
    }) => (
      <div className={`flex items-center justify-between px-3 py-1 ${cashBg ? 'bg-blue-50/50' : ''}`}>
        <span className="text-gray-700 text-sm">{label}</span>
        <input
          type="text"
          inputMode={isText ? 'text' : 'numeric'}
          defaultValue={isText ? String(value || '') : (value ? String(value) : '')}
          onBlur={(e) => {
            const v = isText ? e.target.value : (parseInt(e.target.value.replace(/,/g, ''), 10) || 0);
            if (v !== value) updateDaily(mobileDate, field, v);
          }}
          className="w-28 px-2 py-1 text-xs text-right bg-yellow-50 border border-gray-200 rounded outline-none focus:border-[#C9A84C]"
          placeholder={isText ? '' : '-'}
        />
      </div>
    );

    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#C9A84C]">대시보드</h1>

        {/* Date navigator */}
        <MobileDateNav
          dateLabel={`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`}
          dayLabel={`${DAY_NAMES[d.getDay()]}요일`}
          isWeekend={isWE}
          onPrev={goPrevDay}
          onNext={goNextDay}
        />

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 text-sm">
          <MobileRow label="대실" value={`${mAgg.daesilCount}건  ${fmt(mAgg.daesilAmount)}`} />
          <MobileRow label="숙박" value={`${mAgg.sukbakCount}건  ${fmt(mAgg.sukbakAmount)}`} />
          <div className="h-1 bg-gray-50" />
          <MobileRow label="계좌입금" value={mAgg.transfer} />
          <MobileRow label="야놀자" value={mAgg.yanolja} />
          <MobileRow label="여기어때" value={mAgg.yeogi} />
          <MobileRow label="현금" value={mAgg.cash} />
          <MobileRow label="호텔스토리" value={mAgg.hotelstory} />
          <MobileRow label="꿀스테이" value={mAgg.kkul} />
          <MobileRow label="카드" value={mAgg.card} />
          <MobileRow label="총매출" value={mAgg.totalRevenue} bold />
          <div className="h-1 bg-gray-50" />
          <MobileRow label="현금매출" value={mAgg.cash} cashBg />
          <MobileEditRow label="전일시재" value={mDaily.prev_cash} field="prev_cash" cashBg />
          <MobileRow label="소계" value={mAgg.cash + mDaily.prev_cash} bold cashBg />
          <MobileEditRow label="현금지출" value={mDaily.cash_out} field="cash_out" cashBg />
          <MobileRow label="현금잔액" value={mAgg.cash + mDaily.prev_cash - mDaily.cash_out} bold cashBg />
          <MobileEditRow label="비고" value={mDaily.note} isText field="note" cashBg />
        </div>
      </div>
    );
  }

  // ── Desktop: weekly/monthly table view ──

  // Row definitions
  type RowDef = {
    label: string;
    getValue: (agg: DayAgg, daily: DailyRecord) => number | string;
    editable?: keyof Omit<DailyRecord, 'date'>;
    isSep?: boolean;
    cashBg?: boolean;
    bold?: boolean;
  };

  const rows: RowDef[] = [
    { label: '대실건수', getValue: (a) => a.daesilCount },
    { label: '숙박건수', getValue: (a) => a.sukbakCount },
    { label: '', getValue: () => '', isSep: true },
    { label: '대실매출', getValue: (a) => a.daesilAmount },
    { label: '숙박매출', getValue: (a) => a.sukbakAmount },
    { label: '', getValue: () => '', isSep: true },
    { label: '계좌입금', getValue: (a) => a.transfer },
    { label: '야놀자', getValue: (a) => a.yanolja },
    { label: '여기어때', getValue: (a) => a.yeogi },
    { label: '현금', getValue: (a) => a.cash },
    { label: '호텔스토리', getValue: (a) => a.hotelstory },
    { label: '꿀스테이', getValue: (a) => a.kkul },
    { label: '카드', getValue: (a) => a.card },
    { label: '총매출', getValue: (a) => a.totalRevenue, bold: true },
    { label: '', getValue: () => '', isSep: true },
    { label: '현금매출', getValue: (a) => a.cash, cashBg: true },
    { label: '전일시재', getValue: (_, d) => d.prev_cash, editable: 'prev_cash', cashBg: true },
    { label: '소계', getValue: (a, d) => a.cash + d.prev_cash, cashBg: true, bold: true },
    { label: '현금지출', getValue: (_, d) => d.cash_out, editable: 'cash_out', cashBg: true },
    { label: '현금잔액', getValue: (a, d) => a.cash + d.prev_cash - d.cash_out, cashBg: true, bold: true },
    { label: '비고', getValue: (_, d) => d.note, editable: 'note', cashBg: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-[#C9A84C]">대시보드</h1>
        <div className="flex items-center gap-2">
          {!monthMode && (
            <>
              <button onClick={goPrevWeek} className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200">◀ 이전주</button>
              <span className="text-sm font-medium px-2">{headerText}</span>
              <button onClick={goNextWeek} className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm hover:bg-gray-200">다음주 ▶</button>
            </>
          )}
          {monthMode && <span className="text-sm font-medium px-2">{headerText}</span>}
          <button onClick={toggleMonth} className="px-3 py-1.5 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A]">
            {monthMode ? '주간보기' : '월간내역'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-[#C9A84C]/20 text-gray-800">
              <th className="px-2 py-2 text-left sticky left-0 bg-[#C9A84C]/20 z-10 min-w-[80px]">항목</th>
              {viewDates.map((dt) => {
                const d = new Date(dt + 'T00:00:00');
                const isWE = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <th key={dt} className={`px-2 py-2 text-center min-w-[70px] ${isWE ? 'bg-red-50/50' : ''}`}>
                    <div>{dt.slice(5)}</div>
                    <div className={`text-[10px] ${isWE ? 'text-red-500' : 'text-gray-500'}`}>{DAY_NAMES[d.getDay()]}</div>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center min-w-[80px] bg-gray-100 font-bold">{monthMode ? '월합계' : '주간합계'}</th>
              {!monthMode && <th className="px-2 py-2 text-center min-w-[90px] bg-blue-50 italic text-gray-600">월예상액</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.isSep) return <tr key={ri} className="h-2 bg-gray-50"><td colSpan={viewDates.length + (monthMode ? 2 : 3)} /></tr>;
              let sumVal: number | string = 0;
              if (row.editable === 'note' || row.editable === 'cash_out_memo') {
                sumVal = '';
              } else {
                sumVal = viewDates.reduce((s, dt) => {
                  const a = aggByDate.get(dt) ?? ZERO_AGG;
                  const d: DailyRecord = dailyMap.get(dt) ?? { date: dt, ...DEFAULT_DAILY };
                  const v = row.getValue(a, d);
                  return s + (typeof v === 'number' ? v : 0);
                }, 0);
              }
              return (
                <tr key={ri} className={`border-t border-gray-100 ${row.cashBg ? 'bg-blue-50/30' : ''} ${row.bold ? 'font-bold' : ''}`}>
                  <td className={`px-2 py-1 sticky left-0 z-10 font-medium text-gray-700 ${row.cashBg ? 'bg-blue-50/30' : 'bg-white'}`}>{row.label}</td>
                  {viewDates.map((dt) => {
                    const a = aggByDate.get(dt) ?? ZERO_AGG;
                    const d: DailyRecord = dailyMap.get(dt) ?? { date: dt, ...DEFAULT_DAILY };
                    const val = row.getValue(a, d);
                    if (row.editable) {
                      const isText = row.editable === 'note' || row.editable === 'cash_out_memo';
                      return <DashEditCell key={dt} value={val} isText={isText} onCommit={(v) => updateDaily(dt, row.editable!, isText ? String(v) : Number(v))} />;
                    }
                    return (
                      <td key={dt} className={`px-2 py-1 text-right tabular-nums ${val === 0 || val === '' ? 'text-gray-300' : ''}`}>
                        {typeof val === 'number' ? (val === 0 ? '-' : fmt(val)) : (val || '-')}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right tabular-nums bg-gray-50 font-bold">
                    {typeof sumVal === 'number' ? (sumVal === 0 ? '-' : fmt(sumVal)) : ''}
                  </td>
                  {!monthMode && (
                    <td className="px-2 py-1 text-right tabular-nums bg-blue-50/50 italic text-gray-500">
                      {row.label === '총매출' ? fmt(forecast) : ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Editable cell (always-rendered input)
// ─────────────────────────────────────────────────────────────

function DashEditCell({ value, isText, onCommit }: {
  value: number | string;
  isText?: boolean;
  onCommit: (v: number | string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const displayStr = isText ? String(value || '') : (value ? String(value) : '');
  const [draft, setDraft] = useState(displayStr);
  const [flash, setFlash] = useState(false);

  const [prev, setPrev] = useState(value);
  if (value !== prev) { setPrev(value); if (!focused) setDraft(isText ? String(value || '') : (value ? String(value) : '')); }

  const commit = useCallback(() => {
    if (isText) {
      if (draft !== String(value || '')) { onCommit(draft); setFlash(true); setTimeout(() => setFlash(false), 500); }
    } else {
      const n = parseInt(draft.replace(/,/g, ''), 10) || 0;
      if (n !== value) { onCommit(n); setFlash(true); setTimeout(() => setFlash(false), 500); }
    }
  }, [draft, value, isText, onCommit]);

  return (
    <td className={`p-0 ${flash ? 'bg-green-100' : 'bg-yellow-50/50'}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode={isText ? 'text' : 'numeric'}
        value={focused ? draft : (isText ? displayStr : (value === 0 ? '' : fmt(value as number)))}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => { setFocused(true); setDraft(displayStr); setTimeout(() => inputRef.current?.select(), 0); }}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setDraft(displayStr); inputRef.current?.blur(); }
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault(); commit();
            const td = inputRef.current?.closest('td');
            if (td) { const tr = td.closest('tr'); const ci = Array.from(tr!.children).indexOf(td);
              let nr = tr?.nextElementSibling; while (nr) { const inp = nr.children[ci]?.querySelector('input');
                if (inp) { (inp as HTMLInputElement).focus(); return; } nr = nr.nextElementSibling; } }
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault(); commit();
            const td = inputRef.current?.closest('td');
            if (td) { const tr = td.closest('tr'); const ci = Array.from(tr!.children).indexOf(td);
              let pr = tr?.previousElementSibling; while (pr) { const inp = pr.children[ci]?.querySelector('input');
                if (inp) { (inp as HTMLInputElement).focus(); return; } pr = pr.previousElementSibling; } }
          }
        }}
        className={`w-full px-1 py-1 text-xs outline-none bg-transparent border ${isText ? 'text-left' : 'text-right tabular-nums'}
          ${focused ? 'border-[#C9A84C] bg-white' : 'border-transparent'}
          ${!isText && !value ? 'text-gray-300' : ''}`}
        placeholder={isText ? '' : '-'}
      />
    </td>
  );
}

// ─────────────────────────────────────────────────────────────
// MobileDateNav — isolated component that NEVER re-renders
// when parent sales/daily state changes. Only re-renders when
// the date label or callbacks change. This prevents React from
// replacing the button DOM nodes mid-touch-gesture.
// ─────────────────────────────────────────────────────────────

const NAV_BTN_STYLE: React.CSSProperties = {
  minWidth: 52,
  minHeight: 52,
  fontSize: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
  userSelect: 'none',
  zIndex: 10,
  position: 'relative',
  background: '#f3f4f6',
  borderRadius: 8,
  border: 'none',
};

const MobileDateNav = React.memo(function MobileDateNav({
  dateLabel,
  dayLabel,
  isWeekend,
  onPrev,
  onNext,
}: {
  dateLabel: string;
  dayLabel: string;
  isWeekend: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        background: 'white',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        padding: '8px',
        gap: 4,
      }}
    >
      <button type="button" onClick={onPrev} style={NAV_BTN_STYLE}>
        ◀
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isWeekend ? '#ef4444' : undefined }}>
          {dateLabel}
        </div>
        <div style={{ fontSize: 12, color: isWeekend ? '#f87171' : '#6b7280' }}>
          {dayLabel}
        </div>
      </div>
      <button type="button" onClick={onNext} style={NAV_BTN_STYLE}>
        ▶
      </button>
    </div>
  );
});
