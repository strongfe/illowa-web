import { NextRequest, NextResponse } from 'next/server';
import { abandonCardPayment } from '@/lib/reserveServer';

export const dynamic = 'force-dynamic';

// POST /api/reserve/abandon  { orderId } — 결제 실패·취소 시 잡아 둔 객실을 바로 푼다.
// 결제 전 상태(awaiting_payment)인 건만 바뀌므로 남이 호출해도 확정된 예약에는 영향이 없다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.orderId === 'string' ? body.orderId.slice(0, 64) : '';
  if (orderId) await abandonCardPayment(orderId).catch((e) => console.error('[reserve/abandon]', e));
  return NextResponse.json({ ok: true });
}
