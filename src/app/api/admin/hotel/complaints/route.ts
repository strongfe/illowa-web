import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// GET /api/admin/hotel/complaints
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const params = req.nextUrl.searchParams;
  const status = params.get('status');
  const room = params.get('room');
  const dateFrom = params.get('date_from');
  const dateTo = params.get('date_to');

  let query = supabase
    .from('complaints')
    .select('*')
    .order('complaint_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (room) query = query.eq('room_number', room);
  if (dateFrom) query = query.gte('complaint_date', dateFrom);
  if (dateTo) query = query.lte('complaint_date', dateTo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/admin/hotel/complaints
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      complaint_date: body.complaint_date || new Date().toISOString().split('T')[0],
      room_number: body.room_number || null,
      room_type: body.room_type || null,
      guest_name: body.guest_name || null,
      customer_id: body.customer_id || null,
      sale_id: body.sale_id || null,
      channel: body.channel || null,
      category: body.category || null,
      description: body.description || '',
      priority: body.priority || '보통',
      assigned_to: body.assigned_to || '',
      status: 'open',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/admin/hotel/complaints
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (updates.status === 'resolved' || updates.status === 'closed') {
    updates.resolved_at = new Date().toISOString();
  }
  if (updates.status === 'closed') {
    updates.closed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('complaints')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/hotel/complaints?id=xxx
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('complaints').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
