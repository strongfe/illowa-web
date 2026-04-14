'use client';

// ═══════════════════════════════════════════════════════════════
// GridDemo — standalone preview for the new inline-edit grid.
// (Phase 1, Checkpoint 2)
//
// Renders one `SalesGridPanel` (variant=etc) populated with the
// "기타·숙박" subset of today's sales. Lets the reviewer eyeball
// keyboard navigation, lazy mount, Esc restore, and scroll tracking
// without affecting the production sales page.
//
// Reachable via /admin/hotel/sales?preview=grid
// (See SalesPageInline for the switch.)
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import SalesGridPanel from './SalesGridPanel';
import type { Sale } from '@/types/hotel';

const OTA_NAMES = new Set(['야놀자', '여기어때']);

function todayStr() {
  const _d = new Date(); return `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
}

export default function GridDemo() {
  const [date, setDate] = useState(todayStr());
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hotel/sales?date=${date}`);
      if (res.ok) {
        const data: Sale[] = await res.json();
        // Inline grid expects chronological (oldest first) so new rows
        // append to the end. API serves DESC for the legacy UI.
        data.sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        );
        setSales(data);
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Filter to "기타·숙박" — anything that is not Yanolja/Yeogi and is sukbak.
  const etcSukbak = sales.filter(
    (s) => !OTA_NAMES.has(s.channel) && s.sale_type === '숙박',
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#C9A84C]">
          판매 입력 — Grid Preview (CP2)
        </h1>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={fetchSales}
            className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-200"
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        <b>Checkpoint 2 preview.</b> 기타·숙박 패널 1개만 인라인 그리드로
        렌더링합니다. 키보드 동작·빈 행 lazy mount·Esc 원본 복구·가로 스크롤
        추적을 확인해 주세요. <i>저장 로직은 아직 없습니다 (CP4 예정).</i>
      </div>

      {loading && <div className="text-sm text-gray-500">로딩 중…</div>}

      <SalesGridPanel
        title="기타"
        saleType="숙박"
        variant="etc"
        sales={etcSukbak}
        saleDate={date}
      />

      <div className="text-xs text-gray-500 space-y-1">
        <p>• 빈 행을 클릭하거나 Tab으로 이동하면 EditableCell이 처음 마운트됩니다.</p>
        <p>• Tab/Shift+Tab: 가로 이동, Enter: 다음 행, ↑↓←→: 자유 이동(편집 모드 아닐 때).</p>
        <p>• 한글 IME 입력 중 Enter는 무시 (조합 종료 후 다시 Enter).</p>
        <p>• Esc: 셀 값을 원본으로 복구.</p>
      </div>
    </div>
  );
}
