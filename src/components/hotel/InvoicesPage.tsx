'use client';

// ═══════════════════════════════════════════════════════════════
// 인보이스 관리 — 검색 + 목록 + 미리보기/PDF
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';
import type { Sale } from '@/types/hotel';

function fmt(n: number): string {
  return n.toLocaleString('ko-KR');
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────
// Grouped invoice item (single or multi-night)
// ─────────────────────────────────────────────────────────────

interface InvoiceItem {
  id: string; // booking_id or sale.id
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomNumber: string;
  totalAmount: number;
  dailyRates: { date: string; amount: number }[];
  isBooking: boolean;
}

function groupSalesIntoItems(sales: Sale[]): InvoiceItem[] {
  const sukbak = sales.filter((s) => s.sale_type === '숙박');
  const bookingMap = new Map<string, Sale[]>();
  const singles: Sale[] = [];

  for (const s of sukbak) {
    if (
      s.booking_id &&
      typeof s.booking_id === 'string' &&
      s.booking_id.length >= 32
    ) {
      const arr = bookingMap.get(s.booking_id) ?? [];
      arr.push(s);
      bookingMap.set(s.booking_id, arr);
    } else {
      singles.push(s);
    }
  }

  const items: InvoiceItem[] = [];

  // Multi-night bookings
  for (const [bid, group] of bookingMap) {
    group.sort((a, b) => a.sale_date.localeCompare(b.sale_date));
    const first = group[0];
    const last = group[group.length - 1];
    items.push({
      id: bid,
      guestName: first.guest_name || '-',
      checkIn: first.sale_date,
      checkOut: last.sale_date,
      nights: group.length,
      roomNumber: first.room_number || '-',
      totalAmount: group.reduce((s, r) => s + r.amount, 0),
      dailyRates: group.map((s) => ({ date: s.sale_date, amount: s.amount })),
      isBooking: true,
    });
  }

  // Single-night
  for (const s of singles) {
    items.push({
      id: s.id,
      guestName: s.guest_name || '-',
      checkIn: s.sale_date,
      checkOut: s.sale_date,
      nights: 1,
      roomNumber: s.room_number || '-',
      totalAmount: s.amount,
      dailyRates: [{ date: s.sale_date, amount: s.amount }],
      isBooking: false,
    });
  }

  items.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return items;
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [nameFilter, setNameFilter] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<InvoiceItem | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all sales in the date range
      const dates: string[] = [];
      const d = new Date(dateFrom + 'T00:00:00');
      const end = new Date(dateTo + 'T00:00:00');
      while (d <= end) {
        dates.push(d.toISOString().split('T')[0]);
        d.setDate(d.getDate() + 1);
      }
      const allSales: Sale[] = [];
      const results = await Promise.all(
        dates.map((dt) =>
          fetch(`/api/admin/hotel/sales?date=${dt}`).then((r) =>
            r.ok ? r.json() : [],
          ),
        ),
      );
      for (const daySales of results) {
        for (const s of daySales as Sale[]) allSales.push(s);
      }
      let grouped = groupSalesIntoItems(allSales);
      if (nameFilter.trim()) {
        const q = nameFilter.trim().toLowerCase();
        grouped = grouped.filter((it) =>
          it.guestName.toLowerCase().includes(q),
        );
      }
      setItems(grouped);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, nameFilter]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[#C9A84C]">인보이스</h1>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">성명</label>
          <input
            type="text"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="성명 검색"
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
        <button
          onClick={search}
          disabled={loading}
          className="px-4 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A] disabled:opacity-50"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* Results */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200">
            <h2 className="font-bold text-sm">검색 결과 ({items.length}건)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-500 text-xs">
                <th className="px-3 py-2 text-left">성명</th>
                <th className="px-3 py-2 text-center">입실일</th>
                <th className="px-3 py-2 text-center">퇴실일</th>
                <th className="px-3 py-2 text-center">박수</th>
                <th className="px-3 py-2 text-center">호실</th>
                <th className="px-3 py-2 text-right">금액</th>
                <th className="px-3 py-2 text-center">발행</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium">{it.guestName}</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {it.checkIn}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {it.checkOut}
                  </td>
                  <td className="px-3 py-2 text-center">{it.nights}박</td>
                  <td className="px-3 py-2 text-center text-gray-600">
                    {it.roomNumber}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {fmt(it.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => setPreviewItem(it)}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                    >
                      미리보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-400 text-sm">
          날짜 범위와 성명을 입력하고 검색해주세요
        </div>
      )}

      {/* Invoice preview popup */}
      {previewItem && (
        <InvoicePopup
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Invoice preview + print/PDF
// ─────────────────────────────────────────────────────────────

// Shared print CSS for the invoice
const INVOICE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #333; max-width: 680px; margin: 0 auto; padding: 48px 40px; }
  .inv-title { text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #C9A84C; margin-bottom: 20px; }
  .inv-divider { border: none; border-top: 1px solid #C9A84C; margin: 16px 0; }
  .inv-hotel-info { text-align: left; font-size: 11px; color: #666; line-height: 1.9; }
  .inv-no { text-align: right; font-size: 11px; color: #999; margin-top: 20px; }
  .inv-guest-label { font-size: 11px; color: #C9A84C; text-transform: uppercase; letter-spacing: 3px; margin-top: 24px; }
  .inv-guest-name { font-size: 22px; font-weight: bold; color: #222; margin-top: 4px; padding-bottom: 8px; border-bottom: 2px solid #C9A84C; display: inline-block; }
  .inv-vat { font-size: 11px; color: #999; margin-top: 8px; }
  .inv-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  .inv-table thead th { background: #1a1a1a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; padding: 10px 16px; }
  .inv-table thead th.t-left { text-align: left; }
  .inv-table thead th.t-center { text-align: center; }
  .inv-table thead th.t-right { text-align: right; }
  .inv-table tbody td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid #eee; }
  .inv-table tbody tr:nth-child(even) { background: #fafafa; }
  .inv-table .td-right { text-align: right; }
  .inv-table .td-center { text-align: center; }
  .inv-total { background: #f8f4ec; border-top: 2px solid #333; }
  .inv-total td { padding: 14px 16px; font-weight: bold; font-size: 14px; }
  .inv-total .total-amount { text-align: right; color: #C9A84C; font-size: 18px; }
  .inv-footer { text-align: center; margin-top: 40px; }
  .inv-footer-line { border: none; border-top: 1px solid #C9A84C; margin-bottom: 20px; }
  .inv-footer-date { font-size: 12px; color: #999; }
  .inv-footer-thanks { font-size: 14px; color: #555; font-style: italic; line-height: 1.8; margin-top: 8px; }
  .inv-footer-hotel { font-size: 14px; font-weight: bold; color: #C9A84C; letter-spacing: 6px; margin-top: 16px; }
  @media print { body { padding: 20px; } .no-print { display: none !important; } }
`;

function InvoicePopup({
  item,
  onClose,
}: {
  item: InvoiceItem;
  onClose: () => void;
}) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const invoiceNo = `INV-${item.checkIn.replace(/-/g, '')}-${item.id.slice(0, 4).toUpperCase()}`;

  const handlePrint = () => {
    const el = invoiceRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=800,height=1000');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Invoice - ${item.guestName}</title>
      <style>${INVOICE_CSS}</style>
    </head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl mx-4 w-full max-w-[680px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={invoiceRef} style={{ fontFamily: "Georgia, 'Times New Roman', serif", padding: '48px 40px', maxWidth: 680, margin: '0 auto' }}>
          {/* Title + Hotel name */}
          <div style={{ textAlign: 'center', fontSize: 36, fontWeight: 'bold', letterSpacing: 8, color: '#C9A84C', marginBottom: 4 }}>
            INVOICE
          </div>
          <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 'bold', letterSpacing: 3, marginBottom: 20 }}>
            ILLOWA HOTEL
          </div>

          {/* Hotel info — left aligned */}
          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.9, marginTop: 8 }}>
            <div>상호명 : 일로와(illOwa) &nbsp;|&nbsp; 대표자 : 전대홍</div>
            <div>사업자등록번호 : 123-36-55369</div>
            <div>주소 : 경기도 안양시 만안구 안양로268번길 41 (안양동 622-19)</div>
            <div>전화 : 0503-5051-6355 &nbsp;|&nbsp; 이메일 : chon9129@naver.com</div>
          </div>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid #C9A84C', margin: '16px 0' }} />

          {/* Invoice number */}
          <div style={{ textAlign: 'right', fontSize: 11, color: '#999', marginTop: 20 }}>
            No. {invoiceNo}
          </div>

          {/* Guest name */}
          <div style={{ fontSize: 11, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: 3, marginTop: 12 }}>
            Guest Name
          </div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#222', marginTop: 4, paddingBottom: 6, borderBottom: '2px solid #C9A84C', display: 'inline-block' }}>
            {item.guestName}
          </div>
          <div style={{ fontSize: 11, color: '#999', margin: 0, padding: 0, textAlign: 'right', lineHeight: 1 }}>
            (VAT 포함, 단위: 원)
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
            <thead>
              <tr>
                <th style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, padding: '10px 16px', textAlign: 'left' }}>Date</th>
                <th style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, padding: '10px 16px', textAlign: 'center' }}>Room No</th>
                <th style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, padding: '10px 16px', textAlign: 'right' }}>Room Rate</th>
                <th style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, padding: '10px 16px', textAlign: 'center' }}>Count</th>
                <th style={{ background: '#1a1a1a', color: '#fff', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, padding: '10px 16px', textAlign: 'right' }}>Account</th>
              </tr>
            </thead>
            <tbody>
              {item.dailyRates.map((dr, i) => (
                <tr key={dr.date} style={{ background: i % 2 === 1 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #eee' }}>
                    {dr.date.slice(5).replace('-', '/')}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                    {i === 0 ? item.roomNumber : ''}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    {fmt(dr.amount)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #eee', textAlign: 'center' }}>
                    1
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, borderBottom: '1px solid #eee', textAlign: 'right' }}>
                    {fmt(dr.amount)}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ background: '#f8f4ec', borderTop: '2px solid #333' }}>
                <td style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: 14 }} colSpan={4}>
                  Total
                </td>
                <td style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: 18, textAlign: 'right', color: '#C9A84C' }}>
                  {fmt(item.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <hr style={{ border: 'none', borderTop: '1px solid #C9A84C', marginBottom: 20 }} />
            <div style={{ fontSize: 12, color: '#999' }}>
              {item.checkOut.replace(/-/g, '.')}
            </div>
            <div style={{ fontSize: 14, color: '#555', fontStyle: 'italic', lineHeight: 1.8, marginTop: 8 }}>
              Thank you very much<br />for staying at our hotel
            </div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#C9A84C', letterSpacing: 6, marginTop: 16 }}>
              ILLOWA HOTEL
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-8 pb-6 justify-center">
          <button
            onClick={handlePrint}
            className="px-6 py-2.5 bg-[#C9A84C] text-white font-bold rounded-lg text-sm hover:bg-[#E8C96A]"
          >
            인쇄 / PDF 저장
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-lg text-sm hover:bg-gray-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
