import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/dashboard-weekly?start=YYYY-MM-DD&end=YYYY-MM-DD
//
// Returns:
//   sales: Sale[] for the date range
//   dailyData: dashboard_daily[] for the date range
//
// The frontend computes all aggregations client-side so this
// endpoint is deliberately thin — it just proxies the two tables.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const start = req.nextUrl.searchParams.get('start');
  const end = req.nextUrl.searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end required' },
      { status: 400 },
    );
  }

  const [salesRes, dailyRes] = await Promise.all([
    supabase
      .from('sales')
      .select('*')
      .gte('sale_date', start)
      .lte('sale_date', end)
      .order('sale_date'),
    supabase
      .from('dashboard_daily')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date'),
  ]);

  if (salesRes.error)
    return NextResponse.json({ error: salesRes.error.message }, { status: 500 });

  return NextResponse.json({
    sales: salesRes.data,
    dailyData: dailyRes.data ?? [],
  });
}
