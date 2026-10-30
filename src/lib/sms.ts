import crypto from 'node:crypto';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════
// 문자 발송 (솔라피 Solapi)
//
// 필요한 환경변수:
//   SOLAPI_API_KEY, SOLAPI_API_SECRET  솔라피 콘솔에서 발급
//   SOLAPI_SENDER                      사전 등록한 발신번호 (예: 0314649661)
//   HOTEL_NOTIFY_PHONES                새 예약 알림을 받을 번호, 쉼표로 여러 개
//
// 키가 없으면 실제로 보내지 않고 sms_log 에 "미발송(설정 없음)"으로만 남긴다.
// 문자 실패가 예약 처리를 막으면 안 되므로 이 함수는 예외를 던지지 않는다.
// ═══════════════════════════════════════════════════════════════

const ENDPOINT = 'https://api.solapi.com/messages/v4/send';

function authHeader(key: string, secret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', secret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSms(to: string, text: string, kind: string, reservationId?: number) {
  const key = process.env.SOLAPI_API_KEY;
  const secret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_SENDER;
  const phone = to.replace(/\D/g, '');

  let ok = false;
  let result = '';
  if (!key || !secret || !from) {
    result = '미발송(문자 설정 없음)';
  } else {
    try {
      // type 을 생략하면 길이에 따라 SMS/LMS 가 자동 선택된다.
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: authHeader(key, secret), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { to: phone, from: from.replace(/\D/g, ''), text } }),
      });
      result = (await res.text()).slice(0, 500);
      ok = res.ok;
    } catch (e) {
      result = `오류: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  try {
    await db()`
      INSERT INTO sms_log (kind, to_phone, text, ok, result, reservation_id)
      VALUES (${kind}, ${phone}, ${text}, ${ok}, ${result}, ${reservationId ?? null})
    `;
  } catch (e) {
    console.error('[sms] 기록 실패', e);
  }
  if (!ok) console.warn(`[sms] ${kind} → ${phone}: ${result}`);
  return ok;
}

export const hotelNotifyPhones = () =>
  (process.env.HOTEL_NOTIFY_PHONES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
