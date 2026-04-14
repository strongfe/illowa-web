'use client';

// ═══════════════════════════════════════════════════════════════
// 연박 현황 페이지 (Long-stay / multi-night bookings dashboard)
//
// Reads `GET /api/admin/hotel/bookings` — the server returns rows
// from the `bookings` table, which are ALREADY pre-grouped by
// booking_id (check_in_date, check_out_date, total_nights,
// total_amount, etc. are aggregate columns on the row itself).
// That means the "group sales by booking_id" requirement is a
// no-op here — we just render what the API gives us.
//
// Row clicks open the reused Legacy SaleModal for editing.
// Because SaleModal wants a `Sale` (not a `Booking`) we first
// hop to `/api/admin/hotel/sales?date={check_in_date}` and
// pick the sale whose `booking_id` matches the clicked row.
// That trailing fetch keeps the main route untouched.
//
// "+ 연박 추가" reuses the same modal in CREATE mode with a
// defaults object, so the modal opens on the 연박 tab by default
// (SaleModal checks `defaults.sale_type` and reads `mode`
// internally; starting on "single" is fine — the user just
// clicks "연박" once).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Booking, Sale, Room } from '@/types/hotel';
import { SaleModal } from './SalesPageLegacy';

type BookingStatus = '투숙중' | '오늘퇴실' | '예정' | '퇴실완료' | '취소';
type StatusFilter = '전체' | '투숙중' | '예정' | '완료';

function todayStr(): string {
  const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
}

function startOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // 일요일 시작
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function endOfWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + (6 - d.getDay())); // 토요일 끝
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/**
 * Derive the row status label from the booking's dates relative to
 * today. `check_in_date` is inclusive and `check_out_date` is the
 * day the guest leaves (exclusive for the stay count).
 *   check_in <= today < check_out   → 투숙중
 *   check_out === today              → 오늘퇴실
 *   check_out < today                → 퇴실완료
 *   check_in > today                 → 예정
 * Cancelled bookings are flagged separately.
 */
function deriveStatus(b: Booking, today: string): BookingStatus {
  if (b.status === 'cancelled') return '취소';
  if (b.check_out_date === today) return '오늘퇴실';
  if (b.check_out_date < today) return '퇴실완료';
  if (b.check_in_date > today) return '예정';
  return '투숙중';
}

