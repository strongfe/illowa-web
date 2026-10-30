'use client';

// ═══════════════════════════════════════════════════════════════
// 홈페이지 직접 예약 화면
//
// 흐름: 숙박/대실 탭 + 날짜 → 객실 목록 → 예약 정보 입력 → 신청 완료
// • 남은 객실 수: /api/reserve/availability (배정량 − 예약 수)
// • 예약 신청: POST /api/reserve → 손님·호텔에 문자 발송
// • 요금은 화면과 서버가 같은 계산(reserveCore)을 쓰고, 최종 금액은 서버가 정한다.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import {
  ArrowLeft, CalendarDays, Car, ChevronLeft, ChevronRight, Clock, Footprints, Moon, Sun, X, CheckCircle2,
} from 'lucide-react';
import { DAESIL_START_TIMES, BOOKABLE_DAYS, CANCEL_POLICY } from '@/data/reserveConfig';
import {
  RESERVE_ROOMS, PHONE_RE, WEEK, addDays, daesilSlot, fmtDay, fmtDuration, formatPhone, isPastTime, isSellable,
  nightsBetween, priceOf, todayKST, won,
  type AvailabilityItem, type Mode, type PayMethod, type ReservationRequest, type ReserveRoom,
} from '@/lib/reserveCore';

type Step = 'list' | 'form' | 'done';
type FormData = Omit<ReservationRequest, 'mode' | 'roomKey' | 'checkIn' | 'checkOut' | 'daesilTime'>;

// 달력 칸 만들기용 (브라우저 로컬 날짜)
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const LIVE = process.env.NEXT_PUBLIC_RESERVE_LIVE === 'true';

