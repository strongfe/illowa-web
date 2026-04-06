'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RoomStatus, RoomType, Booking } from '@/types/hotel';
import { ROOM_TYPE_LABELS } from '@/types/hotel';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  vacant: { bg: 'bg-[#2a2a2a]', text: 'text-gray-400', label: '공실' },
  daesil: { bg: 'bg-blue-900/50', text: 'text-blue-300', label: '대실' },
  sukbak: { bg: 'bg-green-900/50', text: 'text-green-300', label: '숙박' },
  both: { bg: 'bg-purple-900/50', text: 'text-purple-300', label: '대실+숙박' },
};

const TYPE_COLORS: Record<RoomType, string> = {
  T: 'border-yellow-500',
  GS: 'border-purple-500',
  GD: 'border-pink-500',
  S: 'border-sky-500',
  D: 'border-teal-500',
  P: 'border-orange-500',
  PT: 'border-red-500',
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomStatus[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todayReservations, setTodayReservations] = useState<Array<{ id: string; guest_name: string; room_type: string; room_number: string | null; channel: string; payment_timing: string; amount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<RoomStatus | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchRooms = useCallback(async () => {
    const [statsRes, bookingsRes, resvRes] = await Promise.all([
      fetch('/api/admin/hotel/stats?date=' + todayStr),
      fetch('/api/admin/hotel/bookings?date=' + todayStr + '&active=true'),
      fetch('/api/admin/hotel/reservations'),
    ]);
    if (statsRes.ok) {
      const data = await statsRes.json();
      setRooms(data.roomStatus || []);
    }
    if (bookingsRes.ok) {
      setBookings(await bookingsRes.json());
    }
    if (resvRes.ok) {
      const allResv = await resvRes.json();
      setTodayReservations(allResv.filter((r: { sale_date: string }) => r.sale_date === todayStr));
    }
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // 30초마다 자동 새로고침
  useEffect(() => {
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }

  // 층별 그룹핑 (9층 → 2층)
  const floors = [9, 8, 7, 6, 5, 3, 2];
  const roomsByFloor = new Map<number, RoomStatus[]>();
  rooms.forEach(r => {
    const list = roomsByFloor.get(r.floor) || [];
    list.push(r);
    roomsByFloor.set(r.floor, list);
  });

  const totalVacant = rooms.filter(r => r.room_status === 'vacant').length;
  const totalDaesil = rooms.filter(r => r.room_status === 'daesil').length;
  const totalSukbak = rooms.filter(r => r.room_status === 'sukbak').length;

  const handleCheckout = async (saleId: string) => {
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: saleId, status: 'checked_out' }),
    });
    setSelectedRoom(null);
    fetchRooms();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">객실 현황</h1>
        <button onClick={fetchRooms} className="text-sm text-[#C9A84C] hover:text-[#E8C96A]">새로고침</button>
      </div>

      {/* 요약 */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-400">공실 <span className="text-white font-bold">{totalVacant}</span></span>
        <span className="text-blue-400">대실 <span className="font-bold">{totalDaesil}</span></span>
        <span className="text-green-400">숙박 <span className="font-bold">{totalSukbak}</span></span>
        {todayReservations.length > 0 && (
          <span className="text-yellow-400">예약도착 <span className="font-bold">{todayReservations.length}</span></span>
        )}
      </div>

      {/* 오늘 도착 예약 알림 */}
      {todayReservations.filter(r => !r.room_number).length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-4 py-3 text-sm">
          <span className="text-yellow-400 font-bold">미배정 예약 {todayReservations.filter(r => !r.room_number).length}건</span>
          <span className="text-yellow-400/70 ml-2">
            {todayReservations.filter(r => !r.room_number).map(r => `${r.guest_name}(${r.room_type})`).join(', ')}
          </span>
        </div>
      )}

      {/* 타입 범례 */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([type, label]) => (
          <span key={type} className={`flex items-center gap-1`}>
            <span className={`w-3 h-3 rounded border-2 ${TYPE_COLORS[type]}`} />
            {type}({label})
          </span>
        ))}
      </div>

      {/* 층별 객실 */}
      <div className="space-y-4">
        {floors.map(floor => {
          const floorRooms = roomsByFloor.get(floor) || [];
          if (floorRooms.length === 0) return null;
          return (
            <div key={floor} className="bg-[#1a1a1a] rounded-xl border border-[#333] p-4">
              <h3 className="text-sm font-bold text-gray-400 mb-3">{floor}층</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
                {floorRooms
                  .sort((a, b) => a.room_number.localeCompare(b.room_number))
                  .map(room => {
                    const status = STATUS_COLORS[room.room_status] || STATUS_COLORS.vacant;
                    const typeColor = TYPE_COLORS[room.room_type];
                    const salesList = room.sales || [];
                    // 연박 정보 찾기
                    const roomBooking = bookings.find(b =>
                      b.room_number === room.room_number && b.status === 'active'
                    );
                    let nightLabel = '';
                    if (roomBooking) {
                      const currentNight = Math.max(1, Math.round(
                        (new Date(todayStr + 'T00:00:00').getTime() - new Date(roomBooking.check_in_date + 'T00:00:00').getTime()) / 86400000
                      ) + 1);
                      nightLabel = `${currentNight}/${roomBooking.total_nights}박`;
                    }
                    return (
                      <button
                        key={room.room_id}
                        onClick={() => setSelectedRoom(room)}
                        className={`${status.bg} border-2 ${typeColor} rounded-lg p-3 text-center transition-transform hover:scale-105 active:scale-95`}
                      >
                        <div className="text-lg font-bold">{room.room_number}</div>
                        <div className="text-xs text-gray-500">{room.room_type}</div>
                        {room.room_status !== 'vacant' && room.room_status !== 'both' && (
                          <>
                            <div className={`text-xs mt-1 ${status.text} font-medium`}>
                              {nightLabel ? `숙박 ${nightLabel}` : status.label}
                            </div>
                            <div className="text-xs text-gray-500 truncate">{room.guest_name || '-'}</div>
                            {roomBooking && (
                              <div className="text-[10px] text-gray-600">~{roomBooking.check_out_date.slice(5)}</div>
                            )}
                          </>
                        )}
                        {room.room_status === 'both' && (
                          <div className="mt-1 space-y-0.5">
                            {salesList.map(s => (
                              <div key={s.sale_id} className={`text-[10px] truncate ${s.sale_type === '대실' ? 'text-blue-400' : 'text-green-400'}`}>
                                {s.sale_type}: {s.guest_name || '-'}
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 객실 상세 팝업 */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedRoom(null)}>
          <div
            className="bg-[#1a1a1a] rounded-xl border border-[#333] p-6 w-80 max-w-[90vw] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">{selectedRoom.room_number}호</h3>
              <button onClick={() => setSelectedRoom(null)} className="text-gray-500 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="타입" value={`${selectedRoom.room_type} (${ROOM_TYPE_LABELS[selectedRoom.room_type]})`} />
              <Row label="층" value={`${selectedRoom.floor}층`} />
              <Row label="상태" value={(STATUS_COLORS[selectedRoom.room_status] || STATUS_COLORS.vacant).label} />
              {selectedRoom.features && <Row label="특성" value={selectedRoom.features} />}
            </div>
            {/* 판매 목록 (복수 가능) */}
            {(selectedRoom.sales || []).length > 0 ? (
              <div className="space-y-3">
                {(selectedRoom.sales || []).map(s => (
                  <div key={s.sale_id} className="bg-[#222] rounded-lg p-3 space-y-1.5">
                    <div className={`text-xs font-bold ${s.sale_type === '대실' ? 'text-blue-400' : 'text-green-400'}`}>
                      {s.sale_type}
                    </div>
                    <div className="space-y-1 text-sm">
                      <Row label="성명" value={s.guest_name || '-'} />
                      <Row label="채널" value={s.channel || '-'} />
                      <Row label="입실" value={s.check_in_time ? `${s.check_in_time}시` : '-'} />
                      <Row label="퇴실" value={s.check_out_time ? `${s.check_out_time}시` : '-'} />
                      <Row label="금액" value={s.amount ? `${s.amount.toLocaleString()}원` : '-'} />
                    </div>
                    <button
                      onClick={() => handleCheckout(s.sale_id)}
                      className="w-full py-2 rounded-lg text-xs font-bold bg-orange-600 text-white hover:bg-orange-500 transition-colors mt-2"
                    >
                      퇴실 처리
                    </button>
                  </div>
                ))}
              </div>
            ) : selectedRoom.room_status !== 'vacant' && selectedRoom.sale_id && (
              <div className="space-y-2">
                <div className="space-y-1 text-sm">
                  <Row label="유형" value={selectedRoom.sale_type || '-'} />
                  <Row label="성명" value={selectedRoom.guest_name || '-'} />
                  <Row label="채널" value={selectedRoom.channel || '-'} />
                  <Row label="입실" value={selectedRoom.check_in_time ? `${selectedRoom.check_in_time}시` : '-'} />
                  <Row label="퇴실" value={selectedRoom.check_out_time ? `${selectedRoom.check_out_time}시` : '-'} />
                  <Row label="금액" value={selectedRoom.amount ? `${selectedRoom.amount.toLocaleString()}원` : '-'} />
                </div>
                <button
                  onClick={() => handleCheckout(selectedRoom.sale_id!)}
                  className="w-full py-2.5 rounded-lg font-bold bg-orange-600 text-white hover:bg-orange-500 transition-colors"
                >
                  퇴실 처리
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
