'use client';

// ═══════════════════════════════════════════════════════════════
// 홈페이지 판매 객실 수(배정량) 설정
//
// • 날짜 × 객실 타입 표. 칸의 숫자 = 그날 홈페이지에서 팔 방 수.
// • 회색 숫자는 기본값(아직 따로 정하지 않음). 0 = 그날 그 타입 마감.
// • "이 날 마감"은 그 날짜 모든 타입을 0 으로 바꾼다 (만실일 때).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RESERVE_ROOMS, WEEK, addDays, dayOfWeek, todayKST, type Mode } from '@/lib/reserveCore';

interface Cell {
  date: string;
  roomKey: string;
  qty: number;
  isDefault: boolean;
  used: number;
}

const DAYS = 14;
const cellKey = (date: string, roomKey: string) => `${date}|${roomKey}`;

export default function AllotmentPage() {
  const [mode, setMode] = useState<Mode>('stay');
  const [from, setFrom] = useState(todayKST());
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/reserve/allotment?mode=${mode}&from=${from}&days=${DAYS}`);
    const j = await res.json();
    if (!res.ok) {
      setMessage(j.error ?? '불러오기 실패');
      setCells([]);
      return;
    }
    setCells(j);
    setEdits({});
  }, [mode, from]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(from, i)), [from]);
  const rooms = RESERVE_ROOMS.filter((r) => (mode === 'daesil' ? !!r.daesilPrice : true));
  const byKey = useMemo(() => new Map((cells ?? []).map((c) => [cellKey(c.date, c.roomKey), c])), [cells]);

  const setQty = (date: string, roomKey: string, qty: number) =>
    setEdits((e) => ({ ...e, [cellKey(date, roomKey)]: Math.max(0, Math.min(50, qty)) }));

  const closeDay = (date: string) =>
    setEdits((e) => ({ ...e, ...Object.fromEntries(rooms.map((r) => [cellKey(date, r.key), 0])) }));

  const save = async () => {
    const items = Object.entries(edits).map(([k, qty]) => {
      const [date, roomKey] = k.split('|');
      return { date, roomKey, qty };
    });
    if (items.length === 0) return;
    setSaving(true);
    const res = await fetch('/api/admin/reserve/allotment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, items }),
    });
    const j = await res.json();
    setSaving(false);
    setMessage(res.ok ? `${j.saved}칸 저장했습니다` : j.error ?? '저장 실패');
    if (res.ok) await load();
  };

  const dirty = Object.keys(edits).length;

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">홈페이지 판매 객실 수</h1>
        {(['stay', 'daesil'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              mode === m ? 'bg-[#C9A84C] text-black' : 'border border-gray-200 bg-white text-gray-700'
            }`}
          >
            {m === 'stay' ? '숙박' : '대실'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-sm">
          <button onClick={() => setFrom(addDays(from, -7))} className="rounded border px-3 py-1.5">◀ 7일</button>
          <button onClick={() => setFrom(todayKST())} className="rounded border px-3 py-1.5">오늘</button>
          <button onClick={() => setFrom(addDays(from, 7))} className="rounded border px-3 py-1.5">7일 ▶</button>
        </div>
      </div>

      <p className="mb-3 text-xs text-gray-500">
        숫자 = 그날 홈페이지에서 팔 방 수. <span className="text-gray-400">회색</span>은 기본값,{' '}
        <span className="font-semibold text-blue-700">파란색</span>은 저장 전 변경. 칸 아래 작은 숫자는 이미 들어온 예약 수입니다.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left">객실</th>
              {dates.map((d) => {
                const dow = dayOfWeek(d);
                return (
                  <th key={d} className={`px-1 py-2 text-center font-medium ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : ''}`}>
                    <div>{Number(d.slice(5, 7))}/{Number(d.slice(8))}</div>
                    <div className="text-xs">{WEEK[dow]}</div>
                    <button onClick={() => closeDay(d)} className="mt-1 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-700">
                      이 날 마감
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.key} className="border-t border-gray-100">
                <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 text-left font-medium">{r.name}</th>
                {dates.map((d) => {
                  const k = cellKey(d, r.key);
                  const c = byKey.get(k);
                  const edited = k in edits;
                  const qty = edited ? edits[k] : c?.qty ?? r.allotment;
                  const used = c?.used ?? 0;
                  return (
                    <td key={d} className={`px-1 py-1 text-center ${qty === 0 ? 'bg-gray-100' : ''}`}>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={qty}
                        onChange={(e) => setQty(d, r.key, Number(e.target.value))}
                        className={`w-12 rounded border px-1 py-1 text-center ${
                          edited ? 'border-blue-400 font-semibold text-blue-700' : c?.isDefault !== false ? 'text-gray-400' : 'text-gray-900'
                        }`}
                      />
                      <div className={`text-[10px] ${used > qty ? 'font-bold text-red-600' : 'text-gray-500'}`}>
                        {used > 0 ? `예약 ${used}` : ' '}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-gray-200 bg-gray-50 py-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-lg bg-[#C9A84C] px-6 py-2.5 font-semibold text-black disabled:opacity-40"
        >
          {saving ? '저장 중…' : dirty ? `변경 ${dirty}칸 저장` : '변경 없음'}
        </button>
        {dirty > 0 && (
          <button onClick={() => setEdits({})} className="text-sm text-gray-600 underline">변경 취소</button>
        )}
        {message && <span className="text-sm text-gray-700">{message}</span>}
      </div>
    </div>
  );
}
