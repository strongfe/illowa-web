import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// PUT /api/admin/hotel/dashboard-daily
//
// UPSERT a dashboard_daily row. Body:
//   { date, prev_cash?, cash_out?, cash_out_memo?, note? }
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const { date, ...fields } = body;
  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    date,
    updated_at: new Date().toISOString(),
  };
  if (fields.prev_cash != null) row.prev_cash = fields.prev_cash;
  if (fields.cash_out != null) row.cash_out = fields.cash_out;
  if (fields.cash_out_memo != null) row.cash_out_memo = fields.cash_out_memo;
  if (fields.note != null) row.note = fields.note;

  const { data, error } = await supabase
    .from('dashboard_daily')
    .upsert(row, { onConflict: 'date' })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
