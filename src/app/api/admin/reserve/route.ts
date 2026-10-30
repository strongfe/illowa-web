import { NextRequest, NextResponse } from 'next/server';
import { listReservations } from '@/lib/reserveServer';
import { addDays, isDateKey, todayKST } from '@/lib/reserveCore';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/reserve?from=2026-11-01&to=2026-11-30&status=pending
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const from = isDateKey(p.get('from')) ? p.get('from')! : addDays(todayKST(), -7);
  const to = isDateKey(p.get('to')) ? p.get('to')! : addDays(todayKST(), 60);
  const status = p.get('status');
  const allowed = ['pending', 'confirmed', 'cancelled', 'no_show'];

  try {
    return NextResponse.json(await listReservations(from, to, status && allowed.includes(status) ? status : null));
  } catch (e) {
    console.error('[admin/reserve]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
