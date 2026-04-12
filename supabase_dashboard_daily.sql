-- ============================================================
-- 대시보드 일일 데이터 (dashboard_daily)
-- 전일시재, 현금지출, 비고 등 수동 입력 필드.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_daily (
  date DATE PRIMARY KEY,
  prev_cash INTEGER DEFAULT 200000,
  cash_out INTEGER DEFAULT 0,
  cash_out_memo TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dashboard_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON dashboard_daily
  FOR ALL USING (auth.role() = 'authenticated');

CREATE TRIGGER dashboard_daily_updated_at
  BEFORE UPDATE ON dashboard_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 실행 후 확인:
-- SELECT COUNT(*) FROM dashboard_daily;
-- 결과: 0 (빈 테이블)
-- ============================================================
