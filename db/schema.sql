-- 홈페이지 직접 예약 전용 DB (Railway Postgres)
-- 배포 때마다 scripts/migrate.mjs 가 실행한다. 몇 번 실행해도 안전해야 한다.

CREATE TABLE IF NOT EXISTS web_reservations (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,                 -- 예약번호 IW261113-1234
  mode          TEXT NOT NULL CHECK (mode IN ('stay', 'daesil')),
  room_key      TEXT NOT NULL,                        -- rooms.json 키 (std, gdlx …)
  room_name     TEXT NOT NULL,
  check_in      DATE NOT NULL,
  check_out     DATE NOT NULL,                        -- 대실은 check_in + 1일
  daesil_time   TEXT,                                 -- 대실 입실 시각 '14:00'
  daesil_hours  INT,
  guest_name    TEXT NOT NULL,
  phone         TEXT NOT NULL,                        -- 숫자만 01012345678
  visit         TEXT NOT NULL CHECK (visit IN ('walk', 'car')),
  car_no        TEXT NOT NULL DEFAULT '',
  request       TEXT NOT NULL DEFAULT '',
  pay_method    TEXT NOT NULL CHECK (pay_method IN ('onsite', 'transfer')),
  amount        INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),
  admin_memo    TEXT NOT NULL DEFAULT '',
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_reservations_check_in_idx ON web_reservations (check_in);
CREATE INDEX IF NOT EXISTS web_reservations_status_idx ON web_reservations (status);
CREATE INDEX IF NOT EXISTS web_reservations_phone_idx ON web_reservations (phone);

-- 배정량: 날짜·타입·판매방식별 홈페이지 판매 객실 수.
-- 행이 없으면 reserveConfig.ts 의 기본 배정량을 쓴다. 0 = 그날 마감.
CREATE TABLE IF NOT EXISTS web_allotments (
  stay_date   DATE NOT NULL,
  room_key    TEXT NOT NULL,
  mode        TEXT NOT NULL CHECK (mode IN ('stay', 'daesil')),
  qty         INT NOT NULL CHECK (qty >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (stay_date, room_key, mode)
);

-- 문자 발송 기록 (문제 추적용)
CREATE TABLE IF NOT EXISTS sms_log (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,                          -- request_guest / request_hotel / confirmed / cancelled
  to_phone    TEXT NOT NULL,
  text        TEXT NOT NULL,
  ok          BOOLEAN NOT NULL,
  result      TEXT NOT NULL DEFAULT '',
  reservation_id BIGINT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2026-10-30: 대실 퇴실 시각 (입실 시각 + 이용 시간, 퇴실 마감 넘지 않음)
ALTER TABLE web_reservations ADD COLUMN IF NOT EXISTS daesil_end TEXT;
