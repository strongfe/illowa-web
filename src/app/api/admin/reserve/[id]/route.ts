import { NextRequest, NextResponse } from 'next/server';
import { updateReservation, ReserveError } from '@/lib/reserveServer';
import type { ReservationStatus } from '@/lib/reserveCore';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

const STATUSES: ReservationStatus[] = ['pending', 'confirmed', 'cancelled', 'no_show'];

// PATCH /api/admin/reserve/123  { status?: 'confirmed', adminMemo?: '...' }
// 확정·취소로 바뀌면 손님에게 문자가 나간다.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const status = STATUSES.includes(body.status) ? (body.status as ReservationStatus) : undefined;
  const adminMemo = typeof body.adminMemo === 'string' ? body.adminMemo.slice(0, 500) : undefined;

  try {
    return NextResponse.json(await updateReservation(id, { status, adminMemo }));
  } catch (e) {
    if (e instanceof ReserveError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[admin/reserve/:id]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
