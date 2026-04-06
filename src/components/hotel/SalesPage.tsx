'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Sale, SaleInput, Room, RoomType, SaleType } from '@/types/hotel';
import { OTA_CHANNELS, OTHER_CHANNELS, PAYMENT_METHODS, ROOM_TYPE_CAPACITY } from '@/types/hotel';

const ROOM_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function fmtTime(t: number | null) {
  if (t == null) return '';
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
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
  extra_payment_method: '',
  extra_amount: 0,
};

// ─── 6파트 그리드 분류 ───
interface SalesGroups {
  yanolja_daesil: Sale[];
  yanolja_sukbak: Sale[];
  yeogi_daesil: Sale[];
  yeogi_sukbak: Sale[];
  etc_daesil: Sale[];
  etc_sukbak: Sale[];
}

function groupSales(sales: Sale[]): SalesGroups {
  const g: SalesGroups = {
    yanolja_daesil: [], yanolja_sukbak: [],
    yeogi_daesil: [], yeogi_sukbak: [],
    etc_daesil: [], etc_sukbak: [],
  };
  for (const s of sales) {
    if (s.channel === '야놀자') {
      (s.sale_type === '대실' ? g.yanolja_daesil : g.yanolja_sukbak).push(s);
    } else if (s.channel === '여기어때') {
      (s.sale_type === '대실' ? g.yeogi_daesil : g.yeogi_sukbak).push(s);
    } else {
      (s.sale_type === '대실' ? g.etc_daesil : g.etc_sukbak).push(s);
    }
  }
  return g;
}

function sumAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + r.amount + (r.extra_amount || 0), 0);
}

function sumBaseAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + r.amount, 0);
}

function sumExtraAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + (r.extra_amount || 0), 0);
}

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export default function SalesPage() {
  const [saleDate, setSaleDate] = useState(today());
  const [sales, setSales] = useState<Sale[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);

  // 모바일 접이식 상태
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [availPopup, setAvailPopup] = useState(false);

  const fetchSales = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/sales?date=${saleDate}`);
    if (res.ok) setSales(await res.json());
  }, [saleDate]);

  const fetchRooms = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/rooms`);
    if (res.ok) setRooms(await res.json());
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // 30초 자동 새로고침
  useEffect(() => {
    const interval = setInterval(fetchSales, 30000);
    return () => clearInterval(interval);
  }, [fetchSales]);

  const groups = groupSales(sales);

  const openNewSale = (channel: string, saleType: SaleType) => {
    setEditSale(null);
    setModalOpen(true);
    // SaleModal에서 초기값 설정됨
    modalDefaultRef.current = { channel, sale_type: saleType };
  };

  const openEditSale = (sale: Sale) => {
    setEditSale(sale);
    modalDefaultRef.current = null;
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditSale(null);
    fetchSales();
  };

  const handleToggleCheckout = async (sale: Sale) => {
    const newStatus = sale.status === 'checked_out' ? 'active' : 'checked_out';
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sale.id, status: newStatus }),
    });
    fetchSales();
  };

  const modalDefaultRef = useRef<{ channel: string; sale_type: SaleType } | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 전체 요약
  const allDaesil = sales.filter(s => s.sale_type === '대실');
  const allSukbak = sales.filter(s => s.sale_type === '숙박');

  // 타입별 판매가능 현황 계산
  const availability = ROOM_TYPES.map(rt => {
    const total = ROOM_TYPE_CAPACITY[rt];
    const typeSales = sales.filter(s => s.room_type === rt);

    // 대실가능 = 총실 - (대실active + 조기숙박active) + 대실checked_out
    const daesilActive = typeSales.filter(s => s.sale_type === '대실' && s.status === 'active').length;
    const earlySukbak = typeSales.filter(s => s.sale_type === '숙박' && s.status === 'active' && s.check_in_time != null && s.check_in_time < 16).length;
    const daesilOut = typeSales.filter(s => s.sale_type === '대실' && s.status === 'checked_out').length;
    const daesilAvail = total - (daesilActive + earlySukbak) + daesilOut;

    // 숙박가능 = 총실 - 숙박 전체 (active + checked_out)
    const sukbakTotal = typeSales.filter(s => s.sale_type === '숙박').length;
    const sukbakAvail = total - sukbakTotal;

    return { rt, total, daesilAvail, sukbakAvail };
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#C9A84C]">판매 현황판</h1>
          <button
            onClick={() => setAvailPopup(true)}
            className="px-3 py-1.5 bg-[#2a2a2a] border border-[#444] rounded-lg text-xs text-gray-300 hover:bg-[#333] transition-colors"
          >
            잔여현황
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
            className="bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => { setEditSale(null); modalDefaultRef.current = null; setModalOpen(true); }}
            className="px-4 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A] transition-colors"
          >
            + 판매 추가
          </button>
        </div>
      </div>

      {/* 타입별 판매가능 현황 팝업 */}
      {availPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAvailPopup(false)}>
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 mx-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#C9A84C]">타입별 잔여현황</h2>
              <button onClick={() => setAvailPopup(false)} className="text-gray-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#222] text-gray-500">
                    <th className="px-3 py-2 text-left">타입</th>
                    <th className="px-3 py-2 text-center">총실</th>
                    <th className="px-3 py-2 text-center">대실가능</th>
                    <th className="px-3 py-2 text-center">숙박가능</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map(a => (
                    <tr key={a.rt} className="border-t border-[#2a2a2a]">
                      <td className="px-3 py-2 font-bold">{a.rt}</td>
                      <td className="px-3 py-2 text-center text-gray-400">{a.total}</td>
                      <td className={`px-3 py-2 text-center font-bold ${
                        a.daesilAvail <= 0 ? 'text-red-400' : a.daesilAvail <= 2 ? 'text-orange-400' : 'text-emerald-400'
                      }`}>{a.daesilAvail}</td>
                      <td className={`px-3 py-2 text-center font-bold ${
                        a.sukbakAvail <= 0 ? 'text-red-400' : a.sukbakAvail <= 2 ? 'text-orange-400' : 'text-emerald-400'
                      }`}>{a.sukbakAvail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6파트 그리드 ─── */}
      {/* 대실 행 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <SalesPartPanel
          title="야놀자" saleType="대실" sales={groups.yanolja_daesil} isEtc={false}
          collapsed={collapsed['yd']} onToggle={() => toggleCollapse('yd')}
          onClickRow={openEditSale} onAdd={() => openNewSale('야놀자', '대실')} onToggleCheckout={handleToggleCheckout}
        />
        <SalesPartPanel
          title="여기어때" saleType="대실" sales={groups.yeogi_daesil} isEtc={false}
          collapsed={collapsed['ed']} onToggle={() => toggleCollapse('ed')}
          onClickRow={openEditSale} onAdd={() => openNewSale('여기어때', '대실')} onToggleCheckout={handleToggleCheckout}
        />
        <SalesPartPanel
          title="기타" saleType="대실" sales={groups.etc_daesil} isEtc={true}
          collapsed={collapsed['od']} onToggle={() => toggleCollapse('od')}
          onClickRow={openEditSale} onAdd={() => openNewSale('워킹', '대실')} onToggleCheckout={handleToggleCheckout}
        />
      </div>

      {/* 숙박 행 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <SalesPartPanel
          title="야놀자" saleType="숙박" sales={groups.yanolja_sukbak} isEtc={false}
          collapsed={collapsed['ys']} onToggle={() => toggleCollapse('ys')}
          onClickRow={openEditSale} onAdd={() => openNewSale('야놀자', '숙박')} onToggleCheckout={handleToggleCheckout}
        />
        <SalesPartPanel
          title="여기어때" saleType="숙박" sales={groups.yeogi_sukbak} isEtc={false}
          collapsed={collapsed['es']} onToggle={() => toggleCollapse('es')}
          onClickRow={openEditSale} onAdd={() => openNewSale('여기어때', '숙박')} onToggleCheckout={handleToggleCheckout}
        />
        <SalesPartPanel
          title="기타" saleType="숙박" sales={groups.etc_sukbak} isEtc={true}
          collapsed={collapsed['os']} onToggle={() => toggleCollapse('os')}
          onClickRow={openEditSale} onAdd={() => openNewSale('워킹', '숙박')} onToggleCheckout={handleToggleCheckout}
        />
      </div>

      {/* 전체 요약 */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-4">
        <div className="flex flex-wrap gap-6 text-sm justify-center">
          <span>대실 <b className="text-blue-400">{allDaesil.length}</b>건 <b className="text-blue-400">{fmt(sumAmount(allDaesil))}</b>원</span>
          <span>숙박 <b className="text-green-400">{allSukbak.length}</b>건 <b className="text-green-400">{fmt(sumAmount(allSukbak))}</b>원</span>
          <span>합계 <b className="text-[#C9A84C]">{sales.length}</b>건 <b className="text-[#C9A84C]">{fmt(sumAmount(sales))}</b>원</span>
        </div>
      </div>

      {/* 입력/수정 모달 */}
      {modalOpen && (
        <SaleModal
          saleDate={saleDate}
          rooms={rooms}
          editSale={editSale}
          defaults={modalDefaultRef.current}
          onClose={() => { setModalOpen(false); setEditSale(null); }}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// 파트 패널 (하나의 채널×유형 영역)
// ═══════════════════════════════════════
function SalesPartPanel({ title, saleType, sales, isEtc, collapsed, onToggle, onClickRow, onAdd, onToggleCheckout }: {
  title: string;
  saleType: SaleType;
  sales: Sale[];
  isEtc: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onClickRow: (sale: Sale) => void;
  onAdd: () => void;
  onToggleCheckout: (sale: Sale) => void;
}) {
  const headerBg = saleType === '대실' ? 'bg-emerald-900/40' : 'bg-blue-900/40';
  const total = sumAmount(sales);
  const extraTotal = sumExtraAmount(sales);

  return (
    <div className="bg-[#1a1a1a] rounded-lg border border-[#333] overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          <span className="font-bold text-sm">{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${saleType === '대실' ? 'bg-emerald-800 text-emerald-200' : 'bg-blue-800 text-blue-200'}`}>
            {saleType}
          </span>
          <span className="text-xs text-gray-400">({sales.length}건)</span>
          <span className="xl:hidden text-gray-500 text-xs ml-auto">{collapsed ? '▼' : '▲'}</span>
        </button>
        <button onClick={onAdd} className="text-xs text-[#C9A84C] hover:text-[#E8C96A] ml-2 shrink-0">+추가</button>
      </div>

      {/* 테이블 */}
      {!collapsed && (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-[#222] text-gray-500">
                <th className="px-2 py-1.5 text-left w-6">#</th>
                {isEtc && <th className="px-2 py-1.5 text-left">구분</th>}
                <th className="px-2 py-1.5 text-left">성명</th>
                <th className="px-2 py-1.5 text-center">타입</th>
                <th className="px-2 py-1.5 text-center">입실</th>
                <th className="px-2 py-1.5 text-center">퇴실</th>
                {isEtc && <th className="px-2 py-1.5 text-center">결제</th>}
                <th className="px-2 py-1.5 text-right">금액</th>
                <th className="px-2 py-1.5 text-center">호실</th>
                <th className="px-2 py-1.5 text-center">퇴실</th>
                <th className="px-2 py-1.5 text-center">추결</th>
                <th className="px-2 py-1.5 text-right">추금액</th>
                <th className="px-2 py-1.5 text-left">메모</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={isEtc ? 13 : 11} className="px-2 py-4 text-center text-gray-600">-</td></tr>
              )}
              {sales.map((sale, i) => {
                const isOut = sale.status === 'checked_out';
                const hasExtra = !!(sale.extra_amount && sale.extra_amount > 0);
                return (
                  <tr
                    key={sale.id}
                    onClick={() => onClickRow(sale)}
                    className={`cursor-pointer border-t border-[#2a2a2a] transition-colors hover:bg-[#C9A84C]/10 ${isOut ? 'text-gray-600' : 'text-gray-200'}`}
                  >
                    <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                    {isEtc && <td className="px-2 py-1.5 text-gray-400">{sale.channel}</td>}
                    <td className="px-2 py-1.5 truncate max-w-[80px]">
                      {sale.guest_name || '-'}
                      {sale.memo?.includes('당특') && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-red-900 text-red-300">당특</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">{sale.room_type}</td>
                    <td className="px-2 py-1.5 text-center">{fmtTime(sale.check_in_time)}</td>
                    <td className="px-2 py-1.5 text-center">{fmtTime(sale.check_out_time)}</td>
                    {isEtc && <td className="px-2 py-1.5 text-center text-gray-400">{sale.payment_method || ''}</td>}
                    <td className="px-2 py-1.5 text-right font-medium">{fmt(sale.amount)}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400">{sale.room_number || ''}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); onToggleCheckout(sale); }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          isOut
                            ? 'bg-orange-800/60 text-orange-300 hover:bg-orange-700/60'
                            : 'text-gray-600 hover:bg-[#333] hover:text-gray-400'
                        }`}
                      >
                        {isOut ? '☑ 퇴실' : '☐'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-400">{sale.extra_payment_method || ''}</td>
                    <td className={`px-2 py-1.5 text-right ${hasExtra ? 'text-yellow-400 font-medium' : 'text-gray-600'}`}>
                      {hasExtra ? `+${fmt(sale.extra_amount)}` : ''}
                    </td>
                    <td className="px-2 py-1.5 text-gray-400 max-w-[60px] truncate" title={sale.memo || ''}>
                      {sale.memo || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* 소계 */}
          {sales.length > 0 && (
            <div className="px-3 py-1.5 bg-[#222] text-xs text-gray-400 flex justify-between border-t border-[#333]">
              <span>소계: {sales.length}건</span>
              <span className="font-medium text-[#C9A84C]">
                {fmt(total)}원
                {extraTotal > 0 && <span className="text-yellow-400 ml-1">(+{fmt(extraTotal)})</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// 입력/수정 모달
// ═══════════════════════════════════════
function SaleModal({ saleDate, rooms, editSale, defaults, onClose, onSaved, onDeleted }: {
  saleDate: string;
  rooms: Room[];
  editSale: Sale | null;
  defaults: { channel: string; sale_type: SaleType } | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!editSale;

  const [form, setForm] = useState<SaleInput>(() => {
    if (editSale) {
      return {
        sale_date: editSale.sale_date,
        sale_type: editSale.sale_type,
        channel: editSale.channel,
        payment_method: editSale.payment_method || '',
        guest_name: editSale.guest_name,
        room_type: editSale.room_type,
        check_in_time: editSale.check_in_time ?? undefined,
        check_out_time: editSale.check_out_time ?? undefined,
        amount: editSale.amount,
        room_id: editSale.room_id ?? undefined,
        room_number: editSale.room_number || '',
        car_number: editSale.car_number,
        memo: editSale.memo,
        extra_payment_method: editSale.extra_payment_method || '',
        extra_amount: editSale.extra_amount || 0,
      };
    }
    return {
      ...INITIAL_FORM,
      sale_date: saleDate,
      sale_type: defaults?.sale_type || '대실',
      channel: defaults?.channel || '',
    };
  });

  const [channelGroup, setChannelGroup] = useState<'ota' | 'other' | ''>(() => {
    const ch = editSale?.channel || defaults?.channel || '';
    if (['야놀자', '여기어때'].includes(ch)) return 'ota';
    if (ch) return 'other';
    return '';
  });

  const [loading, setLoading] = useState(false);

  // 고객 정보
  const [customerOpen, setCustomerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerInfo | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredRooms = rooms.filter(r => r.room_type === form.room_type);

  const setField = <K extends keyof SaleInput>(key: K, value: SaleInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const selectChannel = (ch: string, group: 'ota' | 'other') => {
    setChannelGroup(group);
    setField('channel', ch);
    if (group === 'ota') {
      setField('payment_method', ch === '야놀자' ? '야놀자' : '여기어때');
    }
  };

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
            if (data.customer.name && !form.guest_name) {
              setField('guest_name', data.customer.name);
            }
            if (data.customer.email) setEmail(data.customer.email);
            setMarketingConsent(data.customer.marketing_consent || false);
          } else {
            setIsNewCustomer(true);
          }
        }
        setCustomerSearching(false);
      }, 400);
    }
  };

  const handleSubmit = async () => {
    if (!form.channel || !form.amount) return;
    setLoading(true);

    const payload: Record<string, unknown> = { ...form };
    if (!payload.check_in_time) delete payload.check_in_time;
    if (!payload.check_out_time) delete payload.check_out_time;
    if (!payload.room_id) delete payload.room_id;

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      payload.phone = phoneDigits;
      payload.email = email || undefined;
      payload.marketing_consent = marketingConsent;
    }

    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { id: editSale!.id, ...payload } : payload;

    await fetch('/api/admin/hotel/sales', {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    setLoading(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!editSale || !confirm('삭제하시겠습니까?')) return;
    await fetch(`/api/admin/hotel/sales?id=${editSale.id}`, { method: 'DELETE' });
    onDeleted();
  };

  const handleCheckout = async () => {
    if (!editSale) return;
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editSale.id, status: 'checked_out' }),
    });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] rounded-xl border border-[#333] w-full max-w-lg mx-4 p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#C9A84C]">{isEdit ? '판매 수정' : '판매 추가'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>

        {/* 대실/숙박 */}
        <div className="flex gap-2">
          {(['대실', '숙박'] as SaleType[]).map(type => (
            <button
              key={type}
              onClick={() => setField('sale_type', type)}
              className={`flex-1 py-2.5 rounded-lg font-bold transition-colors ${
                form.sale_type === type
                  ? type === '대실' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
                  : 'bg-[#2a2a2a] text-gray-400'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* 채널 */}
        <div>
          <div className="flex gap-2 mb-2">
            {OTA_CHANNELS.map(ch => (
              <button
                key={ch}
                onClick={() => selectChannel(ch, 'ota')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                    className={`flex-1 py-1.5 rounded-lg text-xs ${
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
                {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* 객실타입 */}
        <div className="grid grid-cols-6 gap-2">
          {ROOM_TYPES.map(rt => (
            <button
              key={rt}
              onClick={() => { setField('room_type', rt); setField('room_id', undefined); setField('room_number', ''); }}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                form.room_type === rt ? 'bg-[#C9A84C] text-black' : 'bg-[#2a2a2a] text-gray-300'
              }`}
            >
              {rt}
            </button>
          ))}
        </div>

        {/* 성명 + 금액 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">성명</label>
            <input type="text" value={form.guest_name || ''} onChange={e => setField('guest_name', e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="성명" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">금액</label>
            <input type="number" value={form.amount || ''} onChange={e => setField('amount', Number(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="0" step={1000} />
          </div>
        </div>

        {/* 고객 정보 (접이식) */}
        <div className="border border-[#333] rounded-lg overflow-hidden">
          <button type="button" onClick={() => setCustomerOpen(!customerOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-[#222] hover:bg-[#2a2a2a] transition-colors">
            <span className="text-xs text-gray-400 flex items-center gap-2">
              고객 정보
              {foundCustomer && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40">
                  재방문 {foundCustomer.visit_count}회
                </span>
              )}
              {isNewCustomer && phone.replace(/\D/g, '').length >= 10 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/40">신규</span>
              )}
            </span>
            <span className="text-gray-500 text-xs">{customerOpen ? '▲' : '▼'}</span>
          </button>
          {customerOpen && (
            <div className="p-3 space-y-3 bg-[#1a1a1a]">
              <div className="relative">
                <input type="tel" value={phone} onChange={e => handlePhoneChange(e.target.value)}
                  className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm pr-16"
                  placeholder="010-0000-0000" inputMode="numeric" />
                {customerSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">검색중...</span>}
              </div>
              {foundCustomer && (
                <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg p-2.5 space-y-1">
                  <div className="text-[#C9A84C] font-bold text-xs">재방문 고객! ({foundCustomer.visit_count}회째)</div>
                  <div className="text-[10px] text-gray-300 space-y-0.5">
                    {foundCustomer.preferred_room_type && <p>선호: {foundCustomer.preferred_room_type}타입 | 누적: {fmt(foundCustomer.total_spent)}원</p>}
                    {foundCustomer.last_visit_date && <p>최근: {foundCustomer.last_visit_date}</p>}
                    {foundCustomer.memo && <p className="text-yellow-400/80">메모: {foundCustomer.memo}</p>}
                  </div>
                </div>
              )}
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2 text-sm" placeholder="이메일 (선택)" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#C9A84C]" />
                <span className="text-xs text-gray-400">마케팅 수신동의</span>
              </label>
            </div>
          )}
        </div>

        {/* 입실/퇴실 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">입실시간</label>
            <input type="number" value={form.check_in_time ?? ''} onChange={e => setField('check_in_time', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="14" step={0.5} min={0} max={24} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">퇴실시간</label>
            <input type="number" value={form.check_out_time ?? ''} onChange={e => setField('check_out_time', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="12" step={0.5} min={0} max={24} />
          </div>
        </div>

        {/* 호실 + 차번호 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">호실</label>
            <select value={form.room_id ?? ''} onChange={e => {
              const room = rooms.find(r => r.id === Number(e.target.value));
              setField('room_id', room?.id); setField('room_number', room?.room_number || '');
            }} className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2">
              <option value="">선택 안함</option>
              {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.room_number}호</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">차번호</label>
            <input type="text" value={form.car_number || ''} onChange={e => setField('car_number', e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="차번호" />
          </div>
        </div>

        {/* 추가결제 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">추가결제수단</label>
            <select value={form.extra_payment_method || ''} onChange={e => setField('extra_payment_method', e.target.value)}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2">
              <option value="">없음</option>
              {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">추가금액</label>
            <input type="number" value={form.extra_amount || ''} onChange={e => setField('extra_amount', Number(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="0" step={1000} />
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">메모</label>
          <input type="text" value={form.memo || ''} onChange={e => setField('memo', e.target.value)}
            className="w-full bg-[#2a2a2a] border border-[#444] rounded-lg px-3 py-2" placeholder="시간연장, 추가인원, 차량추가 등" />
        </div>

        {/* 액션 버튼들 */}
        <div className="space-y-2 pt-2">
          <button onClick={handleSubmit} disabled={loading || !form.channel || !form.amount}
            className="w-full py-3 rounded-lg font-bold text-base bg-[#C9A84C] text-black hover:bg-[#E8C96A] transition-colors disabled:opacity-40">
            {loading ? '저장 중...' : isEdit ? '수정 저장' : '저장'}
          </button>
          {isEdit && editSale!.status === 'active' && (
            <button onClick={handleCheckout}
              className="w-full py-2.5 rounded-lg font-bold text-sm bg-orange-600 text-white hover:bg-orange-500 transition-colors">
              퇴실 처리
            </button>
          )}
          {isEdit && (
            <button onClick={handleDelete}
              className="w-full py-2 rounded-lg text-sm text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 transition-colors">
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
