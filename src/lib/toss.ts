// ═══════════════════════════════════════════════════════════════
// 토스페이먼츠 서버 API (결제 승인·취소)
// https://docs.tosspayments.com/guides/v2/payment-widget/integration
//
// • 시크릿 키(TOSS_SECRET_KEY)는 서버에서만 쓴다. 결제위젯 키는 test_gsk_/live_gsk_.
// • 인증: Basic base64("{시크릿 키}:") — 끝의 콜론을 빠뜨리면 안 된다.
// ═══════════════════════════════════════════════════════════════

const API = 'https://api.tosspayments.com/v1/payments';

export const tossEnabled = () => !!process.env.TOSS_SECRET_KEY;

function authHeader() {
  const key = process.env.TOSS_SECRET_KEY;
  if (!key) throw new Error('TOSS_SECRET_KEY 가 설정되지 않았습니다');
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export interface TossResult {
  ok: boolean;
  status: number;
  data: { method?: string; status?: string; code?: string; message?: string; [k: string]: unknown };
}

async function call(path: string, body: unknown, idempotencyKey?: string): Promise<TossResult> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** 결제 승인. amount 는 반드시 서버에 저장된 예약 금액을 넣는다. */
export const confirmPayment = (paymentKey: string, orderId: string, amount: number) =>
  call('/confirm', { paymentKey, orderId, amount });

/** 결제 전액 취소(환불) */
export const cancelPayment = (paymentKey: string, cancelReason: string) =>
  call(`/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason }, `cancel-${paymentKey}`);
