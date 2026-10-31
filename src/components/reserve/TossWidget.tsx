'use client';

// ═══════════════════════════════════════════════════════════════
// 토스페이먼츠 결제위젯 (주문서형) — 결제수단 선택 UI + 약관 UI
// https://docs.tosspayments.com/guides/v2/payment-widget/integration
//
// 클라이언트 키(NEXT_PUBLIC_TOSS_CLIENT_KEY)는 공개용 값이다 (test_gck_/live_gck_).
// 결제 요청(requestPayment)은 부모가 예약을 만든 뒤 onReady 로 받은 widgets 로 한다.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { ANONYMOUS, loadTossPayments, type TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk';

export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

export default function TossWidget({
  amount,
  onReady,
}: {
  amount: number;
  onReady: (widgets: TossPaymentsWidgets | null) => void;
}) {
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const [error, setError] = useState('');

  // 처음 한 번: SDK 로드 → 금액 설정 → 결제 UI·약관 UI 렌더
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const toss = await loadTossPayments(TOSS_CLIENT_KEY);
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: 'KRW', value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#toss-payment-method', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#toss-agreement', variantKey: 'AGREEMENT' }),
        ]);
        if (!alive) return;
        widgetsRef.current = widgets;
        onReady(widgets);
      } catch (e) {
        console.error('[TossWidget]', e);
        if (alive) setError('결제창을 불러오지 못했습니다. 새로고침하거나 무통장 입금을 선택해 주세요.');
      }
    })();
    return () => {
      alive = false;
      onReady(null);
    };
    // 금액 변경은 아래 effect 에서 처리한다. SDK 는 한 번만 그린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 날짜·객실이 바뀌어 금액이 달라지면 위젯 금액도 맞춘다
  useEffect(() => {
    void widgetsRef.current?.setAmount({ currency: 'KRW', value: amount });
  }, [amount]);

  return (
    <div className="-mx-2">
      {error && <p className="mx-2 rounded bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div id="toss-payment-method" />
      <div id="toss-agreement" />
    </div>
  );
}
