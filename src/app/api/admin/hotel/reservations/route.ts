import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/reservations
// 미래 날짜(sale_date > today) + 예약금/완불 건 조회
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .in('payment_timing', ['예약금', '완불'])
    .gte('sale_date', todayStr)
    .neq('status', 'cancelled')
    .order('sale_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
