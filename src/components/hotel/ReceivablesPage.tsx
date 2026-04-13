'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Receivable } from '@/types/hotel';
import { PAYMENT_METHODS } from '@/types/hotel';

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  '미수': { bg: 'bg-gray-200', text: 'text-gray-700' },
  '주의': { bg: 'bg-orange-100', text: 'text-orange-700' },
  '장기미수': { bg: 'bg-red-100', text: 'text-red-700' },
  '수금완료': { bg: 'bg-green-100', text: 'text-green-700' },
};

export default function ReceivablesPage() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameSearch, setNameSearch] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/hotel/receivables?status=all');
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const nameKey = nameSearch.trim().toLowerCase();
  const openItems = items.filter(i => !i.resolved_at && (!nameKey || (i.guest_name || '').toLowerCase().includes(nameKey)));
  const resolvedItems = items.filter(i => i.resolved_at && (!nameKey || (i.guest_name || '').toLowerCase().includes(nameKey)));

  const totalOpen = openItems.reduce((s, i) => s + i.receivable_amount, 0);
  const totalResolved = resolvedItems.reduce((s, i) => s + i.receivable_amount, 0);
  const longOverdue = openItems.filter(i => i.days_overdue > 30);
  const longTotal = longOverdue.reduce((s, i) => s + i.receivable_amount, 0);

  // 수금 처리 (한 번 클릭)
  const handleResolve = async (item: Receivable, method: string, memo: string) => {
    await fetch('/api/admin/hotel/receivables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: item.id,
        resolved_payment_method: method,
        resolved_memo: memo,
      }),
    });
    fetchData();
  };

  // 수금 취소
  const handleUnresolve = async (item: Receivable) => {
    await fetch('/api/admin/hotel/receivables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sale_id: item.id,
        resolved_payment_method: null,
        resolved_memo: '',
        unresolve: true,
      }),
    });
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
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-600">미수 잔액</p>
          <p className="text-2xl font-bold text-[#C9A84C] mt-1">{fmt(totalOpen)}원</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
        <label className="text-xs text-gray-600">성명</label>
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="이름 검색"
          className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-sm w-36"
        />
        {nameSearch && (
          <button onClick={() => setNameSearch('')} className="text-xs text-gray-500 hover:text-gray-900 px-2">초기화</button>
        )}
      </div>

      {/* 미수 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-bold">미수 목록 ({openItems.length}건 / {fmt(totalOpen)}원)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-left">구분</th>
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-center">타입</th>
                <th className="px-3 py-2 text-center">호실</th>
                <th className="px-3 py-2 text-right">미수금액</th>
                <th className="px-3 py-2 text-center">경과</th>
                <th className="px-3 py-2 text-center">상태</th>
                <th className="px-3 py-2 text-center">수금수단</th>
                <th className="px-3 py-2 text-left">메모</th>
                <th className="px-3 py-2 text-center">처리</th>
              </tr>
            </thead>
            <tbody>
              {openItems.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">미수 건이 없습니다</td></tr>
              )}
              {openItems.map(item => (
                <ReceivableRow key={item.id} item={item} onResolve={handleResolve} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 수금완료 (접이식) */}
      {resolvedItems.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowResolved(!showResolved)}
            className="w-full px-5 py-4 flex items-center justify-between border-b border-gray-200 hover:bg-gray-100">
            <h2 className="font-bold text-gray-600">수금완료 ({resolvedItems.length}건 / {fmt(totalResolved)}원)</h2>
            <span className="text-gray-500 text-sm">{showResolved ? '▲' : '▼'}</span>
          </button>
          {showResolved && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 text-xs">
                    <th className="px-3 py-2 text-left">날짜</th>
                    <th className="px-3 py-2 text-left">성명</th>
                    <th className="px-3 py-2 text-right">금액</th>
                    <th className="px-3 py-2 text-center">수금수단</th>
                    <th className="px-3 py-2 text-left">메모</th>
                    <th className="px-3 py-2 text-left">수금일</th>
                    <th className="px-3 py-2 text-center">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedItems.map(item => (
                    <tr key={item.id} className="border-t border-gray-200 text-gray-500 hover:bg-gray-50">
                      <td className="px-3 py-2">{item.sale_date}</td>
                      <td className="px-3 py-2">{item.guest_name || '-'}</td>
                      <td className="px-3 py-2 text-right">{fmt(item.receivable_amount)}원</td>
                      <td className="px-3 py-2 text-center">{item.resolved_payment_method}</td>
                      <td className="px-3 py-2">{item.resolved_memo || '-'}</td>
                      <td className="px-3 py-2">{item.resolved_at?.split('T')[0] || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleUnresolve(item)}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs hover:bg-red-100">취소</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inline-editable row: select payment method + type memo → click 수금 */
function ReceivableRow({
  item,
  onResolve,
}: {
  item: Receivable;
  onResolve: (item: Receivable, method: string, memo: string) => void;
}) {
  const [method, setMethod] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const st = STATUS_STYLE[item.receivable_status] || STATUS_STYLE['미수'];

  const handleClick = async () => {
    if (!method) return;
    setSaving(true);
    await onResolve(item, method, memo);
    setSaving(false);
  };

  return (
    <tr className="border-t border-gray-200 hover:bg-gray-50">
      <td className="px-3 py-2 text-gray-600">{item.sale_date}</td>
      <td className="px-3 py-2">{item.channel} {item.sale_type}</td>
      <td className="px-3 py-2">{item.guest_name || '-'}</td>
      <td className="px-3 py-2 text-center">{item.room_type}</td>
      <td className="px-3 py-2 text-center text-gray-600">{item.room_number || '-'}</td>
      <td className="px-3 py-2 text-right font-bold text-red-400">{fmt(item.receivable_amount)}원</td>
      <td className="px-3 py-2 text-center">{item.days_overdue}일</td>
      <td className="px-3 py-2 text-center">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.bg} ${st.text}`}>{item.receivable_status}</span>
      </td>
      <td className="px-2 py-1">
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="w-full bg-gray-50 border border-gray-300 rounded px-1 py-1 text-xs">
          <option value="">선택</option>
          {PAYMENT_METHODS.filter(p => p !== '미수').map(pm => <option key={pm} value={pm}>{pm}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
          className="w-full bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs" placeholder="메모" />
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={handleClick} disabled={saving || !method}
          className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-40 font-bold">
          {saving ? '...' : '수금'}
        </button>
      </td>
    </tr>
  );
}

function Card({ label, count, amount, color }: { label: string; count: number; amount: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{fmt(amount)}원</p>
      <p className="text-xs text-gray-500 mt-1">{count}건</p>
    </div>
  );
}
