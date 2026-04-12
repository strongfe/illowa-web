import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return digits;
}

// 고객 처리: 전화번호가 있으면 기존 고객 업데이트 또는 신규 생성
async function processCustomer(
  phone: string | undefined,
  name: string,
  email: string | undefined,
  marketingConsent: boolean,
  amount: number,
  roomType: string,
  saleDate: string,
): Promise<string | null> {
  if (!phone) return null;

  const formatted = formatPhone(phone);
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;

  // 기존 고객 검색
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .or(`phone.eq.${digits},phone.eq.${formatted}`)
    .limit(1)
    .single();

  if (existing) {
    // 재방문 고객 업데이트
    const updates: Record<string, unknown> = {
      visit_count: (existing.visit_count || 0) + 1,
      total_spent: (existing.total_spent || 0) + amount,
      last_visit_date: saleDate,
      updated_at: new Date().toISOString(),
    };
    // 이름이 비어있거나 마스킹된 이름이면 업데이트
    if (name && (!existing.name || existing.name.includes('*'))) {
      updates.name = name;
    }
    // 이메일이 비어있었으면 업데이트
    if (email && !existing.email) {
      updates.email = email;
    }
    // 마케팅 동의가 새로 true로 바뀌면 업데이트
    if (marketingConsent && !existing.marketing_consent) {
      updates.marketing_consent = true;
    }
    // 선호 객실타입 업데이트 (가장 최근 이용 타입)
    updates.preferred_room_type = roomType;

    await supabase.from('customers').update(updates).eq('id', existing.id);
    return existing.id;
  } else {
    // 신규 고객 생성
    const { data: newCustomer } = await supabase
      .from('customers')
      .insert({
        name: name || '',
        phone: formatted,
        email: email || null,
        visit_count: 1,
        total_spent: amount,
        preferred_room_type: roomType,
        last_visit_date: saleDate,
        marketing_consent: marketingConsent,
      })
      .select('id')
      .single();

    return newCustomer?.id || null;
  }
}

// GET /api/admin/hotel/sales?date=2024-01-01
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .eq('sale_date', date)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/hotel/sales
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const { phone, email, marketing_consent, ...saleFields } = await req.json();

  // 고객 처리
  const customerId = await processCustomer(
    phone,
    saleFields.guest_name || '',
    email,
    marketing_consent || false,
    saleFields.amount || 0,
    saleFields.room_type || '',
    saleFields.sale_date || new Date().toISOString().split('T')[0],
  );

  const insertData = { ...saleFields, customer_id: customerId };

  const { data, error } = await supabase
    .from('sales')
    .insert(insertData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PUT /api/admin/hotel/sales (update by id)
export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const { id, phone, email, marketing_consent, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // PUT에서도 고객정보가 전달되면 처리
  if (phone) {
    const customerId = await processCustomer(
      phone,
      updates.guest_name || '',
      email,
      marketing_consent || false,
      updates.amount || 0,
      updates.room_type || '',
      updates.sale_date || new Date().toISOString().split('T')[0],
    );
    if (customerId) {
      updates.customer_id = customerId;
    }
  }

  const { data, error } = await supabase
    .from('sales')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/hotel/sales?id=xxx
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Safety: reject deletion of booking-linked or reservation-deposit rows
  const { data: row } = await supabase
    .from('sales')
    .select('booking_id, payment_timing')
    .eq('id', id)
    .single();

  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (row.booking_id) {
    return NextResponse.json(
      { error: '연박 행은 연박현황에서 관리하세요' },
      { status: 403 },
    );
  }
  if (row.payment_timing && row.payment_timing !== '현장') {
    return NextResponse.json(
      { error: '예약금 행은 예약현황에서 관리하세요' },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
