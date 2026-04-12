-- ============================================================
-- 일일 마감 정산 테이블 (daily_reconciliation)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS daily_reconciliation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recon_date DATE NOT NULL,
  channel TEXT NOT NULL,
  recon_type TEXT NOT NULL CHECK (recon_type IN ('OTA', '직접', '카드', '환불')),
  actual_daesil_count INTEGER DEFAULT 0,
  actual_daesil_amount INTEGER DEFAULT 0,
  actual_sukbak_count INTEGER DEFAULT 0,
  actual_sukbak_amount INTEGER DEFAULT 0,
  memo TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recon_date, channel)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_recon_date ON daily_reconciliation(recon_date);

-- 3. RLS
ALTER TABLE daily_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users full access" ON daily_reconciliation
  FOR ALL USING (auth.role() = 'authenticated');

-- 4. updated_at 자동 갱신
CREATE TRIGGER recon_updated_at
  BEFORE UPDATE ON daily_reconciliation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Realtime (선택)
-- ALTER PUBLICATION supabase_realtime ADD TABLE daily_reconciliation;

-- ============================================================
-- 실행 후 확인:
-- SELECT COUNT(*) FROM daily_reconciliation;
-- 결과: 0 (빈 테이블)
-- ============================================================
