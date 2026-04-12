'use client';

// ═══════════════════════════════════════════════════════════════
// 일일 마감 — 정산 페이지 (Phase B 전면 재설계)
//
// 3개 테이블 (OTA+직접 / 카드 / 환불)로 입력내용(자동) vs
// 실재내용(수동) vs 차이(자동)를 한눈에 비교.
// 실재내용 셀은 인라인 편집 + PUT UPSERT.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Sale } from '@/types/hotel';

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────
// Channel definitions
// ─────────────────────────────────────────────────────────────

const OTA_CHANNELS = ['야놀자', '여기어때', '호텔스토리', '꿀스테이'] as const;
const DIRECT_CHANNELS = ['현금', '계좌', '미수'] as const;
const CARD_CHANNELS = ['국민', '농협', '롯데', '비씨', '삼성', '신한', '하나', '현대'] as const;
const REFUND_CHANNELS = ['현금환불', '계좌환불', '카드환불'] as const;

type ReconType = 'OTA' | '직접' | '카드' | '환불';

interface ChannelDef {
  channel: string;
  label: string;
  reconType: ReconType;
}

const ALL_CHANNELS: ChannelDef[] = [
  ...OTA_CHANNELS.map((c) => ({
    channel: c,
    label: c === '호텔스토리' ? '호스' : c === '꿀스테이' ? '꿀테' : c === '야놀자' ? '야자' : '여기',
    reconType: 'OTA' as ReconType,
  })),
  ...DIRECT_CHANNELS.map((c) => ({
    channel: c,
    label: c,
    reconType: '직접' as ReconType,
  })),
  ...CARD_CHANNELS.map((c) => ({
    channel: c,
    label: c,
    reconType: '카드' as ReconType,
  })),
  ...REFUND_CHANNELS.map((c) => ({
    channel: c,
    label: c,
    reconType: '환불' as ReconType,
  })),
];

// ─────────────────────────────────────────────────────────────
// Row data
// ─────────────────────────────────────────────────────────────

interface InputData {
  daesilCount: number;
  daesilAmount: number;
  sukbakCount: number;
  sukbakAmount: number;
}

interface ActualData {
  daesilCount: number;
  daesilAmount: number;
  sukbakCount: number;
  sukbakAmount: number;
  memo: string;
}

interface RowData {
  def: ChannelDef;
  input: InputData;
  actual: ActualData;
}

const ZERO_INPUT: InputData = { daesilCount: 0, daesilAmount: 0, sukbakCount: 0, sukbakAmount: 0 };
const ZERO_ACTUAL: ActualData = { daesilCount: 0, daesilAmount: 0, sukbakCount: 0, sukbakAmount: 0, memo: '' };

// ─────────────────────────────────────────────────────────────
// Input calculation from sales
// ─────────────────────────────────────────────────────────────

function computeInputData(
  sales: Sale[],
): Map<string, InputData> {
  const result = new Map<string, InputData>();

  // Initialize all channels
  for (const def of ALL_CHANNELS) {
    result.set(def.channel, { ...ZERO_INPUT });
  }

  // Claimed set to prevent double-counting
  const claimed = new Set<string>();

  // OTA: match by channel OR payment_method (alias support)
  const otaAliases: Record<string, string[]> = {
    '야놀자': ['야놀자'],
    '여기어때': ['여기어때'],
    '호텔스토리': ['호텔스토리', '호스'],
    '꿀스테이': ['꿀스테이', '꿀테'],
  };

  for (const ch of OTA_CHANNELS) {
    const aliases = otaAliases[ch] || [ch];
    const matched = sales.filter((s) => {
      if (claimed.has(s.id)) return false;
      return aliases.some((a) => s.channel === a || s.payment_method === a);
    });
    for (const s of matched) claimed.add(s.id);
    const row = result.get(ch)!;
    for (const s of matched) {
      if (s.sale_type === '대실') {
        row.daesilCount += 1;
        row.daesilAmount += s.amount;
      } else {
        row.sukbakCount += 1;
        row.sukbakAmount += s.amount;
      }
    }
  }

  // Remaining (non-OTA) sales → direct + card by payment_method
  const remaining = sales.filter((s) => !claimed.has(s.id));

  for (const s of remaining) {
    const pm = s.payment_method;
    if (!pm) continue;
    const row = result.get(pm);
    if (row) {
      if (s.sale_type === '대실') {
        row.daesilCount += 1;
        row.daesilAmount += s.amount;
      } else {
        row.sukbakCount += 1;
        row.sukbakAmount += s.amount;
      }
    }

    // Extra payment method → amount only (count 0)
    const epm = s.extra_payment_method;
    const ea = s.extra_amount || 0;
    if (epm && ea > 0) {
      const eRow = result.get(epm);
      if (eRow) {
        // Add to the same sale_type bucket for consistency
        if (s.sale_type === '대실') {
          eRow.daesilAmount += ea;
        } else {
          eRow.sukbakAmount += ea;
        }
      }
    }
  }

  // Refund channels always 0 (no input)
  return result;
}

