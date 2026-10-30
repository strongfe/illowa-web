import { NextRequest, NextResponse } from 'next/server';
import { getAllotments, saveAllotments } from '@/lib/reserveServer';
import { findRoom, isDateKey, todayKST, type Mode } from '@/lib/reserveCore';

export const dynamic = 'force-dynamic';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

// GET /api/admin/reserve/allotment?mode=stay&from=2026-11-01&days=14
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const mode: Mode = p.get('mode') === 'daesil' ? 'daesil' : 'stay';
  const from = isDateKey(p.get('from')) ? p.get('from')! : todayKST();
  const days = Math.min(Math.max(Number(p.get('days')) || 14, 1), 62);
  try {
    return NextResponse.json(await getAllotments(mode, from, days));
  } catch (e) {
    console.error('[admin/reserve/allotment]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/admin/reserve/allotment  { mode, items: [{ date, roomKey, qty }] }
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const mode: Mode = body.mode === 'daesil' ? 'daesil' : 'stay';
  const items = Array.isArray(body.items) ? body.items : [];
  const valid = items.filter(
    (it: { date?: unknown; roomKey?: unknown; qty?: unknown }) =>
      isDateKey(it.date) && typeof it.roomKey === 'string' && findRoom(it.roomKey) &&
      Number.isInteger(it.qty) && (it.qty as number) >= 0 && (it.qty as number) <= 50,
  );
  if (valid.length !== items.length || valid.length > 2000) {
    return NextResponse.json({ error: '잘못된 값이 있습니다' }, { status: 400 });
  }
  try {
    await saveAllotments(mode, valid);
    return NextResponse.json({ ok: true, saved: valid.length });
  } catch (e) {
    console.error('[admin/reserve/allotment PUT]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
