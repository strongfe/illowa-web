'use client';

// ═══════════════════════════════════════════════════════════════
// 온라인 결제 결과 화면
// • complete: 토스 successUrl. 쿼리(paymentKey, orderId, amount)로 서버에 승인을 요청한다.
// • fail:     토스 failUrl. 잡아 둔 객실을 풀고 사유를 보여 준다.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { won } from '@/lib/reserveCore';

type Done = { code: string; amount: number; usage: string; paymentMethod: string | null };

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-200 font-sans">
      <div className="mx-auto min-h-screen max-w-[480px] bg-[#fff] text-neutral-900">
        <header className="flex h-[52px] items-center gap-2 bg-[#111] px-2 text-white">
          <Link href="/" aria-label="홈으로" className="p-2"><ArrowLeft size={22} /></Link>
          <h1 className="text-[16px] font-semibold">{title}</h1>
          <span className="ml-auto pr-3 text-[11px] tracking-[3px] text-[#C9A84C]">ILLOWA</span>
        </header>
        {children}
      </div>
    </div>
  );
}

const HOTEL_TEL = '031-464-9661';

export function PaymentComplete() {
  const params = useSearchParams();
  const [state, setState] = useState<{ done?: Done; error?: string }>({});
  const sent = useRef(false); // 개발 모드에서 effect 가 두 번 돌아도 승인은 한 번만

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const body = {
      paymentKey: params.get('paymentKey'),
      orderId: params.get('orderId'),
      amount: Number(params.get('amount')),
    };
    fetch('/api/reserve/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const j = await res.json();
        setState(res.ok ? { done: j } : { error: j.error ?? '결제 확인에 실패했습니다' });
      })
      .catch(() => setState({ error: `네트워크 오류가 발생했습니다. 호텔(${HOTEL_TEL})로 연락 주세요` }));
  }, [params]);

  if (!state.done && !state.error) {
    return (
      <Frame title="결제 확인 중">
        <p className="px-5 py-20 text-center text-neutral-600">결제를 확인하고 있습니다. 창을 닫지 말아 주세요…</p>
      </Frame>
    );
  }

  if (state.error) {
    return (
      <Frame title="결제 실패">
        <div className="px-5 py-10 text-center">
          <XCircle size={56} className="mx-auto text-red-500" />
          <h2 className="mt-4 text-[20px] font-bold">예약이 완료되지 않았습니다</h2>
          <p className="mt-2 text-[14px] leading-6 text-neutral-600">{state.error}</p>
        </div>
        <div className="space-y-2 p-4">
          <Link href="/reserve" className="block w-full rounded-lg bg-[#111] py-3.5 text-center text-[15px] font-semibold text-white">
            다시 예약하기
          </Link>
          <a href={`tel:${HOTEL_TEL}`} className="block w-full rounded-lg border border-neutral-300 py-3.5 text-center text-[15px]">
            호텔에 전화하기
          </a>
        </div>
      </Frame>
    );
  }

  const d = state.done!;
  return (
    <Frame title="예약 확정">
      <div className="px-5 py-10 text-center">
        <CheckCircle2 size={56} className="mx-auto text-[#C9A84C]" />
        <h2 className="mt-4 text-[20px] font-bold">결제가 완료되어 예약이 확정되었습니다</h2>
        <p className="mt-2 text-[14px] text-neutral-600">확정 문자를 보내드렸습니다.</p>
      </div>
      <section className="mx-4 rounded-xl border border-neutral-200 p-4 text-[14px]">
        <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-3">
          <span className="text-neutral-500">예약번호</span>
          <span className="font-mono text-[15px] font-bold">{d.code}</span>
        </div>
        <p>{d.usage}</p>
        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-neutral-500">결제 금액{d.paymentMethod ? ` (${d.paymentMethod})` : ''}</span>
          <span className="text-[18px] font-bold">{won(d.amount)}</span>
        </div>
      </section>
      <p className="mx-4 mt-4 rounded-lg bg-neutral-100 p-3 text-[13px] text-neutral-600">
        취소는 호텔({HOTEL_TEL})로 전화 주세요. 취소·환불 규정에 따라 처리해 드립니다.
      </p>
      <div className="p-4">
        <Link href="/" className="block w-full rounded-lg bg-[#111] py-3.5 text-center text-[15px] font-semibold text-white">
          홈으로
        </Link>
      </div>
    </Frame>
  );
}

export function PaymentFail() {
  const params = useSearchParams();
  const code = params.get('code');
  const message = params.get('message');
  const orderId = params.get('orderId');

  useEffect(() => {
    if (!orderId) return;
    void fetch('/api/reserve/abandon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });
  }, [orderId]);

  const canceledByUser = code === 'PAY_PROCESS_CANCELED';
  return (
    <Frame title={canceledByUser ? '결제 취소' : '결제 실패'}>
      <div className="px-5 py-10 text-center">
        <XCircle size={56} className="mx-auto text-neutral-400" />
        <h2 className="mt-4 text-[20px] font-bold">{canceledByUser ? '결제를 취소하셨습니다' : '결제에 실패했습니다'}</h2>
        {!canceledByUser && message && <p className="mt-2 text-[14px] text-neutral-600">{message}</p>}
        <p className="mt-2 text-[13px] text-neutral-500">결제되지 않았으며, 예약은 접수되지 않았습니다.</p>
      </div>
      <div className="space-y-2 p-4">
        <Link href="/reserve" className="block w-full rounded-lg bg-[#111] py-3.5 text-center text-[15px] font-semibold text-white">
          다시 예약하기
        </Link>
        <a href={`tel:${HOTEL_TEL}`} className="block w-full rounded-lg border border-neutral-300 py-3.5 text-center text-[15px]">
          호텔에 전화하기
        </a>
      </div>
    </Frame>
  );
}
