'use client';

import { useState, useEffect, useCallback } from 'react';
import { PAYMENT_METHODS } from '@/types/hotel';

interface Complaint {
  id: string;
  complaint_date: string;
  room_number: string | null;
  room_type: string | null;
  guest_name: string | null;
  customer_id: string | null;
  sale_id: string | null;
  channel: string | null;
  category: string | null;
  description: string | null;
  priority: string;
  assigned_to: string;
  status: string;
  resolution: string | null;
  resolution_memo: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  '긴급': { bg: 'bg-red-900', text: 'text-red-300' },
  '높음': { bg: 'bg-orange-900', text: 'text-orange-300' },
  '보통': { bg: 'bg-gray-700', text: 'text-gray-300' },
  '낮음': { bg: 'bg-gray-800', text: 'text-gray-500' },
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: 'bg-red-900', text: 'text-red-300', label: '미처리' },
  in_progress: { bg: 'bg-orange-900', text: 'text-orange-300', label: '처리중' },
  resolved: { bg: 'bg-green-900', text: 'text-green-300', label: '완료' },
  closed: { bg: 'bg-gray-700', text: 'text-gray-400', label: '종결' },
};

const CATEGORIES: Record<string, string[]> = {
  '시설': ['에어컨', '수압', '보일러', 'TV', 'PC', '욕조', '조명', '도어락', '가구', '기타'],
  '청결': ['청소상태', '냄새', '벌레', '수건침구', '기타'],
  '서비스': ['프론트응대', '소음', '주차', '체크인지연', '기타'],
  '기타': ['분실물', '파손', '기타'],
};