// ─────────────────────────────────────────────────────────────
// Reconciliation record from API
// ─────────────────────────────────────────────────────────────

interface ReconRecord {
  id: string;
  recon_date: string;
  channel: string;
  recon_type: string;
  actual_daesil_count: number;
  actual_daesil_amount: number;
  actual_sukbak_count: number;
  actual_sukbak_amount: number;
  memo: string;
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function ClosingPage() {
  const [date, setDate] = useState(todayStr());
  const [sales, setSales] = useState<Sale[]>([]);
  const [reconRecords, setReconRecords] = useState<ReconRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, reconRes] = await Promise.all([
        fetch(`/api/admin/hotel/sales?date=${date}`),
        fetch(`/api/admin/hotel/reconciliation?date=${date}`),
      ]);
      if (salesRes.ok) setSales(await salesRes.json());
      if (reconRes.ok) setReconRecords(await reconRes.json());
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute input data from sales
  const inputMap = computeInputData(sales);

  // Build actual data map from recon records
  const actualMap = new Map<string, ActualData>();
  for (const r of reconRecords) {
    actualMap.set(r.channel, {
      daesilCount: r.actual_daesil_count,
      daesilAmount: r.actual_daesil_amount,
      sukbakCount: r.actual_sukbak_count,
      sukbakAmount: r.actual_sukbak_amount,
      memo: r.memo || '',
    });
  }

  // Build rows
  const rows: RowData[] = ALL_CHANNELS.map((def) => ({
    def,
    input: def.reconType === '환불' ? { ...ZERO_INPUT } : (inputMap.get(def.channel) ?? { ...ZERO_INPUT }),
    actual: actualMap.get(def.channel) ?? { ...ZERO_ACTUAL },
  }));

  const otaDirectRows = rows.filter(
    (r) => r.def.reconType === 'OTA' || r.def.reconType === '직접',
  );
  const cardRows = rows.filter((r) => r.def.reconType === '카드');
  const refundRows = rows.filter((r) => r.def.reconType === '환불');

  // Subtotals
  const sumRows = (arr: RowData[]) => ({
    inputDC: arr.reduce((s, r) => s + r.input.daesilCount, 0),
    inputDA: arr.reduce((s, r) => s + r.input.daesilAmount, 0),
    inputSC: arr.reduce((s, r) => s + r.input.sukbakCount, 0),
    inputSA: arr.reduce((s, r) => s + r.input.sukbakAmount, 0),
    actualDC: arr.reduce((s, r) => s + r.actual.daesilCount, 0),
    actualDA: arr.reduce((s, r) => s + r.actual.daesilAmount, 0),
    actualSC: arr.reduce((s, r) => s + r.actual.sukbakCount, 0),
    actualSA: arr.reduce((s, r) => s + r.actual.sukbakAmount, 0),
  });
  const otaDirectSub = sumRows(otaDirectRows);
  const cardSub = sumRows(cardRows);
  const refundSub = sumRows(refundRows);
  const grandTotal = {
    inputDC: otaDirectSub.inputDC + cardSub.inputDC,
    inputDA: otaDirectSub.inputDA + cardSub.inputDA,
    inputSC: otaDirectSub.inputSC + cardSub.inputSC,
    inputSA: otaDirectSub.inputSA + cardSub.inputSA,
    actualDC: otaDirectSub.actualDC + cardSub.actualDC - refundSub.actualDC,
    actualDA: otaDirectSub.actualDA + cardSub.actualDA - refundSub.actualDA,
    actualSC: otaDirectSub.actualSC + cardSub.actualSC - refundSub.actualSC,
    actualSA: otaDirectSub.actualSA + cardSub.actualSA - refundSub.actualSA,
  };

