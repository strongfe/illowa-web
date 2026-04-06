'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

interface AuditLog {
  id: number;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  created_at: string;
}

const TABLE_LABELS: Record<string, string> = {
  sales: '판매', bookings: '예약', customers: '고객',
  daily_closings: '마감', cash_expenses: '지출',
};

const ACTION_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  INSERT: { bg: 'bg-green-900', text: 'text-green-300', label: '등록' },
  UPDATE: { bg: 'bg-orange-900', text: 'text-orange-300', label: '수정' },
  DELETE: { bg: 'bg-red-900', text: 'text-red-300', label: '삭제' },
};

const FIELD_LABELS: Record<string, string> = {
  guest_name: '성명', amount: '금액', room_type: '타입', room_number: '호실',
  channel: '채널', payment_method: '결제수단', sale_type: '구분', sale_date: '날짜',
  check_in_time: '입실', check_out_time: '퇴실', status: '상태', memo: '메모',
  is_receivable: '미수', receivable_amount: '미수금액', resolved_at: '수금일',
  resolved_payment_method: '수금수단', payment_timing: '결제시점',
  prepaid_amount: '예약금', balance_paid: '잔금결제', phone: '전화번호',
  name: '이름', visit_count: '방문횟수', marketing_consent: '마케팅동의',
  closing_date: '마감일', total_revenue: '총매출', is_verified: '검증',
  extra_amount: '추가금액', extra_payment_method: '추결수단',
};

function summarize(log: AuditLog): string {
  const d = log.new_data || log.old_data || {};
  const name = (d.guest_name || d.name || '') as string;
  const type = (d.room_type || '') as string;
  const room = (d.room_number || '') as string;

  if (log.table_name === 'sales') {
    if (log.action === 'INSERT') {
      return `${name} ${type} ${room} ${fmt(d.amount as number || 0)}원 ${d.channel || ''}`;
    }
    if (log.action === 'DELETE') {
      return `${name} ${type} ${room} ${fmt(d.amount as number || 0)}원 삭제됨`;
    }
    if (log.action === 'UPDATE' && log.changed_fields) {
      const parts = log.changed_fields
        .filter(f => !['updated_at', 'created_at'].includes(f))
        .slice(0, 3)
        .map(f => {
          const label = FIELD_LABELS[f] || f;
          const oldV = log.old_data?.[f];
          const newV = log.new_data?.[f];
          return `${label}: ${oldV}→${newV}`;
        });
      return `${name} ${type} ${room} ${parts.join(', ')}`;
    }
  }
  if (log.table_name === 'bookings') {
    return `${name} ${d.check_in_date || ''}~${d.check_out_date || ''}`;
  }
  if (log.table_name === 'customers') {
    if (log.action === 'UPDATE' && log.changed_fields) {
      return `${name} ${log.changed_fields.filter(f => f !== 'updated_at').map(f => FIELD_LABELS[f] || f).join(', ')} 변경`;
    }
    return `${name}`;
  }
  if (log.table_name === 'daily_closings') {
    return `${d.closing_date || ''} 마감`;
  }
  if (log.table_name === 'cash_expenses') {
    return `${d.description || ''} ${fmt(d.amount as number || 0)}원`;
  }
  return '';
}

