import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/customers/search?phone=01012345678
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    return NextResponse.json({ found: false, customer: null });
  }

  // 전화번호 포맷 통일: 하이픈 포함/미포함 모두 검색
  const formatted = phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');

  const { data } = await supabase
    .from('customers')
    .select('*')
    .or(`phone.eq.${phone},phone.eq.${formatted}`)
    .limit(1)
    .single();

  if (data) {
    return NextResponse.json({ found: true, customer: data });
  }
  return NextResponse.json({ found: false, customer: null });
}
