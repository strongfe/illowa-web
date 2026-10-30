import postgres from 'postgres';

// 예약 전용 DB (Railway Postgres). DATE·TIMESTAMPTZ 컬럼은 문자열 그대로 받는다.
const globalForDb = globalThis as unknown as { reserveSql?: postgres.Sql };

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 이 설정되지 않았습니다');
  globalForDb.reserveSql ??= postgres(url, {
    max: 5,
    idle_timeout: 30,
    types: {
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      timestamptz: { to: 1184, from: [1184], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
  return globalForDb.reserveSql;
}