export default function AuditPage() {
  const searchParams = useSearchParams();
  const recordIdParam = searchParams.get('record_id') || '';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [recordFilter, setRecordFilter] = useState(recordIdParam);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (tableFilter) params.set('table', tableFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (dateFilter) params.set('date', dateFilter);
    if (recordFilter) params.set('record_id', recordFilter);

    const res = await fetch(`/api/admin/hotel/audit?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, tableFilter, actionFilter, dateFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [tableFilter, actionFilter, dateFilter, recordFilter]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleRestore = async (logId: number) => {
    if (!confirm('삭제된 데이터를 복원하시겠습니까?')) return;
    const res = await fetch('/api/admin/hotel/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log_id: logId }),
    });
    if (res.ok) {
      alert('복원 완료');
      fetchLogs();
    } else {
      const err = await res.json();
      alert(`복원 실패: ${err.error}`);
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#C9A84C]">변경 이력</h1>

      {/* 필터 */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1">
          {[['', '전체'], ['sales', '판매'], ['bookings', '예약'], ['customers', '고객'], ['daily_closings', '마감'], ['cash_expenses', '지출']].map(([v, label]) => (
            <button key={v} onClick={() => setTableFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs ${tableFilter === v ? 'bg-[#C9A84C] text-black font-bold' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>{label}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {[['', '전체'], ['INSERT', '등록'], ['UPDATE', '수정'], ['DELETE', '삭제']].map(([v, label]) => (
            <button key={v} onClick={() => setActionFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs ${actionFilter === v ? 'bg-[#C9A84C] text-black font-bold' : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#333]'}`}>{label}</button>
          ))}
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-1.5 text-xs" />
        {dateFilter && <button onClick={() => setDateFilter('')} className="text-xs text-gray-500 hover:text-white">날짜 초기화</button>}
        {recordFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400">레코드 필터 적용중</span>
            <button onClick={() => setRecordFilter('')} className="text-xs text-gray-500 hover:text-white">해제</button>
          </div>
        )}
      </div>

      {/* 로그 목록 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#333] flex justify-between">
          <h2 className="font-bold">이력 ({total}건)</h2>
          {totalPages > 1 && (
            <div className="flex gap-2 text-xs">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-gray-400 disabled:text-gray-700">이전</button>
              <span className="text-gray-400">{page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-gray-400 disabled:text-gray-700">다음</button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-gray-500">로딩 중...</div>
        ) : logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-500">이력이 없습니다</div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {logs.map(log => {
              const as = ACTION_STYLE[log.action];
              const isExpanded = expanded.has(log.id);
              const time = new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              const dateStr = log.created_at.split('T')[0];
              return (
                <div key={log.id}>
                  <button onClick={() => toggleExpand(log.id)} className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-[#222] transition-colors">
                    <span className="text-xs text-gray-500 w-20 shrink-0">{dateStr === dateFilter || !dateFilter ? time : `${dateStr.slice(5)} ${time}`}</span>
                    <span className="text-xs text-gray-400 w-10 shrink-0">{TABLE_LABELS[log.table_name] || log.table_name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${as.bg} ${as.text} shrink-0`}>{as.label}</span>
                    <span className="text-xs text-gray-300 flex-1 truncate">{summarize(log)}</span>
                    <span className="text-xs text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-2">
                      {/* UPDATE: 변경 필드 비교 */}
                      {log.action === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0 && (
                        <div className="bg-[#222] rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[#2a2a2a] text-gray-500">
                                <th className="px-3 py-1.5 text-left">필드</th>
                                <th className="px-3 py-1.5 text-left">변경 전</th>
                                <th className="px-3 py-1.5 text-left">변경 후</th>
                              </tr>
                            </thead>
                            <tbody>
                              {log.changed_fields.filter(f => f !== 'updated_at').map(field => (
                                <tr key={field} className="border-t border-[#333]">
                                  <td className="px-3 py-1.5 text-gray-400">{FIELD_LABELS[field] || field}</td>
                                  <td className="px-3 py-1.5 text-red-400">{String(log.old_data?.[field] ?? '-')}</td>
                                  <td className="px-3 py-1.5 text-green-400">{String(log.new_data?.[field] ?? '-')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* DELETE: 삭제된 데이터 + 복원 버튼 */}
                      {log.action === 'DELETE' && log.old_data && (
                        <div className="space-y-2">
                          <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-3">
                            <p className="text-xs text-red-400 font-bold mb-1">삭제된 데이터</p>
                            <div className="text-xs text-gray-400 space-y-0.5">
                              {Object.entries(log.old_data)
                                .filter(([k]) => !['created_at', 'updated_at'].includes(k))
                                .map(([k, v]) => (
                                  <div key={k}><span className="text-gray-500">{FIELD_LABELS[k] || k}:</span> {String(v)}</div>
                                ))}
                            </div>
                          </div>
                          <button onClick={() => handleRestore(log.id)}
                            className="px-4 py-2 bg-blue-800 text-blue-200 rounded-lg text-xs hover:bg-blue-700">
                            복원
                          </button>
                        </div>
                      )}

                      {/* INSERT: 등록된 데이터 */}
                      {log.action === 'INSERT' && log.new_data && (
                        <div className="bg-green-900/10 border border-green-900/30 rounded-lg p-3">
                          <p className="text-xs text-green-400 font-bold mb-1">등록된 데이터</p>
                          <div className="text-xs text-gray-400 space-y-0.5">
                            {Object.entries(log.new_data)
                              .filter(([k, v]) => v != null && v !== '' && !['created_at', 'updated_at'].includes(k))
                              .map(([k, v]) => (
                                <div key={k}><span className="text-gray-500">{FIELD_LABELS[k] || k}:</span> {String(v)}</div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
