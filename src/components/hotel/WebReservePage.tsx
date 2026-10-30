'use client';

// ═══════════════════════════════════════════════════════════════
// 홈페이지 예약 관리 — 신청 확인·확정·취소
//
// • 확정/취소를 누르면 손님에게 문자가 나간다 (서버에서 발송).
// • 확정한 예약은 엑셀 판매 시트에 채널 "홈페이지"로 옮겨 적는다.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import {
  PAY_LABELS, STATUS_LABELS, addDays, fmtDay, nightsBetween, todayKST, won, type ReservationStatus,
} from '@/lib/reserveCore';

interface Row {
  id: number;
  code: string;
  mode: 'stay' | 'daesil';
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
  pay_deadline: string;
}

const TABS: { key: ReservationStatus | 'all'; label: string }[] = [
  { key: 'pending', label: '확인 대기' },
  { key: 'confirmed', label: '확정' },
  { key: 'all', label: '전체' },
];

const BADGE: Record<ReservationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-600',
  no_show: 'bg-red-100 text-red-700',
};

const fmtPhone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
const fmtCreated = (s: string) => {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function WebReservePage() {
  const today = todayKST();
  const [tab, setTab] = useState<ReservationStatus | 'all'>('pending');
  const [from, setFrom] = useState(addDays(today, -3));
  const [to, setTo] = useState(addDays(today, 60));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ from, to });
    if (tab !== 'all') q.set('status', tab);
    const res = await fetch(`/api/admin/reserve?${q}`);
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? '불러오기 실패');
      setRows([]);
    } else {
      setError('');
      setRows(j);
    }
  }, [from, to, tab]);

  useEffect(() => {
    // 처음과 조건 변경 시 불러오고, 새 신청을 놓치지 않게 1분마다 다시 불러온다
    const run = () => void load();
    const first = setTimeout(run, 0);
    const timer = setInterval(run, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const update = async (r: Row, body: { status?: ReservationStatus; adminMemo?: string }, ask?: string) => {
    if (ask && !window.confirm(ask)) return;
    setBusy(r.id);
    const res = await fetch(`/api/admin/reserve/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) {
      window.alert(j.error ?? '처리 실패');
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">홈페이지 예약</h1>
        <div className="flex items-center gap-1 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-1" />
          <span>~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-1" />
        </div>
      </div>

      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.key ? 'bg-[#C9A84C] text-black' : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {rows === null && <p className="py-10 text-center text-gray-500">불러오는 중…</p>}
      {rows?.length === 0 && !error && <p className="py-10 text-center text-gray-500">해당 예약이 없습니다.</p>}

      <div className="space-y-3">
        {rows?.map((r) => (
          <article key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              <span className="font-mono text-sm text-gray-500">{r.code}</span>
              {r.status === 'pending' && r.pay_method === 'transfer' && (
                <span className="text-xs font-semibold text-red-600">입금 기한 {r.pay_deadline}</span>
              )}
              <span className="ml-auto text-xs text-gray-400">신청 {fmtCreated(r.created_at)}</span>
            </div>

            <div className="mt-2 text-[15px]">
              <b>{r.room_name}</b>{' '}
              {r.mode === 'daesil'
                ? `대실 ${fmtDay(r.check_in)} ${r.daesil_time}~${r.daesil_end ?? ''}`
                : `숙박 ${fmtDay(r.check_in)} ~ ${fmtDay(r.check_out)} ${nightsBetween(r.check_in, r.check_out)}박`}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              <span>{r.guest_name}</span>
              <a href={`tel:${r.phone}`} className="text-blue-600 underline">{fmtPhone(r.phone)}</a>
              <span>{won(r.amount)} · {PAY_LABELS[r.pay_method]}</span>
              <span>{r.visit === 'car' ? `차량 ${r.car_no}` : '도보'}</span>
            </div>
            {r.request && <p className="mt-2 rounded bg-gray-50 p-2 text-sm text-gray-700">요청: {r.request}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.status === 'pending' && (
                <button
                  disabled={busy === r.id}
                  onClick={() => update(r, { status: 'confirmed' }, `${r.guest_name}님 예약을 확정하고 확정 문자를 보낼까요?${r.pay_method === 'transfer' ? ' (입금을 확인하셨나요?)' : ''}`)}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {r.pay_method === 'transfer' ? '입금 확인 · 확정 + 문자' : '확정 + 문자'}
                </button>
              )}
              {(r.status === 'pending' || r.status === 'confirmed') && (
                <button
                  disabled={busy === r.id}
                  onClick={() => update(r, { status: 'cancelled' }, `${r.guest_name}님 예약을 취소하고 취소 문자를 보낼까요?`)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
                >
                  취소 + 문자
                </button>
              )}
              {r.status === 'confirmed' && r.check_in <= today && (
                <button
                  disabled={busy === r.id}
                  onClick={() => update(r, { status: 'no_show' }, '노쇼로 표시할까요? (문자는 보내지 않습니다)')}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 disabled:opacity-50"
                >
                  노쇼
                </button>
              )}
              <MemoField row={r} onSave={(memo) => update(r, { adminMemo: memo })} />
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        확정한 예약은 엑셀 판매 시트에 채널 &quot;홈페이지&quot;로 입력해 주세요. 목록은 1분마다 자동으로 새로고침됩니다.
      </p>
    </div>
  );
}

function MemoField({ row, onSave }: { row: Row; onSave: (memo: string) => void }) {
  const [memo, setMemo] = useState(row.admin_memo);
  const changed = memo !== row.admin_memo;
  return (
    <div className="flex min-w-[200px] flex-1 items-center gap-1">
      <input
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="직원 메모 (손님에게 안 보임)"
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
      />
      {changed && (
        <button onClick={() => onSave(memo)} className="shrink-0 rounded bg-gray-800 px-3 py-1.5 text-xs text-white">
          저장
        </button>
      )}
    </div>
  );
}
