'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Receivable } from '@/types/hotel';
import { PAYMENT_METHODS } from '@/types/hotel';

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '미수': { bg: 'bg-gray-700', text: 'text-gray-200' },
  '주의': { bg: 'bg-orange-900', text: 'text-orange-300' },
  '장기미수': { bg: 'bg-red-900', text: 'text-red-300' },
  '수금완료': { bg: 'bg-green-900', text: 'text-green-300' },
};

export default function ReceivablesPage() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveTarget, setResolveTarget] = useState<Receivable | null>(null);
  const [resolveMethod, setResolveMethod] = useState('');
  const [resolveMemo, setResolveMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/hotel/receivables?status=all');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openItems = items.filter(i => !i.resolved_at);
  const resolvedItems = items.filter(i => i.resolved_at);

  const totalOpen = openItems.reduce((s, i) => s + i.receivable_amount, 0);
  const totalResolved = resolvedItems.reduce((s, i) => s + i.receivable_amount, 0);
  const longOverdue = openItems.filter(i => i.days_overdue > 30);
  const longTotal = longOverdue.reduce((s, i) => s + i.receivable_amount, 0);

  const handleResolve = async () => {
    if (!resolveTarget || !resolveMethod) return;
    setSaving(true);
    await fetch('/api/admin/hotel/receivables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: resolveTarget.id,
        resolved_payment_method: resolveMethod,
        resolved_memo: resolveMemo,
      }),
    });
    setSaving(false);
    setResolveTarget(null);
    setResolveMethod('');
    setResolveMemo('');
    fetchData();
  };

  if (loading) return <div className="text-center py-20 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#C9A84C]">미수금 관리</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="미수" count={openItems.length} amount={totalOpen} color="text-orange-400" />
        <Card label="수금완료" count={resolvedItems.length} amount={totalResolved} color="text-green-400" />
        <Card label="장기미수 (30일+)" count={longOverdue.length} amount={longTotal} color="text-red-400" />
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#333]">
          <p className="text-sm text-gray-400">미수 잔액</p>
          <p className="text-2xl font-bold text-[#C9A84C] mt-1">{fmt(totalOpen)}원</p>
        </div>
      </div>

      {/* 미수 목록 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#333]">
          <h2 className="font-bold">미수 목록 ({openItems.length}건)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-left">구분</th>
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-center">타입</th>
                <th className="px-3 py-2 text-center">호실</th>
                <th className="px-3 py-2 text-right">미수금액</th>
                <th className="px-3 py-2 text-center">경과</th>
                <th className="px-3 py-2 text-center">상태</th>
                <th className="px-3 py-2 text-center">연락처</th>
                <th className="px-3 py-2 text-center">처리</th>
              </tr>
            </thead>
            <tbody>
              {openItems.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-600">미수 건이 없습니다</td></tr>
              )}
              {openItems.map(item => {
                const st = STATUS_STYLE[item.receivable_status] || STATUS_STYLE['미수'];
                return (
                  <tr key={item.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                    <td className="px-3 py-2 text-gray-400">{item.sale_date}</td>
                    <td className="px-3 py-2">{item.channel} {item.sale_type}</td>
                    <td className="px-3 py-2">{item.guest_name || '-'}</td>
                    <td className="px-3 py-2 text-center">{item.room_type}</td>
                    <td className="px-3 py-2 text-center text-gray-400">{item.room_number || '-'}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-400">{fmt(item.receivable_amount)}원</td>
                    <td className="px-3 py-2 text-center">{item.days_overdue}일</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.bg} ${st.text}`}>{item.receivable_status}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-400 text-xs">{item.phone || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setResolveTarget(item); setResolveMethod(''); setResolveMemo(''); }}
                        className="px-2 py-1 bg-green-800 text-green-200 rounded text-xs hover:bg-green-700">수금</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수금완료 (접이식) */}
      {resolvedItems.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
          <button onClick={() => setShowResolved(!showResolved)}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-[#333] hover:bg-[#222]">
            <h2 className="font-bold text-gray-400">수금완료 ({resolvedItems.length}건)</h2>
            <span className="text-gray-500 text-sm">{showResolved ? '▲' : '▼'}</span>
          </button>
          {showResolved && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[#222] text-gray-500 text-xs">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">성명</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-center">수금수단</th>
                    <th className="px-3 py-2 text-left">메모</th>
                    <th className="px-3 py-2 text-left">수금일</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedItems.map(item => (
                    <tr key={item.id} className="border-t border-[#2a2a2a] text-gray-500">
                      <td className="px-3 py-2">{item.sale_date}</td>
                      <td className="px-3 py-2">{item.guest_name || '-'}</td>
                      <td className="px-3 py-2 text-right">{fmt(item.receivable_amount)}원</td>
                      <td className="px-3 py-2 text-center">{item.resolved_payment_method}</td>
                      <td className="px-3 py-2">{item.resolved_memo || '-'}</td>
                      <td className="px-3 py-2">{item.resolved_at?.split('T')[0] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 수금 처리 모달 */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setResolveTarget(null)}>
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 w-80 max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#C9A84C]">수금 처리</h3>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-400">날짜:</span> {resolveTarget.sale_date}</p>
              <p><span className="text-gray-400">성명:</span> {resolveTarget.guest_name || '-'}</p>
              <p><span className="text-gray-400">미수금액:</span> <span className="text-red-400 font-bold">{fmt(resolveTarget.receivable_amount)}원</span></p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">수금 결제수단</label>
              <select value={resolveMethod} onChange={e => setResolveMethod(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm">
                <option value="">선택</option>
                {PAYMENT_METHODS.filter(p => p !== '미수').map(pm => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">메모</label>
              <input type="text" value={resolveMemo} onChange={e => setResolveMemo(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" placeholder="선택 입력" />
            </div>
            <button onClick={handleResolve} disabled={saving || !resolveMethod}
              className="w-full py-2.5 rounded-lg font-bold bg-green-700 text-white hover:bg-green-600 transition-colors disabled:opacity-40">
              {saving ? '처리 중...' : '수금 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#333]">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{fmt(amount)}원</p>
      <p className="text-xs text-gray-500 mt-1">{count}건</p>
    </div>
  );
}
