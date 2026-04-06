import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/rooms?type=GS
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roomType = req.nextUrl.searchParams.get('type');

  let query = supabase
    .from('rooms')
    .select('*')
    .eq('is_active', true)
    .order('room_number');

  if (roomType) {
    query = query.eq('room_type', roomType);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
