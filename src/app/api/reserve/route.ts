import { NextRequest, NextResponse } from 'next/server';
import { createReservation, ReserveError } from '@/lib/reserveServer';

export const dynamic = 'force-dynamic';

// 같은 IP 에서 10분에 5건까지 (서버 1대 기준 메모리 카운터)
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

// POST /api/reserve — 홈페이지 예약 신청
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }
  // 사람 눈에 안 보이는 칸이 채워져 있으면 봇으로 보고 조용히 무시
  if (body.website) return NextResponse.json({ ok: true, code: 'IW000000-0000' });

  try {
    const r = await createReservation(body, ip);
    return NextResponse.json({ ok: true, code: r.code, amount: r.amount });
  } catch (e) {
    if (e instanceof ReserveError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[reserve]', e);
    return NextResponse.json({ error: '예약 처리 중 문제가 생겼습니다. 전화로 문의해 주세요' }, { status: 500 });
  }
}
