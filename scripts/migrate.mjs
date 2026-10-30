// 예약 DB 스키마 적용 (배포 시작 전 실행). DATABASE_URL 이 없으면 건너뛴다.
import fs from 'node:fs';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('[migrate] DATABASE_URL 없음 — 건너뜀');
  process.exit(0);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await sql.unsafe(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('[migrate] 스키마 적용 완료');
} finally {
  await sql.end();
}
