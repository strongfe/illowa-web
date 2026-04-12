'use client';

// ═══════════════════════════════════════════════════════════════
// SalesGridPage — 6-panel inline-edit sales input page (CP3a)
//
// Replaces SalesPageLegacy's modal-based flow with 6 SalesGridPanel
// instances arranged in a 3×2 (desktop) or 2-col (tablet) layout.
//
// Responsibilities:
//  - Fetch sales / rooms / complaints for the selected date
//  - Group sales into 6 (channel × sale_type) buckets
//  - Compute per-type availability + overall summary
//  - Host the 잔여현황 / 사용설명서 popups (copied from Legacy verbatim,
//    just without modal-spawning buttons)
//  - 30s auto-refresh while no dirty cell exists (dirty tracking
//    lands in CP4; for now refresh always runs)
//
// Not responsible for (yet):
//  - Row saving (CP4)
//  - Ctrl+click → edit modal / multi-night / CRM (CP5)
//  - Mobile layout (falls back to Legacy in SalesPageInline)
//  - Range select / copy-paste (CP4.5)
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SalesGridPanel from './SalesGridPanel';
import { VacancyTable, ChannelRevenueTable } from './StatsPanel';
import type { Sale, RoomType, Room } from '@/types/hotel';
import { ROOM_TYPE_CAPACITY } from '@/types/hotel';

const ROOM_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

interface SalesGroups {
  yanolja_daesil: Sale[];
  yanolja_sukbak: Sale[];
  yeogi_daesil: Sale[];
  yeogi_sukbak: Sale[];
  etc_daesil: Sale[];
  etc_sukbak: Sale[];
}

function groupSales(sales: Sale[]): SalesGroups {
  const g: SalesGroups = {
    yanolja_daesil: [], yanolja_sukbak: [],
    yeogi_daesil: [], yeogi_sukbak: [],
    etc_daesil: [], etc_sukbak: [],
  };
  for (const s of sales) {
    if (s.channel === '야놀자') {
      (s.sale_type === '대실' ? g.yanolja_daesil : g.yanolja_sukbak).push(s);
    } else if (s.channel === '여기어때') {
      (s.sale_type === '대실' ? g.yeogi_daesil : g.yeogi_sukbak).push(s);
    } else {
      (s.sale_type === '대실' ? g.etc_daesil : g.etc_sukbak).push(s);
    }
  }
  return g;
}

function sumAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + r.amount + (r.extra_amount || 0), 0);
}

