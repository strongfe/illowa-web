'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DailySummary, DailyRoomStat, ChannelRevenue, RoomType } from '@/types/hotel';
import { ROOM_TYPE_LABELS, ROOM_TYPE_CAPACITY } from '@/types/hotel';

function formatAmount(n: number) {
  return n.toLocaleString('ko-KR');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

interface StatsData {
  summary: DailySummary;
  roomStats: DailyRoomStat[];
  channelRevenue: ChannelRevenue[];
}

export default function DashboardPage() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/hotel/stats?date=${date}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // 30초마다 자동 새로고침
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading && !data) {
    return <div className="text-center py-20 text-gray-500">로딩 중...</div>;
  }

  const s = data?.summary || {
    daesil_count: 0, sukbak_count: 0,
    daesil_revenue: 0, sukbak_revenue: 0,
    total_revenue: 0, total_count: 0,
  };

  // 총 객실수에서 사용중 객실 계산
  const totalRooms = 42;
  const occupiedRooms = (data?.roomStats || []).reduce(
    (sum, rs) => sum + rs.reserved - rs.checked_out, 0
  );
  const vacantRooms = totalRooms - Math.max(0, occupiedRooms);

  // 모든 타입별 데이터 (데이터 없는 타입도 표시)
  const allTypes: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];
  const roomStatsMap = new Map(
    (data?.roomStats || []).map(rs => [rs.room_type, rs])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">대시보드</h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={fetchStats} className="text-sm text-[#C9A84C] hover:text-[#E8C96A]">
            새로고침
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="대실" count={s.daesil_count} amount={s.daesil_revenue} color="blue" />
        <SummaryCard label="숙박" count={s.sukbak_count} amount={s.sukbak_revenue} color="green" />
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-600">총매출</p>
          <p className="text-2xl font-bold text-[#C9A84C] mt-1">{formatAmount(s.total_revenue)}원</p>
          <p className="text-xs text-gray-500 mt-1">{s.total_count}건</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-600">공실</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{vacantRooms}실</p>
          <p className="text-xs text-gray-500 mt-1">/ {totalRooms}실</p>
        </div>
      </div>

      {/* 객실타입별 현황 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-gray-200">객실타입별 현황</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">타입</th>
                <th className="px-4 py-3 text-center text-gray-600">총실</th>
                <th className="px-4 py-3 text-center text-gray-600">예약</th>
                <th className="px-4 py-3 text-center text-gray-600">입실</th>
                <th className="px-4 py-3 text-center text-gray-600">퇴실</th>
                <th className="px-4 py-3 text-center text-gray-600">공실</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allTypes.map(rt => {
                const stat = roomStatsMap.get(rt);
                const capacity = ROOM_TYPE_CAPACITY[rt];
                return (
                  <tr key={rt} className="hover:bg-gray-100">
                    <td className="px-4 py-3 font-medium">{rt} <span className="text-gray-500">({ROOM_TYPE_LABELS[rt]})</span></td>
                    <td className="px-4 py-3 text-center">{capacity}</td>
                    <td className="px-4 py-3 text-center text-blue-400">{stat?.reserved || 0}</td>
                    <td className="px-4 py-3 text-center text-green-400">{stat?.checked_in || 0}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{stat?.checked_out || 0}</td>
                    <td className="px-4 py-3 text-center font-bold">{stat ? stat.vacant : capacity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 채널별 매출 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <h2 className="px-5 py-4 font-bold border-b border-gray-200">채널별 매출</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">채널</th>
                <th className="px-4 py-3 text-center text-gray-600">건수</th>
                <th className="px-4 py-3 text-right text-gray-600">대실</th>
                <th className="px-4 py-3 text-right text-gray-600">숙박</th>
                <th className="px-4 py-3 text-right text-gray-600">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data?.channelRevenue || []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">데이터 없음</td></tr>
              )}
              {(data?.channelRevenue || [])
                .sort((a, b) => b.total_revenue - a.total_revenue)
                .map(cr => (
                  <tr key={cr.channel} className="hover:bg-gray-100">
                    <td className="px-4 py-3 font-medium">{cr.channel}</td>
                    <td className="px-4 py-3 text-center">{cr.sale_count}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{formatAmount(cr.daesil_revenue)}</td>
                    <td className="px-4 py-3 text-right text-green-400">{formatAmount(cr.sukbak_revenue)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#C9A84C]">{formatAmount(cr.total_revenue)}</td>
                  </tr>
                ))}
              {(data?.channelRevenue || []).length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-3">합계</td>
                  <td className="px-4 py-3 text-center">
                    {(data?.channelRevenue || []).reduce((sum, cr) => sum + cr.sale_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400">
                    {formatAmount((data?.channelRevenue || []).reduce((sum, cr) => sum + cr.daesil_revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400">
                    {formatAmount((data?.channelRevenue || []).reduce((sum, cr) => sum + cr.sukbak_revenue, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-[#C9A84C]">
                    {formatAmount(s.total_revenue)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, count, amount, color }: {
  label: string; count: number; amount: number; color: 'blue' | 'green';
}) {
  const colorClass = color === 'blue' ? 'text-blue-400' : 'text-green-400';
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{formatAmount(amount)}원</p>
      <p className="text-xs text-gray-500 mt-1">{count}건</p>
    </div>
  );
}
