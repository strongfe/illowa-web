import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/stats?date=2024-01-01
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [summary, roomStats, channelRevenue, roomStatus] = await Promise.all([
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
    roomStatus: roomStatus.data || [],
  });
}