export default function ComplaintsPage() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'timeline' | 'room' | 'customer'>('timeline');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [actionTarget, setActionTarget] = useState<Complaint | null>(null);
  const [actionType, setActionType] = useState<'progress' | 'resolve' | ''>('');
  const [actionText, setActionText] = useState('');
  const [actionAssignee, setActionAssignee] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/admin/hotel/complaints?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCount = items.filter(i => i.status === 'open').length;
  const progressCount = items.filter(i => i.status === 'in_progress').length;
  const resolvedCount = items.filter(i => i.status === 'resolved' || i.status === 'closed').length;
  const thisMonth = items.filter(i => {
    const m = new Date().toISOString().slice(0, 7);
    return i.complaint_date?.startsWith(m);
  }).length;

  const handleAction = async () => {
    if (!actionTarget) return;
    const updates: Record<string, unknown> = { id: actionTarget.id };
    if (actionType === 'progress') {
      updates.status = 'in_progress';
      updates.assigned_to = actionAssignee;
      updates.resolution = actionText;
    } else if (actionType === 'resolve') {
      updates.status = 'resolved';
      updates.resolution_memo = actionText;
    }
    await fetch('/api/admin/hotel/complaints', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
    });
    setActionTarget(null);
    setActionType('');
    setActionText('');
    setActionAssignee('');
    fetchData();
  };

  // 호실별 그룹
  const roomGroups = new Map<string, Complaint[]>();
  items.forEach(c => {
    const key = c.room_number || '미지정';
    if (!roomGroups.has(key)) roomGroups.set(key, []);
    roomGroups.get(key)!.push(c);
  });

  // 고객별 그룹
  const customerGroups = new Map<string, Complaint[]>();
  items.forEach(c => {
    const key = c.guest_name || '미상';
    if (!customerGroups.has(key)) customerGroups.set(key, []);
    customerGroups.get(key)!.push(c);
  });

  if (loading) return <div className="text-center py-20 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">컴플레인 관리</h1>
        <button onClick={() => setShowNewModal(true)}
          className="px-4 py-2 bg-red-700 text-white font-bold rounded-lg text-sm hover:bg-red-600">+ 접수</button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="미처리" count={openCount} color="text-red-400" />
        <Card label="처리중" count={progressCount} color="text-orange-400" />
        <Card label="완료" count={resolvedCount} color="text-green-400" />
        <Card label="이번 달" count={thisMonth} color="text-gray-300" />
      </div>

      {/* 뷰 전환 + 필터 */}
      <div className="flex flex-wrap gap-4">
        <div className="flex gap-1">
          {([['timeline', '시간순'], ['room', '호실별'], ['customer', '고객별']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs ${view === v ? 'bg-[#C9A84C] text-black font-bold' : 'bg-[#2a2a2a] text-gray-400'}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-1">
          {[['', '전체'], ['open', '미처리'], ['in_progress', '처리중'], ['resolved', '완료']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs ${statusFilter === v ? 'bg-[#444] text-white' : 'bg-[#2a2a2a] text-gray-500'}`}>{l}</button>
          ))}
        </div>
      </div>

      {/* 시간순 보기 */}
      {view === 'timeline' && (
        <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-[#222] text-gray-500">
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-center">호실</th>
                  <th className="px-3 py-2 text-left">고객</th>
                  <th className="px-3 py-2 text-left">카테고리</th>
                  <th className="px-3 py-2 text-left">내용</th>
                  <th className="px-3 py-2 text-center">우선</th>
                  <th className="px-3 py-2 text-center">상태</th>
                  <th className="px-3 py-2 text-center">담당</th>
                  <th className="px-3 py-2 text-center">처리</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-600">컴플레인이 없습니다</td></tr>}
                {items.map(c => {
                  const ps = PRIORITY_STYLE[c.priority] || PRIORITY_STYLE['보통'];
                  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.open;
                  return (
                    <tr key={c.id} className="border-t border-[#2a2a2a] hover:bg-[#222]">
                      <td className="px-3 py-2 text-gray-400">{c.complaint_date}</td>
                      <td className="px-3 py-2 text-center">{c.room_number || '-'}</td>
                      <td className="px-3 py-2">{c.guest_name || '-'}</td>
                      <td className="px-3 py-2 text-gray-400">{c.category || '-'}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={c.description || ''}>{c.description || '-'}</td>
                      <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ps.bg} ${ps.text}`}>{c.priority}</span></td>
                      <td className="px-3 py-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ss.bg} ${ss.text}`}>{ss.label}</span></td>
                      <td className="px-3 py-2 text-center text-gray-400">{c.assigned_to || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {c.status === 'open' && (
                          <button onClick={() => { setActionTarget(c); setActionType('progress'); }}
                            className="px-2 py-0.5 bg-orange-800 text-orange-200 rounded text-[10px] hover:bg-orange-700">접수</button>
                        )}
                        {c.status === 'in_progress' && (
                          <button onClick={() => { setActionTarget(c); setActionType('resolve'); }}
                            className="px-2 py-0.5 bg-green-800 text-green-200 rounded text-[10px] hover:bg-green-700">완료</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 호실별 보기 */}
      {view === 'room' && (
        <div className="space-y-3">
          {Array.from(roomGroups.entries()).sort((a, b) => b[1].length - a[1].length).map(([room, complaints]) => {
            const activeCount = complaints.filter(c => c.status === 'open' || c.status === 'in_progress').length;
            const categories = [...new Set(complaints.map(c => c.category).filter(Boolean))];
            const isRepeat = complaints.filter(c => c.category === complaints[0]?.category).length >= 3;
            return (
              <div key={room} className="bg-[#1a1a1a] rounded-xl border border-[#333] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold">{room}호</span>
                  <span className="text-xs text-gray-400">({complaints.length}건{activeCount > 0 ? `, 미처리 ${activeCount}건` : ''})</span>
                  {isRepeat && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900 text-red-300 font-bold">반복 이슈</span>}
                </div>
                <div className="space-y-1">
                  {complaints.map(c => {
                    const ss = STATUS_STYLE[c.status] || STATUS_STYLE.open;
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 w-16">{c.complaint_date?.slice(5)}</span>
                        <span className="text-gray-400">{c.category}</span>
                        <span className="flex-1 text-gray-300 truncate">{c.description}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${ss.bg} ${ss.text}`}>{ss.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {roomGroups.size === 0 && <div className="text-center py-8 text-gray-500">데이터 없음</div>}
        </div>
      )}

      {/* 고객별 보기 */}
      {view === 'customer' && (
        <div className="space-y-3">
          {Array.from(customerGroups.entries()).sort((a, b) => b[1].length - a[1].length).map(([name, complaints]) => (
            <div key={name} className="bg-[#1a1a1a] rounded-xl border border-[#333] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold">{name}</span>
                <span className="text-xs text-gray-400">({complaints.length}건)</span>
              </div>
              <div className="space-y-1">
                {complaints.map(c => {
                  const ss = STATUS_STYLE[c.status] || STATUS_STYLE.open;
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-16">{c.complaint_date?.slice(5)}</span>
                      <span className="text-gray-400 w-12">{c.room_number || '-'}호</span>
                      <span className="text-gray-400">{c.category}</span>
                      <span className="flex-1 text-gray-300 truncate">{c.description}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${ss.bg} ${ss.text}`}>{ss.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {customerGroups.size === 0 && <div className="text-center py-8 text-gray-500">데이터 없음</div>}
        </div>
      )}

      {/* 상태 변경 모달 */}
      {actionTarget && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setActionTarget(null); setActionType(''); }}>
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 w-80 max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#C9A84C]">
              {actionType === 'progress' ? '처리 접수' : '처리 완료'}
            </h3>
            <div className="text-xs space-y-1 text-gray-400">
              <p>호실: {actionTarget.room_number || '-'} | {actionTarget.category}</p>
              <p>{actionTarget.description}</p>
            </div>
            {actionType === 'progress' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">담당자</label>
                <input type="text" value={actionAssignee} onChange={e => setActionAssignee(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" placeholder="관리실, 객실팀, 프론트 등" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{actionType === 'progress' ? '처리 계획' : '처리 내용'}</label>
              <textarea value={actionText} onChange={e => setActionText(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm h-20 resize-none"
                placeholder={actionType === 'progress' ? '기사 출동 예정 등' : '에어컨 필터 교체 완료 등'} />
            </div>
            <button onClick={handleAction}
              className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
                actionType === 'progress' ? 'bg-orange-600 text-white hover:bg-orange-500' : 'bg-green-600 text-white hover:bg-green-500'
              }`}>
              {actionType === 'progress' ? '처리중으로 변경' : '완료 처리'}
            </button>
          </div>
        </div>
      )}

      {/* 신규 접수 모달 */}
      {showNewModal && <NewComplaintModal onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); fetchData(); }} />}
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

// ─── 신규 접수 모달 ───
function NewComplaintModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [roomNumber, setRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [mainCat, setMainCat] = useState('시설');
  const [subCat, setSubCat] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('보통');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState<Array<{ room_number: string }>>([]);

  useEffect(() => {
    fetch('/api/admin/hotel/rooms').then(r => r.ok ? r.json() : []).then(setRooms);
  }, []);

  const handleSave = async () => {
    if (!description) return;
    setSaving(true);
    await fetch('/api/admin/hotel/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: roomNumber || null,
        guest_name: guestName || null,
        category: subCat ? `${mainCat}-${subCat}` : mainCat,
        description,
        priority,
        assigned_to: assignedTo,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 w-full max-w-md mx-4 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-red-400">컴플레인 접수</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">호실</label>
            <select value={roomNumber} onChange={e => setRoomNumber(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm">
              <option value="">선택</option>
              {rooms.map(r => <option key={r.room_number} value={r.room_number}>{r.room_number}호</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">고객명</label>
            <input type="text" value={guestName} onChange={e => setGuestName(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" placeholder="고객명" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">카테고리</label>
          <div className="flex gap-2 mb-2">
            {Object.keys(CATEGORIES).map(cat => (
              <button key={cat} onClick={() => { setMainCat(cat); setSubCat(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs ${mainCat === cat ? 'bg-[#C9A84C] text-black font-bold' : 'bg-[#2a2a2a] text-gray-400'}`}>{cat}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES[mainCat]?.map(sub => (
              <button key={sub} onClick={() => setSubCat(sub)}
                className={`px-2 py-1 rounded text-xs ${subCat === sub ? 'bg-[#555] text-white' : 'bg-[#2a2a2a] text-gray-500'}`}>{sub}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">내용</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm h-20 resize-none" placeholder="상세 설명" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">우선순위</label>
            <div className="flex gap-1">
              {['긴급', '높음', '보통', '낮음'].map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-bold ${priority === p ? (PRIORITY_STYLE[p]?.bg + ' ' + PRIORITY_STYLE[p]?.text) : 'bg-[#2a2a2a] text-gray-500'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">담당</label>
            <input type="text" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" placeholder="관리실" />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !description}
          className="w-full py-3 rounded-lg font-bold bg-red-700 text-white hover:bg-red-600 transition-colors disabled:opacity-40">
          {saving ? '저장 중...' : '접수'}
        </button>
      </div>
    </div>
  );
}