export default function ReserveApp() {
  const today = useMemo(() => todayKST(), []);
  const [mode, setMode] = useState<Mode>('stay');
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [pickedTime, setDaesilTime] = useState('14:00');
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [step, setStep] = useState<Step>('list');
  const [room, setRoom] = useState<ReserveRoom | null>(null);
  const [code, setCode] = useState('');
  const [finalAmount, setFinalAmount] = useState(0);

  // 남은 객실 수 — 조건이 바뀔 때마다 서버에 묻는다
  const query = `mode=${mode}&checkIn=${checkIn}&checkOut=${checkOut}`;
  const [avail, setAvail] = useState<{ query: string; rooms: AvailabilityItem[] | null; error: string }>({
    query: '', rooms: null, error: '',
  });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`/api/reserve/availability?${query}`)
      .then(async (res) => {
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) setAvail({ query, rooms: null, error: j.error ?? '객실 정보를 불러오지 못했습니다' });
        else setAvail({ query, rooms: j.rooms, error: '' });
      })
      .catch(() => alive && setAvail({ query, rooms: null, error: '네트워크 오류가 발생했습니다' }));
    return () => {
      alive = false;
    };
  }, [query, reload]);
  const loading = avail.query !== query;
  const remainingOf = (r: ReserveRoom) =>
    loading ? null : avail.rooms?.find((x) => x.key === r.key)?.remaining ?? 0;

  const nights = mode === 'stay' ? nightsBetween(checkIn, checkOut) : 0;
  const price = (r: ReserveRoom) => priceOf(r, mode, checkIn, checkOut);

  // 오늘 대실이면 이미 지난 시각은 못 고른다 → 고른 시각이 지났으면 가장 빠른 가능 시각으로
  const openTimes = DAESIL_START_TIMES.filter((t) => !isPastTime(checkIn, t, today));
  const daesilTime = openTimes.includes(pickedTime) ? pickedTime : openTimes[0] ?? pickedTime;
  const daesilClosedToday = mode === 'daesil' && openTimes.length === 0;

  // 대실: 그 시각에 입실 가능한 타입만 / 숙박: 연박은 2박 이상 / 당일특가는 오늘만
  const visibleRooms = daesilClosedToday
    ? []
    : RESERVE_ROOMS.filter((r) => isSellable(r, mode, checkIn, checkOut, today, mode === 'daesil' ? daesilTime : null));

  const summary = {
    mode,
    checkIn,
    checkOut,
    nights,
    daesilTime,
  };

  const submit = async (data: FormData): Promise<string | null> => {
    if (!room) return '객실을 다시 선택해 주세요';
    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data, mode, roomKey: room.key, checkIn, checkOut, daesilTime: mode === 'daesil' ? daesilTime : null,
        } satisfies ReservationRequest),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 409) setReload((n) => n + 1); // 마감됐으면 남은 객실 다시 조회
        return j.error ?? '예약 신청에 실패했습니다';
      }
      setCode(j.code);
      setFinalAmount(j.amount);
      setStep('done');
      window.scrollTo(0, 0);
      return null;
    } catch {
      return '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요';
    }
  };

  if (step === 'done' && room) {
    return <DoneView room={room} price={finalAmount} summary={summary} code={code} />;
  }

  if (step === 'form' && room) {
    return (
      <FormView
        room={room}
        price={price(room)}
        summary={summary}
        onBack={() => setStep('list')}
        onSubmit={submit}
      />
    );
  }

  return (
    <Shell>
      <TopBar title="일로와 호텔 예약" backHref="/" />
      <PrototypeNotice />

      {/* 숙박 / 대실 탭 */}
      <div className="sticky top-[52px] z-20 bg-[#fff] border-b border-neutral-200">
        <div className="grid grid-cols-2">
          {([
            ['stay', '숙박', Moon],
            ['daesil', '대실', Sun],
          ] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex items-center justify-center gap-1.5 py-3 text-[15px] font-semibold border-b-2 transition-colors ${
                mode === m ? 'border-[#C9A84C] text-neutral-900' : 'border-transparent text-neutral-400'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* 날짜 선택 바 */}
        <button
          onClick={() => setCalendarOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left"
        >
          <CalendarDays size={18} className="text-[#C9A84C] shrink-0" />
          <span className="text-[15px] font-semibold text-neutral-900">
            {mode === 'stay'
              ? `${fmtDay(checkIn)} ~ ${fmtDay(checkOut)}`
              : fmtDay(checkIn)}
          </span>
          <span className="text-sm text-neutral-500">
            {mode === 'stay' ? `${nights}박` : daesilClosedToday ? '오늘 대실 마감' : `${daesilTime} 입실`}
          </span>
          <span className="ml-auto text-xs text-[#9a7b2c] font-medium">변경</span>
        </button>

        {/* 대실 입실 시간 */}
        {mode === 'daesil' && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
            {DAESIL_START_TIMES.map((t) => (
              <button
                key={t}
                disabled={!openTimes.includes(t)}
                onClick={() => setDaesilTime(t)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm border disabled:text-neutral-300 disabled:border-neutral-200 ${
                  daesilTime === t && !daesilClosedToday
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-[#fff] text-neutral-700 border-neutral-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 객실 목록 */}
      <div className="px-4 py-4 space-y-4 bg-neutral-100">
        {visibleRooms.map((r) => {
          const remaining = remainingOf(r);
          const soldOut = remaining === 0;
          return (
            <RoomCard
              key={r.key}
              room={r}
              mode={mode}
              price={price(r)}
              nights={nights}
              daesilInfo={daesilInfo(r, checkIn, daesilTime)}
              remaining={remaining}
              soldOut={soldOut}
              onSelect={() => {
                setRoom(r);
                setStep('form');
                window.scrollTo(0, 0);
              }}
            />
          );
        })}
        {daesilClosedToday && (
          <p className="rounded-lg bg-[#fff] p-6 text-center text-sm text-neutral-600">
            오늘 대실 예약은 마감되었습니다. 다른 날짜를 선택해 주세요.
          </p>
        )}
        {mode === 'daesil' && !daesilClosedToday && (
          <p className="text-xs text-neutral-500">선택한 입실 시간에 이용 가능한 객실만 보여 드립니다.</p>
        )}
        {avail.error && !loading && (
          <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{avail.error}</p>
        )}
        <p className="text-center text-xs text-neutral-500 pt-2 pb-6">
          표시 요금은 객실 1개 기준이며, 현장 상황에 따라 객실이 배정됩니다.
        </p>
      </div>

      {calendarOpen && (
        <CalendarSheet
          mode={mode}
          today={today}
          checkIn={checkIn}
          checkOut={checkOut}
          onClose={() => setCalendarOpen(false)}
          onApply={(a, b) => {
            setCheckIn(a);
            if (b) setCheckOut(b);
            setCalendarOpen(false);
          }}
        />
      )}
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 레이아웃 조각
// ─────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-200 font-sans">
      <div className="mx-auto max-w-[480px] min-h-screen bg-[#fff] text-neutral-900 shadow-sm">{children}</div>
    </div>
  );
}

function TopBar({ title, backHref, onBack }: { title: string; backHref?: string; onBack?: () => void }) {
  const icon = <ArrowLeft size={22} />;
  return (
    <header className="sticky top-0 z-30 h-[52px] flex items-center gap-2 px-2 bg-[#111] text-white">
      {onBack ? (
        <button onClick={onBack} aria-label="뒤로" className="p-2">{icon}</button>
      ) : (
        <Link href={backHref ?? '/'} aria-label="홈으로" className="p-2">{icon}</Link>
      )}
      <h1 className="text-[16px] font-semibold">{title}</h1>
      <span className="ml-auto pr-3 text-[11px] tracking-[3px] text-[#C9A84C]">ILLOWA</span>
    </header>
  );
}

function PrototypeNotice() {
  if (LIVE) return null;
  return (
    <div className="bg-amber-50 text-amber-800 text-xs px-4 py-2 border-b border-amber-200">
      테스트 운영 중입니다. 신청 내용은 호텔에서 확인 후 확정됩니다.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 객실 카드
// ─────────────────────────────────────────────────────────────

function RoomCard({
  room, mode, price, nights, daesilInfo, remaining, soldOut, onSelect,
}: {
  room: ReserveRoom;
  mode: Mode;
  price: number;
  nights: number;
  daesilInfo: string;
  remaining: number | null; // null = 확인 중
  soldOut: boolean;
  onSelect: () => void;
}) {
  const [photo, setPhoto] = useState(0);
  const photos = room.photos.slice(0, 6);

  return (
    <article className={`rounded-xl bg-[#fff] overflow-hidden shadow-sm ${soldOut ? 'opacity-60' : ''}`}>
      <div className="relative aspect-[16/10] bg-neutral-300">
        <Image
          src={photos[photo]}
          alt={`${room.name} 사진 ${photo + 1}`}
          fill
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover"
        />
        <span className="absolute left-3 top-3 rounded bg-black/70 px-2 py-0.5 text-[10px] tracking-[2px] text-[#E8C96A]">
          {room.badge}
        </span>
        <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
          {photo + 1} / {photos.length}
        </span>
        {photos.length > 1 && (
          <>
            <button
              aria-label="이전 사진"
              onClick={() => setPhoto((photo - 1 + photos.length) % photos.length)}
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="다음 사진"
              onClick={() => setPhoto((photo + 1) % photos.length)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[17px] font-bold text-neutral-900">{room.name}</h2>
          <span className="text-xs text-neutral-400">{room.sub}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {room.feats.map((f) => (
            <span key={f} className="rounded bg-neutral-100 px-2 py-0.5 text-[12px] text-neutral-600">{f}</span>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-neutral-100 pt-3">
          <div className="text-[13px] text-neutral-500 leading-5">
            {mode === 'stay' ? (
              <>
                <p className="font-semibold text-neutral-800">숙박</p>
                <p>{room.checkInfo.replace('체크인 ', '입실 ').replace('체크아웃 ', '퇴실 ')}</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-neutral-800">대실</p>
                <p>{daesilInfo}</p>
              </>
            )}
          </div>
          <div className="text-right">
            {remaining === null ? (
              <p className="text-sm text-neutral-400">남은 객실 확인 중…</p>
            ) : soldOut ? (
              <p className="text-[18px] font-bold text-neutral-400">예약 마감</p>
            ) : (
              <>
                <p className={`text-xs font-medium ${remaining <= 1 ? 'text-red-500' : 'text-[#9a7b2c]'}`}>
                  남은 객실 {remaining}개
                </p>
                <p className="text-[20px] font-bold text-neutral-900">
                  {won(price)}
                </p>
                {mode === 'stay' && nights > 1 && (
                  <p className="text-[11px] text-neutral-400">{nights}박 합계</p>
                )}
              </>
            )}
          </div>
        </div>

        <button
          disabled={soldOut || remaining === null}
          onClick={onSelect}
          className="mt-3 w-full rounded-lg py-3 text-[15px] font-semibold text-white bg-[#111] disabled:bg-neutral-300"
        >
          {soldOut ? '예약 마감' : `${mode === 'stay' ? '숙박' : '대실'} 예약하기`}
        </button>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// 달력 (아래에서 올라오는 시트)
// ─────────────────────────────────────────────────────────────

function CalendarSheet({
  mode, today, checkIn, checkOut, onClose, onApply,
}: {
  mode: Mode;
  today: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onApply: (a: string, b: string | null) => void;
}) {
  const [start, setStart] = useState<string>(checkIn);
  const [end, setEnd] = useState<string | null>(mode === 'stay' ? checkOut : null);
  const last = addDays(today, BOOKABLE_DAYS);

  const months = useMemo(() => {
    const first = fromKey(today);
    return [0, 1, 2].map((i) => new Date(first.getFullYear(), first.getMonth() + i, 1));
  }, [today]);

  const pick = (k: string) => {
    if (mode === 'daesil') {
      setStart(k);
      return;
    }
    if (!start || end || k <= start) {
      setStart(k);
      setEnd(null);
    } else {
      setEnd(k);
    }
  };

  const ready = mode === 'daesil' || !!end;
  const label =
    mode === 'daesil'
      ? `${fmtDay(start)} 대실 선택`
      : end
        ? `${fmtDay(start)} ~ ${fmtDay(end)} · ${nightsBetween(start, end)}박 선택`
        : '퇴실일을 선택하세요';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-[480px] max-h-[85vh] flex flex-col rounded-t-2xl bg-[#fff] text-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="text-[16px] font-bold">{mode === 'stay' ? '입실일 · 퇴실일 선택' : '이용일 선택'}</h3>
          <button onClick={onClose} aria-label="닫기"><X size={22} /></button>
        </div>
        <div className="grid grid-cols-7 px-4 pt-2 text-center text-xs text-neutral-500">
          {WEEK.map((w, i) => (
            <span key={w} className={i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}>{w}</span>
          ))}
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          {months.map((m) => {
            const offset = m.getDay();
            const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            return (
              <section key={m.toISOString()} className="pt-4">
                <h4 className="mb-2 text-[15px] font-bold">{m.getFullYear()}년 {m.getMonth() + 1}월</h4>
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const k = toKey(new Date(m.getFullYear(), m.getMonth(), i + 1));
                    const disabled = k < today || k > last;
                    const isStart = k === start;
                    const isEnd = k === end;
                    const inRange = !!end && k > start && k < end;
                    const dow = fromKey(k).getDay();
                    return (
                      <button
                        key={k}
                        disabled={disabled}
                        onClick={() => pick(k)}
                        className={`relative h-11 text-[14px] ${
                          inRange ? 'bg-[#F0DFA0]/50' : ''
                        } ${disabled ? 'text-neutral-300' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-neutral-800'}`}
                      >
                        <span
                          className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full ${
                            isStart || isEnd ? 'bg-[#111] text-white font-bold' : ''
                          }`}
                        >
                          {i + 1}
                          {(isStart || isEnd) && mode === 'stay' && (
                            <span className="text-[9px] leading-none text-[#E8C96A]">{isStart ? '입실' : '퇴실'}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <div className="border-t border-neutral-200 p-3">
          <button
            disabled={!ready}
            onClick={() => onApply(start, end)}
            className="w-full rounded-lg bg-[#C9A84C] py-3.5 text-[15px] font-bold text-white disabled:bg-neutral-300"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 예약 정보 입력
// ─────────────────────────────────────────────────────────────

type Summary = {
  mode: Mode;
  checkIn: string;
  checkOut: string;
  nights: number;
  daesilTime: string;
};

/** 대실 이용 시간 안내: '14:00~20:00 (6시간)' */
function daesilInfo(room: ReserveRoom, checkIn: string, time: string) {
  const slot = daesilSlot(room, checkIn, time);
  return slot ? `${time}~${slot.end} 이용 (${fmtDuration(slot.minutes)})` : '';
}

function UsageLines({ room, summary }: { room: ReserveRoom; summary: Summary }) {
  return (
    <dl className="grid grid-cols-[72px_1fr] gap-y-1.5 text-[14px]">
      <dt className="text-neutral-500">객실</dt>
      <dd className="font-semibold">{room.name}</dd>
      <dt className="text-neutral-500">{summary.mode === 'stay' ? '숙박' : '대실'}</dt>
      <dd>
        {summary.mode === 'stay'
          ? `${fmtDay(summary.checkIn)} ~ ${fmtDay(summary.checkOut)} (${summary.nights}박)`
          : `${fmtDay(summary.checkIn)} ${daesilInfo(room, summary.checkIn, summary.daesilTime)}`}
      </dd>
    </dl>
  );
}

function FormView({
  room, price, summary, onBack, onSubmit,
}: {
  room: ReserveRoom;
  price: number;
  summary: Summary;
  onBack: () => void;
  onSubmit: (data: FormData) => Promise<string | null>;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [visit, setVisit] = useState<'walk' | 'car'>('walk');
  const visitOptions = room.walkOnly
    ? ([['walk', '도보', Footprints]] as const)
    : ([['walk', '도보', Footprints], ['car', '차량', Car]] as const);
  const [carNo, setCarNo] = useState('');
  const [request, setRequest] = useState('');
  const [pay, setPay] = useState<PayMethod>('onsite');
  const [agree, setAgree] = useState({ policy: false, privacy: false });
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [website, setWebsite] = useState(''); // 봇 차단용 숨은 칸

  const phoneOk = PHONE_RE.test(phone.trim());
  const errors = {
    name: !name.trim() ? '예약자 이름을 입력하세요' : '',
    phone: !phoneOk ? '휴대폰 번호를 정확히 입력하세요 (예: 010-1234-5678)' : '',
    carNo: visit === 'car' && !carNo.trim() ? '차량번호를 입력하세요' : '',
    agree: !(agree.policy && agree.privacy) ? '필수 약관에 동의해 주세요' : '',
  };
  const valid = !Object.values(errors).some(Boolean);

  const handleSubmit = async () => {
    setTried(true);
    setServerError('');
    if (!valid || sending) return;
    setSending(true);
    const err = await onSubmit({
      guestName: name.trim(),
      phone: phone.trim(),
      visit,
      carNo: carNo.trim(),
      request: request.trim(),
      payMethod: pay,
      agree: agree.policy && agree.privacy,
      website,
    });
    setSending(false);
    if (err) setServerError(err);
  };

  const input = 'w-full rounded-lg border border-neutral-300 px-3 py-3 text-[15px] outline-none focus:border-[#C9A84C]';
  const err = (m: string) => (tried && m ? <p className="mt-1 text-xs text-red-500">{m}</p> : null);

  return (
    <Shell>
      <TopBar title="예약하기" onBack={onBack} />
      <PrototypeNotice />

      <div className="bg-neutral-100 pb-28">
        <section className="bg-[#fff] px-4 py-4">
          <h2 className="mb-3 text-[16px] font-bold">예약 내용</h2>
          <UsageLines room={room} summary={summary} />
        </section>

        <section className="mt-2 bg-[#fff] px-4 py-4 space-y-4">
          <h2 className="text-[16px] font-bold">예약자 정보</h2>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">예약자 이름</label>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
            {err(errors.name)}
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-600">휴대폰 번호</label>
            <input
              className={input}
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-1234-5678"
            />
            <p className="mt-1 text-xs text-neutral-500">예약 확정 문자가 이 번호로 발송됩니다.</p>
            {err(errors.phone)}
          </div>
        </section>

        <section className="mt-2 bg-[#fff] px-4 py-4 space-y-3">
          <h2 className="text-[16px] font-bold">방문 방법</h2>
          <div className={`grid gap-2 ${visitOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {visitOptions.map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setVisit(v)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-3 text-[15px] ${
                  visit === v ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 text-neutral-700'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          {room.walkOnly && (
            <p className="text-xs text-neutral-500">이 객실은 도보 방문 전용 상품입니다 (주차 불가).</p>
          )}
          {visit === 'car' && (
            <div>
              <input className={input} value={carNo} onChange={(e) => setCarNo(e.target.value)} placeholder="차량번호 (예: 12가 3456)" />
              {err(errors.carNo)}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-neutral-600">요청사항 (선택)</label>
            <textarea
              className={`${input} min-h-[80px]`}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="예: 늦은 입실 예정, 금연 객실 희망"
            />
          </div>
        </section>

        <section className="mt-2 bg-[#fff] px-4 py-4 space-y-2">
          <h2 className="mb-1 text-[16px] font-bold">결제 방법</h2>
          {([
            ['onsite', '현장 결제', '입실 시 프런트에서 카드·현금으로 결제'],
            ['transfer', '무통장 입금', '입금 계좌는 확정 문자로 안내드립니다'],
          ] as const).map(([v, label, desc]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                pay === v ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-neutral-300'
              }`}
            >
              <input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} className="mt-1 accent-[#C9A84C]" />
              <span>
                <span className="block text-[15px] font-semibold">{label}</span>
                <span className="block text-xs text-neutral-500">{desc}</span>
              </span>
            </label>
          ))}
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-neutral-300 p-3 text-neutral-400">
            <input type="radio" disabled className="mt-1" />
            <span>
              <span className="block text-[15px] font-semibold">카드 · 카카오페이 · 네이버페이</span>
              <span className="block text-xs">온라인 결제 준비 중</span>
            </span>
          </div>
        </section>

        <section className="mt-2 bg-[#fff] px-4 py-4">
          <h2 className="mb-2 text-[16px] font-bold">취소 · 환불 규정</h2>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-neutral-600">
            {CANCEL_POLICY.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3 text-[14px]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#C9A84C]"
                checked={agree.policy && agree.privacy}
                onChange={(e) => setAgree({ policy: e.target.checked, privacy: e.target.checked })}
              />
              <span className="font-semibold">전체 동의</span>
            </label>
            <label className="flex items-center gap-2 pl-1">
              <input type="checkbox" className="h-4 w-4 accent-[#C9A84C]" checked={agree.policy} onChange={(e) => setAgree({ ...agree, policy: e.target.checked })} />
              <span>[필수] 취소 · 환불 규정 동의</span>
            </label>
            <label className="flex items-center gap-2 pl-1">
              <input type="checkbox" className="h-4 w-4 accent-[#C9A84C]" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
              <span>
                [필수] 개인정보 수집 · 이용 동의{' '}
                <Link href="/privacy" className="text-xs text-neutral-400 underline">보기</Link>
              </span>
            </label>
            {err(errors.agree)}
          </div>
          {/* 봇 차단용 — 화면에 보이지 않는 칸 */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </section>
      </div>

      {/* 하단 고정 예약 버튼 */}
      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-neutral-200 bg-[#fff] p-3">
        {serverError && <p className="mb-2 text-center text-sm text-red-600">{serverError}</p>}
        <button
          onClick={handleSubmit}
          disabled={sending}
          className="w-full rounded-lg bg-[#C9A84C] py-4 text-[16px] font-bold text-white disabled:opacity-60"
        >
          {sending ? '예약 신청 중…' : `${won(price)} 예약 신청하기`}
        </button>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────
// 신청 완료
// ─────────────────────────────────────────────────────────────

function DoneView({
  room, price, summary, code,
}: { room: ReserveRoom; price: number; summary: Summary; code: string }) {
  return (
    <Shell>
      <TopBar title="예약 신청 완료" backHref="/" />
      <PrototypeNotice />
      <div className="px-5 py-10 text-center">
        <CheckCircle2 size={56} className="mx-auto text-[#C9A84C]" />
        <h2 className="mt-4 text-[20px] font-bold">예약 신청이 접수되었습니다</h2>
        <p className="mt-2 text-[14px] leading-6 text-neutral-600">
          호텔에서 확인 후 <b>예약 확정 문자</b>를 보내드립니다.
          <br />
          문자를 받으시면 예약이 확정됩니다.
        </p>
      </div>
      <section className="mx-4 rounded-xl border border-neutral-200 p-4">
        <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-3">
          <span className="text-sm text-neutral-500">예약번호</span>
          <span className="font-mono text-[15px] font-bold">{code}</span>
        </div>
        <UsageLines room={room} summary={summary} />
        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-sm text-neutral-500">결제 예정 금액</span>
          <span className="text-[18px] font-bold">{won(price)}</span>
        </div>
      </section>
      <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-neutral-100 p-3 text-[13px] text-neutral-600">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <span>확정 문자가 30분 안에 오지 않으면 호텔로 전화 주세요. 031-464-9661</span>
      </div>
      <div className="p-4">
        <Link href="/" className="block w-full rounded-lg bg-[#111] py-3.5 text-center text-[15px] font-semibold text-white">
          홈으로
        </Link>
      </div>
    </Shell>
  );
}
