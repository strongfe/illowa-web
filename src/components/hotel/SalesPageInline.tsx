'use client';

// ═══════════════════════════════════════════════════════════════
// SalesPageInline — production entry point for the inline-edit UI.
//
// Status (live):
//   ✅ Checkpoint 1: EditableCell 5 types
//   ✅ Checkpoint 2: SalesGridPanel (one panel)
//   ✅ Checkpoint 3a: 6 panels wired up
//   ✅ Checkpoint 4: Save logic (PATCH + POST + dirty tracking +
//                   validation + row flags + checkbox commit)
//   ✅ Checkpoint 5: Modal integration (연박/예약금/CRM via
//                   reused SalesPageLegacy.SaleModal) + mobile
//                   fallback
//   ⏳ Checkpoint 4.5: Range select + copy/paste + undo
//
// Mobile handling
// ───────────────
// 768px 미만 화면에서는 인라인 그리드가 가로 스크롤 지옥이 되기
// 때문에 기존 SalesPageLegacy (모달 방식)로 fallback 합니다.
// 이 fallback 은 NEXT_PUBLIC_USE_INLINE_EDIT 환경변수와 독립적으로
// 작동합니다 — 환경변수가 true 더라도 화면이 좁으면 자동으로
// 모달 UI 가 사용됩니다.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import SalesGridPage from './inline/SalesGridPage';
import SalesPageLegacy from './SalesPageLegacy';

function useIsDesktop(breakpointPx = 768): boolean {
  // SSR-safe: start assuming desktop so the server/first-paint markup
  // matches the most common case. The client adjusts after mount.
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${breakpointPx}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpointPx]);

  return isDesktop;
}

export default function SalesPageInline() {
  const isDesktop = useIsDesktop(768);

  // Mobile → legacy modal UI. Desktop → new inline grid.
  if (!isDesktop) {
    return <SalesPageLegacy />;
  }
  return <SalesGridPage />;
}
