// ── 객실 ──
export interface Room {
  id: number;
  room_number: string;
  room_type: RoomType;
  floor: number;
  features: string;
  is_active: boolean;
}

export type RoomType = 'T' | 'GS' | 'GD' | 'S' | 'D' | 'P' | 'PT';

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  T: '당특',
  GS: '게이밍스탠다드',
  GD: '게이밍디럭스',
  S: '스탠다드',
  D: '디럭스',
  P: '프리미어',
  PT: '프리미어트윈',
};

export const ROOM_TYPE_CAPACITY: Record<RoomType, number> = {
  T: 1, GS: 8, GD: 5, S: 14, D: 5, P: 5, PT: 5,
};

// ── 판매 ──
export type SaleType = '대실' | '숙박';
export type SaleStatus = 'active' | 'checked_out' | 'cancelled';

export interface Sale {
  id: string;
  sale_date: string;
  sale_type: SaleType;
  channel: string;
  payment_method: string | null;
  guest_name: string;
  room_type: RoomType;
  check_in_time: number | null;
  check_out_time: number | null;
  amount: number;
  selling_price: number;
  room_id: number | null;
  room_number: string | null;
  car_number: string;
  memo: string;
  extra_payment_method: string | null;
  extra_amount: number;
  booking_id: string | null;
  payment_timing: '현장' | '예약금' | '완불';
  prepaid_date: string | null;
  prepaid_amount: number;
  prepaid_method: string | null;
  balance_amount: number;
  balance_method: string | null;
  balance_paid: boolean;
  is_receivable: boolean;
  receivable_amount: number;
  resolved_at: string | null;
  resolved_payment_method: string | null;
  resolved_memo: string | null;
  status: SaleStatus;
  created_at: string;
}

export interface SaleInput {
  sale_date: string;
  sale_type: SaleType;
  channel: string;
  payment_method?: string;
  guest_name?: string;
  room_type: RoomType;
  check_in_time?: number;
  check_out_time?: number;
  amount: number;
  selling_price?: number;
  room_id?: number;
  room_number?: string;
  car_number?: string;
  memo?: string;
  extra_payment_method?: string;
  extra_amount?: number;
  is_receivable?: boolean;
  receivable_amount?: number;
  payment_timing?: '현장' | '예약금' | '완불';
  prepaid_date?: string;
  prepaid_amount?: number;
  prepaid_method?: string;
  balance_amount?: number;
  balance_method?: string;
  balance_paid?: boolean;
  status?: SaleStatus;
}

// ── 미수금 ──
export interface Receivable {
  id: string;
  sale_date: string;
  sale_type: SaleType;
  channel: string;
  guest_name: string;
  room_type: RoomType;
  room_number: string | null;
  amount: number;
  receivable_amount: number;
  resolved_at: string | null;
  resolved_payment_method: string | null;
  resolved_memo: string | null;
  memo: string;
  is_receivable: boolean;
  phone: string | null;
  customer_name: string | null;
  receivable_status: '미수' | '주의' | '장기미수' | '수금완료';
  days_overdue: number;
}

// ── 채널 / 결제수단 ──
export const CHANNELS = ['야놀자', '여기어때', '호텔스토리', '꿀스테이', '워킹', '연장', '예약', '비씨'] as const;
export const OTA_CHANNELS = ['야놀자', '여기어때'] as const;
export const OTHER_CHANNELS = ['워킹', '연장'] as const;

export const PAYMENT_METHODS = [
  '국민', '신한', '비씨', '현대', '삼성', '농협', '하나', '롯데', '현금', '계좌', '호스', '미수',
] as const;

// ── 일일 마감 ──
export interface DailyClosing {
  id: number;
  closing_date: string;
  daesil_count: number;
  sukbak_count: number;
  daesil_revenue: number;
  sukbak_revenue: number;
  revenue_yanolja: number;
  revenue_yeogi: number;
  revenue_hotelstory: number;
  revenue_kkul: number;
  revenue_cash: number;
  revenue_card: number;
  revenue_transfer: number;
  total_revenue: number;
  prev_day_cash: number;
  cash_expense: number;
  cash_balance: number;
  hotelstory_slip: number;
  card_slip: number;
  card_terminal_amounts: Record<string, number> | null;
  actual_cash_count: number;
  actual_transfer_amount: number;
  is_verified: boolean;
  notes: string;
  closed_by: string;
}

// ── 뷰 데이터 ──
export interface DailySummary {
  sale_date: string;
  daesil_count: number;
  sukbak_count: number;
  daesil_revenue: number;
  sukbak_revenue: number;
  total_revenue: number;
  total_count: number;
}

export interface DailyRoomStat {
  sale_date: string;
  room_type: RoomType;
  total_rooms: number;
  reserved: number;
  checked_in: number;
  checked_out: number;
  pending: number;
  vacant: number;
}

export interface ChannelRevenue {
  sale_date: string;
  channel: string;
  sale_count: number;
  daesil_revenue: number;
  sukbak_revenue: number;
  total_revenue: number;
}

export interface RoomSaleInfo {
  sale_id: string;
  sale_type: SaleType;
  guest_name: string | null;
  channel: string | null;
  check_in_time: number | null;
  check_out_time: number | null;
  amount: number | null;
  sale_status: SaleStatus;
}

export interface RoomStatus {
  room_id: number;
  room_number: string;
  room_type: RoomType;
  floor: number;
  features: string;
  // 단일 판매 (하위호환)
  sale_id: string | null;
  sale_type: SaleType | null;
  guest_name: string | null;
  channel: string | null;
  check_in_time: number | null;
  check_out_time: number | null;
  amount: number | null;
  sale_status: SaleStatus | null;
  room_status: 'vacant' | 'daesil' | 'sukbak' | 'both';
  // 복수 판매
  sales: RoomSaleInfo[];
}

// ── 연박 예약 ──
export type SplitMethod = 'equal' | 'by_day' | 'manual';

export interface Booking {
  id: string;
  guest_name: string;
  room_type: RoomType;
  room_id: number | null;
  room_number: string | null;
  channel: string;
  payment_method: string | null;
  check_in_date: string;
  check_out_date: string;
  total_nights: number;
  total_amount: number;
  split_method: SplitMethod;
  customer_id: string | null;
  memo: string;
  status: string;
  created_at: string;
}

export interface BookingInput {
  guest_name: string;
  room_type: RoomType;
  room_id?: number;
  room_number?: string;
  channel: string;
  payment_method?: string;
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  split_method: SplitMethod;
  daily_amounts?: number[];
  memo?: string;
  phone?: string;
  email?: string;
  marketing_consent?: boolean;
}

export interface RoomRate {
  id: number;
  room_type: RoomType;
  day_type: string;
  rate: number;
}

// ── 현금 지출 ──
export interface CashExpense {
  id: number;
  expense_date: string;
  description: string;
  amount: number;
  created_by: string;
}