  // Actual update handler
  const handleActualUpdate = useCallback(
    async (
      channel: string,
      reconType: ReconType,
      field: keyof ActualData,
      value: number | string,
    ) => {
      const bodyKey =
        field === 'daesilCount'
          ? 'actual_daesil_count'
          : field === 'daesilAmount'
          ? 'actual_daesil_amount'
          : field === 'sukbakCount'
          ? 'actual_sukbak_count'
          : field === 'sukbakAmount'
          ? 'actual_sukbak_amount'
          : 'memo';

      await fetch('/api/admin/hotel/reconciliation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recon_date: date,
          channel,
          recon_type: reconType,
          [bodyKey]: value,
        }),
      });

      // Optimistic local update
      setReconRecords((prev) => {
        const idx = prev.findIndex((r) => r.channel === channel);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...next[idx], [bodyKey]: value };
          return next;
        }
        // New record
        return [
          ...prev,
          {
            id: '',
            recon_date: date,
            channel,
            recon_type: reconType,
            actual_daesil_count: 0,
            actual_daesil_amount: 0,
            actual_sukbak_count: 0,
            actual_sukbak_amount: 0,
            memo: '',
            [bodyKey]: value,
          } as ReconRecord,
        ];
      });
    },
    [date],
  );

  if (loading) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">일일 마감</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* OTA + 직접 */}
      <ReconTable
        title="OTA + 직접"
        rows={otaDirectRows}
        subtotal={otaDirectSub}
        onUpdate={handleActualUpdate}
      />

      {/* 카드 */}
      <ReconTable
        title="카드"
        rows={cardRows}
        subtotal={cardSub}
        onUpdate={handleActualUpdate}
      />

      {/* 환불 */}
      <ReconTable
        title="환불"
        rows={refundRows}
        subtotal={refundSub}
        isRefund
        onUpdate={handleActualUpdate}
      />

      {/* 총계 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: 56 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 24 }} /><col style={{ width: 60 }} />
            <col style={{ width: 94 }} />
          </colgroup>
          <tbody>
            <tr className="bg-[#C9A84C]/10 font-bold text-xs">
              <td className="px-1 py-1.5 text-center">총계</td>
              <NumTd v={grandTotal.inputDC} />
              <NumTd v={grandTotal.inputDA} />
              <NumTd v={grandTotal.inputSC} />
              <NumTd v={grandTotal.inputSA} />
              <NumTd v={grandTotal.actualDC} />
              <NumTd v={grandTotal.actualDA} />
              <NumTd v={grandTotal.actualSC} />
              <NumTd v={grandTotal.actualSA} />
              <DiffTd v={grandTotal.actualDC - grandTotal.inputDC} />
              <DiffTd v={grandTotal.actualDA - grandTotal.inputDA} />
              <DiffTd v={grandTotal.actualSC - grandTotal.inputSC} />
              <DiffTd v={grandTotal.actualSA - grandTotal.inputSA} />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ReconTable component
// ─────────────────────────────────────────────────────────────

function ReconTable({
  title,
  rows,
  subtotal,
  isRefund,
  onUpdate,
}: {
  title: string;
  rows: RowData[];
  subtotal: ReturnType<typeof sumRowsType>;
  isRefund?: boolean;
  onUpdate: (
    channel: string,
    reconType: ReconType,
    field: keyof ActualData,
    value: number | string,
  ) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-200">
        <h2 className="font-bold text-sm text-gray-800">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap table-fixed">
          <colgroup>
            <col style={{ width: 56 }} />{/* 채널 */}
            <col style={{ width: 24 }} />{/* 대건 */}
            <col style={{ width: 60 }} />{/* 대금 */}
            <col style={{ width: 24 }} />{/* 숙건 */}
            <col style={{ width: 60 }} />{/* 숙금 */}
            <col style={{ width: 24 }} />{/* 대건 */}
            <col style={{ width: 60 }} />{/* 대금 */}
            <col style={{ width: 24 }} />{/* 숙건 */}
            <col style={{ width: 60 }} />{/* 숙금 */}
            <col style={{ width: 24 }} />{/* 대건 */}
            <col style={{ width: 60 }} />{/* 대금 */}
            <col style={{ width: 24 }} />{/* 숙건 */}
            <col style={{ width: 60 }} />{/* 숙금 */}
            <col style={{ width: 94 }} />{/* 비고 */}
          </colgroup>
          <thead>
            <tr className="bg-gray-100 text-gray-500 text-[10px]">
              <th className="px-1 py-1 text-center" rowSpan={2}>채널</th>
              <th className="px-1 py-1 text-center border-l border-gray-300" colSpan={4}>입력</th>
              <th className="px-1 py-1 text-center border-l border-gray-300" colSpan={4}>실재</th>
              <th className="px-1 py-1 text-center border-l border-gray-300" colSpan={4}>차이</th>
              <th className="px-1 py-1 text-center border-l border-gray-300" rowSpan={2}>비고</th>
            </tr>
            <tr className="bg-gray-50 text-gray-400 text-[10px]">
              <th className="px-1 py-0.5 text-center border-l border-gray-300">대건</th>
              <th className="px-1 py-0.5 text-center">대금</th>
              <th className="px-1 py-0.5 text-center">숙건</th>
              <th className="px-1 py-0.5 text-center">숙금</th>
              <th className="px-1 py-0.5 text-center border-l border-gray-300">대건</th>
              <th className="px-1 py-0.5 text-center">대금</th>
              <th className="px-1 py-0.5 text-center">숙건</th>
              <th className="px-1 py-0.5 text-center">숙금</th>
              <th className="px-1 py-0.5 text-center border-l border-gray-300">대건</th>
              <th className="px-1 py-0.5 text-center">대금</th>
              <th className="px-1 py-0.5 text-center">숙건</th>
              <th className="px-1 py-0.5 text-center">숙금</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ReconRow
                key={r.def.channel}
                row={r}
                isRefund={isRefund}
                onUpdate={onUpdate}
              />
            ))}
            {/* Subtotal */}
            <tr className="border-t-2 border-gray-300 font-bold bg-gray-50">
              <td className="px-1 py-1 text-center">소계</td>
              <NumTd v={subtotal.inputDC} />
              <NumTd v={subtotal.inputDA} />
              <NumTd v={subtotal.inputSC} />
              <NumTd v={subtotal.inputSA} />
              <NumTd v={subtotal.actualDC} />
              <NumTd v={subtotal.actualDA} />
              <NumTd v={subtotal.actualSC} />
              <NumTd v={subtotal.actualSA} />
              <DiffTd v={subtotal.actualDC - subtotal.inputDC} />
              <DiffTd v={subtotal.actualDA - subtotal.inputDA} />
              <DiffTd v={subtotal.actualSC - subtotal.inputSC} />
              <DiffTd v={subtotal.actualSA - subtotal.inputSA} />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// sumRows type helper (for subtotal prop)
