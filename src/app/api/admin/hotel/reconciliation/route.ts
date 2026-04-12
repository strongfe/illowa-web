import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/reconciliation?date=YYYY-MM-DD
//
// Returns all reconciliation rows for the given date. If no rows
// exist yet the response is an empty array — the frontend fills
// them lazily when the user first edits a cell.
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const date =
    req.nextUrl.searchParams.get('date') ||
    new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_reconciliation')
    .select('*')
    .eq('recon_date', date)
    .order('channel');

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/admin/hotel/reconciliation
//
// UPSERT a single reconciliation row. If a row for the given
// (recon_date, channel) already exists it is updated; otherwise a
// new row is inserted. This lets the frontend fire a PUT on every
// cell blur without worrying about whether the row was created yet.
//
// Body: {
//   recon_date: string,        // YYYY-MM-DD
//   channel: string,           // e.g. '야놀자', '국민', '현금환불'
//   recon_type: string,        // 'OTA' | '직접' | '카드' | '환불'
//   actual_daesil_count?: number,
//   actual_daesil_amount?: number,
//   actual_sukbak_count?: number,
//   actual_sukbak_amount?: number,
//   memo?: string,
// }
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const { recon_date, channel, recon_type, ...fields } = body;

  if (!recon_date || !channel || !recon_type) {
    return NextResponse.json(
      { error: 'recon_date, channel, recon_type required' },
      { status: 400 },
    );
  }

  // Build the upsert payload. Only include fields that were
  // explicitly provided so partial updates work correctly.
  const row: Record<string, unknown> = {
    recon_date,
    channel,
    recon_type,
    updated_at: new Date().toISOString(),
  };
  if (fields.actual_daesil_count != null)
    row.actual_daesil_count = fields.actual_daesil_count;
  if (fields.actual_daesil_amount != null)
    row.actual_daesil_amount = fields.actual_daesil_amount;
  if (fields.actual_sukbak_count != null)
    row.actual_sukbak_count = fields.actual_sukbak_count;
  if (fields.actual_sukbak_amount != null)
    row.actual_sukbak_amount = fields.actual_sukbak_amount;
  if (fields.memo != null) row.memo = fields.memo;

  const { data, error } = await supabase
    .from('daily_reconciliation')
    .upsert(row, { onConflict: 'recon_date,channel' })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
