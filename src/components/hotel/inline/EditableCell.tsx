'use client';

// ═══════════════════════════════════════════════════════════════
// EditableCell — 5 cell variants for the Excel-style sales grid
// (Phase 1 MVP — Checkpoint 1)
//
// Variants:
//   1. TextCell    — 성명, 차번호, 비고(메모)
//   2. NumberCell  — 금액(입금가), 추금액
//   3. TimeCell    — 입실, 퇴실 (0~24, 0.5 단위)
//   4. SelectCell  — 타입, 호실, 결제수단, 구분(채널)
//   5. CheckCell   — 퇴실 체크박스
//
// All variants share `BaseCellProps` for navigation/edit lifecycle.
// They are intentionally controlled — focus / edit state is owned by
// the parent grid (built in Checkpoint 2). The cells just render
// according to props and emit semantic events upward.
//
// Key design decisions:
// • Display mode = focusable <div> (tabIndex=0) catching keyboard
//   navigation events.
// • Edit mode    = real input/select element with autoFocus.
// • Korean IME safe: Enter is ignored while compositionend has not
//   fired (e.nativeEvent.isComposing OR keyCode 229).
// • Format validation runs on cell blur (locally per cell).
//   Required-field / cross-row validation happens at row save time
//   in the parent grid.
// • Esc restores the original value via parent's onCancel.
// ═══════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// ─────────────────────────────────────────────────────────────
// Shared types & helpers
// ─────────────────────────────────────────────────────────────

export type CellDirection = 'up' | 'down' | 'left' | 'right';

export interface BaseCellProps {
  /** True when this cell holds the grid's keyboard focus. */
  isFocused: boolean;
  /** True when the cell should render its input element (not display). */
  isEditing: boolean;
  /** Disable all interaction (e.g. checked-out row, multi-night row). */
  readOnly?: boolean;
  /** Show a small saving spinner overlay. */
  isSaving?: boolean;
  /** Briefly flash green to indicate save success. */
  justSaved?: boolean;
  /** Validation error message (red border + tooltip when focused). */
  error?: string | null;
  /** ARIA label for screen readers. */
  ariaLabel?: string;

  /** Click or F2 in display mode → request to enter edit mode. */
  onRequestEdit?: () => void;
  /** Enter or blur → commit current draft and exit edit mode. */
  onCommit?: () => void;
  /** Esc → discard draft and exit edit mode. */
  onCancel?: () => void;
  /** Keyboard arrow → request focus on neighbor cell. */
  onMove?: (dir: CellDirection) => void;
  /** Tab pressed — parent decides next cell. */
  onTab?: (shiftKey: boolean) => void;
}

/** Detect a fake Enter sent by an active IME composition. */
function isImeComposing(e: React.KeyboardEvent): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229;
}

/** Build the visual container className from state flags. */
function buildContainerClass(opts: {
  isFocused: boolean;
  isEditing: boolean;
  readOnly?: boolean;
  error?: string | null;
  isSaving?: boolean;
  justSaved?: boolean;
  align?: 'left' | 'right' | 'center';
}): string {
  const align =
    opts.align === 'right'
      ? 'justify-end text-right'
      : opts.align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  const parts = [
    'relative h-6 px-1 text-xs flex items-center',
    align,
    'border outline-none transition-colors duration-100',
  ];

  if (opts.error) {
    parts.push('border-red-500 bg-red-50');
  } else if (opts.isEditing) {
    parts.push('border-[#C9A84C] bg-white');
  } else if (opts.isFocused) {
    parts.push('border-[#C9A84C] bg-[#C9A84C]/10');
  } else {
    parts.push('border-transparent hover:bg-gray-100');
  }

  if (opts.justSaved) parts.push('!bg-green-100');
  if (opts.isSaving) parts.push('opacity-60');
  if (opts.readOnly) parts.push('cursor-not-allowed text-gray-400');
  else parts.push('cursor-text');

  return parts.join(' ');
}

