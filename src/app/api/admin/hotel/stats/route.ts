import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

interface RawRoomStatus {
  room_id: number;
  room_number: string;
  room_type: string;
  floor: number;
  features: string;
  sale_id: string | null;
  sale_type: string | null;
  guest_name: string | null;
  channel: string | null;
  check_in_time: number | null;
  check_out_time: number | null;
  amount: number | null;
  sale_status: string | null;
  room_status: string;
}

// 동일 호실에 복수 판매가 있을 때 병합 처리
function mergeRoomStatus(rawRows: RawRoomStatus[]) {
  const roomMap = new Map<number, {
    room_id: number; room_number: string; room_type: string;
    floor: number; features: string;
    sales: Array<{
      sale_id: string; sale_type: string; guest_name: string | null;
      channel: string | null; check_in_time: number | null;
      check_out_time: number | null; amount: number | null;
      sale_status: string;
    }>;
  }>();

  for (const row of rawRows) {
    if (!roomMap.has(row.room_id)) {
      roomMap.set(row.room_id, {
        room_id: row.room_id, room_number: row.room_number,
        room_type: row.room_type, floor: row.floor, features: row.features,
        sales: [],
      });
    }
    if (row.sale_id && row.sale_status === 'active') {
      roomMap.get(row.room_id)!.sales.push({
        sale_id: row.sale_id, sale_type: row.sale_type!,
        guest_name: row.guest_name, channel: row.channel,
        check_in_time: row.check_in_time, check_out_time: row.check_out_time,
        amount: row.amount, sale_status: row.sale_status,
      });
    }
  }

  return Array.from(roomMap.values()).map(room => {
    const { sales } = room;
    const hasDaesil = sales.some(s => s.sale_type === '대실');
    const hasSukbak = sales.some(s => s.sale_type === '숙박');

    // 우선 표시할 판매 결정: 숙박 > 대실, 또는 둘 다 active이면 'both'
    let primary = sales[0] || null;
    let roomStatus: string = 'vacant';

    if (hasDaesil && hasSukbak) {
      roomStatus = 'both';
      // 숙박을 primary로
      primary = sales.find(s => s.sale_type === '숙박') || sales[0];
    } else if (hasSukbak) {
      roomStatus = 'sukbak';
      primary = sales.find(s => s.sale_type === '숙박')!;
    } else if (hasDaesil) {
      roomStatus = 'daesil';
      primary = sales.find(s => s.sale_type === '대실')!;
    }

    return {
      room_id: room.room_id,
      room_number: room.room_number,
      room_type: room.room_type,
      floor: room.floor,
      features: room.features,
      sale_id: primary?.sale_id || null,
      sale_type: primary?.sale_type || null,
      guest_name: primary?.guest_name || null,
      channel: primary?.channel || null,
      check_in_time: primary?.check_in_time || null,
      check_out_time: primary?.check_out_time || null,
      amount: primary?.amount || null,
      sale_status: primary?.sale_status || null,
      room_status: roomStatus,
      sales: sales,
    };
  }).sort((a, b) => b.floor - a.floor || a.room_number.localeCompare(b.room_number));
}

// GET /api/admin/hotel/stats?date=2024-01-01
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [summary, roomStats, channelRevenue, roomStatusRaw] = await Promise.all([
    supabase.from('v_daily_summary').select('*').eq('sale_date', date).single(),
    supabase.from('v_daily_room_stats').select('*').eq('sale_date', date),
    supabase.from('v_daily_channel_revenue').select('*').eq('sale_date', date),
    supabase.from('v_room_status').select('*'),
  ]);

  return NextResponse.json({
    summary: summary.data || {
      sale_date: date, daesil_count: 0, sukbak_count: 0,
      daesil_revenue: 0, sukbak_revenue: 0, total_revenue: 0, total_count: 0,
    },
    roomStats: roomStats.data || [],
    channelRevenue: channelRevenue.data || [],
    roomStatus: mergeRoomStatus((roomStatusRaw.data || []) as RawRoomStatus[]),
  });
}
