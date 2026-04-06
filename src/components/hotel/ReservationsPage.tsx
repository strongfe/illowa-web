'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Sale } from '@/types/hotel';
import { PAYMENT_METHODS } from '@/types/hotel';

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function endOfWeekStr() {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d.toISOString().split('T')[0];
}

export default function ReservationsPage() {
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<Sale | null>(null);
  const [balanceMethod, setBalanceMethod] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/hotel/reservations');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = todayStr();
  const tomorrow = tomorrowStr();
  const weekEnd = endOfWeekStr();

  const todayArrivals = items.filter(i => i.sale_date === today);
  const tomorrowArrivals = items.filter(i => i.sale_date === tomorrow);
  const thisWeek = items.filter(i => i.sale_date >= today && i.sale_date <= weekEnd);
  const balanceWaiting = items.filter(i => i.payment_timing === '예약금' && !i.balance_paid);
  const balanceTotal = balanceWaiting.reduce((s, i) => s + i.balance_amount, 0);

  const handleBalancePay = async () => {
    if (!resolveTarget || !balanceMethod) return;
    setSaving(true);
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resolveTarget.id, balance_method: balanceMethod, balance_paid: true }),
    });
    setSaving(false);
    setResolveTarget(null);
    setBalanceMethod('');
    fetchData();
  };

  const handleCancel = async (sale: Sale) => {
    const memo = prompt('취소 사유를 입력하세요 (예약금 환불 여부 등)');
    if (memo === null) return;
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sale.id, status: 'cancelled', memo: `[취소] ${memo}` }),
    });
    fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#C9A84C]">예약 현황</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="오늘 도착" count={todayArrivals.length} color={todayArrivals.length > 0 ? 'text-red-400' : 'text-gray-400'} />
        <Card label="내일 도착" count={tomorrowArrivals.length} color="text-blue-400" />
        <Card label="이번 주" count={thisWeek.length} color="text-green-400" />
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#333]">
          <p className="text-sm text-gray-400">잔금 대기</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(balanceTotal)}원</p>
          <p className="text-xs text-gray-500 mt-1">{balanceWaiting.length}건</p>
        </div>
      </div>

      {/* 예약 목록 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#333]">
          <h2 className="font-bold">예약 목록 ({items.length}건)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">숙박일</th>
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-center">타입</th>
                <th className="px-3 py-2 text-center">호실</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-right">총액</th>
                <th className="px-3 py-2 text-right">예약금</th>
                <th className="px-3 py-2 text-right">잔금</th>
                <th className="px-3 py-2 text-center">결제상태</th>
                <th className="px-3 py-2 text-center">처리</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-600">예약 건이 없습니다</td></tr>
              )}
              {items.map(item => {
                const isToday = item.sale_date === today;
                const isFullPaid = item.payment_timing === '완불';
                const isBalancePaid = item.payment_timing === '예약금' && item.balance_paid;
                const isBalanceWaiting = item.payment_timing === '예약금' && !item.balance_paid;

                return (
                  <tr key={item.id} className={`border-t border-[#2a2a2a] hover:bg-[#222] ${isToday ? 'bg-red-900/10' : ''}`}>
                    <td className="px-3 py-2">
                      {item.sale_date}
                      {isToday && <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-red-900 text-red-300">오늘</span>}
                    </td>
                    <td className="px-3 py-2">{item.guest_name || '-'}</td>
                    <td className="px-3 py-2 text-center">{item.room_type}</td>
                    <td className="px-3 py-2 text-center text-gray-400">{item.room_number || '-'}</td>
                    <td className="px-3 py-2 text-gray-400">{item.channel}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(item.amount)}</td>
                    <td className="px-3 py-2 text-right text-blue-400">{item.prepaid_amount ? fmt(item.prepaid_amount) : '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {isBalanceWaiting ? <span className="text-orange-400 font-bold">{fmt(item.balance_amount)}</span> : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isFullPaid && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900 text-green-300">완불</span>}
                      {isBalancePaid && <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900 text-green-300">결제완료</span>}
                      {isBalanceWaiting && <span className="px-2 py-0.5 rounded text-xs font-bold bg-orange-900 text-orange-300">잔금대기</span>}
                    </td>
                    <td className="px-3 py-2 text-center space-x-1">
                      {isBalanceWaiting && (
                        <button onClick={() => { setResolveTarget(item); setBalanceMethod(''); }}
                          className="px-2 py-1 bg-blue-800 text-blue-200 rounded text-xs hover:bg-blue-700">잔금수금</button>
                      )}
                      <button onClick={() => handleCancel(item)}
                        className="px-2 py-1 bg-red-900 text-red-300 rounded text-xs hover:bg-red-800">취소</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 잔금 수금 모달 */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setResolveTarget(null)}>
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 w-80 max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#C9A84C]">잔금 수금</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-400">숙박일:</span> {resolveTarget.sale_date}</p>
              <p><span className="text-gray-400">성명:</span> {resolveTarget.guest_name || '-'}</p>
              <p><span className="text-gray-400">잔금:</span> <span className="text-orange-400 font-bold">{fmt(resolveTarget.balance_amount)}원</span></p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">잔금 결제수단</label>
              <select value={balanceMethod} onChange={e => setBalanceMethod(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm">
                <option value="">선택</option>
                {PAYMENT_METHODS.filter(p => p !== '미수').map(pm => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>
            <button onClick={handleBalancePay} disabled={saving || !balanceMethod}
              className="w-full py-2.5 rounded-lg font-bold bg-blue-700 text-white hover:bg-blue-600 transition-colors disabled:opacity-40">
              {saving ? '처리 중...' : '잔금 수금 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#333]">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{count}건</p>
    </div>
  );
}
