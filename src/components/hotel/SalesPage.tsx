'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Sale, SaleInput, Room, RoomType, SaleType } from '@/types/hotel';
import { ROOM_TYPE_LABELS, OTA_CHANNELS, OTHER_CHANNELS, PAYMENT_METHODS } from '@/types/hotel';

const ROOM_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

function today() {
  return new Date().toISOString().split('T')[0];
}

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR');
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visit_count: number;
  total_spent: number;
  preferred_room_type: string | null;
  last_visit_date: string | null;
  memo: string | null;
  marketing_consent: boolean;
}

const INITIAL_FORM: SaleInput = {
  sale_date: today(),
  sale_type: '대실',
  channel: '',
  payment_method: '',
  guest_name: '',
  room_type: 'S',
  check_in_time: undefined,
  check_out_time: undefined,
  amount: 0,
  room_id: undefined,
  room_number: '',
  car_number: '',
  memo: '',
};

export default function SalesPage() {
  const [form, setForm] = useState<SaleInput>({ ...INITIAL_FORM });
  const [sales, setSales] = useState<Sale[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [channelGroup, setChannelGroup] = useState<'ota' | 'other' | ''>('');

  // 고객 정보 상태
  const [customerOpen, setCustomerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerInfo | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSales = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/sales?date=${form.sale_date}`);
    if (res.ok) setSales(await res.json());
  }, [form.sale_date]);

  const fetchRooms = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/rooms`);
    if (res.ok) setRooms(await res.json());
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filteredRooms = rooms.filter(r => r.room_type === form.room_type);

  const setField = <K extends keyof SaleInput>(key: K, value: SaleInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // 전화번호 입력 시 자동 고객 검색
  const handlePhoneChange = (raw: string) => {
    const formatted = formatPhoneInput(raw);
    setPhone(formatted);
    setFoundCustomer(null);
    setIsNewCustomer(false);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    const digits = formatted.replace(/\D/g, '');
    if (digits.length >= 10) {
      setCustomerSearching(true);
      searchTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/admin/hotel/customers/search?phone=${digits}`);
        if (res.ok) {
          const data = await res.json();
          if (data.found) {
            setFoundCustomer(data.customer);
            setIsNewCustomer(false);
            setCustomerOpen(true);
            // 기존 고객 이름 자동 채움
            if (data.customer.name && !form.guest_name) {
              setField('guest_name', data.customer.name);
            }
            if (data.customer.email) {
              setEmail(data.customer.email);
            }
            setMarketingConsent(data.customer.marketing_consent || false);
          } else {
            setIsNewCustomer(true);
          }
        }
        setCustomerSearching(false);
      }, 400);
    }
  };

  const selectChannel = (ch: string, group: 'ota' | 'other') => {
    setChannelGroup(group);
    setField('channel', ch);
    if (group === 'ota') {
      setField('payment_method', ch === '야놀자' ? '야놀자' : '여기어때');
    }
  };

  const resetCustomerFields = () => {
    setPhone('');
    setEmail('');
    setMarketingConsent(false);
    setFoundCustomer(null);
    setIsNewCustomer(false);
    setCustomerOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.channel || !form.amount) return;
    setLoading(true);

    const payload: Record<string, unknown> = { ...form };
    if (!payload.check_in_time) delete payload.check_in_time;
    if (!payload.check_out_time) delete payload.check_out_time;
    if (!payload.room_id) delete payload.room_id;

    // 고객 정보 추가
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      payload.phone = phoneDigits;
      payload.email = email || undefined;
      payload.marketing_consent = marketingConsent;
    }

    const url = '/api/admin/hotel/sales';
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? { id: editId, ...payload } : payload;

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    setLoading(false);
    setEditId(null);
    setForm({ ...INITIAL_FORM, sale_date: form.sale_date, sale_type: form.sale_type });
    setChannelGroup('');
    resetCustomerFields();
    fetchSales();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/hotel/sales?id=${id}`, { method: 'DELETE' });
    fetchSales();
  };

  const handleEdit = (sale: Sale) => {
    setEditId(sale.id);
    setForm({
      sale_date: sale.sale_date,
      sale_type: sale.sale_type,
      channel: sale.channel,
      payment_method: sale.payment_method || '',
      guest_name: sale.guest_name,
      room_type: sale.room_type,
      check_in_time: sale.check_in_time ?? undefined,
      check_out_time: sale.check_out_time ?? undefined,
      amount: sale.amount,
      room_id: sale.room_id ?? undefined,
      room_number: sale.room_number || '',
      car_number: sale.car_number,
      memo: sale.memo,
    });
    if (['야놀자', '여기어때'].includes(sale.channel)) {
      setChannelGroup('ota');
    } else {
      setChannelGroup('other');
    }
    // 수정 시 고객 정보 초기화 (기존 연결은 유지됨)
    resetCustomerFields();
  };

  const handleCheckout = async (sale: Sale) => {
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sale.id, status: 'checked_out' }),
    });
    fetchSales();
  };

  const totalRevenue = sales.filter(s => s.status !== 'cancelled').reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">판매 입력</h1>
        <input
          type="date"
          value={form.sale_date}
          onChange={e => setField('sale_date', e.target.value)}
          className="bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* 입력 폼 */}
      <div className="bg-[#1a1a1a] rounded-xl p-5 border border-[#333] space-y-5">
        {/* 대실/숙박 탭 */}
        <div className="flex gap-2">
          {(['대실', '숙박'] as SaleType[]).map(type => (
            <button
              key={type}
              onClick={() => setField('sale_type', type)}
              className={`flex-1 py-3 rounded-lg text-lg font-bold transition-colors ${
                form.sale_type === type
                  ? type === '대실' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                  : 'bg-[#2a2a2a] text-gray-400'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* 채널 선택 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">채널</label>
          <div className="flex gap-2 mb-2">
            {OTA_CHANNELS.map(ch => (
              <button
                key={ch}
                onClick={() => selectChannel(ch, 'ota')}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                  form.channel === ch
                    ? ch === '야놀자' ? 'bg-pink-600 text-white' : 'bg-red-600 text-white'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
                }`}
              >
                {ch}
              </button>
            ))}
            <button
              onClick={() => { setChannelGroup('other'); if (!OTHER_CHANNELS.includes(form.channel as typeof OTHER_CHANNELS[number])) setField('channel', '워킹'); }}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-colors ${
                channelGroup === 'other' ? 'bg-[#C9A84C] text-black' : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333]'
              }`}
            >
              기타
            </button>
          </div>
          {channelGroup === 'other' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {OTHER_CHANNELS.map(ch => (
                  <button
                    key={ch}
                    onClick={() => setField('channel', ch)}
                    className={`flex-1 py-2 rounded-lg text-sm ${
                      form.channel === ch ? 'bg-[#555] text-white' : 'bg-[#2a2a2a] text-gray-400'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
              <select
                value={form.payment_method || ''}
                onChange={e => setField('payment_method', e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
              >
                <option value="">결제수단 선택</option>
                {PAYMENT_METHODS.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 객실타입 */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">객실타입</label>
          <div className="grid grid-cols-6 gap-2">
            {ROOM_TYPES.map(rt => (
              <button
                key={rt}
                onClick={() => { setField('room_type', rt); setField('room_id', undefined); setField('room_number', ''); }}
                className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  form.room_type === rt ? 'bg-[#C9A84C] text-black' : 'bg-[#2a2a2a] text-gray-300'
                }`}
              >
                {rt}
              </button>
            ))}
          </div>
        </div>

        {/* 성명 + 금액 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">성명</label>
            <input
              type="text"
              value={form.guest_name || ''}
              onChange={e => setField('guest_name', e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              placeholder="성명"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">금액</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={e => setField('amount', Number(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              placeholder="0"
              step={1000}
            />
          </div>
        </div>

        {/* ─── 고객 정보 (접이식) ─── */}
        <div className="border border-[#333] rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setCustomerOpen(!customerOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#222] hover:bg-[#2a2a2a] transition-colors"
          >
            <span className="text-sm text-gray-400 flex items-center gap-2">
              고객 정보 추가
              {foundCustomer && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40">
                  재방문 {foundCustomer.visit_count}회
                </span>
              )}
              {isNewCustomer && phone.replace(/\D/g, '').length >= 10 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-900/40 text-blue-300 border border-blue-700/40">
                  신규 고객
                </span>
              )}
            </span>
            <span className="text-gray-500 text-sm">{customerOpen ? '▲' : '▼'}</span>
          </button>

          {customerOpen && (
            <div className="p-4 space-y-4 bg-[#1a1a1a]">
              {/* 전화번호 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">전화번호</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5 pr-10"
                    placeholder="010-0000-0000"
                    inputMode="numeric"
                  />
                  {customerSearching && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">검색중...</span>
                  )}
                </div>
              </div>

              {/* 재방문 고객 정보 배지 */}
              {foundCustomer && (
                <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#C9A84C] font-bold text-sm">재방문 고객!</span>
                    <span className="text-xs text-gray-400">({foundCustomer.visit_count}회째)</span>
                  </div>
                  <div className="text-xs text-gray-300 space-y-0.5">
                    {foundCustomer.preferred_room_type && (
                      <p>선호: {foundCustomer.preferred_room_type}타입 | 누적: {formatAmount(foundCustomer.total_spent)}원</p>
                    )}
                    {foundCustomer.last_visit_date && (
                      <p>최근 방문: {foundCustomer.last_visit_date}</p>
                    )}
                    {foundCustomer.memo && (
                      <p className="text-yellow-400/80 mt-1">메모: {foundCustomer.memo}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 이메일 */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
                  placeholder="선택 입력"
                />
              </div>

              {/* 마케팅 수신동의 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={e => setMarketingConsent(e.target.checked)}
                  className="w-4 h-4 rounded border-[#444] bg-[#2a2a2a] accent-[#C9A84C]"
                />
                <span className="text-sm text-gray-400">마케팅 수신동의 (프로모션/할인 안내)</span>
              </label>
            </div>
          )}
        </div>

        {/* 입실/퇴실 시간 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">입실시간</label>
            <input
              type="number"
              value={form.check_in_time ?? ''}
              onChange={e => setField('check_in_time', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              placeholder="14.0"
              step={0.5}
              min={0}
              max={24}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">퇴실시간</label>
            <input
              type="number"
              value={form.check_out_time ?? ''}
              onChange={e => setField('check_out_time', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              placeholder="12.0"
              step={0.5}
              min={0}
              max={24}
            />
          </div>
        </div>

        {/* 호실 + 차번호 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">호실</label>
            <select
              value={form.room_id ?? ''}
              onChange={e => {
                const room = rooms.find(r => r.id === Number(e.target.value));
                setField('room_id', room?.id);
                setField('room_number', room?.room_number || '');
              }}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
            >
              <option value="">선택 안함</option>
              {filteredRooms.map(r => (
                <option key={r.id} value={r.id}>{r.room_number}호</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">차번호</label>
            <input
              type="text"
              value={form.car_number || ''}
              onChange={e => setField('car_number', e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
              placeholder="차번호"
            />
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">메모</label>
          <input
            type="text"
            value={form.memo || ''}
            onChange={e => setField('memo', e.target.value)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2.5"
            placeholder="메모"
          />
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={loading || !form.channel || !form.amount}
          className="w-full py-3.5 rounded-lg font-bold text-lg transition-colors disabled:opacity-40 bg-[#C9A84C] text-black hover:bg-[#E8C96A]"
        >
          {loading ? '저장 중...' : editId ? '수정 저장' : '저장'}
        </button>
        {editId && (
          <button
            onClick={() => { setEditId(null); setForm({ ...INITIAL_FORM, sale_date: form.sale_date }); setChannelGroup(''); resetCustomerFields(); }}
            className="w-full py-2 text-sm text-gray-400 hover:text-white"
          >
            수정 취소
          </button>
        )}
      </div>

      {/* 오늘 입력 목록 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#333]">
          <h2 className="font-bold text-lg">
            {form.sale_date} 판매 목록
            <span className="ml-2 text-sm text-gray-400">({sales.length}건)</span>
          </h2>
          <span className="text-[#C9A84C] font-bold">{formatAmount(totalRevenue)}원</span>
        </div>
        <div className="divide-y divide-[#2a2a2a]">
          {sales.length === 0 && (
            <p className="px-5 py-8 text-center text-gray-500">입력된 판매가 없습니다</p>
          )}
          {sales.map(sale => (
            <div key={sale.id} className="px-5 py-3 flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                sale.sale_type === '대실' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
              }`}>
                {sale.sale_type}
              </span>
              <span className="text-xs text-gray-400 w-14">{sale.channel}</span>
              <span className="text-sm flex-1">
                {sale.guest_name || '-'}
                {sale.room_number && <span className="ml-1 text-gray-500">({sale.room_number}호)</span>}
              </span>
              <span className="text-sm font-medium text-[#C9A84C] w-24 text-right">
                {formatAmount(sale.amount)}원
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                sale.status === 'active' ? 'bg-emerald-900 text-emerald-300' :
                sale.status === 'checked_out' ? 'bg-gray-700 text-gray-400' :
                'bg-red-900 text-red-300'
              }`}>
                {sale.status === 'active' ? '사용중' : sale.status === 'checked_out' ? '퇴실' : '취소'}
              </span>
              <div className="flex gap-1">
                {sale.status === 'active' && (
                  <button onClick={() => handleCheckout(sale)} className="text-xs text-orange-400 hover:text-orange-300 px-2 py-1">
                    퇴실
                  </button>
                )}
                <button onClick={() => handleEdit(sale)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">
                  수정
                </button>
                <button onClick={() => handleDelete(sale.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
