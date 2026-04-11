'use client';

// ═══════════════════════════════════════════════════════════════
// SalesPageInline — production entry point for the inline-edit UI.
//
// Status (live):
//   ✅ Checkpoint 1: EditableCell 5 types
//   ✅ Checkpoint 2: SalesGridPanel (one panel)
//   ✅ Checkpoint 3a: 6 panels wired up (this file)
//   ⏳ Checkpoint 4: Save logic (PATCH + dirty tracking)
//   ⏳ Checkpoint 4.5: Range select + copy/paste + undo
//   ⏳ Checkpoint 5: Modal integration (Ctrl+click, multi-night, mobile)
//
// Mobile handling
// ───────────────
// 768px 미만 화면에서는 인라인 그리드가 가로 스크롤 지옥이 되기
// 때문에 기존 SalesPageLegacy (모달 방식)로 fallback 합니다.
// CP5에서 본격적인 모바일 UX를 정의하기 전까지의 임시 대응입니다.
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
