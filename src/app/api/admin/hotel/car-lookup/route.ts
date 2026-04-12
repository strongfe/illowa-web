import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

/**
 * GET /api/admin/hotel/car-lookup?name=홍길동
 * Returns the most recent car_number for the given guest_name.
 */
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get('name')?.trim();
  if (!name) {
    return NextResponse.json({ car_number: null });
  }

  const { data } = await supabase
    .from('sales')
    .select('car_number')
    .eq('guest_name', name)
    .not('car_number', 'is', null)
    .neq('car_number', '')
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  const carNumber = data?.[0]?.car_number || null;
  return NextResponse.json({ car_number: carNumber });
}
