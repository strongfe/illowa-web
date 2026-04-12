'use client';

// ═══════════════════════════════════════════════════════════════
// MemoPopup — 비고(memo) 셀 전용 팝업 편집기
//
// 비고 셀 클릭 시 셀 아래(또는 위)에 absolute 팝업 표시.
//  - 상단: 읽기전용 prefix (연박 정보 / 예약금 정보)
//  - 하단: textarea 3줄 편집
//  - Enter = 줄바꿈 (textarea 기본)
//  - Tab = 저장 후 다음 셀
//  - Esc = 취소 (원본 복구)
//  - 바깥 클릭 = 저장 후 닫기
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BaseCellProps } from './EditableCell';

export interface MemoPopupProps extends BaseCellProps {
  /** Raw memo from draft (no prefix). */
  value: string;
  onChange: (next: string) => void;
  /** Combined display text (prefix + memo) for non-editing view. */
  displayValue: string;
  /** Tailwind color class for the display text. */
  textClassName?: string;
  /** Readonly prefix lines shown above the textarea. */
  prefixLines: string[];
}

export function MemoPopup(props: MemoPopupProps) {
  const {
    value,
    onChange,
    displayValue,
    textClassName,
    prefixLines,
    isFocused,
    isEditing,
    readOnly,
    isSaving,
    justSaved,
    error,
    onRequestEdit,
    onCommit,
    onCancel,
    onMove,
    onTab,
  } = props;

  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);
  const [popupAbove, setPopupAbove] = useState(false);

  // Sync draft from value when not editing
  const [prevEditing, setPrevEditing] = useState(isEditing);
  const [prevValue, setPrevValue] = useState(value);
  if (isEditing !== prevEditing || value !== prevValue) {
    setPrevEditing(isEditing);
    setPrevValue(value);
    if (!isEditing) {
      setDraft(value);
    }
  }

  // Focus management
  useEffect(() => {
    if (readOnly) return;
    if (isEditing) {
      const el = textareaRef.current;
      if (el && document.activeElement !== el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      // Decide popup direction based on available space below
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setPopupAbove(spaceBelow < 160);
      }
    } else if (isFocused) {
      const el = wrapRef.current;
      if (el && document.activeElement !== el) el.focus();
    }
  }, [isFocused, isEditing, readOnly]);

  const commit = useCallback(() => {
    if (draft !== value) onChange(draft);
    onCommit?.();
  }, [draft, value, onChange, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter = newline (default textarea behavior, no preventDefault)
    if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      onCancel?.();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      commit();
      onTab?.(e.shiftKey);
      return;
    }
  };

  // Click outside = save + close
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        commit();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEditing, commit]);

  // Display mode keydown (cell wrapper)
  const handleDisplayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
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
    // Any printable key → enter edit mode
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      onRequestEdit?.();
    }
  };

  // Container classes
  const borderClass = error
    ? 'border-red-500 bg-red-50'
    : isEditing
    ? 'border-[#C9A84C] bg-white'
    : isFocused
    ? 'border-[#C9A84C] bg-[#C9A84C]/10'
    : 'border-transparent hover:bg-gray-100';

  const flashClass = justSaved ? '!bg-green-100' : '';
  const savingClass = isSaving ? 'opacity-60' : '';

  return (
    <div
      ref={wrapRef}
      tabIndex={readOnly ? -1 : 0}
      role="gridcell"
      onClick={() => !readOnly && onRequestEdit?.()}
      onKeyDown={handleDisplayKeyDown}
      className={`relative h-6 px-1 text-xs flex items-center border outline-none transition-colors cursor-text ${borderClass} ${flashClass} ${savingClass}`}
    >
      {/* Display value */}
      {!isEditing && (
        <span className={`truncate w-full ${displayValue ? (textClassName ?? '') : 'text-gray-300'}`}>
          {displayValue || ''}
        </span>
      )}

      {/* Editing popup */}
      {isEditing && (
        <div
          ref={popupRef}
          className={`absolute left-0 z-30 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-[200px] ${
            popupAbove ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Readonly prefix lines */}
          {prefixLines.length > 0 && (
            <div className="mb-1.5 pb-1.5 border-b border-gray-200">
              {prefixLines.map((line, i) => (
                <div
                  key={i}
                  className="text-[10px] text-purple-600 font-medium"
                >
                  {line}
                </div>
              ))}
            </div>
          )}
          {/* Editable textarea */}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none resize-none focus:border-[#C9A84C]"
            placeholder="메모 입력"
          />
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>Tab: 저장 · Esc: 취소</span>
          </div>
        </div>
      )}
    </div>
  );
}
