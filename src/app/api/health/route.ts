// Railway healthcheck. DB 를 건드리지 않고 프로세스 생존만 확인한다.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