type SumResult = {
  inputDC: number;
  inputDA: number;
  inputSC: number;
  inputSA: number;
  actualDC: number;
  actualDA: number;
  actualSC: number;
  actualSA: number;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sumRowsType(): SumResult {
  return {} as SumResult;
}

// ─────────────────────────────────────────────────────────────
// ReconRow — one channel row with inline editing
// ─────────────────────────────────────────────────────────────

function ReconRow({
  row,
  isRefund,
  onUpdate,
}: {
  row: RowData;
  isRefund?: boolean;
  onUpdate: (
    channel: string,
    reconType: ReconType,
    field: keyof ActualData,
    value: number | string,
  ) => void;
}) {
  const { def, input, actual } = row;

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/50">
      <td className="px-1 py-1 font-medium text-center truncate">{def.label}</td>
      {/* Input (auto-calculated, read-only) */}
      <NumTd v={isRefund ? 0 : input.daesilCount} dim={isRefund} />
      <NumTd v={isRefund ? 0 : input.daesilAmount} dim={isRefund} />
      <NumTd v={isRefund ? 0 : input.sukbakCount} dim={isRefund} />
      <NumTd v={isRefund ? 0 : input.sukbakAmount} dim={isRefund} />
      {/* Actual (editable) */}
      <EditableNumCell
        value={actual.daesilCount}
        onCommit={(v) => onUpdate(def.channel, def.reconType, 'daesilCount', v)}
      />
      <EditableNumCell
        value={actual.daesilAmount}
        onCommit={(v) => onUpdate(def.channel, def.reconType, 'daesilAmount', v)}
      />
      <EditableNumCell
        value={actual.sukbakCount}
        onCommit={(v) => onUpdate(def.channel, def.reconType, 'sukbakCount', v)}
      />
      <EditableNumCell
        value={actual.sukbakAmount}
        onCommit={(v) => onUpdate(def.channel, def.reconType, 'sukbakAmount', v)}
      />
      {/* Diff (auto) */}
      <DiffTd v={actual.daesilCount - (isRefund ? 0 : input.daesilCount)} />
      <DiffTd v={actual.daesilAmount - (isRefund ? 0 : input.daesilAmount)} />
      <DiffTd v={actual.sukbakCount - (isRefund ? 0 : input.sukbakCount)} />
      <DiffTd v={actual.sukbakAmount - (isRefund ? 0 : input.sukbakAmount)} />
      {/* Memo */}
      <EditableMemoCell
        value={actual.memo}
        onCommit={(v) => onUpdate(def.channel, def.reconType, 'memo', v)}
      />
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// Cell components
// ─────────────────────────────────────────────────────────────

function NumTd({ v, dim }: { v: number; dim?: boolean }) {
  return (
    <td
      className={`px-1 py-1 text-right tabular-nums ${
        dim ? 'text-gray-300' : v === 0 ? 'text-gray-300' : ''
      }`}
    >
      {v === 0 ? '-' : fmt(v)}
    </td>
  );
}

function DiffTd({ v }: { v: number }) {
  const color =
    v === 0 ? 'text-gray-300' : v < 0 ? 'text-red-600 font-bold' : '';
  return (
    <td className={`px-1 py-1 text-right tabular-nums ${color}`}>
      {v === 0 ? '-' : fmt(v)}
    </td>
  );
}

/**
 * Navigate to a sibling input in the table grid.
 * dir: 'up'|'down' moves to the same column in the prev/next row.
 *      'left'|'right' moves to the prev/next td's input in the same row.
 */
function moveFocus(
  current: HTMLInputElement,
  dir: 'up' | 'down' | 'left' | 'right',
) {
  const td = current.closest('td');
  if (!td) return;

  let targetTd: Element | null = null;

  if (dir === 'left') {
    targetTd = td.previousElementSibling;
  } else if (dir === 'right') {
    targetTd = td.nextElementSibling;
  } else {
    const tr = td.closest('tr');
    if (!tr) return;
    const colIdx = Array.from(tr.children).indexOf(td);
    const targetTr =
      dir === 'up'
        ? tr.previousElementSibling
        : tr.nextElementSibling;
    if (!targetTr) return;
    targetTd = targetTr.children[colIdx] ?? null;
  }

  if (!targetTd) return;
  const input = targetTd.querySelector('input');
  if (input) (input as HTMLInputElement).focus();
}

function EditableNumCell({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value ? String(value) : '');
  const [flash, setFlash] = useState(false);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setDraft(value ? String(value) : '');
  }

  const commit = useCallback(() => {
    const n = parseInt(draft.replace(/,/g, ''), 10) || 0;
    if (n !== value) {
      onCommit(n);
      setFlash(true);
      setTimeout(() => setFlash(false), 500);
    }
  }, [draft, value, onCommit]);

  return (
    <td className={`p-0 ${flash ? 'bg-green-100' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={focused ? draft : (value === 0 ? '' : fmt(value))}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setFocused(true);
          setDraft(value ? String(value) : '');
          setTimeout(() => inputRef.current?.select(), 0);
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value ? String(value) : '');
            inputRef.current?.blur();
            return;
          }
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            commit();
            if (inputRef.current) moveFocus(inputRef.current, 'down');
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            commit();
            if (inputRef.current) moveFocus(inputRef.current, 'up');
            return;
          }
          if (e.key === 'ArrowLeft') {
            // Only move if caret is at position 0
            if (inputRef.current && inputRef.current.selectionStart === 0) {
              e.preventDefault();
              commit();
              moveFocus(inputRef.current, 'left');
            }
            return;
          }
          if (e.key === 'ArrowRight') {
            if (
              inputRef.current &&
              inputRef.current.selectionStart === inputRef.current.value.length
            ) {
              e.preventDefault();
              commit();
              moveFocus(inputRef.current, 'right');
            }
            return;
          }
        }}
        className={`w-full px-1 py-1 text-xs text-right tabular-nums outline-none bg-transparent border ${
          focused ? 'border-[#C9A84C] bg-white' : 'border-transparent'
        } ${!focused && value === 0 ? 'text-gray-300' : ''}`}
        placeholder="-"
      />
    </td>
  );
}

function EditableMemoCell({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setDraft(value);
  }

  const commit = useCallback(() => {
    if (draft !== value) onCommit(draft);
  }, [draft, value, onCommit]);

  return (
    <td className="p-0">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            inputRef.current?.blur();
            return;
          }
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            commit();
            if (inputRef.current) moveFocus(inputRef.current, 'down');
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            commit();
            if (inputRef.current) moveFocus(inputRef.current, 'up');
            return;
          }
        }}
        className={`w-full px-1 py-1 text-xs outline-none bg-transparent border ${
          focused ? 'border-[#C9A84C] bg-white' : 'border-transparent'
        } ${!value ? 'text-gray-300' : 'text-gray-600'}`}
        placeholder="-"
      />
    </td>
  );
}
