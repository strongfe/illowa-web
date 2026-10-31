// 홈페이지 직접 예약의 취소·환불 규정 — 야놀자 규정과 같게 운영 (2026-10 기준)
// 환불정책 페이지(/[locale]/refund)와 예약 화면이 이 한 곳을 함께 쓴다.

export const REFUND_POLICY = {
  ko: [
    '입실 1일 전까지 취소 시 전액 환불됩니다 (취소 수수료 없음).',
    '예약 후 60분 이내 취소 시 전액 환불됩니다 (취소 수수료 없음, 입실 시간 전까지).',
    '입실 시간 이후 또는 실제 입실 이후에는 취소·환불할 수 없습니다.',
    '입실 시간이 지난 뒤 예약한 경우 취소할 수 없으나, 예약 후 15분 이내에는 취소할 수 있습니다.',
    '상품이 안내된 내용과 다르거나 약속과 다르게 제공된 경우, 입실 이후라도 취소·환불할 수 있습니다.',
    '무통장 입금은 신청 후 2시간 안에 입금해 주세요. 기한이 지나면 예약이 자동 취소됩니다.',
    '카드·간편결제 환불은 카드사에 따라 3~7일이 걸리며, 무통장 입금 건은 입금하신 계좌로 환불해 드립니다.',
    '취소는 호텔(031-464-9661)로 전화 주세요.',
  ],
  en: [
    'Free cancellation with a full refund up to 1 day before check-in.',
    'Free cancellation with a full refund within 60 minutes of booking (before the check-in time).',
    'Bookings cannot be cancelled or refunded after the check-in time or after you have checked in.',
    'Bookings made after the check-in time cannot be cancelled, except within 15 minutes of booking.',
    'If the room differs from its description or the service is not provided as promised, you may cancel and be refunded even after check-in.',
    'For bank transfers, please pay within 2 hours of booking. Unpaid bookings are cancelled automatically.',
    'Card and easy-pay refunds take 3–7 days depending on the card issuer. Bank transfers are refunded to the paying account.',
    'To cancel, please call the hotel at +82-31-464-9661.',
  ],
} as const;
