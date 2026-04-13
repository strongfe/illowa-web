'use client';

// ═══════════════════════════════════════════════════════════════
// SalesGridPanel — one Excel-style sales panel (Phase 1, CP 2)
//
// • 40 fixed rows. Existing sales fill the top, the rest are empty.
// • Empty cells render as `LightweightCell` (a plain div), so the
//   initial mount of a panel is ≈ 520 cheap divs instead of 520
//   `EditableCell` instances. (req. #4)
// • A cell is upgraded to a real `EditableCell` the first time it
//   is touched (click, Tab, arrow nav). Once mounted it stays
//   mounted until the row is saved. (req. #4 + #16)
// • Keyboard focus matrix:
//     focused = { row, col } | null   — has keyboard focus
//     editing = { row, col } | null   — currently in edit input
//   Tab / click / typing → focus + edit
//   Arrow keys           → focus only (Excel-like, see CP 1)
// • Esc restores the cell's value from a per-row `original`
//   snapshot. (req. checkpoint 2 #2)
// • Designed for the "기타" panel (14 columns including # / 구분 /
//   결재). The same column-builder accepts an `'ota'` variant for
//   Yanolja / Yeogi where 구분 + 결재 are removed and the amount
//   header reads "입금가" (req. #15). The OTA columns are wired in
//   checkpoint 3.
// • Save logic (PATCH + dirty tracking + POST for new rows) lands
//   in checkpoint 4. For now `onRowCommit` is a no-op stub.
// ═══════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  TextCell,
  NumberCell,
  TimeCell,
  SelectCell,
  CheckCell,
  type BaseCellProps,
  type CellDirection,
  type SelectOption,
} from './EditableCell';
import { MemoPopup } from './MemoPopup';
import type { Sale, SaleType, RoomType, Booking } from '@/types/hotel';
import { OTHER_CHANNELS, PAYMENT_METHODS } from '@/types/hotel';
// SaleModal import removed — 연박/예약 편집은 전용 페이지에서 처리

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export const ROW_COUNT = 40;
// When the panel is collapsed we cap the scrollable area to this many
// rows. 대실 panels collapse to 7 rows, 숙박 to 20 rows — reflects the
// rough daily volume ratio so the default "뷰" still shows most data.
const COLLAPSED_ROWS_DAESIL = 7;
const COLLAPSED_ROWS_SUKBAK = 20;
// Row height in px (matches `h-6` in both EditableCell and LightweightCell).
const ROW_HEIGHT_PX = 24;
const SELECTABLE_ROOM_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

// ─────────────────────────────────────────────────────────────
// RowDraft — the editable subset of a Sale row
// ─────────────────────────────────────────────────────────────

export interface RowDraft {
  channel: string;
  guest_name: string;
  room_type: RoomType | null;
  check_in_time: number | null;
  check_out_time: number | null;
  payment_method: string;
  amount: number;
  room_number: string;
  checked_out: boolean;
  car_number: string;
  memo: string;
  extra_payment_method: string;
  extra_amount: number;
}

const EMPTY_DRAFT: RowDraft = {
  channel: '',
  guest_name: '',
  room_type: null,
  check_in_time: null,
  check_out_time: null,
  payment_method: '',
  amount: 0,
  room_number: '',
  checked_out: false,
  car_number: '',
  memo: '',
  extra_payment_method: '',
  extra_amount: 0,
};

function saleToDraft(sale: Sale): RowDraft {
  return {
    channel: sale.channel,
    guest_name: sale.guest_name || '',
    room_type: sale.room_type,
    check_in_time: sale.check_in_time,
    check_out_time: sale.check_out_time,
    payment_method: sale.payment_method || '',
    amount: sale.amount,
    room_number: sale.room_number || '',
    checked_out: sale.status === 'checked_out',
    car_number: sale.car_number || '',
    memo: sale.memo || '',
    extra_payment_method: sale.extra_payment_method || '',
    extra_amount: sale.extra_amount || 0,
  };
}

interface RowState {
  /** Original sale loaded from the server, or null for an empty row. */
  original: Sale | null;
  /** Snapshot of the draft at the moment editing began for the row.
   *  Used for Esc-to-restore. */
  snapshot: RowDraft;
  /** Live editable draft. */
  draft: RowDraft;
  /** RowDraft fields modified since the last successful save/load. */
  dirty: Set<keyof RowDraft>;
  /** True while a PATCH/POST for this row is in flight. */
  saving: boolean;
  /** Timestamp of the last successful save, used for the 0.5 s
   *  green flash. Null when there is nothing to flash. */
  savedAt: number | null;
  /** Human-readable error from the last save attempt, or null. */
  error: string | null;
  /** Per-field validation errors. A non-empty entry causes the
   *  matching cell to render with a red border and tooltip. Populated
   *  by commitRow (required-field check, room conflict) and cleared
   *  when the user re-edits the affected field. */
  fieldErrors: Partial<Record<keyof RowDraft, string>>;
}

function buildRowState(sale: Sale | null): RowState {
  const draft = sale ? saleToDraft(sale) : { ...EMPTY_DRAFT };
  return {
    original: sale,
    snapshot: { ...draft },
    draft,
    dirty: new Set(),
    saving: false,
    savedAt: null,
    error: null,
    fieldErrors: {},
  };
}

// ─────────────────────────────────────────────────────────────
// CP4.5 — Range selection + copy/paste + undo
// ─────────────────────────────────────────────────────────────

interface Selection {
  /** Cell where the selection started. Stays fixed as the range grows. */
  anchor: FocusPos;
  /** Moving end of the selection (drag / shift-click / Ctrl+A). */
  focus: FocusPos;
}

/** Normalise an anchor/focus pair into a top-left / bottom-right rect. */
function rectFromSelection(s: Selection): {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
} {
  return {
    r0: Math.min(s.anchor.row, s.focus.row),
    r1: Math.max(s.anchor.row, s.focus.row),
    c0: Math.min(s.anchor.col, s.focus.col),
    c1: Math.max(s.anchor.col, s.focus.col),
  };
}

/** Maximum number of undo batches kept per panel. Each batch may
 *  contain many cell edits (a paste is one batch). */
const MAX_UNDO = 20;

interface UndoEntry {
  rowIdx: number;
  key: keyof RowDraft;
  prev: RowDraft[keyof RowDraft];
}

/**
 * Serialise a single draft value for TSV copy. Keeps the output
 * Excel-friendly: plain integers (no commas), half-hours as "14.5",
 * booleans as TRUE/FALSE, nulls as empty.
 */
function serializeForCopy(
  key: keyof RowDraft,
  value: RowDraft[keyof RowDraft],
): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (key === 'check_in_time' || key === 'check_out_time') {
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    }
    return String(value);
  }
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Parse a TSV blob (from either our own copy or Excel) into a grid
 * of trimmed strings. Tolerates CRLF, trailing newlines, and ragged
 * row lengths — the caller picks only the cells it can target.
 */
function parseTSV(text: string): string[][] {
  if (!text) return [];
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const stripped = normalised.replace(/\n+$/, '');
  if (stripped === '') return [];
  return stripped.split('\n').map((line) => line.split('\t'));
}

/**
 * Coerce a raw pasted cell into a typed RowDraft value for the
 * given column. Returns `undefined` when the value cannot be safely
 * converted — the caller should skip that single cell and continue.
 * An empty string coerces to the column's natural empty value so
 * that clearing via paste works as expected.
 */
