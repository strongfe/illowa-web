// 서버 시작 시 한 번 실행된다 (Next.js instrumentation).
// 무통장 입금 기한이 지난 예약을 5분마다 자동 취소한다.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL) return;
  const { expireUnpaid } = await import('@/lib/reserveServer');
  setInterval(() => {
    expireUnpaid().catch((e) => console.error('[expireUnpaid]', e));
  }, 5 * 60 * 1000);
}
