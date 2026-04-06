'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailySummary, ChannelRevenue, DailyClosing, CashExpense, Sale } from '@/types/hotel';
import { PAYMENT_METHODS } from '@/types/hotel';

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

const CARD_METHODS = ['국민', '신한', '비씨', '현대', '삼성', '농협', '하나', '롯데'];
const OTA_CHANNELS = [
  { name: '야놀자', feeRate: 0.10 },
  { name: '여기어때', feeRate: 0.10 },
  { name: '호텔스토리', feeRate: 0 },
];

interface ClosingData {
  closing: DailyClosing | null;
  summary: DailySummary;
  channelRevenue: ChannelRevenue[];
  cashExpenses: CashExpense[];
}

interface CardRow {
  method: string;
  onsiteSales: number;
  prepaidCollected: number;
  receivableCollected: number;
  systemTotal: number;
}

export default function ClosingPage() {
  const [date, setDate] = useState(yesterday());
  const [data, setData] = useState<ClosingData | null>(null);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allResolvedToday, setAllResolvedToday] = useState<Array<{ resolved_payment_method: string | null; receivable_amount: number }>>([]);
  const [allPrepaidToday, setAllPrepaidToday] = useState<Array<{ prepaid_method: string | null; prepaid_amount: number; balance_method: string | null; balance_amount: number; balance_paid: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 수동 입력
  const [prevDayCash, setPrevDayCash] = useState(0);
  const [cardTerminals, setCardTerminals] = useState<Record<string, number>>({});
  const [actualCash, setActualCash] = useState(0);
  const [actualTransfer, setActualTransfer] = useState(0);
  const [notes, setNotes] = useState('');

  // 현금 지출
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmt, setNewExpenseAmt] = useState(0);

  // 미수 현황
  const [receivableNew, setReceivableNew] = useState(0);
  const [receivableNewCount, setReceivableNewCount] = useState(0);
  const [receivableTotal, setReceivableTotal] = useState(0);
  const [receivableTotalCount, setReceivableTotalCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [res, salesRes, recRes] = await Promise.all([
      fetch(`/api/admin/hotel/closing?date=${date}`),
      fetch(`/api/admin/hotel/sales?date=${date}`),
      fetch(`/api/admin/hotel/receivables?status=all`),
    ]);

    if (salesRes.ok) setAllSales(await salesRes.json());

    if (recRes.ok) {
      const recs: Array<{ sale_date: string; receivable_amount: number; resolved_at: string | null; resolved_payment_method: string | null }> = await recRes.json();
      const dayNew = recs.filter(r => r.sale_date === date && !r.resolved_at);
      const dayResolved = recs.filter(r => r.resolved_at?.startsWith(date));
      const allOpen = recs.filter(r => !r.resolved_at);
      setReceivableNewCount(dayNew.length);
      setReceivableNew(dayNew.reduce((s, r) => s + r.receivable_amount, 0));
      setReceivableTotalCount(allOpen.length);
      setReceivableTotal(allOpen.reduce((s, r) => s + r.receivable_amount, 0));
      setAllResolvedToday(dayResolved.map(r => ({ resolved_payment_method: r.resolved_payment_method, receivable_amount: r.receivable_amount })));
    }

    // 오늘 선결제 수금 (prepaid_date = date, sale_date > date)
    // This needs a separate query - for now compute from allSales context
    // We'll compute from sales that have prepaid_date = date but are future-dated
    // Since we only have today's sales, we need to handle this differently
    // For now, use the sales data we have

    if (res.ok) {
      const d: ClosingData = await res.json();
      setData(d);
      if (d.closing) {
        setPrevDayCash(d.closing.prev_day_cash);
        setNotes(d.closing.notes);
        setActualCash(d.closing.actual_cash_count || 0);
        setActualTransfer(d.closing.actual_transfer_amount || 0);
        try {
          const ct = d.closing.card_terminal_amounts;
          if (ct && typeof ct === 'object') setCardTerminals(ct as Record<string, number>);
        } catch { /* ignore */ }
      } else {
        setPrevDayCash(0);
        setNotes('');
        setActualCash(0);
        setActualTransfer(0);
        setCardTerminals({});
      }
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }

  const s = data?.summary || {
    daesil_count: 0, sukbak_count: 0,
    daesil_revenue: 0, sukbak_revenue: 0,
    total_revenue: 0, total_count: 0,
  };
  const channels = data?.channelRevenue || [];
  const expenses = data?.cashExpenses || [];
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  // ─── 카드사별 정산 계산 ───
  const cardRows: CardRow[] = CARD_METHODS.map(method => {
    // 당일매출: 현장결제 중 해당 카드사
    const onsiteSales = allSales
      .filter(s => s.payment_method === method && (!s.payment_timing || s.payment_timing === '현장') && !s.is_receivable)
      .reduce((sum, s) => sum + s.amount, 0);
    // 선결제수금: 예약금/완불 결제수단이 해당 카드사 (sale_date = today이지만 prepaid_date도 today인 경우)
    // + 잔금 수금 중 해당 카드사
    const prepaidCollected = allSales
      .filter(s => s.prepaid_method === method && s.payment_timing !== '현장')
      .reduce((sum, s) => sum + (s.prepaid_amount || 0), 0)
      + allSales.filter(s => s.balance_method === method && s.balance_paid).reduce((sum, s) => sum + (s.balance_amount || 0), 0);
    // 미수회수: 오늘 수금된 것 중 해당 카드사
    const receivableCollected = allResolvedToday
      .filter(r => r.resolved_payment_method === method)
      .reduce((sum, r) => sum + r.receivable_amount, 0);

    return {
      method,
      onsiteSales,
      prepaidCollected,
      receivableCollected,
      systemTotal: onsiteSales + prepaidCollected + receivableCollected,
    };
  });

  const cardSystemTotal = cardRows.reduce((s, r) => s + r.systemTotal, 0);
  const cardTerminalTotal = CARD_METHODS.reduce((s, m) => s + (cardTerminals[m] || 0), 0);
  const cardDiff = cardSystemTotal - cardTerminalTotal;

  // ─── 현금 정산 ───
  const cashOnsite = allSales
    .filter(s => s.payment_method === '현금' && (!s.payment_timing || s.payment_timing === '현장') && !s.is_receivable)
    .reduce((sum, s) => sum + s.amount, 0);
  const cashPrepaid = allSales
    .filter(s => s.prepaid_method === '현금' && s.payment_timing !== '현장')
    .reduce((sum, s) => sum + (s.prepaid_amount || 0), 0)
    + allSales.filter(s => s.balance_method === '현금' && s.balance_paid).reduce((sum, s) => sum + (s.balance_amount || 0), 0);
  const cashResolved = allResolvedToday
    .filter(r => r.resolved_payment_method === '현금')
    .reduce((sum, r) => sum + r.receivable_amount, 0);
  const cashTotal = cashOnsite + cashPrepaid + cashResolved;
  const cashBalance = cashTotal + prevDayCash - totalExpense;
  const cashDiff = cashBalance - actualCash;

  // ─── 계좌 정산 ───
  const transferOnsite = allSales
    .filter(s => s.payment_method === '계좌' && (!s.payment_timing || s.payment_timing === '현장') && !s.is_receivable)
    .reduce((sum, s) => sum + s.amount, 0);
  const transferPrepaid = allSales
    .filter(s => s.prepaid_method === '계좌' && s.payment_timing !== '현장')
    .reduce((sum, s) => sum + (s.prepaid_amount || 0), 0)
    + allSales.filter(s => s.balance_method === '계좌' && s.balance_paid).reduce((sum, s) => sum + (s.balance_amount || 0), 0);
  const transferResolved = allResolvedToday
    .filter(r => r.resolved_payment_method === '계좌')
    .reduce((sum, r) => sum + r.receivable_amount, 0);
  const transferTotal = transferOnsite + transferPrepaid + transferResolved;
  const transferDiff = transferTotal - actualTransfer;

  // ─── OTA 정산 ───
  const otaRows = OTA_CHANNELS.map(ota => {
    const rev = channels.find(c => c.channel === ota.name)?.total_revenue || 0;
    return { ...ota, revenue: rev, estimated: Math.round(rev * (1 - ota.feeRate)) };
  });
  const otaTotal = otaRows.reduce((s, r) => s + r.revenue, 0);

  // ─── 전체 정산 요약 ───
  const allOk = cardDiff === 0 && (actualCash === 0 || cashDiff === 0) && (actualTransfer === 0 || transferDiff === 0);
  const diffCount = [cardDiff !== 0, actualCash > 0 && cashDiff !== 0, actualTransfer > 0 && transferDiff !== 0].filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/admin/hotel/closing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closing_date: date,
        daesil_count: s.daesil_count,
        sukbak_count: s.sukbak_count,
        daesil_revenue: s.daesil_revenue,
        sukbak_revenue: s.sukbak_revenue,
        revenue_yanolja: channels.find(c => c.channel === '야놀자')?.total_revenue || 0,
        revenue_yeogi: channels.find(c => c.channel === '여기어때')?.total_revenue || 0,
        revenue_hotelstory: channels.find(c => c.channel === '호텔스토리')?.total_revenue || 0,
        revenue_kkul: channels.find(c => c.channel === '꿀스테이')?.total_revenue || 0,
        revenue_cash: cashTotal,
        revenue_card: cardSystemTotal,
        revenue_transfer: transferTotal,
        total_revenue: s.total_revenue,
        prev_day_cash: prevDayCash,
        cash_expense: totalExpense,
        cash_balance: cashBalance,
        card_terminal_amounts: cardTerminals,
        actual_cash_count: actualCash,
        actual_transfer_amount: actualTransfer,
        is_verified: allOk,
        notes,
      }),
    });
    setSaving(false);
    fetchData();
  };

  const addExpense = async () => {
    if (!newExpenseDesc || !newExpenseAmt) return;
    await fetch('/api/admin/hotel/cash-expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expense_date: date, description: newExpenseDesc, amount: newExpenseAmt }),
    });
    setNewExpenseDesc('');
    setNewExpenseAmt(0);
    fetchData();
  };

  const deleteExpense = async (id: number) => {
    await fetch(`/api/admin/hotel/cash-expenses?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const setCardTerminal = (method: string, value: number) => {
    setCardTerminals(prev => ({ ...prev, [method]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">일일 마감</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" />
      </div>

      {data?.closing?.is_verified && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">마감 완료됨</div>
      )}

      {/* 매출 자동 집계 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">매출 자동 집계</h2>
        <div className="p-5 space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <Row label="대실" value={`${s.daesil_count}건 / ${fmt(s.daesil_revenue)}원`} />
            <Row label="숙박" value={`${s.sukbak_count}건 / ${fmt(s.sukbak_revenue)}원`} />
          </div>
          <div className="border-t border-[#333] pt-2">
            <Row label="총매출" value={`${fmt(s.total_revenue)}원`} bold />
          </div>
        </div>
      </div>

      {/* ═══ 카드 정산 ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">카드 정산</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500">
                <th className="px-3 py-2 text-left">카드사</th>
                <th className="px-3 py-2 text-right">당일매출</th>
                <th className="px-3 py-2 text-right">선결제</th>
                <th className="px-3 py-2 text-right">미수회수</th>
                <th className="px-3 py-2 text-right font-bold text-gray-300">시스템</th>
                <th className="px-3 py-2 text-right">단말기</th>
                <th className="px-3 py-2 text-right">차액</th>
              </tr>
            </thead>
            <tbody>
              {cardRows.map(row => {
                const terminal = cardTerminals[row.method] || 0;
                const diff = row.systemTotal - terminal;
                const hasData = row.systemTotal > 0 || terminal > 0;
                return (
                  <tr key={row.method} className={`border-t border-[#2a2a2a] ${!hasData ? 'text-gray-700' : ''}`}>
                    <td className="px-3 py-2 font-medium">{row.method}</td>
                    <td className="px-3 py-2 text-right">{row.onsiteSales ? fmt(row.onsiteSales) : ''}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{row.prepaidCollected ? fmt(row.prepaidCollected) : ''}</td>
                    <td className="px-3 py-2 text-right text-orange-400">{row.receivableCollected ? fmt(row.receivableCollected) : ''}</td>
                    <td className="px-3 py-2 text-right font-bold">{row.systemTotal ? fmt(row.systemTotal) : ''}</td>
                    <td className="px-3 py-2 text-right">
                      {hasData && (
                        <input type="number" value={terminal || ''} onChange={e => setCardTerminal(row.method, Number(e.target.value))}
                          className="w-20 bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-right text-xs" step={1000} />
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${!hasData ? '' : diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {hasData && terminal > 0 ? (diff === 0 ? 'OK' : fmt(diff)) : ''}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-[#444] bg-[#222] font-bold">
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2 text-right">{fmt(cardRows.reduce((s, r) => s + r.onsiteSales, 0))}</td>
                <td className="px-3 py-2 text-right text-blue-400">{fmt(cardRows.reduce((s, r) => s + r.prepaidCollected, 0))}</td>
                <td className="px-3 py-2 text-right text-orange-400">{fmt(cardRows.reduce((s, r) => s + r.receivableCollected, 0))}</td>
                <td className="px-3 py-2 text-right text-[#C9A84C]">{fmt(cardSystemTotal)}</td>
                <td className="px-3 py-2 text-right">{cardTerminalTotal > 0 ? fmt(cardTerminalTotal) : ''}</td>
                <td className={`px-3 py-2 text-right ${cardDiff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {cardTerminalTotal > 0 ? (cardDiff === 0 ? 'OK' : fmt(cardDiff)) : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 현금 정산 ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">현금 정산</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500">
                <th className="px-3 py-2 text-left">항목</th>
                <th className="px-3 py-2 text-right">당일매출</th>
                <th className="px-3 py-2 text-right">선결제</th>
                <th className="px-3 py-2 text-right">미수회수</th>
                <th className="px-3 py-2 text-right font-bold text-gray-300">시스템</th>
                <th className="px-3 py-2 text-right">실제</th>
                <th className="px-3 py-2 text-right">차액</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#2a2a2a]">
                <td className="px-3 py-2 font-medium">현금 수입</td>
                <td className="px-3 py-2 text-right">{cashOnsite ? fmt(cashOnsite) : ''}</td>
                <td className="px-3 py-2 text-right text-blue-400">{cashPrepaid ? fmt(cashPrepaid) : ''}</td>
                <td className="px-3 py-2 text-right text-orange-400">{cashResolved ? fmt(cashResolved) : ''}</td>
                <td className="px-3 py-2 text-right font-bold">{fmt(cashTotal)}</td>
                <td className="px-3 py-2 text-right" rowSpan={4}>
                  <input type="number" value={actualCash || ''} onChange={e => setActualCash(Number(e.target.value))}
                    className="w-20 bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-right text-xs" step={1000} placeholder="시재" />
                </td>
                <td className="px-3 py-2 text-right" rowSpan={4}>
                  {actualCash > 0 && (
                    <span className={`font-bold ${cashDiff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {cashDiff === 0 ? 'OK' : fmt(cashDiff)}
                    </span>
                  )}
                </td>
              </tr>
              <tr className="border-t border-[#2a2a2a]">
                <td className="px-3 py-2 text-gray-400">+ 전일시재</td>
                <td colSpan={3}></td>
                <td className="px-3 py-2 text-right">
                  <input type="number" value={prevDayCash || ''} onChange={e => setPrevDayCash(Number(e.target.value))}
                    className="w-20 bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-right text-xs" step={1000} />
                </td>
              </tr>
              <tr className="border-t border-[#2a2a2a]">
                <td className="px-3 py-2 text-gray-400">- 현금지출</td>
                <td colSpan={3}></td>
                <td className="px-3 py-2 text-right text-red-400">{totalExpense ? `-${fmt(totalExpense)}` : ''}</td>
              </tr>
              <tr className="border-t-2 border-[#444] bg-[#222] font-bold">
                <td className="px-3 py-2">현금 잔액</td>
                <td colSpan={3}></td>
                <td className="px-3 py-2 text-right text-[#C9A84C]">{fmt(cashBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* 현금 지출 내역 */}
        <div className="p-4 border-t border-[#333]">
          <label className="block text-xs text-gray-400 mb-2">현금지출 내역</label>
          {expenses.map(exp => (
            <div key={exp.id} className="flex items-center gap-2 mb-1">
              <span className="flex-1 text-xs">{exp.description}</span>
              <span className="text-xs text-red-400">-{fmt(exp.amount)}원</span>
              <button onClick={() => deleteExpense(exp.id)} className="text-[10px] text-gray-500 hover:text-red-400">X</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)}
              className="flex-1 bg-[#2a2a2a] border border-[#444] rounded px-2 py-1.5 text-xs" placeholder="지출 항목" />
            <input type="number" value={newExpenseAmt || ''} onChange={e => setNewExpenseAmt(Number(e.target.value))}
              className="w-24 bg-[#2a2a2a] border border-[#444] rounded px-2 py-1.5 text-xs" placeholder="금액" step={1000} />
            <button onClick={addExpense} className="px-2 py-1.5 bg-[#333] rounded text-xs hover:bg-[#444]">추가</button>
          </div>
        </div>
      </div>

      {/* ═══ 계좌 정산 ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">계좌이체 정산</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500">
                <th className="px-3 py-2 text-left">항목</th>
                <th className="px-3 py-2 text-right">당일매출</th>
                <th className="px-3 py-2 text-right">선결제</th>
                <th className="px-3 py-2 text-right">미수회수</th>
                <th className="px-3 py-2 text-right font-bold text-gray-300">시스템</th>
                <th className="px-3 py-2 text-right">실제입금</th>
                <th className="px-3 py-2 text-right">차액</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[#2a2a2a]">
                <td className="px-3 py-2 font-medium">계좌</td>
                <td className="px-3 py-2 text-right">{transferOnsite ? fmt(transferOnsite) : ''}</td>
                <td className="px-3 py-2 text-right text-blue-400">{transferPrepaid ? fmt(transferPrepaid) : ''}</td>
                <td className="px-3 py-2 text-right text-orange-400">{transferResolved ? fmt(transferResolved) : ''}</td>
                <td className="px-3 py-2 text-right font-bold">{fmt(transferTotal)}</td>
                <td className="px-3 py-2 text-right">
                  <input type="number" value={actualTransfer || ''} onChange={e => setActualTransfer(Number(e.target.value))}
                    className="w-20 bg-[#2a2a2a] border border-[#444] rounded px-2 py-0.5 text-right text-xs" step={1000} placeholder="입금액" />
                </td>
                <td className={`px-3 py-2 text-right font-bold ${!actualTransfer ? '' : transferDiff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {actualTransfer > 0 ? (transferDiff === 0 ? 'OK' : fmt(transferDiff)) : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ OTA 정산 (참고) ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">OTA 정산 (참고)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#222] text-gray-500">
                <th className="px-3 py-2 text-left">OTA</th>
                <th className="px-3 py-2 text-right">매출금액</th>
                <th className="px-3 py-2 text-center">수수료율</th>
                <th className="px-3 py-2 text-right">예상정산</th>
              </tr>
            </thead>
            <tbody>
              {otaRows.map(row => (
                <tr key={row.name} className="border-t border-[#2a2a2a]">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right">{row.revenue ? fmt(row.revenue) : '-'}</td>
                  <td className="px-3 py-2 text-center text-gray-400">{row.feeRate ? `-${row.feeRate * 100}%` : '가변'}</td>
                  <td className="px-3 py-2 text-right">{row.estimated ? fmt(row.estimated) : '-'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#444] bg-[#222] font-bold">
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2 text-right">{fmt(otaTotal)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-[#C9A84C]">{fmt(otaRows.reduce((s, r) => s + r.estimated, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 미수 현황 ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">미수 현황</h2>
        <div className="p-5 space-y-2">
          <Row label="당일 발생 미수" value={receivableNewCount > 0 ? `${receivableNewCount}건 / ${fmt(receivableNew)}원` : '없음'} />
          <Row label="미수 잔액 (누적)" value={`${receivableTotalCount}건 / ${fmt(receivableTotal)}원`} bold />
        </div>
      </div>

      {/* 메모 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5">
        <label className="block text-sm text-gray-400 mb-1">메모</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5 h-20 resize-none" placeholder="특이사항 메모" />
      </div>

      {/* ═══ 전체 정산 요약 ═══ */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">전체 정산 요약</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#222] text-gray-500 text-xs">
                <th className="px-4 py-2 text-left">구분</th>
                <th className="px-4 py-2 text-right">시스템</th>
                <th className="px-4 py-2 text-right">실제</th>
                <th className="px-4 py-2 text-right">차액</th>
                <th className="px-4 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="카드 합계" system={cardSystemTotal} actual={cardTerminalTotal} />
              <SummaryRow label="현금 잔액" system={cashBalance} actual={actualCash} />
              <SummaryRow label="계좌 합계" system={transferTotal} actual={actualTransfer} />
              <tr className="border-t border-[#2a2a2a] text-gray-500">
                <td className="px-4 py-2">OTA 매출</td>
                <td className="px-4 py-2 text-right">{fmt(otaTotal)}</td>
                <td className="px-4 py-2 text-right text-gray-600">-</td>
                <td className="px-4 py-2 text-right text-gray-600">-</td>
                <td className="px-4 py-2 text-center text-gray-600">참고</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 마감 확인 */}
      {diffCount > 0 && (
        <div className="bg-orange-900/20 border border-orange-700/40 rounded-lg px-4 py-3 text-orange-300 text-sm">
          차액 {diffCount}건 확인 필요 (차액이 있어도 마감 가능, 메모에 사유 기재)
        </div>
      )}
      <button onClick={handleSave} disabled={saving}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-colors disabled:opacity-40 ${
          allOk ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-[#C9A84C] text-black hover:bg-[#E8C96A]'
        }`}>
        {saving ? '저장 중...' : allOk ? '마감 확인 (정산 완료)' : '마감 확인'}
      </button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-gray-400'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-[#C9A84C]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, system, actual }: { label: string; system: number; actual: number }) {
  const diff = actual > 0 ? system - actual : 0;
  const hasActual = actual > 0;
  return (
    <tr className="border-t border-[#2a2a2a]">
      <td className="px-4 py-2 font-medium">{label}</td>
      <td className="px-4 py-2 text-right">{fmt(system)}</td>
      <td className="px-4 py-2 text-right">{hasActual ? fmt(actual) : '-'}</td>
      <td className={`px-4 py-2 text-right font-bold ${!hasActual ? 'text-gray-600' : diff === 0 ? 'text-green-400' : 'text-red-400'}`}>
        {hasActual ? (diff === 0 ? '0' : fmt(diff)) : '-'}
      </td>
      <td className="px-4 py-2 text-center">
        {hasActual ? (
          diff === 0 ? <span className="text-green-400">OK</span> : <span className="text-red-400">차이</span>
        ) : <span className="text-gray-600">-</span>}
      </td>
    </tr>
  );
}
