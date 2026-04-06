import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return digits;
}

// 요일 → day_type 매핑 (0=일, 1=월, ..., 6=토)
function getDayType(date: Date): string {
  const day = date.getDay();
  if (day === 5) return '금';
  if (day === 6) return '토';
  if (day === 0) return '일';
  return '평일'; // 월~목
}

// 날짜 범위 생성 (check_in_date ~ check_out_date - 1)
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  while (d < endD) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// 고객 처리
async function processCustomer(
  phone: string | undefined, name: string, email: string | undefined,
  marketingConsent: boolean, amount: number, roomType: string, saleDate: string,
): Promise<string | null> {
  if (!phone) return null;
  const formatted = formatPhone(phone);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;

  const { data: existing } = await supabase
    .from('customers').select('*')
    .or(`phone.eq.${digits},phone.eq.${formatted}`)
    .limit(1).single();

  if (existing) {
    await supabase.from('customers').update({
      visit_count: (existing.visit_count || 0) + 1,
      total_spent: (existing.total_spent || 0) + amount,
      last_visit_date: saleDate,
      preferred_room_type: roomType,
      updated_at: new Date().toISOString(),
      ...(name && (!existing.name || existing.name.includes('*')) ? { name } : {}),
      ...(email && !existing.email ? { email } : {}),
      ...(marketingConsent && !existing.marketing_consent ? { marketing_consent: true } : {}),
    }).eq('id', existing.id);
    return existing.id;
  } else {
    const { data: newC } = await supabase
      .from('customers').insert({
        name: name || '', phone: formatted, email: email || null,
        visit_count: 1, total_spent: amount, preferred_room_type: roomType,
        last_visit_date: saleDate, marketing_consent: marketingConsent,
      }).select('id').single();
    return newC?.id || null;
  }
}

// POST - 연박 예약 생성
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const body = await req.json();
  const {
    guest_name, room_type, room_id, room_number, channel, payment_method,
    check_in_date, check_out_date, total_amount, split_method = 'equal',
    daily_amounts: manualAmounts, memo,
    phone, email, marketing_consent,
  } = body;

  const dates = dateRange(check_in_date, check_out_date);
  const totalNights = dates.length;
  if (totalNights < 2) {
    return NextResponse.json({ error: '연박은 2박 이상이어야 합니다' }, { status: 400 });
  }

  // 고객 처리
  const customerId = await processCustomer(
    phone, guest_name || '', email, marketing_consent || false,
    total_amount, room_type, check_in_date,
  );

  // booking 생성
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings').insert({
      guest_name, room_type, room_id: room_id || null, room_number: room_number || null,
      channel, payment_method: payment_method || null,
      check_in_date, check_out_date, total_nights: totalNights,
      total_amount, split_method, customer_id: customerId,
      memo: memo || '',
    }).select().single();

  if (bookingErr) return NextResponse.json({ error: bookingErr.message }, { status: 500 });

  // 일별 금액 계산
  let dailyAmounts: number[];

  if (split_method === 'manual' && manualAmounts?.length === totalNights) {
    dailyAmounts = manualAmounts;
  } else if (split_method === 'by_day') {
    // room_rates 에서 요일별 단가 조회
    const { data: rates } = await supabase
      .from('room_rates').select('*').eq('room_type', room_type);
    const rateMap = new Map((rates || []).map(r => [r.day_type, r.rate]));

    const rawAmounts = dates.map(d => {
      const dayType = getDayType(new Date(d + 'T00:00:00'));
      return rateMap.get(dayType) || 0;
    });
    const rawTotal = rawAmounts.reduce((s, a) => s + a, 0);

    if (rawTotal === 0) {
      // 요금표 없으면 균등 분배 폴백
      dailyAmounts = equalSplit(total_amount, totalNights);
    } else {
      // 총액에 맞게 비율 보정
      dailyAmounts = rawAmounts.map((a, i) => {
        if (i === totalNights - 1) {
          return total_amount - rawAmounts.slice(0, -1).reduce((s, x, j) => {
            return s + Math.round(total_amount * x / rawTotal);
          }, 0);
        }
        return Math.round(total_amount * a / rawTotal);
      });
    }
  } else {
    // equal
    dailyAmounts = equalSplit(total_amount, totalNights);
  }

  // 일별 sales 생성
  const today = new Date().toISOString().split('T')[0];
  const salesRows = dates.map((date, i) => ({
    sale_date: date,
    sale_type: '숙박' as const,
    channel, payment_method: payment_method || null,
    guest_name, room_type,
    room_id: room_id || null, room_number: room_number || null,
    check_in_time: i === 0 ? 15 : null,
    check_out_time: i === totalNights - 1 ? 13 : null,
    amount: dailyAmounts[i],
    booking_id: booking.id,
    customer_id: customerId,
    memo: memo || '',
    status: date < today ? 'checked_out' : 'active',
  }));

  const { error: salesErr } = await supabase.from('sales').insert(salesRows);
  if (salesErr) return NextResponse.json({ error: salesErr.message }, { status: 500 });

  return NextResponse.json({ booking, nights: totalNights, dailyAmounts });
}

function equalSplit(total: number, nights: number): number[] {
  const base = Math.floor(total / nights);
  const remainder = total - base * nights;
  return Array.from({ length: nights }, (_, i) => base + (i < remainder ? 1 : 0));
}

// GET - 연박 목록
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const date = req.nextUrl.searchParams.get('date');
  const active = req.nextUrl.searchParams.get('active');

  let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });

  if (date) {
    // 해당일에 투숙 중인 연박
    query = query.lte('check_in_date', date).gt('check_out_date', date);
  }
  if (active === 'true') {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE - 연박 취소
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // 연결된 sales 삭제
  await supabase.from('sales').delete().eq('booking_id', id);
  // booking 삭제
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