function coerceForPaste(
  key: keyof RowDraft,
  raw: string,
): RowDraft[keyof RowDraft] | undefined {
  const trimmed = raw.trim();
  switch (key) {
    case 'amount':
    case 'extra_amount': {
      if (trimmed === '') return 0;
      const n = parseInt(trimmed.replace(/,/g, ''), 10);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return n;
    }
    case 'check_in_time':
    case 'check_out_time': {
      if (trimmed === '') return null;
      const n = parseFloat(trimmed);
      if (!Number.isFinite(n) || n < 0 || n > 24) return undefined;
      if (Math.abs(n * 2 - Math.round(n * 2)) > 0.001) return undefined;
      return n;
    }
    case 'room_type': {
      if (trimmed === '') return null;
      const ok: RoomType[] = ['T', 'GS', 'GD', 'S', 'D', 'P', 'PT'];
      return (ok as string[]).includes(trimmed)
        ? (trimmed as RoomType)
        : undefined;
    }
    case 'channel':
    case 'payment_method':
    case 'extra_payment_method':
    case 'guest_name':
    case 'room_number':
    case 'car_number':
    case 'memo':
      return trimmed;
    case 'checked_out': {
      // Checked-out lives on its own PUT endpoint (CP4.4); we
      // deliberately do not let paste flip it to avoid surprising
      // hotel staff with accidental check-outs.
      return undefined;
    }
    default:
      return undefined;
  }
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Booking memo prefix (연박 비고 표시)
// ─────────────────────────────────────────────────────────────

/**
 * Build the "12-15(퇴)3박" prefix that appears in the memo column
 * for multi-night booking rows. Returns '' for non-booking rows.
 *
 * Format rules:
 *  - Same month:    "12-15 3박"   or  "12-15(퇴)3박"
 *  - Cross month:   "4/30-5/2 3박"
 *  - (퇴) only when sale.status === 'checked_out'
 */
function bookingMemoPrefix(
  sale: Sale | null,
  bookingsMap: ReadonlyMap<string, Booking> | undefined,
): string {
  if (!sale || !sale.booking_id || !bookingsMap) return '';
  const booking = bookingsMap.get(sale.booking_id);
  if (!booking) return '';

  const cin = booking.check_in_date; // "2026-04-12"
  const cout = booking.check_out_date; // "2026-04-15"
  const cinMonth = cin.slice(5, 7);
  const cinDay = cin.slice(8, 10);
  const coutMonth = cout.slice(5, 7);
  const coutDay = cout.slice(8, 10);

  // Remove leading zeros for display: "04" → "4", "12" → "12"
  const d1 = String(parseInt(cinDay, 10));
  const d2 = String(parseInt(coutDay, 10));
  const m1 = String(parseInt(cinMonth, 10));
  const m2 = String(parseInt(coutMonth, 10));

  const dateRange =
    cinMonth === coutMonth
      ? `${d1}-${d2}`
      : `${m1}/${d1}-${m2}/${d2}`;

  const checkout = sale.status === 'checked_out' ? '(퇴)' : '';
  const nights = booking.total_nights;

  return `${dateRange}${checkout} ${nights}박`;
}

/**
 * Build the "예약 20,000" or "완불 80,000" prefix for the memo
 * column on rows with payment_timing === '예약금' or '완불'.
 * Returns '' for 현장 결제 rows.
 */
function paymentMemoPrefix(sale: Sale | null): {
  text: string;
  colorClass: string;
} {
  if (!sale) return { text: '', colorClass: '' };

  if (sale.payment_timing === '예약금') {
    if (sale.balance_paid) {
      return {
        text: `완불 ${sale.amount.toLocaleString('ko-KR')}`,
        colorClass: 'text-green-600',
      };
    }
    return {
      text: `예약 ${(sale.prepaid_amount || 0).toLocaleString('ko-KR')}`,
      colorClass: 'text-blue-600',
    };
  }

  if (sale.payment_timing === '완불') {
    return {
      text: `완불 ${sale.amount.toLocaleString('ko-KR')}`,
      colorClass: 'text-green-600',
    };
  }

  return { text: '', colorClass: '' };
}

// Row flags (CP4.4)
// ─────────────────────────────────────────────────────────────

/**
 * Status flags used to color specific cells. The mapping is:
 *   - 성명 cell  : 연박(골드) / 기본
 *   - 금액 cell  : 미수(빨강) / 수금(초록) / 예약금(파랑) /
 *                  결제완료(초록) / 완불(초록) / 기본
 *
 * 당특(memo 포함) is intentionally NOT signalled on the name cell.
 * The "당특" keyword is already visible in the 비고 column and
 * colouring random names red just because their memo contains it
 * confuses staff. If a dedicated 당특 indicator is needed later we
 * will attach it to the memo cell itself.
 */
interface RowFlags {
  nameColor: string | null;
  amountColor: string | null;
  nameTooltip: string | null;
  amountTooltip: string | null;
}

/**
 * Defensive flag coercion for `is_receivable`. Supabase/Postgres
 * booleans can come back as `true | false | null | "t" | "f" | 0 | 1`
 * depending on driver version, and legacy rows created by the old
 * modal UI may have `payment_method === '미수'` without setting the
 * receivable flag. We treat any positive signal as 미수.
 */
function isReceivableFlag(
  original: Sale & { payment_method?: string | null },
): boolean {
  const raw = original.is_receivable as unknown;
  if (raw === true) return true;
  if (typeof raw === 'string' && (raw === 't' || raw === 'true')) return true;
  if (typeof raw === 'number' && raw === 1) return true;
  if (original.payment_method === '미수') return true;
  return false;
}

function computeRowFlags(original: Sale | null): RowFlags {
  const flags: RowFlags = {
    nameColor: null,
    amountColor: null,
    nameTooltip: null,
    amountTooltip: null,
  };
  if (!original) return flags;

  // 성명 셀 — 연박만 표시 (당특은 memo 컬럼에 이미 보임)
  // Strict booking_id validation: must be a non-empty UUID-shaped
  // string. Legacy data occasionally carries whitespace or a
  // sentinel like "0" that is truthy but not a real booking ref.
  const bookingId = original.booking_id;
  if (
    typeof bookingId === 'string' &&
    bookingId.length >= 32 &&
    /^[0-9a-f-]+$/i.test(bookingId)
  ) {
    flags.nameColor = 'text-purple-700 font-semibold';
    flags.nameTooltip = '연박';
  }

  // 금액 셀 — 미수 > 수금 > 예약금 > 결제완료 > 완불
  if (isReceivableFlag(original)) {
    if (original.resolved_at) {
      flags.amountColor = 'text-green-600 font-semibold';
      flags.amountTooltip = '수금';
    } else {
      flags.amountColor = 'text-red-600 font-semibold';
      flags.amountTooltip = '미수';
    }
  } else if (original.payment_timing === '예약금') {
    if (original.balance_paid) {
      flags.amountColor = 'text-green-600 font-semibold';
      flags.amountTooltip = '결제완료';
    } else {
      flags.amountColor = 'text-blue-600 font-semibold';
      flags.amountTooltip = '예약금';
    }
  } else if (original.payment_timing === '완불') {
    flags.amountColor = 'text-green-600 font-semibold';
    flags.amountTooltip = '완불';
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────
// Required-field validation (CP4.3)
// ─────────────────────────────────────────────────────────────

/**
 * Check whether a row draft has the minimum set of required fields
 * before it is allowed to hit the server. Returns a `fieldErrors`
 * map keyed by the offending RowDraft fields; an empty object means
 * the row is valid. Used by both the PUT and POST paths in commitRow.
 */
function validateRequired(
  draft: RowDraft,
): Partial<Record<keyof RowDraft, string>> {
  const errs: Partial<Record<keyof RowDraft, string>> = {};
  if (!draft.channel || draft.channel.trim() === '') {
    errs.channel = '채널 필수';
  }
  if (!draft.room_type) {
    errs.room_type = '타입 필수';
  }
  if (!draft.amount || draft.amount <= 0) {
    errs.amount = '금액 필수';
  }
  return errs;
}

/**
 * Convert a set of dirty RowDraft keys into a PATCH body for
 * /api/admin/hotel/sales. Returns null if nothing to send (e.g. only
 * the `checked_out` checkbox is dirty — that is handled separately in
 * CP4.4). Defensively drops `room_type=null` so we never send an
 * invalid value to a NOT NULL column; CP4.3 adds upfront validation.
 */
function buildPatchBody(
  id: string,
  draft: RowDraft,
  dirty: Set<keyof RowDraft>,
): Record<string, unknown> | null {
  const body: Record<string, unknown> = { id };
  let hasAny = false;
  for (const key of dirty) {
    if (key === 'checked_out') continue;
    const value = draft[key];
    if (key === 'room_type' && value == null) continue;
    // Normalize empty strings for fields the server expects as null
    if (
      (key === 'payment_method' ||
        key === 'room_number' ||
        key === 'extra_payment_method') &&
      value === ''
    ) {
      body[key] = null;
    } else {
      body[key] = value;
    }
    hasAny = true;
  }
  return hasAny ? body : null;
}

/**
 * CP4.2 — Minimum-required-fields check for creating a new row on
 * the server. A draft is "ready" only when the staff has supplied
 * enough data for the sale to be meaningful: channel, room type, and
 * a positive amount. This is a conservative gate — if any of these
 * is missing we skip the POST entirely so the user is not surprised
 * by half-typed rows landing in the database.
 */
function isRowReadyForCreate(draft: RowDraft): boolean {
  if (!draft.channel || draft.channel.trim() === '') return false;
  if (!draft.room_type) return false;
  if (!draft.amount || draft.amount <= 0) return false;
  return true;
}

/**
 * Build the POST body for a fresh row. The server (/api/admin/hotel/
 * sales route.ts) expects the full SaleInput shape plus sale_date
 * and sale_type, which the panel owns rather than the row. Optional
 * fields are omitted entirely so DB defaults apply and nulls are not
 * forced into NOT NULL columns.
 */
function buildCreateBody(
  draft: RowDraft,
  saleDate: string,
  saleType: SaleType,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    sale_date: saleDate,
    sale_type: saleType,
    channel: draft.channel,
    room_type: draft.room_type,
    amount: draft.amount,
    guest_name: draft.guest_name || '',
  };
  if (draft.payment_method) body.payment_method = draft.payment_method;
  if (draft.check_in_time != null) body.check_in_time = draft.check_in_time;
  if (draft.check_out_time != null) body.check_out_time = draft.check_out_time;
  if (draft.room_number) body.room_number = draft.room_number;
  if (draft.car_number) body.car_number = draft.car_number;
  if (draft.memo) body.memo = draft.memo;
  if (draft.extra_payment_method) {
    body.extra_payment_method = draft.extra_payment_method;
  }
  if (draft.extra_amount) body.extra_amount = draft.extra_amount;
  // Auto-flag as receivable when the staff picks "미수" as the method.
  if (draft.payment_method === '미수') {
    body.is_receivable = true;
    body.receivable_amount = draft.amount;
  }
  return body;
}

/**
 * Produce a new Sale object with the successfully-saved draft fields
 * merged in. Called after a 200 response so that `rowState.original`
 * reflects the latest server-accepted values without refetching.
 */
function applyDraftToSale(sale: Sale, draft: RowDraft): Sale {
  return {
    ...sale,
    channel: draft.channel,
    guest_name: draft.guest_name,
    room_type: draft.room_type ?? sale.room_type,
    check_in_time: draft.check_in_time,
    check_out_time: draft.check_out_time,
    payment_method: draft.payment_method || null,
    amount: draft.amount,
    room_number: draft.room_number || null,
    car_number: draft.car_number,
    memo: draft.memo,
    extra_payment_method: draft.extra_payment_method || null,
    extra_amount: draft.extra_amount,
    // status is intentionally NOT touched here — the checkbox toggle
    // (CP4.4) uses a separate PUT endpoint.
  };
}

// ─────────────────────────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────────────────────────

interface ColumnDef {
  /** RowDraft field key, used for both lightweight rendering and Esc restore. */
  key: keyof RowDraft;
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
  render: (p: ColumnRenderProps) => React.ReactElement;
}

interface ColumnRenderProps {
  draft: RowDraft;
  setField: <K extends keyof RowDraft>(key: K, value: RowDraft[K]) => void;
  /**
   * CP4.4 — Immediate-save callback for the checkout checkbox.
   * Sends a PUT `{id, status}` directly and updates row.original
   * without going through the dirty/commitRow pipeline so staff can
   * toggle a row's status while editing a different row.
   */
  onCheckoutToggle: (next: boolean) => void;
  /**
   * CP4.4 — Per-row status flags. Currently used by the 성명 and
   * 금액 columns to tint their text color (당특 → red, 미수 → red,
   * 완불 → green, 연박 → gold, etc.). Null fields mean no tint.
   */
  flags: RowFlags;
  /** Booking memo prefix (e.g. "12-15(퇴)3박") for the memo column. */
  bookingPrefix: string;
  /** Payment memo prefix (e.g. "예약 20,000" or "완불 80,000"). */
  paymentPrefix: { text: string; colorClass: string };
  cellProps: BaseCellProps;
}

export type PanelVariant = 'etc' | 'ota';

/**
 * Build the column list. The 기타 (etc) variant is the full 13 cells used
 * in checkpoint 2. The OTA variant (없는 구분/결재) will be used in
 * checkpoint 3 and is included here so the surrounding logic does not
 * need to fork.
 */
function buildColumns(variant: PanelVariant): ColumnDef[] {
  const channelOptions: SelectOption<string>[] = OTHER_CHANNELS.map((c) => ({
    value: c,
    label: c,
  }));
  const roomTypeOptions: SelectOption<string>[] = SELECTABLE_ROOM_TYPES.map((rt) => ({
    value: rt,
    label: rt,
  }));
  const paymentOptions: SelectOption<string>[] = [
    { value: '', label: '-' },
    ...PAYMENT_METHODS.map((p) => ({ value: p, label: p })),
  ];

  const cols: ColumnDef[] = [];

  if (variant === 'etc') {
    cols.push({
      key: 'channel',
      header: '구분',
      width: 50,
      align: 'center',
      render: ({ draft, setField, cellProps }) => (
        <SelectCell
          {...cellProps}
          value={draft.channel || null}
          options={channelOptions}
          onChange={(v) => setField('channel', v)}
          onClear={() => setField('channel', '')}
          placeholder="-"
        />
      ),
    });
  }

  cols.push({
    key: 'guest_name',
    header: '성명',
    width: 100,
    align: 'left',
    render: ({ draft, setField, flags, cellProps }) => (
      <TextCell
        {...cellProps}
        value={draft.guest_name}
        onChange={(v) => setField('guest_name', v)}
        placeholder="성명"
        align="left"
        textClassName={flags.nameColor ?? undefined}
        ariaLabel={flags.nameTooltip ? `성명 (${flags.nameTooltip})` : '성명'}
      />
    ),
  });

  cols.push({
    key: 'room_type',
    header: '타입',
    width: 36,
    align: 'center',
    render: ({ draft, setField, cellProps }) => (
      <SelectCell
        {...cellProps}
        value={draft.room_type}
        options={roomTypeOptions}
        onChange={(v) => setField('room_type', v as RoomType)}
        onClear={() => setField('room_type', null)}
        placeholder="-"
      />
    ),
  });

  cols.push({
    key: 'check_in_time',
    header: '입실',
    width: 26,
    align: 'center',
    render: ({ draft, setField, cellProps }) => (
      <TimeCell
        {...cellProps}
        value={draft.check_in_time}
        onChange={(v) => setField('check_in_time', v)}
      />
    ),
  });

  cols.push({
    key: 'check_out_time',
    header: '퇴실',
    width: 26,
    align: 'center',
    render: ({ draft, setField, cellProps }) => (
      <TimeCell
        {...cellProps}
        value={draft.check_out_time}
        onChange={(v) => setField('check_out_time', v)}
      />
    ),
  });

  if (variant === 'etc') {
    cols.push({
      key: 'payment_method',
      header: '결재',
      width: 50,
      align: 'center',
      render: ({ draft, setField, cellProps }) => (
        <SelectCell
          {...cellProps}
          value={draft.payment_method || null}
          options={paymentOptions}
          onChange={(v) => setField('payment_method', v)}
          onClear={() => setField('payment_method', '')}
        />
      ),
    });
  }

  cols.push({
    key: 'amount',
    header: variant === 'ota' ? '입금가' : '금액',
    width: 64,
    align: 'right',
    render: ({ draft, setField, flags, cellProps }) => (
      <NumberCell
        {...cellProps}
        value={draft.amount}
        onChange={(v) => setField('amount', v)}
        textClassName={flags.amountColor ?? undefined}
        ariaLabel={flags.amountTooltip ? `금액 (${flags.amountTooltip})` : '금액'}
      />
    ),
  });

  cols.push({
    key: 'room_number',
    header: '호실',
    width: 32,
    align: 'center',
    render: ({ draft, setField, cellProps }) => (
      <TextCell
        {...cellProps}
        value={draft.room_number}
        onChange={(v) => setField('room_number', v)}
        align="center"
        maxLength={5}
      />
    ),
  });

  cols.push({
    key: 'checked_out',
    header: '퇴실',
    width: 36,
    align: 'center',
    render: ({ draft, onCheckoutToggle, cellProps }) => (
      <CheckCell
        {...cellProps}
        value={draft.checked_out}
        onChange={onCheckoutToggle}
      />
    ),
  });

  cols.push({
    key: 'car_number',
    header: '차번호',
    width: 40,
    align: 'left',
    render: ({ draft, setField, cellProps }) => (
      <TextCell
        {...cellProps}
        value={draft.car_number}
        onChange={(v) => setField('car_number', v)}
        align="left"
        maxLength={20}
      />
    ),
  });

  cols.push({
    key: 'memo',
    header: '비고',
    width: 156,
    align: 'left',
    render: ({ draft, setField, bookingPrefix, paymentPrefix, cellProps }) => {
      // Combined display: "12-15 3박 예약 20,000 기존메모"
      const parts: string[] = [];
      if (bookingPrefix) parts.push(bookingPrefix);
      if (paymentPrefix.text) parts.push(paymentPrefix.text);
      if (draft.memo) parts.push(draft.memo);
      const displayValue = parts.join(' ');

      // Color priority: booking amber > payment blue/green > default
      const colorClass = bookingPrefix
        ? 'text-purple-700'
        : paymentPrefix.colorClass || undefined;

      // Readonly prefix lines for the popup header
      const prefixLines: string[] = [];
      if (bookingPrefix) prefixLines.push(`🛏️ ${bookingPrefix}`);
      if (paymentPrefix.text) prefixLines.push(`💰 ${paymentPrefix.text}`);

      return (
        <MemoPopup
          {...cellProps}
          value={draft.memo}
          onChange={(v) => setField('memo', v)}
          displayValue={displayValue}
          textClassName={colorClass}
          prefixLines={prefixLines}
        />
      );
    },
  });

  cols.push({
    key: 'extra_payment_method',
    header: '추결',
    width: 48,
    align: 'center',
    render: ({ draft, setField, cellProps }) => (
      <SelectCell
        {...cellProps}
        value={draft.extra_payment_method || null}
        options={paymentOptions}
        onChange={(v) => setField('extra_payment_method', v)}
        onClear={() => setField('extra_payment_method', '')}
      />
    ),
  });

  cols.push({
    key: 'extra_amount',
    header: '추금액',
    width: 66,
    align: 'right',
    render: ({ draft, setField, cellProps }) => (
      <NumberCell
        {...cellProps}
        value={draft.extra_amount}
        onChange={(v) => setField('extra_amount', v)}
      />
    ),
  });

  return cols;
}

// ─────────────────────────────────────────────────────────────
// Public component props
// ─────────────────────────────────────────────────────────────

export interface SalesGridPanelProps {
  title: string;
  saleType: SaleType;
  variant: PanelVariant;
  sales: Sale[];
  /** ISO date (YYYY-MM-DD) used when POSTing brand new rows. */
  saleDate: string;
  /**
   * Set of `${room_number}|${saleId|''}` entries currently holding an
   * active reservation across ALL panels for the same saleDate. The
   * `saleId` suffix lets a panel recognise its own row and skip self-
   * collisions. Built by the parent (SalesGridPage) so that cross-
   * panel conflicts (e.g. 806 booked in 야놀자·대실 AND 기타·숙박)
   * are caught. Optional so standalone usages (GridDemo) still work.
   */
  occupiedRooms?: ReadonlyMap<string, string>;
  /**
   * Called whenever this panel's "has unsaved edits" status changes.
   * Used by the parent to wire a beforeunload warning at the page
   * level. The callback is deduped on each panel so the parent only
   * sees state transitions, not per-keystroke flaps.
   */
  onDirtyChange?: (panelKey: string, isDirty: boolean) => void;
  /**
   * Stable key identifying this panel within the page. Passed back
   * to `onDirtyChange` so the parent can track dirty state per
   * panel without threading extra props.
   */
  panelKey?: string;
  /**
   * Called with the server-returned Sale every time this panel
   * successfully saves a row (PUT, POST, or the checkbox toggle).
   * The parent uses this to update its `sales` state in place so
   * the page-level summary stays in sync without waiting for the
   * 30 s refresh.
   */
  onRowSaved?: (saved: Sale) => void;
  /**
   * Booking lookup map for displaying "12-15(퇴)3박" in the memo
   * column of multi-night rows. Keyed by booking_id.
   */
  bookingsMap?: ReadonlyMap<string, Booking>;
  /** Reserved for checkpoint 4. Currently not invoked. */
  onRowCommit?: (rowIdx: number, draft: RowDraft, original: Sale | null) => void;
}

interface FocusPos {
  row: number;
  col: number;
}

// ─────────────────────────────────────────────────────────────
// Main panel component
// ─────────────────────────────────────────────────────────────

export default function SalesGridPanel(props: SalesGridPanelProps) {
  const {
    title,
    saleType,
    variant,
    sales,
    saleDate,
    occupiedRooms,
    onDirtyChange,
    panelKey,
    onRowSaved,
    bookingsMap,
  } = props;
  // Stable ref so commitRow/commitCheckout can call it without
  // re-creating their callbacks every render.
  const onRowSavedRef = useRef(onRowSaved);
  onRowSavedRef.current = onRowSaved;


  // CP4.5 — range selection + copy/paste/undo
  //
  // selection   — current rectangular range, or null when only one
  //               cell is "focused". Single-cell focus is tracked by
  //               `focused` below and does not create a Selection.
  // panelRef    — DOM ref used by the document keydown/mouse
  //               listeners to check whether THIS panel is the
  //               currently active one.
  // dragStartRef / isDraggingRef — drag-to-select bookkeeping; the
  //               cell mousedown records where the drag started,
  //               the window mousemove promotes to dragging as
  //               soon as the cursor crosses into a neighbour cell.
  // suppressNextEditRef — set when a shift-click / drag ends, so
  //               the synthesized click event that follows does not
  //               enter the cell's edit mode.
  // undoStackRef — an array of "batches"; each batch is a list of
  //               field-level undo entries. Singleton batches come
  //               from normal edits, multi-entry batches come from
  //               paste operations.
  // pendingBatchRef — non-null while a batch is being accumulated.
  //               setField appends to this ref instead of pushing a
  //               fresh singleton batch, so begin/endBatch() gives
  //               us atomic undo.
  // replayingUndoRef — true while undoOne is re-applying a batch.
  //               setField consults this flag and skips pushing new
  //               undo entries during replay (otherwise undo would
  //               endlessly feed itself).
  const [selection, setSelection] = useState<Selection | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<FocusPos | null>(null);
  const isDraggingRef = useRef(false);
  const suppressNextEditRef = useRef(false);
  const undoStackRef = useRef<UndoEntry[][]>([]);
  const pendingBatchRef = useRef<UndoEntry[] | null>(null);
  const replayingUndoRef = useRef(false);
  // Mirror of `selection` so async callbacks (document-level
  // Ctrl+C/V/Z/A, drag listeners) always read the latest range
  // without depending on useCallback closure capture. Refreshed
  // every render so it's always fresh by the time an event handler
  // runs. `focusedFullRef` lives further down after the `focused`
  // state is declared.
  const selectionRef = useRef<Selection | null>(null);
  selectionRef.current = selection;

  const columns = useMemo(() => buildColumns(variant), [variant]);
  const colCount = columns.length;

  // Build initial row states (existing sales + empty padding to ROW_COUNT).
  const buildInitialRows = useCallback(
    () =>
      Array.from({ length: ROW_COUNT }, (_, i) => buildRowState(sales[i] ?? null)),
    [sales],
  );
  const [rows, setRows] = useState<RowState[]>(buildInitialRows);
  // Mirror `rows` into a ref so asynchronous callbacks (commitRow, the
  // PATCH resolver, setTimeout flash clearer) can read the latest
  // snapshot without triggering re-renders or stale closures.
  const rowsRef = useRef<RowState[]>(rows);
  rowsRef.current = rows;
  // Tracks which rows currently have an in-flight save. Kept out of
  // React state so it can be inspected synchronously from the commit
  // effect without racing with render batching.
  const inFlightRef = useRef<Set<number>>(new Set());
  // Mirrors the currently focused row index (nullable) so that
  // focusCell can determine which row is being left without reading
  // the yet-unscheduled React state.
  const focusedRowRef = useRef<number | null>(null);
  // Mirror of the parent-supplied occupiedRooms map. Read inside
  // commitRow (which is memoized) without forcing the callback to
  // re-create every time the parent rebuilds the map — the ref
  // always holds the latest reference.
  const occupiedRoomsRef = useRef<ReadonlyMap<string, string> | undefined>(
    occupiedRooms,
  );
  occupiedRoomsRef.current = occupiedRooms;
  // Row indexes that have been requested to commit. Scheduling is done
  // via React state so the commit effect below only runs *after*
  // React has flushed the pending setField/setRows updates — this
  // guarantees rowsRef.current carries the latest dirty set when
  // commitRow reads it.
  const [pendingCommits, setPendingCommits] = useState<Set<number>>(
    () => new Set(),
  );

  // ── Row deletion (Del × 2) ──
  // pendingDeleteRow: row index awaiting 2nd Del press, or null.
  const [pendingDeleteRow, setPendingDeleteRow] = useState<number | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);

  // Focus / edit / mount state
  const [focused, setFocused] = useState<FocusPos | null>(null);
  const [editing, setEditing] = useState<FocusPos | null>(null);
  // Mirror of `focused` for CP4.5 async handlers. Paired with
  // `selectionRef` so that document-level Ctrl+C/V/Z code never sees
  // a stale closure of the focused cell.
  const focusedFullRef = useRef<FocusPos | null>(null);
  focusedFullRef.current = focused;
  // Lazy-mount tracking. Once a (row, col) is added it is never removed
  // until the row is saved (req. #4). A non-empty set means the user
  // has started interacting with at least one cell in this panel and
  // we must not clobber their in-progress input with a background
  // refresh.
  const [mounted, setMounted] = useState<Set<string>>(new Set());

  // Resync when external sales[] changes (30s refresh, date switch,
  // onRowSaved callback from a sibling panel, etc.) — CP4.4 per-row
  // dirty protection.
  //
  // Strategy: preserve any row that is dirty OR currently saving,
  // and replace every other slot with the matching entry from the
  // new sales[]. Rows keyed by positional index in the panel; the
  // API already delivers sales in chronological order (see
  // SalesGridPage.fetchSales sort) so slot meaning stays stable
  // in the common "append only" case.
  //
  // Escape hatch: when the date changes (detected via a larger
  // batch diff) we always rebuild so that stale drafts from a
  // previous date do not leak across. Here we treat any difference
  // whose length matches "many rows moved" as a date change — in
  // practice React re-mounts the panel on date changes because the
  // props cascade from SalesGridPage, so the escape hatch rarely
  // triggers.
  const [prevSales, setPrevSales] = useState(sales);
  if (sales !== prevSales) {
    setPrevSales(sales);
    setRows((prevRows) => {
      const next: RowState[] = new Array(ROW_COUNT);
      for (let i = 0; i < ROW_COUNT; i++) {
        const cur = prevRows[i];
        // 1. Protect dirty / saving rows in-place.
        if (cur && (cur.dirty.size > 0 || cur.saving)) {
          next[i] = cur;
          continue;
        }
        // 2. Otherwise pull the matching server row by slot index.
        //    If the saved data for this slot matches what the row
        //    already holds we avoid churning state (keeps `mounted`
        //    cells rendered).
        const incoming = sales[i] ?? null;
        if (
          cur &&
          cur.original &&
          incoming &&
          cur.original.id === incoming.id &&
          cur.original === incoming
        ) {
          next[i] = cur;
          continue;
        }
        next[i] = buildRowState(incoming);
      }
      return next;
    });
  }
  // Collapsed view caps the visible rows (see COLLAPSED_ROWS_*).
  // Defaults by sale_type:
  //   대실 → collapsed (7 rows) — typical daytime volume is low
  //   숙박 → expanded (all 40 rows) — staff usually need the full list
  const [collapsed, setCollapsed] = useState(saleType === '대실');
  const collapsedRows =
    saleType === '숙박' ? COLLAPSED_ROWS_SUKBAK : COLLAPSED_ROWS_DAESIL;

  const cellKey = (r: number, c: number) => `${r}:${c}`;

  const ensureMounted = useCallback((row: number, col: number) => {
    setMounted((prev) => {
      const k = cellKey(row, col);
      if (prev.has(k)) return prev;
      const next = new Set(prev);
      next.add(k);
      return next;
    });
  }, []);

  /**
   * Helper used by both the PUT and POST paths in commitRow. Clears
   * the green success flash ~0.6s later without clobbering a newer
   * save that may have happened in the meantime.
   */
  const scheduleFlashClear = useCallback(
    (rowIdx: number, savedAt: number) => {
      setTimeout(() => {
        setRows((prev) => {
          const cur = prev[rowIdx];
          if (!cur || cur.savedAt !== savedAt) return prev;
          const next = prev.slice();
          next[rowIdx] = { ...cur, savedAt: null };
          return next;
        });
      }, 600);
    },
    [],
  );

  /**
   * CP4.3 — Run validation for a row and write the result into
   * rowState.fieldErrors / rowState.error. Returns `true` if the row
   * is OK to save, `false` if any check failed.
   *
   * Checks run here:
   *   1. Required fields (channel, room_type, amount > 0)
   *   2. Room conflict: if the user set a room_number, no other
   *      ACTIVE row on the same saleDate may hold the same number.
   *      Self-collisions are skipped via the saleId tag in
   *      `occupiedRooms`.
   *
   * Fields without an error are cleared (so re-editing a row that
   * was previously flagged removes the red outline on success).
   */
  const runValidation = useCallback(
    (rowIdx: number): boolean => {
      const row = rowsRef.current[rowIdx];
      if (!row) return false;

      const errs = validateRequired(row.draft);

      // Room conflict — only meaningful if the user actually picked
      // a room number. Empty / null rooms skip this check because
      // lots of rows are legitimately "아직 미배정".
      const rn = row.draft.room_number?.trim();
      if (rn) {
        const map = occupiedRoomsRef.current;
        if (map) {
          const selfId = row.original?.id ?? '';
          const ownerId = map.get(rn);
          if (ownerId != null && ownerId !== selfId) {
            errs.room_number = '호실 중복';
          }
        }
      }

      const hasErrors = Object.keys(errs).length > 0;
      setRows((prev) => {
        const cur = prev[rowIdx];
        const same =
          Object.keys(cur.fieldErrors).length === Object.keys(errs).length &&
          (Object.keys(errs) as (keyof RowDraft)[]).every(
            (k) => cur.fieldErrors[k] === errs[k],
          );
        if (same && (!hasErrors || cur.error)) {
          // Nothing to update — avoid needless rerenders.
          // (If hasErrors we still need to surface row.error below,
          // so only short-circuit when either clean or already set.)
          if (!hasErrors || cur.error) return prev;
        }
        const next = prev.slice();
        next[rowIdx] = {
          ...cur,
          fieldErrors: errs,
          error: hasErrors ? '필수 항목 확인' : cur.error,
        };
        return next;
      });
      return !hasErrors;
    },
    [],
  );

  /**
   * CP4.1/4.2/4.3 — Commit a row's pending edits to the server.
   *
   *  • Existing row (original !== null) + dirty fields → PATCH (PUT
   *    route, fields-only body).
   *  • New row (original === null) + all required fields → POST,
   *    then hydrate original/snapshot from the server response so
   *    subsequent edits take the PUT path.
   *  • Either path first runs `runValidation`; a failed validation
   *    blocks the network call and surfaces per-field errors.
   *  • Anything else is a no-op.
   *
   * Idempotent per row via `inFlightRef` — concurrent calls for the
   * same rowIdx are dropped until the in-flight request resolves.
   */
  const commitRow = useCallback(
    async (rowIdx: number) => {
      if (inFlightRef.current.has(rowIdx)) return;
      let row = rowsRef.current[rowIdx];
      if (!row) return;

      // ── Branch A: update existing row (PATCH via PUT route) ──
      if (row.original) {
        if (row.dirty.size === 0) return;

        // If all key fields are empty, delete the row from DB instead of updating.
        const d = row.draft;
        const isAllEmpty =
          d.guest_name.trim() === '' &&
          d.amount === 0 &&
          (d.room_type === null || d.room_type === ('' as RoomType)) &&
          d.check_in_time === null &&
          d.check_out_time === null &&
          d.room_number.trim() === '' &&
          d.extra_amount === 0;

        if (isAllEmpty && isDeletableRow(rowIdx)) {
          inFlightRef.current.add(rowIdx);
          setRows((prev) => {
            const next = prev.slice();
            next[rowIdx] = { ...prev[rowIdx], saving: true, error: null };
            return next;
          });
          try {
            const res = await fetch(
              `/api/admin/hotel/sales?id=${row.original.id}`,
              { method: 'DELETE' },
            );
            if (!res.ok) {
              const body2 = await res.json().catch(() => ({}));
              throw new Error(body2.error || '삭제 실패');
            }
            // Remove row, shift up, append empty at bottom
            setRows((prev) => {
              const next = prev.slice();
              next.splice(rowIdx, 1);
              next.push(buildRowState(null));
              return next;
            });
            setMounted((prev) => {
              const next = new Set<string>();
              for (const key of prev) {
                const r = parseInt(key.split(':')[0], 10);
                if (r < rowIdx) next.add(key);
              }
              return next;
            });
            setFocused(null);
            setEditing(null);
            onRowSavedRef.current?.(null as unknown as Sale);
          } catch (err) {
            const msg = err instanceof Error ? err.message : '삭제 실패';
            setRows((prev) => {
              const next = prev.slice();
              next[rowIdx] = { ...prev[rowIdx], saving: false, error: msg };
              return next;
            });
          } finally {
            inFlightRef.current.delete(rowIdx);
          }
          return;
        }

        if (!runValidation(rowIdx)) return;
        const body = buildPatchBody(row.original.id, row.draft, row.dirty);
        if (!body) return;
        const sentKeys = Object.keys(body).filter(
          (k) => k !== 'id',
        ) as (keyof RowDraft)[];

        inFlightRef.current.add(rowIdx);
        setRows((prev) => {
          const next = prev.slice();
          next[rowIdx] = { ...prev[rowIdx], saving: true, error: null };
          return next;
        });

        try {
          const res = await fetch('/api/admin/hotel/sales', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const msg = `저장 실패 (${res.status})`;
            setRows((prev) => {
              const next = prev.slice();
              next[rowIdx] = { ...prev[rowIdx], saving: false, error: msg };
              return next;
            });
            return;
          }
          // The API returns the updated row via .select().single(),
          // so we use it as the authoritative snapshot. Falls back
          // to applyDraftToSale if the payload is ever missing.
          let updatedSale: Sale;
          try {
            updatedSale = await res.json();
          } catch {
            updatedSale = applyDraftToSale(row.original, row.draft);
          }
          const savedAt = Date.now();
          setRows((prev) => {
            const next = prev.slice();
            const cur = next[rowIdx];
            if (!cur.original) return prev;
            const newDirty = new Set(cur.dirty);
            for (const k of sentKeys) newDirty.delete(k);
            next[rowIdx] = {
              ...cur,
              original: updatedSale,
              snapshot: { ...cur.draft },
              dirty: newDirty,
              saving: false,
              savedAt,
              error: null,
              fieldErrors: {},
            };
            return next;
          });
          scheduleFlashClear(rowIdx, savedAt);
          onRowSavedRef.current?.(updatedSale);
        } catch (err) {
          const msg = err instanceof Error ? err.message : '네트워크 오류';
          setRows((prev) => {
            const next = prev.slice();
            next[rowIdx] = {
              ...prev[rowIdx],
              saving: false,
              error: `저장 실패: ${msg}`,
            };
            return next;
          });
        } finally {
          inFlightRef.current.delete(rowIdx);
        }
        return;
      }

      // ── Branch B: create brand new row (POST) ──
      // OTA panels (야놀자/여기어때) don't have a channel column,
      // so auto-fill channel from the panel title before checking.
      if (variant === 'ota' && !row.draft.channel) {
        row = { ...row, draft: { ...row.draft, channel: title } };
      }
      // New rows only leave the client once all required fields are
      // filled in; partial rows stay local (with the gold dirty dot)
      // until the user supplies the missing pieces. We silently skip
      // the POST until the staff has typed enough — no red border —
      // because "아직 작성 중"이 정상적인 중간 상태다.
      if (!isRowReadyForCreate(row.draft)) return;
      // Once the row is ready for create, run the full validator so
      // room conflicts (cross-panel) also block the POST.
      if (!runValidation(rowIdx)) return;

      const body = buildCreateBody(row.draft, saleDate, saleType);

      inFlightRef.current.add(rowIdx);
      setRows((prev) => {
        const next = prev.slice();
        next[rowIdx] = { ...prev[rowIdx], saving: true, error: null };
        return next;
      });

      try {
        const res = await fetch('/api/admin/hotel/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const msg = `등록 실패 (${res.status})`;
          setRows((prev) => {
            const next = prev.slice();
            next[rowIdx] = { ...prev[rowIdx], saving: false, error: msg };
            return next;
          });
          return;
        }
        const created: Sale = await res.json();
        const savedAt = Date.now();
        setRows((prev) => {
          const next = prev.slice();
          const cur = next[rowIdx];
          // Use the server's saved row as the new original/snapshot
          // so subsequent edits take the PUT path and the UI shows
          // exactly what made it into the database.
          const newDraft = saleToDraft(created);
          next[rowIdx] = {
            ...cur,
            original: created,
            snapshot: newDraft,
            draft: newDraft,
            dirty: new Set(),
            saving: false,
            savedAt,
            error: null,
            fieldErrors: {},
          };
          return next;
        });
        scheduleFlashClear(rowIdx, savedAt);
        onRowSavedRef.current?.(created);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '네트워크 오류';
        setRows((prev) => {
          const next = prev.slice();
          next[rowIdx] = {
            ...prev[rowIdx],
            saving: false,
            error: `등록 실패: ${msg}`,
          };
          return next;
        });
      } finally {
        inFlightRef.current.delete(rowIdx);
      }
    },
    [saleDate, saleType, scheduleFlashClear, runValidation],
  );

  /**
   * CP4.4 — Immediately save a checkout checkbox toggle.
   *
   * Unlike commitRow this does NOT go through the dirty pipeline: a
   * dedicated PUT is fired as soon as the box is clicked so staff
   * can mark a row checked-out while they are editing a different
   * row. Only works on rows that already exist on the server (new
   * rows cannot be checked-out before they are created).
   */
  const commitCheckout = useCallback(
    async (rowIdx: number, nextCheckedOut: boolean) => {
      const row = rowsRef.current[rowIdx];
      if (!row?.original) return; // new row, ignore
      if (inFlightRef.current.has(rowIdx)) return;

      const newStatus = nextCheckedOut ? 'checked_out' : 'active';
      // Optimistic update so the checkbox flips instantly.
      setRows((prev) => {
        const next = prev.slice();
        const cur = next[rowIdx];
        next[rowIdx] = {
          ...cur,
          draft: { ...cur.draft, checked_out: nextCheckedOut },
          snapshot: { ...cur.snapshot, checked_out: nextCheckedOut },
          saving: true,
          error: null,
        };
        return next;
      });
      inFlightRef.current.add(rowIdx);

      try {
        const res = await fetch('/api/admin/hotel/sales', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: row.original.id, status: newStatus }),
        });
        if (!res.ok) {
          // Roll back the optimistic flip.
          setRows((prev) => {
            const next = prev.slice();
            const cur = next[rowIdx];
            next[rowIdx] = {
              ...cur,
              draft: { ...cur.draft, checked_out: !nextCheckedOut },
              snapshot: { ...cur.snapshot, checked_out: !nextCheckedOut },
              saving: false,
              error: `퇴실 처리 실패 (${res.status})`,
            };
            return next;
          });
          return;
        }
        let updatedSale: Sale;
        try {
          updatedSale = await res.json();
        } catch {
          updatedSale = {
            ...row.original,
            status: newStatus as Sale['status'],
          };
        }
        const savedAt = Date.now();
        setRows((prev) => {
          const next = prev.slice();
          const cur = next[rowIdx];
          next[rowIdx] = {
            ...cur,
            original: updatedSale,
            saving: false,
            savedAt,
            error: null,
          };
          return next;
        });
        scheduleFlashClear(rowIdx, savedAt);
        onRowSavedRef.current?.(updatedSale);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '네트워크 오류';
        setRows((prev) => {
          const next = prev.slice();
          const cur = next[rowIdx];
          next[rowIdx] = {
            ...cur,
            draft: { ...cur.draft, checked_out: !nextCheckedOut },
            snapshot: { ...cur.snapshot, checked_out: !nextCheckedOut },
            saving: false,
            error: `퇴실 처리 실패: ${msg}`,
          };
          return next;
        });
      } finally {
        inFlightRef.current.delete(rowIdx);
      }
    },
    [scheduleFlashClear],
  );

  // ── Row deletion helpers ──

  const cancelPendingDelete = useCallback(() => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDeleteRow(null);
  }, []);

  /**
   * Returns true if the row at `rowIdx` is deletable (has an original
   * sale AND is not a booking-linked or deposit row).
   */
  const isDeletableRow = useCallback(
    (rowIdx: number): boolean => {
      const row = rowsRef.current[rowIdx];
      if (!row?.original) return false;
      if (row.original.booking_id) return false;
      const pt = row.original.payment_timing;
      if (pt && pt !== '현장') return false;
      return true;
    },
    [],
  );

  /**
   * Handle Delete key press (display mode only).
   *  - 1st press: mark row pending (red tint + trash icon, 3s timeout)
   *  - 2nd press within 3s: fire DELETE API and reset row to empty
   */
  const handleDeleteKey = useCallback(
    (rowIdx: number) => {
      if (!isDeletableRow(rowIdx)) return;
      const row = rowsRef.current[rowIdx];
      if (!row?.original) return;

      if (pendingDeleteRow === rowIdx) {
        // ── 2nd Del: execute deletion ──
        cancelPendingDelete();
        setDeletingRow(rowIdx);

        const saleId = row.original.id;
        fetch(`/api/admin/hotel/sales?id=${saleId}`, { method: 'DELETE' })
          .then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || '삭제 실패');
            }
            // Remove the row and shift remaining rows up,
            // then append an empty row at the bottom.
            setRows((prev) => {
              const next = prev.slice();
              next.splice(rowIdx, 1);
              next.push(buildRowState(null));
              return next;
            });
            // Rebuild mounted set: row indices shifted after deletion,
            // so clear all entries at or after the deleted row index.
            setMounted((prev) => {
              const next = new Set<string>();
              for (const key of prev) {
                const r = parseInt(key.split(':')[0], 10);
                if (r < rowIdx) next.add(key);
              }
              return next;
            });
            // Clear focus so it doesn't point at a shifted row
            setFocused(null);
            setEditing(null);
            // Notify sibling panels
            onRowSavedRef.current?.(null as unknown as Sale);
          })
          .catch((err) => {
            setRows((prev) => {
              const next = prev.slice();
              const cur = next[rowIdx];
              next[rowIdx] = { ...cur, error: String(err.message || '삭제 실패') };
              return next;
            });
          })
          .finally(() => setDeletingRow(null));
      } else {
        // ── 1st Del: mark pending ──
        cancelPendingDelete();
        setPendingDeleteRow(rowIdx);
        deleteTimerRef.current = setTimeout(() => {
          setPendingDeleteRow(null);
          deleteTimerRef.current = null;
        }, 3000);
      }
    },
    [pendingDeleteRow, cancelPendingDelete, isDeletableRow],
  );

  // Cancel pending delete when focus moves to a different row or any
  // other key is pressed.
  const cancelDeleteOnInteraction = useCallback(() => {
    if (pendingDeleteRow !== null) cancelPendingDelete();
  }, [pendingDeleteRow, cancelPendingDelete]);

  /** Apply a focus change. `alsoEdit=true` enters edit mode (Tab/click/typing). */
  const focusCell = useCallback(
    (row: number, col: number, alsoEdit: boolean) => {
      const r = Math.max(0, Math.min(ROW_COUNT - 1, row));
      const c = Math.max(0, Math.min(colCount - 1, col));
      // Capture the row we are leaving before we overwrite the ref.
      const prevRow = focusedRowRef.current;

      // Cancel pending delete when moving to a different row
      if (prevRow !== r) cancelDeleteOnInteraction();

      ensureMounted(r, c);
      setFocused({ row: r, col: c });
      focusedRowRef.current = r;
      if (alsoEdit) {
        // Snapshot the row's current draft so Esc can restore it.
        setRows((prev) => {
          const cur = prev[r];
          if (cur.snapshot === cur.draft) return prev; // already in sync
          const next = prev.slice();
          next[r] = { ...cur, snapshot: { ...cur.draft } };
          return next;
        });
        setEditing({ row: r, col: c });
      } else {
        setEditing(null);
      }

      // CP4.1 — If we just left a different row, schedule its commit.
      // We can't call commitRow synchronously here because setField
      // from the same event hasn't been flushed yet, so rowsRef still
      // carries the previous dirty set. Instead we append the row to
      // a pendingCommits state; the useEffect below drains it after
      // React has reconciled, which guarantees rowsRef is up to date.
      if (prevRow != null && prevRow !== r) {
        const committing = prevRow;
        setPendingCommits((prev) => {
          if (prev.has(committing)) return prev;
          const next = new Set(prev);
          next.add(committing);
          return next;
        });
      }
    },
    [colCount, ensureMounted],
  );

  // Drain the pending commit queue after every render. Because this
  // runs in useEffect (post-commit phase), any setField that happened
  // in the triggering event has already been flushed and rowsRef is
  // fresh, so commitRow sees the correct dirty set.
  useEffect(() => {
    if (pendingCommits.size === 0) return;
    const toRun = Array.from(pendingCommits);
    setPendingCommits(new Set());
    for (const rowIdx of toRun) {
      void commitRow(rowIdx);
    }
  }, [pendingCommits, commitRow]);

  // CP4.3 — Notify the parent whenever this panel's unsaved state
  // transitions. We derive the aggregate from `rows` (post render)
  // and only call the callback when it flips, so the parent's
  // beforeunload guard does not re-render every keystroke.
  const aggregatedDirty = useMemo(
    () => rows.some((r) => r.dirty.size > 0 || r.saving),
    [rows],
  );
  const prevDirtyRef = useRef(false);
  useEffect(() => {
    if (!onDirtyChange || !panelKey) return;
    if (prevDirtyRef.current === aggregatedDirty) return;
    prevDirtyRef.current = aggregatedDirty;
    onDirtyChange(panelKey, aggregatedDirty);
  }, [aggregatedDirty, onDirtyChange, panelKey]);
  // When the panel unmounts (e.g. mobile fallback switch, route
  // change) make sure the parent drops our dirty flag so it does not
  // block unload with a ghost reference.
  useEffect(() => {
    return () => {
      if (onDirtyChange && panelKey && prevDirtyRef.current) {
        onDirtyChange(panelKey, false);
      }
    };
  }, [onDirtyChange, panelKey]);

  // Car number auto-fill: debounce timer per row
  const carLookupTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const setField = useCallback(
    <K extends keyof RowDraft>(rowIdx: number, key: K, value: RowDraft[K]) => {
      setRows((prev) => {
        const cur = prev[rowIdx];
        if (cur.draft[key] === value) return prev;
        // CP4.5 — Record an undo entry unless we are currently
        // replaying one (in which case the new value IS the undo
        // result and must not feed back into the stack).
        if (!replayingUndoRef.current) {
          const entry: UndoEntry = { rowIdx, key, prev: cur.draft[key] };
          if (pendingBatchRef.current) {
            // Part of a batch (e.g. in-flight paste) — append to it
            pendingBatchRef.current.push(entry);
          } else {
            // Standalone edit — wrap in a singleton batch so the
            // undo stack is uniformly "array of batches".
            const stack = undoStackRef.current;
            stack.push([entry]);
            if (stack.length > MAX_UNDO) stack.shift();
          }
        }
        const next = prev.slice();
        const dirty = new Set(cur.dirty);
        dirty.add(key);
        // Typing into a previously-flagged cell clears its field error
        // so the user gets immediate positive feedback.
        const fieldErrors = { ...cur.fieldErrors };
        if (fieldErrors[key]) delete fieldErrors[key];

        const newDraft = { ...cur.draft, [key]: value };

        // Auto-fill car_number when guest_name changes (debounced)
        if (key === 'guest_name' && !cur.draft.car_number) {
          const name = (value as string).trim();
          const timers = carLookupTimerRef.current;
          if (timers[rowIdx]) clearTimeout(timers[rowIdx]);
          if (name.length >= 2) {
            timers[rowIdx] = setTimeout(() => {
              delete timers[rowIdx];
              fetch(`/api/admin/hotel/car-lookup?name=${encodeURIComponent(name)}`)
                .then((r) => r.json())
                .then((d) => {
                  if (d.car_number) {
                    setRows((p) => {
                      const r = p[rowIdx];
                      if (!r || r.draft.car_number) return p;
                      const n = p.slice();
                      const ds = new Set(r.dirty);
                      ds.add('car_number');
                      n[rowIdx] = {
                        ...r,
                        draft: { ...r.draft, car_number: d.car_number },
                        dirty: ds,
                      };
                      return n;
                    });
                  }
                })
                .catch(() => {});
            }, 500);
          }
        }

        next[rowIdx] = {
          ...cur,
          draft: newDraft,
          dirty,
          fieldErrors,
          // Typing into a cell clears any lingering save error for
          // that row — the user is taking corrective action.
          error: null,
        };
        return next;
      });
    },
    [],
  );

  // Booking UUID check — still needed by pasteFromClipboard to
  // skip multi-night rows during paste operations.
  const isConnectedBookingRow = useCallback(
    (sale: Sale | null): boolean => {
      if (!sale) return false;
      const bid = sale.booking_id;
      return (
        typeof bid === 'string' &&
        bid.length >= 32 &&
        /^[0-9a-f-]+$/i.test(bid)
      );
    },
    [],
  );

  // ── CP4.5 — batch helpers for the undo stack ──
  const beginBatch = useCallback(() => {
    pendingBatchRef.current = [];
  }, []);
  const endBatch = useCallback(() => {
    const b = pendingBatchRef.current;
    pendingBatchRef.current = null;
    if (!b || b.length === 0) return;
    const stack = undoStackRef.current;
    stack.push(b);
    if (stack.length > MAX_UNDO) stack.shift();
  }, []);

  // CP4.5 — Ctrl+A select all cells in this panel.
  const selectAll = useCallback(() => {
    setSelection({
      anchor: { row: 0, col: 0 },
      focus: { row: ROW_COUNT - 1, col: colCount - 1 },
    });
  }, [colCount]);

  // CP4.5 — Ctrl+C. Serialises the current selection (or the single
  // focused cell if no multi-cell selection exists) to TSV and writes
  // it to the clipboard. Reads the CURRENT draft values so staff see
  // exactly what they typed, not the pre-save original.
  //
  // Uses `selectionRef` / `focusedFullRef` instead of the captured
  // `selection` / `focused` state so that the value observed inside
  // an async keydown handler reflects the latest setState result,
  // not a stale closure from a prior render.
  const copyToClipboard = useCallback(async () => {
    const sel = selectionRef.current;
    const foc = focusedFullRef.current;
    let r0: number, r1: number, c0: number, c1: number;
    if (sel) {
      ({ r0, r1, c0, c1 } = rectFromSelection(sel));
    } else if (foc) {
      r0 = r1 = foc.row;
      c0 = c1 = foc.col;
    } else {
      return;
    }
    const lines: string[] = [];
    for (let r = r0; r <= r1; r++) {
      const row = rowsRef.current[r];
      if (!row) continue;
      const cells: string[] = [];
      for (let c = c0; c <= c1; c++) {
        const col = columns[c];
        if (!col) continue;
        cells.push(serializeForCopy(col.key, row.draft[col.key]));
      }
      lines.push(cells.join('\t'));
    }
    const tsv = lines.join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      // Clipboard API may be blocked in non-secure contexts. Fall
      // back to a hidden textarea + execCommand. This still works on
      // http://localhost and on Vercel HTTPS deployments both.
      const ta = document.createElement('textarea');
      ta.value = tsv;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, [columns]);

  // CP4.5 — Ctrl+V. Reads TSV from the clipboard and writes it into
  // cells starting at the focused cell (top-left). New 연박 rows are
  // skipped entirely so the modal-only contract from CP5 holds. Each
  // pasted cell goes through setField, so dirty tracking, validation
  // and the per-row commit pipeline all run automatically.
  const pasteFromClipboard = useCallback(async () => {
    const foc = focusedFullRef.current;
    if (!foc) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const grid = parseTSV(text);
    if (grid.length === 0) return;

    const startRow = foc.row;
    const startCol = foc.col;
    const affectedRows = new Set<number>();

    // Generic-widening shim so we can feed coerced paste values
    // through the strongly-typed setField without a per-key switch.
    const applyField = setField as (
      rowIdx: number,
      key: keyof RowDraft,
      value: RowDraft[keyof RowDraft],
    ) => void;

    beginBatch();
    try {
      for (let dr = 0; dr < grid.length; dr++) {
        const targetRow = startRow + dr;
        if (targetRow >= ROW_COUNT) break;
        const rowState = rowsRef.current[targetRow];
        if (!rowState) continue;
        // Multi-night rows are owned by the Legacy SaleModal (CP5).
        // Skip every cell on them so accidental paste cannot break
        // booking_id consistency.
        if (rowState.original && isConnectedBookingRow(rowState.original)) {
          continue;
        }
        const srcCols = grid[dr];
        for (let dc = 0; dc < srcCols.length; dc++) {
          const targetCol = startCol + dc;
          if (targetCol >= colCount) break;
          const col = columns[targetCol];
          if (!col) continue;
          // `checked_out` has its own endpoint — never flipped via paste.
          if (col.key === 'checked_out') continue;
          const coerced = coerceForPaste(col.key, srcCols[dc]);
          if (coerced === undefined) continue;
          applyField(targetRow, col.key, coerced);
          affectedRows.add(targetRow);
        }
      }
    } finally {
      endBatch();
    }

    // Expand selection to the rectangle that was actually pasted so
    // the user sees what landed where.
    const lastRow = Math.min(startRow + grid.length - 1, ROW_COUNT - 1);
    const maxCols = Math.max(...grid.map((r) => r.length), 1);
    const lastCol = Math.min(startCol + maxCols - 1, colCount - 1);
    setSelection({
      anchor: { row: startRow, col: startCol },
      focus: { row: lastRow, col: lastCol },
    });

    // Queue commits for every row we touched. CP4's useEffect drain
    // then takes each row through PATCH / POST exactly like a manual
    // Tab-out would.
    if (affectedRows.size > 0) {
      setPendingCommits((prev) => {
        const next = new Set(prev);
        for (const r of affectedRows) next.add(r);
        return next;
      });
    }
  }, [
    colCount,
    columns,
    setField,
    beginBatch,
    endBatch,
    isConnectedBookingRow,
  ]);

  // CP4.5 — Ctrl+Z. Pops one batch off the undo stack and re-plays
  // each entry in reverse order via setField. Because setField
  // consults `replayingUndoRef`, the replay itself does NOT push new
  // undo entries, and the existing dirty/commit pipeline re-sends a
  // PUT with the restored value (even for rows that had already been
  // saved — matching the "undo reaches the server" requirement).
  const undoOne = useCallback(() => {
    const stack = undoStackRef.current;
    const batch = stack.pop();
    if (!batch || batch.length === 0) return;
    const affectedRows = new Set<number>();
    replayingUndoRef.current = true;
    try {
      for (let i = batch.length - 1; i >= 0; i--) {
        const e = batch[i];
        // The entry's `prev` is typed as the union of all possible
        // RowDraft value types; we trust that at record time the
        // (key, value) pair was compatible, so a cast through a
        // generic shim is safe here.
        const applyField = setField as (
          rowIdx: number,
          key: keyof RowDraft,
          value: RowDraft[keyof RowDraft],
        ) => void;
        applyField(e.rowIdx, e.key, e.prev);
        affectedRows.add(e.rowIdx);
      }
    } finally {
      replayingUndoRef.current = false;
    }
    if (affectedRows.size > 0) {
      setPendingCommits((prev) => {
        const next = new Set(prev);
        for (const r of affectedRows) next.add(r);
        return next;
      });
    }
  }, [setField]);

  // Navigation handlers (called from cells via onMove / onTab)
  const move = useCallback(
    (from: FocusPos, dir: CellDirection) => {
      let { row, col } = from;
      if (dir === 'up') row -= 1;
      else if (dir === 'down') row += 1;
      else if (dir === 'left') col -= 1;
      else if (dir === 'right') col += 1;
      focusCell(row, col, false);
    },
    [focusCell],
  );

  // Tab cycles strictly within this panel: the last cell (last row,
  // last col) wraps back to the first cell (0, 0), and Shift+Tab from
  // (0, 0) wraps to the last cell. This intentionally isolates focus
  // from other panels — cross-panel movement is mouse-only (req. CP3).
  const tab = useCallback(
    (from: FocusPos, shift: boolean) => {
      let { row, col } = from;
      if (shift) {
        col -= 1;
        if (col < 0) {
          col = colCount - 1;
          row -= 1;
          if (row < 0) row = ROW_COUNT - 1; // wrap to last cell
        }
      } else {
        col += 1;
        if (col > colCount - 1) {
          col = 0;
          row += 1;
          if (row > ROW_COUNT - 1) row = 0; // wrap to first cell
        }
      }
      focusCell(row, col, true);
    },
    [colCount, focusCell],
  );

  // Cell-level callbacks
  const handleRequestEdit = useCallback(
    (row: number, col: number) => {
      // CP4.5 — if this click is the tail end of a shift-click or
      // drag-to-select, do NOT enter edit mode.
      if (suppressNextEditRef.current) {
        suppressNextEditRef.current = false;
        return;
      }
      focusCell(row, col, true);
    },
    [focusCell],
  );

  const handleCommit = useCallback(() => {
    // CP 2: just exit edit mode.
    // CP 4 will receive (row, col), diff against the snapshot, and
    // dispatch PATCH (existing row) or POST (new row).
    setEditing(null);
  }, []);

  const handleCancel = useCallback(
    (row: number, col: number) => {
      // Restore the single field from the row snapshot and drop it
      // from the dirty set so the deferred commit does not re-send it.
      setRows((prev) => {
        const cur = prev[row];
        const colDef = columns[col];
        const restoredVal = cur.snapshot[colDef.key];
        if (cur.draft[colDef.key] === restoredVal) {
          return prev;
        }
        const next = prev.slice();
        const dirty = new Set(cur.dirty);
        dirty.delete(colDef.key);
        next[row] = {
          ...cur,
          draft: { ...cur.draft, [colDef.key]: restoredVal } as RowDraft,
          dirty,
        };
        return next;
      });
      setEditing(null);
    },
    [columns],
  );

  // ── CP4.5 — cell mousedown bridge ──
  //
  // Fired from each cell wrapper in GridRow. Handles:
  //   • Shift+click → extend the current selection (or build a new
  //     one using the current focused cell as anchor).
  //   • Plain click → record a potential drag start and collapse
  //     any existing selection. The actual edit-mode entry still
  //     happens in the cell's onClick → handleRequestEdit path.
  // Ctrl/Meta+click is intercepted earlier by
  // `handleRowMouseDownCapture` (CP5, opens the modal), so we do
  // not need to handle it here.
  const handleCellMouseDown = useCallback(
    (row: number, col: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) return; // modal path, not selection

      // CP4.5 — Make sure the panel container owns `activeElement`
      // no matter what the click does next. This is the key that
      // makes Ctrl+C / V / Z / A fire reliably: the document-level
      // keydown listener only responds when focus is inside this
      // panel, and without an explicit panelRef.focus() shift-click
      // tends to land focus on document.body.
      panelRef.current?.focus({ preventScroll: true });

      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        // Use the existing selection anchor if any, otherwise the
        // currently focused cell, otherwise the clicked cell.
        const curSel = selectionRef.current;
        const curFoc = focusedFullRef.current;
        const anchor: FocusPos =
          curSel?.anchor ??
          (curFoc != null
            ? { row: curFoc.row, col: curFoc.col }
            : { row, col });
        setSelection({ anchor, focus: { row, col } });
        // Move single-cell focus to the shift-clicked endpoint so
        // that a subsequent Ctrl+C with no multi-cell selection
        // copies the right cell.
        setFocused({ row, col });
        focusedRowRef.current = row;
        // The click that follows this mousedown would otherwise
        // kick off cell editing — suppress it.
        suppressNextEditRef.current = true;
        return;
      }

      // Plain click — clear any stale "suppress next edit" flag left
      // over from a previous drag that ended without a click event
      // reaching a cell. Without this reset a drag-then-click on a
      // different cell would swallow the click silently.
      suppressNextEditRef.current = false;
      dragStartRef.current = { row, col };
      isDraggingRef.current = false;
      if (selectionRef.current) setSelection(null);
    },
    [],
  );

  // CP4.5 — document-level mouse listeners for drag-to-select.
  // Mounted once per panel; they early-return unless `dragStartRef`
  // is set, so there is no cost when nothing is being dragged.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !panelRef.current?.contains(el)) return;
      // Walk up until we find a node with data-row / data-col attrs.
      let node: Element | null = el;
      while (node && node instanceof HTMLElement) {
        if (node.dataset.row != null && node.dataset.col != null) break;
        node = node.parentElement;
      }
      if (!node || !(node instanceof HTMLElement)) return;
      const r = parseInt(node.dataset.row ?? '', 10);
      const c = parseInt(node.dataset.col ?? '', 10);
      if (!Number.isFinite(r) || !Number.isFinite(c)) return;
      const start = dragStartRef.current;
      if (r !== start.row || c !== start.col) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current) {
        setSelection({ anchor: start, focus: { row: r, col: c } });
      }
    };
    const onUp = () => {
      if (isDraggingRef.current) {
        // Block the trailing cell click that would otherwise slide
        // into edit mode on the drag-end cell.
        suppressNextEditRef.current = true;
      }
      dragStartRef.current = null;
      isDraggingRef.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  // CP4.5 — document-level keyboard shortcuts. Every panel registers
  // its own listener; each gates on `panelRef.current.contains(
  // document.activeElement)` so only the active panel acts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(document.activeElement)) return;

      // If the user is inside an editable input (cell edit mode,
      // modal field, etc.) let the native shortcut run so they can
      // copy/paste/undo inside that input normally.
      const ae = document.activeElement as HTMLElement | null;
      const tag = ae?.tagName;
      const inEditable =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      switch (e.key.toLowerCase()) {
        case 'c':
          if (inEditable) return;
          e.preventDefault();
          void copyToClipboard();
          return;
        case 'v':
          if (inEditable) return;
          e.preventDefault();
          void pasteFromClipboard();
          return;
        case 'z':
          if (inEditable) return;
          e.preventDefault();
          undoOne();
          return;
        case 'a':
          if (inEditable) return;
          e.preventDefault();
          selectAll();
          return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [copyToClipboard, pasteFromClipboard, undoOne, selectAll]);

  // Compute total content width for the inner scroll container.
  const totalWidth = useMemo(
    () => 28 /* # column */ + columns.reduce((s, c) => s + c.width, 0),
    [columns],
  );

  // Subtotal — always reflects the live draft so new rows and edits
  // show up immediately. A row counts as "filled" if any key field
  // has content (amount, guest name, or room number). This matches
  // how staff read the panel: anything visible as data is a 건.
  const filledCount = rows.filter(
    (r) =>
      r.draft.amount > 0 ||
      r.draft.guest_name.trim() !== '' ||
      r.draft.room_number.trim() !== '',
  ).length;
  const baseSubtotal = rows.reduce(
    (s, r) => s + (r.draft.amount || 0),
    0,
  );
  const extraSubtotal = rows.reduce(
    (s, r) => s + (r.draft.extra_amount || 0),
    0,
  );
  const subtotal = baseSubtotal + extraSubtotal;

  return (
    <div
      ref={panelRef}
      // tabIndex=-1 makes the panel programmatically focusable (not
      // via Tab) so that CP4.5 can guarantee `document.activeElement`
      // is inside this panel when the user performs Ctrl+C / V / Z /
      // A. Staff never see a focus ring on the panel itself because
      // tabIndex=-1 only fires `focus()` calls we make.
      tabIndex={-1}
      className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col outline-none"
    >
      {/* Panel header */}
      <div
        className={`${
          saleType === '대실' ? 'bg-emerald-100' : 'bg-blue-100'
        } px-3 py-1.5 flex items-center gap-2`}
      >
        <span className="font-bold text-sm">{title}</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            saleType === '대실'
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-blue-200 text-blue-800'
          }`}
        >
          {saleType}
        </span>
        <span className="text-xs text-gray-600">({filledCount}건)</span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-xs text-gray-600 hover:text-gray-900 px-1.5 py-0.5 rounded hover:bg-white/60"
          title={collapsed ? '전체 펼치기' : '접기'}
          aria-label={collapsed ? '전체 펼치기' : '접기'}
        >
          {collapsed ? `▼ 전체보기 (${ROW_COUNT}행)` : `▲ 접기 (${collapsedRows}행)`}
        </button>
      </div>

      {/* Grid area. No visible horizontal scrollbar — the column widths
          are sized to fit 4× at typical panel widths, and any slight
          overflow is hidden with CSS. Browsers still let keyboard focus
          scroll into view via scrollIntoView(inline:'nearest'). */}
      <div className="overflow-x-hidden">
        <div style={{ minWidth: totalWidth }}>
          {/* Column headers */}
          <div className="flex bg-gray-100 text-[10px] text-gray-600 border-b border-gray-200">
            <div
              className="shrink-0 px-1 py-1 text-center whitespace-nowrap"
              style={{ width: 28 }}
            >
              #
            </div>
            {columns.map((c) => (
              <div
                key={c.key}
                className={`shrink-0 px-1 py-1 whitespace-nowrap overflow-hidden ${
                  c.align === 'right'
                    ? 'text-right'
                    : c.align === 'center'
                    ? 'text-center'
                    : 'text-left'
                }`}
                style={{ width: c.width }}
              >
                {c.header}
              </div>
            ))}
          </div>

          {/* Rows — collapsed view caps visible rows (7 for 대실,
              20 for 숙박) and adds vertical scroll. Expanded view
              renders all 40 rows at full height. */}
          <div
            style={
              collapsed
                ? {
                    maxHeight: collapsedRows * ROW_HEIGHT_PX,
                    overflowY: 'auto',
                  }
                : undefined
            }
          >
          {(() => {
            // CP4.5 — pre-compute the selection rectangle once so
            // every row only needs a cheap containment check.
            const selRect = selection ? rectFromSelection(selection) : null;
            return rows.map((row, rowIdx) => {
              const focusedCol = focused?.row === rowIdx ? focused.col : null;
              const editingCol = editing?.row === rowIdx ? editing.col : null;
              const flags = computeRowFlags(row.original);
              const bPrefix = bookingMemoPrefix(row.original, bookingsMap);
              const pPrefix = paymentMemoPrefix(row.original);
              const rowInSel =
                selRect !== null &&
                rowIdx >= selRect.r0 &&
                rowIdx <= selRect.r1;
              return (
                <GridRow
                  key={rowIdx}
                  rowIdx={rowIdx}
                  draft={row.draft}
                  hasOriginal={row.original !== null}
                  columns={columns}
                  focusedCol={focusedCol}
                  editingCol={editingCol}
                  mounted={mounted}
                  isDirty={row.dirty.size > 0}
                  isSaving={row.saving}
                  justSaved={row.savedAt !== null}
                  errorMessage={row.error}
                  fieldErrors={row.fieldErrors}
                  flags={flags}
                  bookingPrefix={bPrefix}
                  paymentPrefix={pPrefix}
                  isPendingDelete={pendingDeleteRow === rowIdx}
                  isDeleting={deletingRow === rowIdx}
                  selRect={rowInSel ? selRect : null}
                  setField={setField}
                  onCheckoutToggle={commitCheckout}
                  onRequestEdit={handleRequestEdit}
                  onCommit={handleCommit}
                  onCancel={handleCancel}
                  onMove={(col, dir) => move({ row: rowIdx, col }, dir)}
                  onTab={(col, shift) => tab({ row: rowIdx, col }, shift)}
                  onRetry={commitRow}
                  onCellMouseDown={handleCellMouseDown}
                />
              );
            });
          })()}
          </div>
        </div>
      </div>

      {/* Panel footer */}
      <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-600 flex items-center justify-between gap-3 border-t border-gray-200">
        <span>소계: {filledCount}건</span>
        <span className="flex items-center gap-3">
          <span className="text-gray-500">
            금액{' '}
            <b className="text-gray-800">
              {baseSubtotal.toLocaleString('ko-KR')}
            </b>
            원
          </span>
          {extraSubtotal > 0 && (
            <span className="text-gray-500">
              추금액{' '}
              <b className="text-yellow-700">
                {extraSubtotal.toLocaleString('ko-KR')}
              </b>
              원
            </span>
          )}
          <span className="font-medium text-[#C9A84C]">
            합계 {subtotal.toLocaleString('ko-KR')}원
          </span>
        </span>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GridRow — 40x rendered, memo-ed to skip work for untouched rows
// ─────────────────────────────────────────────────────────────

interface GridRowProps {
  rowIdx: number;
  draft: RowDraft;
  hasOriginal: boolean;
  columns: ColumnDef[];
  focusedCol: number | null;
  editingCol: number | null;
  mounted: Set<string>;
  /** Any field dirty in this row — shows the gold dot indicator. */
  isDirty: boolean;
  /** Row has a PATCH/POST in flight — shows the spinner. */
  isSaving: boolean;
  /** True during the 0.5 s green flash after a successful save. */
  justSaved: boolean;
  /** Non-null → last save failed; shows the red retry button. */
  errorMessage: string | null;
  /** Per-field validation errors. Drives red borders/tooltips. */
  fieldErrors: Partial<Record<keyof RowDraft, string>>;
  /** Row flags used to color the 성명 / 금액 cells. */
  flags: RowFlags;
  /** Booking memo prefix (e.g. "12-15(퇴)3박") for the memo column. */
  bookingPrefix: string;
  /** Payment memo prefix (e.g. "예약 20,000"). */
  paymentPrefix: { text: string; colorClass: string };
  /** Row is in "pending delete" state (1st Del pressed, waiting for 2nd). */
  isPendingDelete: boolean;
  /** Row is currently being deleted (DELETE API in flight). */
  isDeleting: boolean;
  setField: <K extends keyof RowDraft>(
    rowIdx: number,
    key: K,
    value: RowDraft[K],
  ) => void;
  onCheckoutToggle: (row: number, next: boolean) => void;
  onRequestEdit: (row: number, col: number) => void;
  onCommit: () => void;
  onCancel: (row: number, col: number) => void;
  onMove: (col: number, dir: CellDirection) => void;
  onTab: (col: number, shift: boolean) => void;
  onRetry: (row: number) => void;
  /** CP4.5 — selection rectangle that THIS row intersects, or null
   *  when the row is outside the current selection. Passed as a
   *  normalised {r0,r1,c0,c1} so the row only does cheap arithmetic
   *  to decide which cells get the blue tint / edge borders. */
  selRect: { r0: number; r1: number; c0: number; c1: number } | null;
  /** CP4.5 — mousedown handler wired at the cell level for
   *  shift-click (extend selection) and plain-click drag start. */
  onCellMouseDown: (row: number, col: number, e: React.MouseEvent) => void;
}

const GridRow = React.memo(function GridRow(props: GridRowProps) {
  const {
    rowIdx,
    draft,
    hasOriginal,
    columns,
    focusedCol,
    editingCol,
    mounted,
    isDirty,
    isSaving,
    justSaved,
    errorMessage,
    fieldErrors,
    flags,
    bookingPrefix,
    paymentPrefix,
    selRect,
    setField,
    onCheckoutToggle,
    onRequestEdit,
    onCommit,
    onCancel,
    onMove,
    onTab,
    onRetry,
    onCellMouseDown,
  } = props;

  const { isPendingDelete, isDeleting } = props;

  // Bind row index into the field setter so each cell column only sees
  // a 2-arg signature.
  const setFieldForRow = useCallback(
    <K extends keyof RowDraft>(key: K, value: RowDraft[K]) =>
      setField(rowIdx, key, value),
    [rowIdx, setField],
  );

  // Row tint: green wash during the brief post-save confirmation.
  // The dirty/saving/error states are surfaced in the # column badge
  // so they don't fight the focused cell's gold outline.
  const rowTint = isPendingDelete
    ? 'bg-red-50 border-red-300'
    : isDeleting
    ? 'bg-red-100 opacity-60'
    : justSaved
    ? 'bg-green-50'
    : hasOriginal
    ? ''
    : 'bg-white';

  return (
    <div
      className={`flex border-b ${isPendingDelete ? 'border-red-300' : 'border-gray-100'} ${rowTint} hover:bg-gray-50/50 transition-colors`}
    >
      <div
        className="shrink-0 px-1 text-center text-[11px] leading-6"
        style={{ width: 28 }}
        title={isPendingDelete ? '한 번 더 Del 키를 누르면 삭제됩니다' : errorMessage ?? undefined}
      >
        {isPendingDelete ? (
          <span className="text-red-500" title="한 번 더 Del 키를 누르면 삭제됩니다">🗑️</span>
        ) : isDeleting ? (
          <span
            aria-label="삭제 중"
            className="inline-block w-3 h-3 rounded-full border-2 border-red-300 border-t-red-600 animate-spin align-middle"
          />
        ) : (
          <RowStatusIndicator
            rowIdx={rowIdx}
            isDirty={isDirty}
            isSaving={isSaving}
            justSaved={justSaved}
            errorMessage={errorMessage}
            onRetry={() => onRetry(rowIdx)}
          />
        )}
      </div>
      {columns.map((col, colIdx) => {
        const k = `${rowIdx}:${colIdx}`;
        const isMounted = mounted.has(k);
        const isFocused = focusedCol === colIdx;
        const isEditing = editingCol === colIdx;
        const cellError = fieldErrors[col.key] ?? null;
        // CP4.5 — selection visuals
        const inSelection =
          selRect !== null && colIdx >= selRect.c0 && colIdx <= selRect.c1;
        const selTopEdge = inSelection && rowIdx === selRect!.r0;
        const selBottomEdge = inSelection && rowIdx === selRect!.r1;
        const selLeftEdge = inSelection && colIdx === selRect!.c0;
        const selRightEdge = inSelection && colIdx === selRect!.c1;
        const selClass = inSelection
          ? [
              'bg-blue-400/15',
              selTopEdge ? 'border-t-2 border-t-blue-500' : '',
              selBottomEdge ? 'border-b-2 border-b-blue-500' : '',
              selLeftEdge ? 'border-l-2 border-l-blue-500' : '',
              selRightEdge ? 'border-r-2 border-r-blue-500' : '',
            ].join(' ')
          : '';
        return (
          <div
            key={col.key}
            className={`shrink-0 ${selClass}`}
            style={{ width: col.width }}
            data-row={rowIdx}
            data-col={colIdx}
            onMouseDown={(e) => onCellMouseDown(rowIdx, colIdx, e)}
          >
            {isMounted ? (
              col.render({
                draft,
                setField: setFieldForRow,
                onCheckoutToggle: (next) => onCheckoutToggle(rowIdx, next),
                flags,
                bookingPrefix,
                paymentPrefix,
                cellProps: {
                  isFocused,
                  isEditing,
                  error: cellError,
                  onRequestEdit: () => onRequestEdit(rowIdx, colIdx),
                  onCommit: () => onCommit(),
                  onCancel: () => onCancel(rowIdx, colIdx),
                  onMove: (dir) => onMove(colIdx, dir),
                  onTab: (shift) => onTab(colIdx, shift),
                },
              })
            ) : (
              <LightweightCell
                draft={draft}
                col={col}
                isFocused={isFocused}
                hasError={cellError !== null}
                textClassName={
                  col.key === 'guest_name'
                    ? flags.nameColor ?? undefined
                    : col.key === 'amount'
                    ? flags.amountColor ?? undefined
                    : col.key === 'memo' && (bookingPrefix || paymentPrefix.text)
                    ? bookingPrefix
                      ? 'text-purple-700'
                      : paymentPrefix.colorClass || undefined
                    : undefined
                }
                displayOverride={
                  col.key === 'memo' && (bookingPrefix || paymentPrefix.text)
                    ? [bookingPrefix, paymentPrefix.text, draft.memo]
                        .filter(Boolean)
                        .join(' ') || undefined
                    : undefined
                }
                onClick={() => onRequestEdit(rowIdx, colIdx)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// RowStatusIndicator — # column badge reflecting row save state
// ─────────────────────────────────────────────────────────────

interface RowStatusIndicatorProps {
  rowIdx: number;
  isDirty: boolean;
  isSaving: boolean;
  justSaved: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

function RowStatusIndicator({
  rowIdx,
  isDirty,
  isSaving,
  justSaved,
  errorMessage,
  onRetry,
}: RowStatusIndicatorProps) {
  if (isSaving) {
    return (
      <span
        aria-label="저장 중"
        className="inline-block w-3 h-3 rounded-full border-2 border-gray-300 border-t-[#C9A84C] animate-spin align-middle"
      />
    );
  }
  if (errorMessage) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="text-red-600 font-bold leading-none"
        title={`${errorMessage} — 클릭하여 재시도`}
        aria-label="저장 실패, 재시도"
      >
        ⚠
      </button>
    );
  }
  if (justSaved) {
    return <span className="text-green-600 font-bold">✓</span>;
  }
  if (isDirty) {
    return <span className="text-[#C9A84C] font-bold">•</span>;
  }
  return <span className="text-gray-400">{rowIdx + 1}</span>;
}

// ─────────────────────────────────────────────────────────────
// LightweightCell — display-only div, used until first interaction
// ─────────────────────────────────────────────────────────────

interface LightweightCellProps {
  draft: RowDraft;
  col: ColumnDef;
  isFocused: boolean;
  hasError: boolean;
  /** Optional tint class for the 성명 / 금액 / memo columns. */
  textClassName?: string;
  /** Override the display string (e.g. booking prefix + memo). */
  displayOverride?: string;
  onClick: () => void;
}

function LightweightCell({
  draft,
  col,
  isFocused,
  hasError,
  textClassName,
  displayOverride,
  onClick,
}: LightweightCellProps) {
  const value = draft[col.key];
  let display = '';
  if (displayOverride != null) {
    display = displayOverride;
  } else if (value == null || value === '' || value === 0 || value === false) {
    display = '';
  } else if (typeof value === 'number') {
    display = value.toLocaleString('ko-KR');
  } else if (typeof value === 'boolean') {
    display = value ? '☑' : '';
  } else {
    display = String(value);
  }

  const align =
    col.align === 'right'
      ? 'text-right justify-end'
      : col.align === 'center'
      ? 'text-center justify-center'
      : 'text-left justify-start';

  const borderClass = hasError
    ? 'border-red-500 bg-red-50'
    : isFocused
    ? 'border-[#C9A84C] bg-[#C9A84C]/10'
    : 'border-transparent hover:bg-gray-100';

  return (
    <div
      onClick={onClick}
      className={`h-6 px-1 text-xs flex items-center cursor-text border ${align} ${borderClass}`}
    >
      {display && (
        <span className={`truncate w-full ${textClassName ?? ''}`}>
          {display}
        </span>
      )}
    </div>
  );
}
