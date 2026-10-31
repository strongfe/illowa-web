import { NextRequest, NextResponse } from 'next/server';
import { confirmCardPayment, ReserveError, usageText } from '@/lib/reserveServer';

export const dynamic = 'force-dynamic';

// POST /api/reserve/confirm  { paymentKey, orderId, amount }
// 결제창 인증 성공 후 successUrl 화면에서 호출. 금액은 서버에 저장된 값으로 다시 확인한다.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paymentKey = typeof body.paymentKey === 'string' ? body.paymentKey.slice(0, 200) : '';
  const orderId = typeof body.orderId === 'string' ? body.orderId.slice(0, 64) : '';
  const amount = Number(body.amount);
  if (!paymentKey || !orderId || !Number.isInteger(amount)) {
    return NextResponse.json({ error: '잘못된 결제 정보입니다' }, { status: 400 });
  }

  try {
    const r = await confirmCardPayment(orderId, paymentKey, amount);
    return NextResponse.json({
      ok: true,
      code: r.code,
      amount: r.amount,
      usage: usageText(r),
      paymentMethod: r.payment_method,
    });
  } catch (e) {
    if (e instanceof ReserveError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[reserve/confirm]', e);
    return NextResponse.json({ error: '결제 확인 중 문제가 생겼습니다. 호텔(031-464-9661)로 연락 주세요' }, { status: 500 });
  }
}