function statusClass(s: BookingStatus): string {
  switch (s) {
    case '투숙중':
      return 'bg-green-100 text-green-700';
    case '오늘퇴실':
      return 'bg-orange-100 text-orange-700';
    case '예정':
      return 'bg-blue-100 text-blue-700';
    case '퇴실완료':
      return 'bg-gray-200 text-gray-600';
    case '취소':
      return 'bg-red-100 text-red-700';
  }
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('전체');
  const [nameSearch, setNameSearch] = useState('');

  // Modal state — null means the modal is closed. When the user
  // clicks a row we fetch the representative sale and put it here.
  // When the user clicks "+ 연박 추가" we set it to 'create' and
  // SaleModal opens with editSale=null.
  const [modalSale, setModalSale] = useState<Sale | null>(null);
  // The Booking that was clicked — kept alongside modalSale so we
  // can render a contextual banner above the edit modal showing
  // the full stay span (check_in → check_out, nights, total).
  const [modalBooking, setModalBooking] = useState<Booking | null>(null);
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const today = todayStr();

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/hotel/bookings');
      if (res.ok) {
        const data: Booking[] = await res.json();
        setBookings(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Room master list (for the SaleModal room dropdown). Fetched
  // once on mount and shared across every modal open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/hotel/rooms');
        if (!res.ok) return;
        const data: Room[] = await res.json();
        if (!cancelled) setRooms(data);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered view — date range intersects the booking's stay
  // window, and status matches the filter group.
  const visible = useMemo(() => {
    const nameKey = nameSearch.trim().toLowerCase();
    return bookings
      .map((b) => ({ b, s: deriveStatus(b, today) }))
      .filter(({ b, s }) => {
        // name search filter
        if (nameKey && !b.guest_name.toLowerCase().includes(nameKey)) return false;
        // date range filter: show bookings whose stay window
        // overlaps [dateFrom, dateTo]
        if (dateFrom && b.check_out_date < dateFrom) return false;
        if (dateTo && b.check_in_date > dateTo) return false;
        // status filter groups
        if (statusFilter === '투숙중' && s !== '투숙중' && s !== '오늘퇴실') {
          return false;
        }
        if (statusFilter === '예정' && s !== '예정') return false;
        if (statusFilter === '완료' && s !== '퇴실완료' && s !== '취소') {
          return false;
        }
        return true;
      });
  }, [bookings, today, dateFrom, dateTo, statusFilter, nameSearch]);

  // Summary card totals — computed from the full unfiltered set so
  // the cards don't flicker when the user toggles filters.
  const summary = useMemo(() => {
    let staying = 0;
    let checkoutToday = 0;
    let thisWeekCheckin = 0;
    let totalRevenue = 0;
    const weekStart = startOfWeekStr();
    const weekEnd = endOfWeekStr();
    for (const b of bookings) {
      if (b.status === 'cancelled') continue;
      totalRevenue += b.total_amount;
      const s = deriveStatus(b, today);
      if (s === '투숙중') staying += 1;
      if (s === '오늘퇴실') checkoutToday += 1;
      if (
        b.check_in_date >= weekStart &&
        b.check_in_date <= weekEnd &&
        s === '예정'
      ) {
        thisWeekCheckin += 1;
      }
    }
    return { staying, checkoutToday, thisWeekCheckin, totalRevenue };
  }, [bookings, today]);

  // 연박의 모든 날짜별 sale 목록 (행 클릭 시 로드)
  const [bookingSales, setBookingSales] = useState<Sale[]>([]);

  const handleRowClick = useCallback(
    async (b: Booking) => {
      setModalLoading(true);
      try {
        // Fetch ALL sales across the entire booking period so the
        // user can pick any day to edit, not just check_in_date.
        const dates: string[] = [];
        const d = new Date(b.check_in_date + 'T00:00:00');
        const end = new Date(b.check_out_date + 'T00:00:00');
        while (d < end) {
          dates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
          d.setDate(d.getDate() + 1);
        }
        // Fetch each date's sales in parallel
        const allSales: Sale[] = [];
        const results = await Promise.all(
          dates.map((dt) =>
            fetch(`/api/admin/hotel/sales?date=${dt}`).then((r) =>
              r.ok ? r.json() : [],
            ),
          ),
        );
        for (const daySales of results) {
          for (const s of daySales as Sale[]) {
            if (s.booking_id === b.id) allSales.push(s);
          }
        }
        // Sort by sale_date ascending
        allSales.sort((a, b2) => a.sale_date.localeCompare(b2.sale_date));
        if (allSales.length > 0) {
          setBookingSales(allSales);
          setModalSale(allSales[0]); // 기본: 입실일
          setModalBooking(b);
        }
      } finally {
        setModalLoading(false);
      }
    },
    [],
  );

  if (loading) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">연박 현황</h1>
        <button
          onClick={() => setModalCreateOpen(true)}
          className="px-4 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A] transition-colors"
        >
          + 연박 추가
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          label="투숙중"
          value={`${summary.staying}건`}
          color="text-green-600"
        />
        <Card
          label="오늘 퇴실 예정"
          value={`${summary.checkoutToday}건`}
          color={
            summary.checkoutToday > 0 ? 'text-orange-600' : 'text-gray-500'
          }
        />
        <Card
          label="이번 주 체크인 예정"
          value={`${summary.thisWeekCheckin}건`}
          color="text-blue-600"
        />
        <Card
          label="총 연박 매출"
          value={`${fmt(summary.totalRevenue)}원`}
          color="text-[#C9A84C]"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">성명</label>
          <input
            type="text"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="이름 검색"
            className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-sm w-28"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600">기간</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-2 py-1 text-sm"
          />
          {(dateFrom || dateTo || nameSearch) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setNameSearch('');
              }}
              className="text-xs text-gray-500 hover:text-gray-900 px-2"
            >
              초기화
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['전체', '투숙중', '예정', '완료'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#C9A84C] text-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-bold">연박 목록 ({visible.length}건)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-center">타입</th>
                <th className="px-3 py-2 text-left">채널</th>
                <th className="px-3 py-2 text-center">입실일</th>
                <th className="px-3 py-2 text-center">퇴실일</th>
                <th className="px-3 py-2 text-center">박수</th>
                <th className="px-3 py-2 text-right">총금액</th>
                <th className="px-3 py-2 text-left">결제방식</th>
                <th className="px-3 py-2 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-gray-400"
                  >
                    조건에 해당하는 연박 건이 없습니다
                  </td>
                </tr>
              )}
              {visible.map(({ b, s }) => (
                <tr
                  key={b.id}
                  onClick={() => handleRowClick(b)}
                  className="border-t border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium">{b.guest_name || '-'}</td>
                  <td className="px-3 py-2 text-center">{b.room_type}</td>
                  <td className="px-3 py-2 text-gray-600">{b.channel}</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {b.check_in_date}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {b.check_out_date}
                  </td>
                  <td className="px-3 py-2 text-center">{b.total_nights}박</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {fmt(b.total_amount)}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {b.payment_method || '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${statusClass(s)}`}
                    >
                      {s}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="bg-white rounded-lg px-4 py-2 text-sm shadow">
            불러오는 중...
          </div>
        </div>
      )}

      {/* Edit modal — opens when a row was clicked and we resolved
          the representative Sale. The banner above the modal gives
          context about the full multi-night span and lets the user
          switch between days without closing/reopening the modal. */}
      {modalSale && (
        <>
          {/* Day-navigation bar — positioned at the top of the
              viewport but LEFT-aligned to stay clear of the modal's
              X-close button (top right) and its bottom buttons
              (수정 저장 / 퇴실 처리 / 연박 전체 삭제). */}
          {modalBooking && bookingSales.length > 1 && (
            <div className="fixed left-3 top-3 z-[60] pointer-events-none">
              <div className="pointer-events-auto bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 shadow-lg text-sm">
                <p className="font-bold text-blue-800 text-xs mb-1.5">
                  🛏️ {modalBooking.total_nights}박 ({modalBooking.check_in_date.slice(5)} ~ {modalBooking.check_out_date.slice(5)})
                </p>
                <div className="flex flex-col gap-1">
                  {bookingSales.map((s, i) => {
                    const isActive = modalSale?.id === s.id;
                    const dayLabel = s.sale_date.slice(5);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setModalSale(s)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors text-left ${
                          isActive
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                        }`}
                      >
                        {i + 1}일차 ({dayLabel})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <SaleModal
            key={modalSale.id}
            saleDate={modalSale.sale_date}
            rooms={rooms}
            editSale={modalSale}
            defaults={null}
            onClose={() => {
              setModalSale(null);
              setModalBooking(null);
              setBookingSales([]);
            }}
            onSaved={() => {
              setModalSale(null);
              setModalBooking(null);
              setBookingSales([]);
              fetchBookings();
            }}
            onDeleted={() => {
              setModalSale(null);
              setModalBooking(null);
              setBookingSales([]);
              fetchBookings();
            }}
          />
        </>
      )}

      {/* Create modal — new 연박. SaleModal opens in single mode by
          default; staff click the "연박" tab once inside. We pass
          sale_type='숙박' so OTA vs 기타 defaults make sense. */}
      {modalCreateOpen && (
        <SaleModal
          saleDate={todayStr()}
          rooms={rooms}
          editSale={null}
          defaults={{ channel: '', sale_type: '숙박' }}
          onClose={() => setModalCreateOpen(false)}
          onSaved={() => {
            setModalCreateOpen(false);
            fetchBookings();
          }}
          onDeleted={() => {
            setModalCreateOpen(false);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
