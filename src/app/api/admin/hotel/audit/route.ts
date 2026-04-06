import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/audit?page=1&limit=50&table=sales&action=UPDATE&date=2026-04-06&record_id=uuid
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const page = Number(params.get('page') || 1);
  const limit = Number(params.get('limit') || 50);
  const table = params.get('table');
  const action = params.get('action');
  const date = params.get('date');
  const recordId = params.get('record_id');
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (table) query = query.eq('table_name', table);
  if (action) query = query.eq('action', action);
  if (recordId) query = query.eq('record_id', recordId);
  if (date) {
    query = query.gte('created_at', `${date}T00:00:00`).lt('created_at', `${date}T23:59:59.999`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data || [], total: count || 0, page, limit });
}

// POST /api/admin/hotel/audit - 삭제된 레코드 복원
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { log_id } = await req.json();
  if (!log_id) return NextResponse.json({ error: 'log_id required' }, { status: 400 });

  // 로그 조회
  const { data: log } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('id', log_id)
    .single();

  if (!log || log.action !== 'DELETE' || !log.old_data) {
    return NextResponse.json({ error: 'Only DELETE logs can be restored' }, { status: 400 });
  }

  // 복원: old_data를 해당 테이블에 INSERT
  const restoreData = { ...log.old_data };
  delete restoreData.id; // auto-generated ID 제외 (UUID는 유지)
  if (log.table_name === 'sales') {
    // sales는 UUID이므로 원본 ID 유지
    restoreData.id = log.old_data.id;
  }

  const { error } = await supabase.from(log.table_name).insert(restoreData);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, restored: log.table_name, record_id: log.record_id });
}
