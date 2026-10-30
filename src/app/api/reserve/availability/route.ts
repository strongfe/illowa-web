import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/reserveServer';
import { addDays, todayKST, validateDates, type Mode } from '@/lib/reserveCore';

export const dynamic = 'force-dynamic';

// GET /api/reserve/availability?mode=stay&checkIn=2026-11-13&checkOut=2026-11-15
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const mode: Mode = p.get('mode') === 'daesil' ? 'daesil' : 'stay';
  const checkIn = p.get('checkIn') ?? '';
  const checkOut = mode === 'daesil' ? addDays(checkIn || todayKST(), 1) : p.get('checkOut') ?? '';

  const err = validateDates(mode, checkIn, checkOut, todayKST());
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  try {
    return NextResponse.json({ today: todayKST(), rooms: await getAvailability(mode, checkIn, checkOut) });
  } catch (e) {
    console.error('[reserve/availability]', e);
    return NextResponse.json({ error: '객실 정보를 불러오지 못했습니다' }, { status: 500 });
  }
}
