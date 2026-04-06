'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailySummary, ChannelRevenue, DailyClosing, CashExpense } from '@/types/hotel';

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR');
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

interface ClosingData {
  closing: DailyClosing | null;
  summary: DailySummary;
  channelRevenue: ChannelRevenue[];
  cashExpenses: CashExpense[];
}

export default function ClosingPage() {
  const [date, setDate] = useState(yesterday());
  const [data, setData] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 수동 입력 필드
  const [prevDayCash, setPrevDayCash] = useState(0);
  const [hotelstorySlip, setHotelstorySlip] = useState(0);
  const [cardSlip, setCardSlip] = useState(0);
  const [notes, setNotes] = useState('');

  // 현금 지출 추가
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmt, setNewExpenseAmt] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/hotel/closing?date=${date}`);
    if (res.ok) {
      const d: ClosingData = await res.json();
      setData(d);
      if (d.closing) {
        setPrevDayCash(d.closing.prev_day_cash);
        setHotelstorySlip(d.closing.hotelstory_slip);
        setCardSlip(d.closing.card_slip);
        setNotes(d.closing.notes);
      } else {
        setPrevDayCash(0);
        setHotelstorySlip(0);
        setCardSlip(0);
        setNotes('');
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

  // 채널별 매출 추출
  const getChannelRevenue = (ch: string) =>
    channels.find(c => c.channel === ch)?.total_revenue || 0;

  const revYanolja = getChannelRevenue('야놀자');
  const revYeogi = getChannelRevenue('여기어때');
  const revHotelstory = getChannelRevenue('호텔스토리');
  const revKkul = getChannelRevenue('꿀스테이');

  // 현금 매출 = 워킹/연장/예약 등에서 현금결제
  const revCash = channels
    .filter(c => !['야놀자', '여기어때', '호텔스토리', '꿀스테이'].includes(c.channel))
    .reduce((sum, c) => sum + c.total_revenue, 0);

  // 현금 잔액 = 전일시재 + 현금매출 - 현금지출
  const cashBalance = prevDayCash + revCash - totalExpense;

  // 호텔스토리 대사
  const hotelstoryDiff = revHotelstory - hotelstorySlip;
  // 카드 대사
  const cardTotal = revYanolja + revYeogi + revKkul;
  const cardDiff = cardTotal - cardSlip;

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
        revenue_yanolja: revYanolja,
        revenue_yeogi: revYeogi,
        revenue_hotelstory: revHotelstory,
        revenue_kkul: revKkul,
        revenue_cash: revCash,
        revenue_card: cardTotal,
        revenue_transfer: 0,
        total_revenue: s.total_revenue,
        prev_day_cash: prevDayCash,
        cash_expense: totalExpense,
        cash_balance: cashBalance,
        hotelstory_slip: hotelstorySlip,
        card_slip: cardSlip,
        is_verified: hotelstoryDiff === 0 && cardDiff === 0,
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
      body: JSON.stringify({
        expense_date: date,
        description: newExpenseDesc,
        amount: newExpenseAmt,
      }),
    });
    setNewExpenseDesc('');
    setNewExpenseAmt(0);
    fetchData();
  };

  const deleteExpense = async (id: number) => {
    await fetch(`/api/admin/hotel/cash-expenses?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">일일 마감</h1>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {data?.closing?.is_verified && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg px-4 py-3 text-green-300 text-sm">
          마감 완료됨
        </div>
      )}

      {/* 자동 집계 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">매출 자동 집계</h2>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Row label="대실" value={`${s.daesil_count}건 / ${formatAmount(s.daesil_revenue)}원`} />
            <Row label="숙박" value={`${s.sukbak_count}건 / ${formatAmount(s.sukbak_revenue)}원`} />
          </div>
          <div className="border-t border-[#333] pt-3 mt-3 space-y-2">
            <Row label="야놀자" value={`${formatAmount(revYanolja)}원`} />
            <Row label="여기어때" value={`${formatAmount(revYeogi)}원`} />
            <Row label="호텔스토리" value={`${formatAmount(revHotelstory)}원`} />
            <Row label="꿀스테이" value={`${formatAmount(revKkul)}원`} />
            <Row label="기타(현금/카드 등)" value={`${formatAmount(revCash)}원`} />
          </div>
          <div className="border-t border-[#333] pt-3">
            <Row label="총매출" value={`${formatAmount(s.total_revenue)}원`} bold />
          </div>
        </div>
      </div>

      {/* 현금 시재 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">현금 시재</h2>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">전일시재</label>
            <input
              type="number"
              value={prevDayCash || ''}
              onChange={e => setPrevDayCash(Number(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              step={1000}
            />
          </div>
          <Row label="현금매출" value={`+${formatAmount(revCash)}원`} />

          {/* 현금 지출 내역 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">현금지출</label>
            {expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-2 mb-1">
                <span className="flex-1 text-sm">{exp.description}</span>
                <span className="text-sm text-red-400">-{formatAmount(exp.amount)}원</span>
                <button onClick={() => deleteExpense(exp.id)} className="text-xs text-gray-500 hover:text-red-400">X</button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newExpenseDesc}
                onChange={e => setNewExpenseDesc(e.target.value)}
                className="flex-1 bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
                placeholder="지출 항목"
              />
              <input
                type="number"
                value={newExpenseAmt || ''}
                onChange={e => setNewExpenseAmt(Number(e.target.value))}
                className="w-28 bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
                placeholder="금액"
                step={1000}
              />
              <button onClick={addExpense} className="px-3 py-2 bg-[#333] rounded-lg text-sm hover:bg-[#444]">추가</button>
            </div>
          </div>

          <div className="border-t border-[#333] pt-3">
            <Row label="현금지출 합계" value={`-${formatAmount(totalExpense)}원`} />
            <Row label="현금 잔액" value={`${formatAmount(cashBalance)}원`} bold />
          </div>
        </div>
      </div>

      {/* 전표 대사 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-[#333]">전표 대사</h2>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">호텔스토리 전표</label>
              <input
                type="number"
                value={hotelstorySlip || ''}
                onChange={e => setHotelstorySlip(Number(e.target.value))}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
                step={1000}
              />
              <div className={`mt-1 text-sm ${hotelstoryDiff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {hotelstoryDiff === 0 ? 'OK' : `차액: ${formatAmount(hotelstoryDiff)}원`}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">카드 전표</label>
              <input
                type="number"
                value={cardSlip || ''}
                onChange={e => setCardSlip(Number(e.target.value))}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
                step={1000}
              />
              <div className={`mt-1 text-sm ${cardDiff === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cardDiff === 0 ? 'OK' : `차액: ${formatAmount(cardDiff)}원`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <div className="p-5">
          <label className="block text-sm text-gray-400 mb-1">메모</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5 h-20 resize-none"
            placeholder="특이사항 메모"
          />
        </div>
      </div>

      {/* 마감 확인 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-xl font-bold text-lg bg-[#C9A84C] text-black hover:bg-[#E8C96A] transition-colors disabled:opacity-40"
      >
        {saving ? '저장 중...' : '마감 확인'}
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