export default function SalesGridPage() {
  const [saleDate, setSaleDate] = useState(todayStr());
  const [sales, setSales] = useState<Sale[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [availPopup, setAvailPopup] = useState(false);
  const [helpPopup, setHelpPopup] = useState(false);

  // Guards against overlapping fetches. Dev Strict Mode double-invokes
  // useEffect, and the 30s interval can fire while a slow request is
  // still in flight. Without this we'd get "dupes" in the network tab
  // and the later one could clobber the earlier results. Kept in a ref
  // (not state) so React does not rerender on in-flight transitions.
  const loadingRef = useRef(false);

  const fetchSales = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/hotel/sales?date=${saleDate}`);
      if (res.ok) {
        const data: Sale[] = await res.json();
        // The REST route returns rows in `created_at DESC` order so the
        // legacy modal UI keeps the most recent entry on top. The inline
        // grid instead expects chronological order (oldest first) so
        // freshly POSTed rows appear at the bottom of the panel, right
        // after the existing rows — matching how staff used Excel.
        //
        // We leave the API untouched to avoid disturbing the legacy UI
        // (still used in production while the inline grid is behind an
        // env flag) and do the flip here.
        data.sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return ta - tb;
        });
        setSales(data);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [saleDate]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // CP5 — Fetch the room master list once. Required by the Legacy
  // SaleModal's room number dropdown. The endpoint is cacheable
  // because room inventory rarely changes during a shift, so a
  // single request per page mount is enough.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/hotel/rooms');
        if (!res.ok) return;
        const data: Room[] = await res.json();
        if (!cancelled) setRooms(data);
      } catch {
        /* ignore — modal will fall back to a plain text input */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CP4.3 — Track which panels currently hold unsaved edits so the
  // beforeunload handler can warn the user before navigation. Each
  // child panel reports its own transitions via onDirtyChange.
  const [dirtyPanels, setDirtyPanels] = useState<Set<string>>(
    () => new Set(),
  );

  // Keep the 30s interval hook stable regardless of dirty state.
  // When any panel has unsaved edits we skip the tick so staff never
  // see their draft wiped out by a background refresh. Even without
  // this, each SalesGridPanel has its own "has user activity" guard,
  // but skipping the fetch outright is cheaper and more explicit.
  const hasDirtyPanels = dirtyPanels.size > 0;
  const hasDirtyPanelsRef = useRef(hasDirtyPanels);
  hasDirtyPanelsRef.current = hasDirtyPanels;
  useEffect(() => {
    const id = setInterval(() => {
      if (hasDirtyPanelsRef.current) return;
      fetchSales();
    }, 30000);
    return () => clearInterval(id);
  }, [fetchSales]);

  const groups = useMemo(() => groupSales(sales), [sales]);

  // CP4.3 — Cross-panel room conflict map.
  //   key   = room_number (e.g. "806")
  //   value = owner sale.id (so panels can skip their own row)
  // Only active reservations count, and only rows whose room_number
  // is set. Rows without a number ("아직 미배정") never block others.
  const occupiedRooms = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sales) {
      if (s.status !== 'active') continue;
      if (!s.room_number) continue;
      m.set(s.room_number, s.id);
    }
    return m;
  }, [sales]);
  const handlePanelDirtyChange = useCallback(
    (panelKey: string, isDirty: boolean) => {
      setDirtyPanels((prev) => {
        const has = prev.has(panelKey);
        if (isDirty && !has) {
          const next = new Set(prev);
          next.add(panelKey);
          return next;
        }
        if (!isDirty && has) {
          const next = new Set(prev);
          next.delete(panelKey);
          return next;
        }
        return prev;
      });
    },
    [],
  );

  // CP4.4 — a panel just persisted a row (PUT / POST / checkout).
  // Splice the server response into `sales` so the page footer
  // (대실/숙박/합계) updates immediately without a full refetch.
  // Preserves chronological order by replacing existing ids in
  // place and appending truly new rows to the end.
  const handleRowSaved = useCallback((saved: Sale) => {
    setSales((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = saved;
        return next;
      }
      // New row — append at the end so ASC order is preserved.
      return [...prev, saved];
    });
  }, []);

  useEffect(() => {
    if (dirtyPanels.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      // Chrome/Edge ignore the custom text and show their own
      // "Leave site?" dialog, but returning a non-empty value is
      // still required to trigger it.
      e.preventDefault();
      e.returnValue = '저장되지 않은 변경사항이 있습니다.';
      return '저장되지 않은 변경사항이 있습니다.';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirtyPanels]);

  // Per-type availability (copied from Legacy so 잔여현황 popup keeps
  // the same numbers)
  const availability = useMemo(
    () =>
      ROOM_TYPES.map((rt) => {
        const total = ROOM_TYPE_CAPACITY[rt];
        const typeSales = sales.filter((s) => s.room_type === rt);
        const daesilActive = typeSales.filter(
          (s) => s.sale_type === '대실' && s.status === 'active',
        ).length;
        const earlySukbak = typeSales.filter(
          (s) =>
            s.sale_type === '숙박' &&
            s.status === 'active' &&
            s.check_in_time != null &&
            s.check_in_time < 16,
        ).length;
        const daesilOut = typeSales.filter(
          (s) => s.sale_type === '대실' && s.status === 'checked_out',
        ).length;
        const daesilAvail = total - (daesilActive + earlySukbak) + daesilOut;
        const sukbakTotal = typeSales.filter((s) => s.sale_type === '숙박').length;
        const sukbakAvail = total - sukbakTotal;
        return { rt, total, daesilAvail, sukbakAvail };
      }),
    [sales],
  );

  // Overall page footer summary
  const allDaesil = sales.filter((s) => s.sale_type === '대실');
  const allSukbak = sales.filter((s) => s.sale_type === '숙박');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#C9A84C]">판매 현황판</h1>
          <button
            onClick={() => setAvailPopup(true)}
            className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-200 transition-colors"
          >
            잔여현황
          </button>
          <button
            onClick={() => setHelpPopup(true)}
            className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-xs text-gray-700 hover:bg-gray-200 transition-colors"
          >
            사용설명서
          </button>
          {loading && (
            <span className="text-xs text-gray-400">불러오는 중…</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 6패널 + 통계 — 4열 그리드. 4번째 열(통계)은 2행 span.
          xl 미만에서는 3열로 떨어지고 통계가 아래로 이동. */}
      <div className="grid gap-3"
           style={{ gridTemplateColumns: '4fr 4fr 5fr auto', gridTemplateRows: 'auto auto' }}>
        {/* 대실 행 (1~3열) */}
        <SalesGridPanel title="야놀자"   saleType="대실" variant="ota" sales={groups.yanolja_daesil} saleDate={saleDate}
          panelKey="yanolja_daesil"   occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />
        <SalesGridPanel title="여기어때" saleType="대실" variant="ota" sales={groups.yeogi_daesil}   saleDate={saleDate}
          panelKey="yeogi_daesil"     occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />
        <SalesGridPanel title="기타"     saleType="대실" variant="etc" sales={groups.etc_daesil}     saleDate={saleDate}
          panelKey="etc_daesil"       occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />

        {/* 4번째 열: 통계 (row-span 2 — 대실행+숙박행 전체 차지) */}
        <div className="row-span-2 flex flex-col gap-3 min-w-[160px]">
          <VacancyTable sales={sales} />
          <ChannelRevenueTable sales={sales} />
        </div>

        {/* 숙박 행 (1~3열, 4열은 이미 span) */}
        <SalesGridPanel title="야놀자"   saleType="숙박" variant="ota" sales={groups.yanolja_sukbak} saleDate={saleDate}
          panelKey="yanolja_sukbak"   occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />
        <SalesGridPanel title="여기어때" saleType="숙박" variant="ota" sales={groups.yeogi_sukbak}   saleDate={saleDate}
          panelKey="yeogi_sukbak"     occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />
        <SalesGridPanel title="기타"     saleType="숙박" variant="etc" sales={groups.etc_sukbak}     saleDate={saleDate}
          panelKey="etc_sukbak"       occupiedRooms={occupiedRooms} rooms={rooms}
          onDirtyChange={handlePanelDirtyChange} onRowSaved={handleRowSaved} onRefetchRequested={fetchSales} />
      </div>

      {/* 전체 요약 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-6 text-sm justify-center">
          <span>
            대실 <b className="text-blue-600">{allDaesil.length}</b>건{' '}
            <b className="text-blue-600">{fmt(sumAmount(allDaesil))}</b>원
          </span>
          <span>
            숙박 <b className="text-green-600">{allSukbak.length}</b>건{' '}
            <b className="text-green-600">{fmt(sumAmount(allSukbak))}</b>원
          </span>
          <span>
            합계 <b className="text-[#C9A84C]">{sales.length}</b>건{' '}
            <b className="text-[#C9A84C]">{fmt(sumAmount(sales))}</b>원
          </span>
        </div>
      </div>

      {/* 잔여현황 팝업 */}
      {availPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setAvailPopup(false)}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 p-5 mx-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#C9A84C]">타입별 잔여현황</h2>
              <button
                onClick={() => setAvailPopup(false)}
                className="text-gray-500 hover:text-gray-900 text-xl"
              >
                &times;
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 text-gray-500">
                    <th className="px-3 py-2 text-left">타입</th>
                    <th className="px-3 py-2 text-center">총실</th>
                    <th className="px-3 py-2 text-center">대실가능</th>
                    <th className="px-3 py-2 text-center">숙박가능</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((a) => (
                    <tr key={a.rt} className="border-t border-gray-200">
                      <td className="px-3 py-2 font-bold">{a.rt}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{a.total}</td>
                      <td
                        className={`px-3 py-2 text-center font-bold ${
                          a.daesilAvail <= 0
                            ? 'text-red-600'
                            : a.daesilAvail <= 2
                            ? 'text-orange-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {a.daesilAvail}
                      </td>
                      <td
                        className={`px-3 py-2 text-center font-bold ${
                          a.sukbakAvail <= 0
                            ? 'text-red-600'
                            : a.sukbakAvail <= 2
                            ? 'text-orange-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {a.sukbakAvail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 사용설명서 팝업 (인라인 그리드 버전) */}
      {helpPopup && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8"
          onClick={() => setHelpPopup(false)}
        >
          <div
            className="bg-white rounded-xl border border-gray-200 p-6 mx-4 max-w-2xl w-full space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#C9A84C]">
                일로와 호텔 판매입력 사용설명서
              </h2>
              <button
                onClick={() => setHelpPopup(false)}
                className="text-gray-500 hover:text-gray-900 text-xl"
              >
                &times;
              </button>
            </div>

            <HelpSection
              title="1. 엑셀 스타일 인라인 입력 (신규)"
              items={[
                { label: '빈 행 클릭', desc: '해당 셀이 곧바로 편집 모드로 진입. 별도 "+ 판매 추가" 버튼 불필요' },
                { label: 'Tab / Shift+Tab', desc: '같은 행 좌우 이동. 패널 끝에서는 같은 패널 내에서만 순환' },
                { label: 'Enter', desc: '같은 컬럼 다음 행으로 이동' },
                { label: '방향키 ↑↓←→', desc: '편집 중이든 아니든 자유 이동 (commit + 이동)' },
                { label: 'F2 / Space', desc: '클릭한 셀을 편집 모드로 진입 (select 셀은 input 열림)' },
                { label: 'Esc', desc: '편집한 값을 원본으로 복구' },
                { label: 'Delete / Backspace', desc: '셀 값 비우기 (모든 셀 타입 지원)' },
              ]}
            />

            <HelpSection
              title="2. 패널 구성 (6개)"
              items={[
                { label: '야놀자 × 대실/숙박', desc: '11컬럼, 금액 헤더는 "입금가"' },
                { label: '여기어때 × 대실/숙박', desc: '11컬럼, 금액 헤더는 "입금가"' },
                { label: '기타 × 대실/숙박', desc: '13컬럼 (구분/결재 추가), 금액 헤더는 "금액"' },
                { label: '패널 내 순환', desc: 'Tab이 마지막 셀에 도달하면 첫 셀로 돌아옵니다' },
                { label: '패널 이동', desc: '다른 패널로는 마우스 클릭으로만 이동 (의도치 않은 이동 방지)' },
              ]}
            />

            <HelpSection
              title="3. Select 셀 입력법 (구분/타입/결재/추결)"
              items={[
                { label: '타이핑 (한글 가능)', desc: '셀에 포커스된 상태에서 타이핑 시작 → 자동완성 + 매칭' },
                { label: 'Enter로 확정', desc: '정확히 일치 또는 prefix 매칭되면 해당 값으로 확정' },
                { label: '매칭 실패', desc: '빨간 테두리 + "목록에 없음" 표시. Esc로 원본 복구' },
                { label: 'ASCII 바로가기', desc: '타입 셀에서 s/d/p/g 입력 시 즉시 해당 타입 선택 (편집 모드 없이)' },
                { label: '한글 IME', desc: '조합 완료 후 Enter → 입력 완료. "강애경" 같은 입력도 정상' },
              ]}
            />

            <HelpSection
              title="4. 시간/금액 셀 규칙"
              items={[
                { label: '입실/퇴실 시간', desc: '0~24 사이, 0.5 단위 (예: 14, 14.5, 23)' },
                { label: '범위 초과', desc: '예: 25 입력 시 "0~24 사이" 빨간 경고. Esc로 복구' },
                { label: '금액', desc: '콤마는 자동. 숫자만 입력' },
                { label: '미수 자동 플래그', desc: '결재 셀에 "미수" 선택 시 자동으로 미수 플래그 설정 (CP4)' },
              ]}
            />

            <HelpSection
              title="5. 진행 중 작업 (곧 추가 예정)"
              items={[
                { label: 'CP4: 행 단위 저장', desc: '행 이동/Enter 시 변경 필드만 PATCH 전송' },
                { label: 'CP4: 호실 충돌 검증', desc: '같은 날 같은 호실 중복 시 경고' },
                { label: 'CP4.5: 범위 복사/붙여넣기', desc: 'Ctrl+C/V/X, Delete, Ctrl+Z (엑셀 호환 TSV)' },
                { label: 'CP5: 고급 편집 모달', desc: 'Ctrl+클릭으로 연박/예약금/고객정보 입력' },
                { label: 'CP5: 모바일 fallback', desc: '768px 미만 화면에서는 기존 모달 UI 사용' },
              ]}
            />

            <HelpSection
              title="6. 롤백 스위치"
              items={[
                { label: '환경변수', desc: 'NEXT_PUBLIC_USE_INLINE_EDIT=false 로 설정하면 즉시 기존 모달 UI로 복구' },
                { label: '복구 소요 시간', desc: 'Vercel 환경변수 변경 + 재배포 ≈ 1분' },
                { label: '데이터 호환', desc: '인라인/모달 둘 다 같은 DB를 쓰므로 데이터 손실 없음' },
              ]}
            />

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                문의: 관리자 | 상단 메뉴: 컴플레인 / 변경이력 / 챗봇관리
              </p>
              <button
                onClick={() => setHelpPopup(false)}
                className="mt-3 px-6 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A]"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Help popup section (small helper)
// ─────────────────────────────────────────────────────────────

function HelpSection({
  title,
  items,
}: {
  title: string;
  items: { label: string; desc: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#C9A84C] mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-gray-900 font-medium shrink-0 w-28">
              {item.label}
            </span>
            <span className="text-gray-600">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