/**
 * Scroll the focused cell into view inside any horizontally scrollable
 * ancestor (the panel grid container). Used by every cell variant when
 * `isFocused` flips on, satisfying requirement #9.
 */
function scrollFocusedIntoView(el: HTMLElement | null) {
  if (!el) return;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Spinner shown while a row save is in flight. */
function SavingSpinner() {
  return (
    <span
      aria-hidden
      className="absolute right-1 top-1/2 -translate-y-1/2 inline-block w-3 h-3 rounded-full border-2 border-gray-300 border-t-[#C9A84C] animate-spin"
    />
  );
}

/** Tooltip rendered below a cell with a validation error. */
function ErrorTooltip({ message }: { message: string }) {
  return (
    <span
      role="tooltip"
      className="absolute left-0 top-full mt-0.5 z-20 px-2 py-0.5 text-[10px] bg-red-600 text-white rounded shadow whitespace-nowrap pointer-events-none"
    >
      {message}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// 1. TextCell — 성명, 차번호, 비고(메모)
// ═══════════════════════════════════════════════════════════════

export interface TextCellProps extends BaseCellProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  align?: 'left' | 'right' | 'center';
  /**
   * Extra Tailwind class applied to the cell's display span. Used by
   * SalesGridPanel to tint 성명 cells red for 당특 or gold for 연박.
   * Must be a valid, space-delimited class string.
   */
  textClassName?: string;
}

export function TextCell(props: TextCellProps) {
  const {
    value, onChange, placeholder, maxLength,
    isFocused, isEditing, readOnly, isSaving, justSaved, error, ariaLabel,
    onRequestEdit, onCommit, onCancel, onMove, onTab,
    align = 'left', textClassName,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  // True when edit mode was entered by typing (not by click/F2). In
  // that case the focus effect must place the caret at the END of the
  // input instead of select()'ing the existing text — otherwise the
  // next keystroke would replace the existing value.
  const enterByTypingRef = useRef(false);

  // True when edit mode was entered via Korean IME (keyCode 229).
  // In this case we must delay focus by one animation frame so
  // the browser's IME context survives the DOM swap from display
  // div → input element. Without the delay the first composed
  // syllable is swallowed and appears as its ASCII key equivalent.
  const imeEntryRef = useRef(false);

  // Imperatively focus the right element when state flips
  useEffect(() => {
    if (readOnly) return;
    if (isEditing) {
      const doFocus = () => {
        const el = inputRef.current;
        if (el && document.activeElement !== el) {
          el.focus();
          if (enterByTypingRef.current) {
            const len = el.value.length;
            el.setSelectionRange(len, len);
            enterByTypingRef.current = false;
          } else {
            el.select();
          }
        }
      };
      if (imeEntryRef.current) {
        imeEntryRef.current = false;
        requestAnimationFrame(doFocus);
      } else {
        doFocus();
      }
    } else if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
      scrollFocusedIntoView(wrapRef.current);
    }
  }, [isFocused, isEditing, readOnly]);

  const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    // If already editing, the input handles its own keystrokes.
    // Stop the bubbled event here so it is not double-processed.
    if (isEditing) return;
    switch (e.key) {
      case 'F2':
      case 'Enter':
        e.preventDefault();
        onRequestEdit?.();
        return;
      case 'Tab':
        e.preventDefault();
        onTab?.(e.shiftKey);
        return;
      case 'ArrowUp':    e.preventDefault(); onMove?.('up');    return;
      case 'ArrowDown':  e.preventDefault(); onMove?.('down');  return;
      case 'ArrowLeft':  e.preventDefault(); onMove?.('left');  return;
      case 'ArrowRight': e.preventDefault(); onMove?.('right'); return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (value !== '') onChange('');
        return;
    }
    // Korean IME keydown (keyCode 229 / key === 'Process'): open the
    // editor with the caret at the end so compositionstart/end can
    // append the composed glyph to the existing value.
    if (e.key === 'Process' || e.keyCode === 229) {
      enterByTypingRef.current = true;
      imeEntryRef.current = true;
      onRequestEdit?.();
      return;
    }
    // ASCII / printable → append the typed character to the existing
    // value immediately and enter edit mode with caret at end.
    // preventDefault stops the browser from re-inserting the char
    // into the freshly mounted input (which would duplicate it).
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      enterByTypingRef.current = true;
      onChange((value ?? '') + e.key);
      onRequestEdit?.();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Korean IME safety — ignore the synthetic Enter that fires while
    // a composition is still active.
    if (isImeComposing(e) || composingRef.current) return;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        onCommit?.();
        onMove?.('down');
        return;
      case 'Escape':
        e.preventDefault();
        onCancel?.();
        return;
      case 'Tab':
        e.preventDefault();
        onCommit?.();
        onTab?.(e.shiftKey);
        return;
      // Excel-style: arrow keys commit and move between cells.
      case 'ArrowUp':
        e.preventDefault(); onCommit?.(); onMove?.('up'); return;
      case 'ArrowDown':
        e.preventDefault(); onCommit?.(); onMove?.('down'); return;
      case 'ArrowLeft':
        e.preventDefault(); onCommit?.(); onMove?.('left'); return;
      case 'ArrowRight':
        e.preventDefault(); onCommit?.(); onMove?.('right'); return;
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      onClick={() => !readOnly && onRequestEdit?.()}
      onKeyDown={handleDisplayKeyDown}
      className={buildContainerClass({
        isFocused, isEditing, readOnly, error, isSaving, justSaved, align,
      })}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onKeyDown={handleEditKeyDown}
          onBlur={() => onCommit?.()}
          className="w-full bg-transparent outline-none border-none p-0 text-xs"
        />
      ) : (
        <span className={`truncate w-full ${value ? (textClassName ?? '') : 'text-gray-300'}`}>
          {value || placeholder || ''}
        </span>
      )}
      {isSaving && <SavingSpinner />}
      {error && isFocused && <ErrorTooltip message={error} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. NumberCell — 금액(입금가), 추금액
// ═══════════════════════════════════════════════════════════════

export interface NumberCellProps extends BaseCellProps {
  value: number;
  onChange: (next: number) => void;
  /** Format with thousands separators in display mode (default true). */
  formatComma?: boolean;
  min?: number;
  max?: number;
  align?: 'left' | 'right' | 'center';
  /** Show as "+1,000" — used for the 추금액 column. */
  plusPrefix?: boolean;
  /**
   * Extra Tailwind class applied to the cell's display span. Used by
   * SalesGridPanel to tint 금액 cells by payment state
   * (미수 → red, 완불 → green, 예약금 → blue, etc.).
   */
  textClassName?: string;
}

function formatNumber(n: number, comma: boolean): string {
  if (!Number.isFinite(n)) return '';
  return comma ? n.toLocaleString('ko-KR') : String(n);
}

export function NumberCell(props: NumberCellProps) {
  const {
    value, onChange, formatComma = true, min = 0, max,
    isFocused, isEditing, readOnly, isSaving, justSaved, error, ariaLabel,
    onRequestEdit, onCommit, onCancel, onMove, onTab,
    align = 'right', plusPrefix = false, textClassName,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // True when edit mode was entered by typing a number in display mode.
  // In that case the draft is already the first keystroke; the focus
  // effect must place the caret at the END so the next keystroke
  // appends instead of replacing a selected "1".
  const enterByTypingRef = useRef(false);
  const [draft, setDraft] = useState<string>(value ? String(value) : '');
  const [localError, setLocalError] = useState<string | null>(null);

  // React 19: adjust state during render instead of in useEffect.
  // When the cell exits edit mode, resync the draft from the prop value.
  const [prevEditing, setPrevEditing] = useState(isEditing);
  const [prevValue, setPrevValue] = useState(value);
  if (isEditing !== prevEditing || value !== prevValue) {
    setPrevEditing(isEditing);
    setPrevValue(value);
    if (!isEditing) {
      setDraft(value ? String(value) : '');
      setLocalError(null);
    }
  }

  useEffect(() => {
    if (readOnly) return;
    if (isEditing) {
      const el = inputRef.current;
      if (el && document.activeElement !== el) {
        el.focus();
        if (enterByTypingRef.current) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
          enterByTypingRef.current = false;
        } else {
          el.select();
        }
      }
    } else if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
      scrollFocusedIntoView(wrapRef.current);
    }
  }, [isFocused, isEditing, readOnly]);

  const commit = useCallback(() => {
    const cleaned = draft.replace(/[^0-9.-]/g, '');
    if (cleaned === '' || cleaned === '-') {
      if (value !== 0) onChange(0);
      setLocalError(null);
      onCommit?.();
      return;
    }
    const n = Number(cleaned);
    if (Number.isNaN(n)) {
      setLocalError('숫자만 입력');
      return;
    }
    if (n < min) {
      setLocalError(`${min} 이상`);
      return;
    }
    if (max != null && n > max) {
      setLocalError(`${max} 이하`);
      return;
    }
    setLocalError(null);
    if (n !== value) onChange(n);
    onCommit?.();
  }, [draft, min, max, value, onChange, onCommit]);

  const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (isEditing) return; // input handles its own keystrokes
    switch (e.key) {
      case 'F2':
      case 'Enter':
        e.preventDefault(); onRequestEdit?.(); return;
      case 'Tab':
        e.preventDefault(); onTab?.(e.shiftKey); return;
      case 'ArrowUp':    e.preventDefault(); onMove?.('up');    return;
      case 'ArrowDown':  e.preventDefault(); onMove?.('down');  return;
      case 'ArrowLeft':  e.preventDefault(); onMove?.('left');  return;
      case 'ArrowRight': e.preventDefault(); onMove?.('right'); return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault(); onChange(0); return;
    }
    // Numeric / decimal / minus → start editing with that char.
    // preventDefault so the char is not re-inserted into the freshly
    // mounted input (would produce "55" instead of "5").
    if (/^[0-9.-]$/.test(e.key)) {
      e.preventDefault();
      enterByTypingRef.current = true;
      setDraft(e.key);
      onRequestEdit?.();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        commit();
        // commit() may have set localError; only advance if still clean
        if (!localError) onMove?.('down');
        return;
      case 'Escape':
        e.preventDefault();
        setLocalError(null);
        onCancel?.();
        return;
      case 'Tab':
        e.preventDefault();
        commit();
        if (!localError) onTab?.(e.shiftKey);
        return;
      // Excel-style: arrow keys commit and move between cells.
      case 'ArrowUp':
        e.preventDefault(); commit();
        if (!localError) onMove?.('up');
        return;
      case 'ArrowDown':
        e.preventDefault(); commit();
        if (!localError) onMove?.('down');
        return;
      case 'ArrowLeft':
        e.preventDefault(); commit();
        if (!localError) onMove?.('left');
        return;
      case 'ArrowRight':
        e.preventDefault(); commit();
        if (!localError) onMove?.('right');
        return;
    }
  };

  const display = (() => {
    if (!value) return '';
    return plusPrefix
      ? `+${formatNumber(value, formatComma)}`
      : formatNumber(value, formatComma);
  })();

  const effectiveError = error ?? localError;

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      onClick={() => !readOnly && onRequestEdit?.()}
      onKeyDown={handleDisplayKeyDown}
      className={buildContainerClass({
        isFocused, isEditing, readOnly,
        error: effectiveError, isSaving, justSaved, align,
      })}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commit}
          className="w-full bg-transparent outline-none border-none p-0 text-xs text-right"
        />
      ) : (
        <span
          className={`tabular-nums w-full ${
            value
              ? textClassName ?? (plusPrefix ? 'text-yellow-600' : '')
              : 'text-gray-300'
          }`}
        >
          {display}
        </span>
      )}
      {isSaving && <SavingSpinner />}
      {effectiveError && isFocused && <ErrorTooltip message={effectiveError} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. TimeCell — 입실, 퇴실 (0~24, 0.5 단위)
// ═══════════════════════════════════════════════════════════════

export interface TimeCellProps extends BaseCellProps {
  value: number | null;
  onChange: (next: number | null) => void;
  min?: number;
  max?: number;
  /** Allowed step (default 0.5). */
  step?: number;
  align?: 'left' | 'right' | 'center';
  placeholder?: string;
}

function formatTime(t: number | null): string {
  if (t == null) return '';
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}

/** Validate a time value. Returns an error message or null if OK. */
function validateTime(
  n: number,
  min: number,
  max: number,
  step: number,
): string | null {
  if (Number.isNaN(n)) return '숫자만 입력';
  if (n < min || n > max) return `${min}~${max} 사이`;
  // 0.5 단위 정렬 검사
  const ratio = n / step;
  if (Math.abs(ratio - Math.round(ratio)) > 0.001) {
    return `${step} 단위`;
  }
  return null;
}

export function TimeCell(props: TimeCellProps) {
  const {
    value, onChange, min = 0, max = 24, step = 0.5,
    isFocused, isEditing, readOnly, isSaving, justSaved, error, ariaLabel,
    onRequestEdit, onCommit, onCancel, onMove, onTab,
    align = 'center', placeholder,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // True when edit mode was entered by typing. Prevents the focus effect
  // from calling select(), which would cause the next keystroke to
  // replace a selected single digit (e.g. "1" → "5" instead of "15").
  const enterByTypingRef = useRef(false);
  const [draft, setDraft] = useState<string>(formatTime(value));
  const [localError, setLocalError] = useState<string | null>(null);

  // React 19: adjust state during render instead of in useEffect.
  const [prevEditing, setPrevEditing] = useState(isEditing);
  const [prevValue, setPrevValue] = useState<number | null>(value);
  if (isEditing !== prevEditing || value !== prevValue) {
    setPrevEditing(isEditing);
    setPrevValue(value);
    if (!isEditing) {
      setDraft(formatTime(value));
      setLocalError(null);
    }
  }

  useEffect(() => {
    if (readOnly) return;
    if (isEditing) {
      const el = inputRef.current;
      if (el && document.activeElement !== el) {
        el.focus();
        if (enterByTypingRef.current) {
          const len = el.value.length;
          el.setSelectionRange(len, len);
          enterByTypingRef.current = false;
        } else {
          el.select();
        }
      }
    } else if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
      scrollFocusedIntoView(wrapRef.current);
    }
  }, [isFocused, isEditing, readOnly]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value != null) onChange(null);
      setLocalError(null);
      onCommit?.();
      return;
    }
    const n = Number(trimmed);
    const err = validateTime(n, min, max, step);
    if (err) {
      setLocalError(err);
      // Stay in edit mode with red border so the user can correct.
      return;
    }
    setLocalError(null);
    if (n !== value) onChange(n);
    onCommit?.();
  }, [draft, min, max, step, value, onChange, onCommit]);

  const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (isEditing) return; // input handles its own keystrokes
    switch (e.key) {
      case 'F2':
      case 'Enter':
        e.preventDefault(); onRequestEdit?.(); return;
      case 'Tab':
        e.preventDefault(); onTab?.(e.shiftKey); return;
      case 'ArrowUp':    e.preventDefault(); onMove?.('up');    return;
      case 'ArrowDown':  e.preventDefault(); onMove?.('down');  return;
      case 'ArrowLeft':  e.preventDefault(); onMove?.('left');  return;
      case 'ArrowRight': e.preventDefault(); onMove?.('right'); return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault(); onChange(null); return;
    }
    if (/^[0-9.]$/.test(e.key)) {
      e.preventDefault();
      enterByTypingRef.current = true;
      setDraft(e.key);
      onRequestEdit?.();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault(); commit();
        if (!localError) onMove?.('down');
        return;
      case 'Escape':
        e.preventDefault();
        setLocalError(null);
        onCancel?.();
        return;
      case 'Tab':
        e.preventDefault(); commit();
        if (!localError) onTab?.(e.shiftKey);
        return;
      // Excel-style: arrow keys commit and move between cells.
      case 'ArrowUp':
        e.preventDefault(); commit();
        if (!localError) onMove?.('up');
        return;
      case 'ArrowDown':
        e.preventDefault(); commit();
        if (!localError) onMove?.('down');
        return;
      case 'ArrowLeft':
        e.preventDefault(); commit();
        if (!localError) onMove?.('left');
        return;
      case 'ArrowRight':
        e.preventDefault(); commit();
        if (!localError) onMove?.('right');
        return;
    }
  };

  const effectiveError = error ?? localError;

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      onClick={() => !readOnly && onRequestEdit?.()}
      onKeyDown={handleDisplayKeyDown}
      className={buildContainerClass({
        isFocused, isEditing, readOnly,
        error: effectiveError, isSaving, justSaved, align,
      })}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commit}
          className="w-full bg-transparent outline-none border-none p-0 text-xs text-center"
        />
      ) : (
        <span className={`tabular-nums ${value == null ? 'text-gray-300' : ''}`}>
          {value == null ? (placeholder || '') : formatTime(value)}
        </span>
      )}
      {isSaving && <SavingSpinner />}
      {effectiveError && isFocused && <ErrorTooltip message={effectiveError} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. SelectCell — 타입, 호실, 결제수단, 구분(채널)
// ═══════════════════════════════════════════════════════════════

export interface SelectOption<V extends string | number = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectCellProps<V extends string | number = string>
  extends BaseCellProps {
  value: V | null;
  options: ReadonlyArray<SelectOption<V>>;
  onChange: (next: V) => void;
  placeholder?: string;
  align?: 'left' | 'right' | 'center';
  /**
   * Optional callback invoked when the user presses Delete / Backspace
   * in display mode. When not provided, the key is ignored.
   */
  onClear?: () => void;
  /** Enable ASCII single-letter quick select (e.g. "S" → Standard). */
  enableQuickKey?: boolean;
}

export function SelectCell<V extends string | number = string>(
  props: SelectCellProps<V>,
) {
  const {
    value, options, onChange, onClear, placeholder, enableQuickKey = true,
    isFocused, isEditing, readOnly, isSaving, justSaved, error, ariaLabel,
    onRequestEdit, onCommit, onCancel, onMove, onTab,
    align = 'center',
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const enterByTypingRef = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const currentLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found?.label ?? '';
  }, [options, value]);

  // Editable draft (the label string the user is typing). Synced from
  // the prop-derived currentLabel whenever the cell leaves edit mode.
  const [draft, setDraft] = useState<string>(currentLabel);
  const [localError, setLocalError] = useState<string | null>(null);

  const [prevEditing, setPrevEditing] = useState(isEditing);
  const [prevLabel, setPrevLabel] = useState(currentLabel);
  if (isEditing !== prevEditing || currentLabel !== prevLabel) {
    setPrevEditing(isEditing);
    setPrevLabel(currentLabel);
    if (!isEditing) {
      setDraft(currentLabel);
      setLocalError(null);
    }
  }

  // True when edit mode was entered via Korean IME (keyCode 229).
  const imeEntryRef = useRef(false);

  useEffect(() => {
    if (readOnly) return;
    if (isEditing) {
      const doFocus = () => {
        const el = inputRef.current;
        if (el && document.activeElement !== el) {
          el.focus();
          if (enterByTypingRef.current) {
            const len = el.value.length;
            el.setSelectionRange(len, len);
            enterByTypingRef.current = false;
          } else {
            el.select();
          }
        }
      };
      if (imeEntryRef.current) {
        imeEntryRef.current = false;
        requestAnimationFrame(doFocus);
      } else {
        doFocus();
      }
    } else if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
      scrollFocusedIntoView(wrapRef.current);
    }
  }, [isFocused, isEditing, readOnly]);

  /**
   * Resolve the current draft string to an option value.
   *  - Exact label match wins.
   *  - Otherwise case-insensitive prefix match.
   *  - Empty draft → clear.
   * Returns true if the commit produced a valid value (or an intentional
   * clear) and is safe to advance focus; false if the draft was invalid.
   */
  const commit = useCallback((): boolean => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value != null && value !== ('' as unknown as V)) {
        onClear?.();
      }
      setLocalError(null);
      onCommit?.();
      return true;
    }
    // Exact match (case insensitive)
    const lower = trimmed.toLowerCase();
    let match = options.find(
      (o) => !o.disabled && o.label.toLowerCase() === lower,
    );
    if (!match) {
      match = options.find(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(lower),
      );
    }
    if (!match) {
      setLocalError('목록에 없음');
      return false;
    }
    setLocalError(null);
    if (match.value !== value) onChange(match.value);
    else setDraft(match.label); // snap back to canonical label
    onCommit?.();
    return true;
  }, [draft, value, options, onChange, onClear, onCommit]);

  const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (isEditing) return;
    switch (e.key) {
      case 'F2':
      case 'Enter':
      case ' ':
        e.preventDefault(); onRequestEdit?.(); return;
      case 'Tab':
        e.preventDefault(); onTab?.(e.shiftKey); return;
      case 'ArrowUp':    e.preventDefault(); onMove?.('up');    return;
      case 'ArrowDown':  e.preventDefault(); onMove?.('down');  return;
      case 'ArrowLeft':  e.preventDefault(); onMove?.('left');  return;
      case 'ArrowRight': e.preventDefault(); onMove?.('right'); return;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        onClear?.();
        return;
    }
    // ASCII single-letter prefix match (타입 column: S/D/P/GS/GD/PT).
    // Resolves immediately in display mode without opening the dropdown.
    if (enableQuickKey && /^[a-zA-Z0-9]$/.test(e.key)) {
      const k = e.key.toLowerCase();
      const match = options.find(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(k),
      );
      if (match) {
        e.preventDefault();
        onChange(match.value);
        return;
      }
    }
    // Korean IME keydown fires with keyCode 229 / key === 'Process'.
    // We cannot seed the draft with the composed character because it
    // doesn't exist yet. Open edit mode with an empty draft and let
    // the input receive compositionstart/compositionend.
    if (e.key === 'Process' || e.keyCode === 229) {
      enterByTypingRef.current = true;
      imeEntryRef.current = true;
      setDraft('');
      onRequestEdit?.();
      return;
    }
    // ASCII / printable single-character keys → seed the draft with
    // the typed character and preventDefault so the browser does NOT
    // re-insert the same character into the freshly mounted input.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      enterByTypingRef.current = true;
      setDraft(e.key);
      onRequestEdit?.();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (commit()) onMove?.('down');
        return;
      case 'Escape':
        e.preventDefault();
        setLocalError(null);
        onCancel?.();
        return;
      case 'Tab':
        e.preventDefault();
        if (commit()) onTab?.(e.shiftKey);
        return;
      case 'ArrowUp':
        e.preventDefault();
        if (commit()) onMove?.('up');
        return;
      case 'ArrowDown':
        e.preventDefault();
        if (commit()) onMove?.('down');
        return;
      case 'ArrowLeft':
        e.preventDefault();
        if (commit()) onMove?.('left');
        return;
      case 'ArrowRight':
        e.preventDefault();
        if (commit()) onMove?.('right');
        return;
    }
  };

  const effectiveError = error ?? localError;

  // Filtered options for dropdown
  const filteredOptions = useMemo(() => {
    const available = options.filter((o) => !o.disabled);
    if (!draft.trim()) return available;
    const lower = draft.trim().toLowerCase();
    return available.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, draft]);

  // Reset highlight when filtered list length changes
  const [prevFilteredLen, setPrevFilteredLen] = useState(filteredOptions.length);
  if (filteredOptions.length !== prevFilteredLen) {
    setPrevFilteredLen(filteredOptions.length);
    setHighlightIdx(-1);
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.children;
      if (items[highlightIdx]) {
        (items[highlightIdx] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx]);

  const handleInputKeyDown2 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    // Arrow up/down navigate the dropdown list
    if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filteredOptions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp' && filteredOptions.length > 0) {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    // Enter: if highlighted, select it; otherwise commit typed text
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filteredOptions.length) {
        const selected = filteredOptions[highlightIdx];
        setDraft(selected.label);
        setLocalError(null);
        onChange(selected.value);
        onCommit?.();
        onMove?.('down');
      } else {
        if (commit()) onMove?.('down');
      }
      return;
    }
    // Delegate other keys (Escape, Tab) to the original handler
    handleInputKeyDown(e);
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      onClick={() => !readOnly && onRequestEdit?.()}
      onKeyDown={handleDisplayKeyDown}
      className={buildContainerClass({
        isFocused, isEditing, readOnly,
        error: effectiveError, isSaving, justSaved, align,
      })}
    >
      {isEditing ? (
        <div className="relative w-full">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setLocalError(null); }}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onKeyDown={handleInputKeyDown2}
            onBlur={(e) => {
              // Delay commit to allow dropdown click to fire first
              const related = e.relatedTarget as HTMLElement | null;
              if (related && dropdownRef.current?.contains(related)) return;
              setTimeout(() => { commit(); }, 150);
            }}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none border-none p-0 text-xs text-center"
          />
          {filteredOptions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full mt-0.5 z-[9999] bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto"
            >
              {filteredOptions.map((o, idx) => (
                <div
                  key={String(o.value)}
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur
                    setDraft(o.label);
                    setLocalError(null);
                    onChange(o.value);
                    onCommit?.();
                  }}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  className={`px-2 py-1.5 text-xs cursor-pointer ${
                    idx === highlightIdx
                      ? 'bg-[#C9A84C]/20 text-gray-900'
                      : o.value === value
                        ? 'bg-blue-50 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {o.label}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className={currentLabel ? '' : 'text-gray-300'}>
          {currentLabel || placeholder || ''}
        </span>
      )}
      {isSaving && <SavingSpinner />}
      {effectiveError && isFocused && <ErrorTooltip message={effectiveError} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. CheckCell — 퇴실 체크박스
// ═══════════════════════════════════════════════════════════════

export interface CheckCellProps extends BaseCellProps {
  value: boolean;
  onChange: (next: boolean) => void;
  /** Label rendered when checked. */
  checkedLabel?: string;
  /** Label rendered when unchecked. */
  uncheckedLabel?: string;
}

export function CheckCell(props: CheckCellProps) {
  const {
    value, onChange,
    isFocused, readOnly, isSaving, justSaved, error, ariaLabel,
    onMove, onTab,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readOnly) return;
    if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
      scrollFocusedIntoView(wrapRef.current);
    }
  }, [isFocused, readOnly]);

  const toggle = useCallback(() => {
    if (readOnly) return;
    onChange(!value);
  }, [readOnly, value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    switch (e.key) {
      case ' ':
      case 'Enter':
        e.preventDefault(); toggle(); return;
      case 'Tab':
        e.preventDefault(); onTab?.(e.shiftKey); return;
      case 'ArrowUp':    e.preventDefault(); onMove?.('up');    return;
      case 'ArrowDown':  e.preventDefault(); onMove?.('down');  return;
      case 'ArrowLeft':  e.preventDefault(); onMove?.('left');  return;
      case 'ArrowRight': e.preventDefault(); onMove?.('right'); return;
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      data-checked={value}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      onKeyDown={handleKeyDown}
      className={buildContainerClass({
        isFocused,
        isEditing: false,
        readOnly,
        error,
        isSaving,
        justSaved,
        align: 'center',
      })}
    >
      <span
        className={`text-xs font-bold whitespace-nowrap ${
          value ? 'text-green-600' : 'text-gray-400'
        }`}
      >
        {value ? '✓' : '□'}
      </span>
      {isSaving && <SavingSpinner />}
      {error && isFocused && <ErrorTooltip message={error} />}
    </div>
  );
}
