import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/hotel/receivables?status=open|resolved|all
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status') || 'all';

  let query = supabase.from('v_receivables').select('*');

  if (status === 'open') {
    query = query.is('resolved_at', null);
  } else if (status === 'resolved') {
    query = query.not('resolved_at', 'is', null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/admin/hotel/receivables - 수금 처리
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sale_id, resolved_payment_method, resolved_memo, unresolve } = await req.json();
  if (!sale_id) return NextResponse.json({ error: 'sale_id required' }, { status: 400 });

  const updates = unresolve
    ? { resolved_at: null, resolved_payment_method: null, resolved_memo: '' }
    : {
        resolved_at: new Date().toISOString(),
        resolved_payment_method,
        resolved_memo: resolved_memo || '',
      };

  const { data, error } = await supabase
    .from('sales')
    .update(updates)
    .eq('id', sale_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
