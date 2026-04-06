import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/closing?date=2024-01-01
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  // 마감 데이터 + 자동 집계 동시 조회
  const [closing, summary, channelRevenue, cashExpenses] = await Promise.all([
    supabase.from('daily_closings').select('*').eq('closing_date', date).single(),
    supabase.from('v_daily_summary').select('*').eq('sale_date', date).single(),
    supabase.from('v_daily_channel_revenue').select('*').eq('sale_date', date),
    supabase.from('cash_expenses').select('*').eq('expense_date', date).order('created_at'),
  ]);

  return NextResponse.json({
    closing: closing.data,
    summary: summary.data || {
      sale_date: date, daesil_count: 0, sukbak_count: 0,
      daesil_revenue: 0, sukbak_revenue: 0, total_revenue: 0, total_count: 0,
    },
    channelRevenue: channelRevenue.data || [],
    cashExpenses: cashExpenses.data || [],
  });
}

// POST /api/admin/hotel/closing - 마감 저장/수정
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { closing_date, ...fields } = body;

  if (!closing_date) {
    return NextResponse.json({ error: 'closing_date required' }, { status: 400 });
  }

  // upsert: 날짜가 같으면 update, 없으면 insert
  const { data, error } = await supabase
    .from('daily_closings')
    .upsert({ closing_date, ...fields }, { onConflict: 'closing_date' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
