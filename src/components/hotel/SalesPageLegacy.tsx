'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Sale, SaleInput, Room, RoomType, SaleType, SplitMethod, RoomRate } from '@/types/hotel';
import { OTA_CHANNELS, OTHER_CHANNELS, PAYMENT_METHODS, ROOM_TYPE_CAPACITY } from '@/types/hotel';

const ROOM_TYPES: RoomType[] = ['GS', 'GD', 'S', 'D', 'P', 'PT'];

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function fmtTime(t: number | null) {
  if (t == null) return '';
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  visit_count: number;
  total_spent: number;
  preferred_room_type: string | null;
  last_visit_date: string | null;
  memo: string | null;
  marketing_consent: boolean;
}

const INITIAL_FORM: SaleInput = {
  sale_date: today(),
  sale_type: '대실',
  channel: '',
  payment_method: '',
  guest_name: '',
  room_type: 'S',
  check_in_time: undefined,
  check_out_time: undefined,
  amount: 0,
  room_id: undefined,
  room_number: '',
  car_number: '',
  memo: '',
  extra_payment_method: '',
  extra_amount: 0,
};

// ─── 6파트 그리드 분류 ───
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

function sumBaseAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + r.amount, 0);
}

function sumExtraAmount(sales: Sale[]) {
  return sales.reduce((s, r) => s + (r.extra_amount || 0), 0);
}

// ═══════════════════════════════════════
// Main Component
// ═══════════════════════════════════════
export default function SalesPageLegacy() {
  const [saleDate, setSaleDate] = useState(today());
  const [sales, setSales] = useState<Sale[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);

  // 모바일 접이식 상태
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [availPopup, setAvailPopup] = useState(false);
  const [helpPopup, setHelpPopup] = useState(false);
  const [complaintRooms, setComplaintRooms] = useState<Set<string>>(new Set());

  const fetchSales = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/sales?date=${saleDate}`);
    if (res.ok) setSales(await res.json());
  }, [saleDate]);

  const fetchRooms = useCallback(async () => {
    const res = await fetch(`/api/admin/hotel/rooms`);
    if (res.ok) setRooms(await res.json());
  }, []);

  const fetchComplaints = useCallback(async () => {
    const res = await fetch('/api/admin/hotel/complaints?status=open');
    if (res.ok) {
      const data: Array<{ room_number: string | null }> = await res.json();
      setComplaintRooms(new Set(data.map(c => c.room_number).filter(Boolean) as string[]));
    }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  // 30초 자동 새로고침
  useEffect(() => {
    const interval = setInterval(fetchSales, 30000);
    return () => clearInterval(interval);
  }, [fetchSales]);

  const groups = groupSales(sales);

  const openNewSale = (channel: string, saleType: SaleType) => {
    setEditSale(null);
    setModalOpen(true);
    // SaleModal에서 초기값 설정됨
    modalDefaultRef.current = { channel, sale_type: saleType };
  };

  const openEditSale = (sale: Sale) => {
    setEditSale(sale);
    modalDefaultRef.current = null;
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditSale(null);
    fetchSales();
  };

  const handleToggleCheckout = async (sale: Sale) => {
    const newStatus = sale.status === 'checked_out' ? 'active' : 'checked_out';
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sale.id, status: newStatus }),
    });
    fetchSales();
  };

  const modalDefaultRef = useRef<{ channel: string; sale_type: SaleType } | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 전체 요약
  const allDaesil = sales.filter(s => s.sale_type === '대실');
  const allSukbak = sales.filter(s => s.sale_type === '숙박');

  // 타입별 판매가능 현황 계산
  const availability = ROOM_TYPES.map(rt => {
    const total = ROOM_TYPE_CAPACITY[rt];
    const typeSales = sales.filter(s => s.room_type === rt);

    // 대실가능 = 총실 - (대실active + 조기숙박active) + 대실checked_out
    const daesilActive = typeSales.filter(s => s.sale_type === '대실' && s.status === 'active').length;
    const earlySukbak = typeSales.filter(s => s.sale_type === '숙박' && s.status === 'active' && s.check_in_time != null && s.check_in_time < 16).length;
    const daesilOut = typeSales.filter(s => s.sale_type === '대실' && s.status === 'checked_out').length;
    const daesilAvail = total - (daesilActive + earlySukbak) + daesilOut;

    // 숙박가능 = 총실 - 숙박 전체 (active + checked_out)
    const sukbakTotal = typeSales.filter(s => s.sale_type === '숙박').length;
    const sukbakAvail = total - sukbakTotal;

    return { rt, total, daesilAvail, sukbakAvail };
  });

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
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
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
            className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => { setEditSale(null); modalDefaultRef.current = null; setModalOpen(true); }}
            className="px-4 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A] transition-colors"
          >
            + 판매 추가
          </button>
        </div>
      </div>

      {/* 타입별 판매가능 현황 팝업 */}
      {availPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAvailPopup(false)}>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mx-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#C9A84C]">타입별 잔여현황</h2>
              <button onClick={() => setAvailPopup(false)} className="text-gray-500 hover:text-gray-900 text-xl">&times;</button>
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
                  {availability.map(a => (
                    <tr key={a.rt} className="border-t border-gray-200">
                      <td className="px-3 py-2 font-bold">{a.rt}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{a.total}</td>
                      <td className={`px-3 py-2 text-center font-bold ${
                        a.daesilAvail <= 0 ? 'text-red-400' : a.daesilAvail <= 2 ? 'text-orange-400' : 'text-emerald-400'
                      }`}>{a.daesilAvail}</td>
                      <td className={`px-3 py-2 text-center font-bold ${
                        a.sukbakAvail <= 0 ? 'text-red-400' : a.sukbakAvail <= 2 ? 'text-orange-400' : 'text-emerald-400'
                      }`}>{a.sukbakAvail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 사용설명서 팝업 */}
      {helpPopup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8" onClick={() => setHelpPopup(false)}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 mx-4 max-w-2xl w-full space-y-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#C9A84C]">일로와 호텔 관리 시스템 사용설명서</h2>
              <button onClick={() => setHelpPopup(false)} className="text-gray-500 hover:text-gray-900 text-xl">&times;</button>
            </div>

            <HelpSection title="1. 판매 입력 (판매 현황판)" items={[
              { label: '+ 판매 추가', desc: '상단 버튼 클릭 또는 각 파트의 +추가 클릭' },
              { label: '1박 모드', desc: '대실/숙박 > 채널(야놀자/여기어때/기타) > 타입 > 성명/금액 > 저장' },
              { label: '연박 모드', desc: '연박 탭 > 입실일/퇴실일 > 총액 > 분배방식(균등/요일별/수동) > 일별 금액 자동 생성' },
              { label: '행 클릭', desc: '수정 모달 (모든 필드 수정 + 퇴실처리 + 삭제 + 변경이력 보기)' },
              { label: '퇴실(OUT)', desc: '퇴실 컬럼 ☐ 클릭 → ☑퇴실 토글 (한번 더 클릭하면 복원)' },
              { label: '잔여현황 버튼', desc: '타입별 대실/숙박 가능 객실 수 팝업 (빨강=0, 주황=1~2, 초록=3+)' },
              { label: '6파트 그리드', desc: '야놀자/여기어때/기타 x 대실/숙박 = 6개 파트, 소계 자동 표시' },
            ]} />

            <HelpSection title="2. 결제 시점 (현장/예약금/완불)" items={[
              { label: '현장결제', desc: '당일 체크인 시 결제 (기본값). sale_date = 오늘' },
              { label: '예약금', desc: '"숙박 예정일" 선택(필수) > 예약금 결제수단+금액 입력 > 잔금 자동계산. 해당일에 판매현황판 자동 표시' },
              { label: '완불', desc: '"숙박 예정일" 선택(필수) > 전액 선결제. 예약현황에서 확인 가능' },
              { label: '미수', desc: '결제수단에서 "미수" 선택 > 미수관리 페이지에서 추적. 빨간 "미수" 배지 표시' },
              { label: '잔금 수금', desc: '예약금 건 수정 모달에서 "잔금 결제 처리" 버튼 > 결제수단 선택' },
            ]} />

            <HelpSection title="3. 채널 구분" items={[
              { label: '야놀자', desc: 'OTA 예약, 결제수단 자동 "야놀자"로 설정' },
              { label: '여기어때', desc: 'OTA 예약, 결제수단 자동 "여기어때"로 설정' },
              { label: '기타 > 워킹', desc: '현장 방문 고객 (결제수단 별도 선택)' },
              { label: '기타 > 연장', desc: '대실에서 숙박으로 연장 (시간연장/숙박전환)' },
              { label: '기타 > 예약', desc: '전화/직접 예약 고객' },
            ]} />

            <HelpSection title="4. 고객 정보 (CRM)" items={[
              { label: '전화번호 입력', desc: '입력 즉시 기존 고객 자동 검색 (010-자동포맷)' },
              { label: '재방문 고객', desc: '골드 배지 "재방문 N회" + 선호타입/누적금액/최근방문/메모 표시' },
              { label: '신규 고객', desc: '파란 "신규" 배지, 저장 시 자동 등록' },
              { label: '마케팅 동의', desc: '프로모션/할인 안내 수신 동의 체크 (기본 해제)' },
              { label: '고객 정보 접기', desc: '기본 접힌 상태, "고객 정보" 클릭하면 펼쳐짐' },
            ]} />

            <HelpSection title="5. 추가 컬럼 (추결/추금액/메모)" items={[
              { label: '추가결제수단', desc: '기본 결제 외 추가 결제 시 카드사/현금 선택' },
              { label: '추가금액', desc: '추가 결제 금액 입력 (노란색 "+금액" 표시)' },
              { label: '메모', desc: '시간연장, 추가인원, 차량추가, 당특 등 비고사항' },
              { label: '당특 배지', desc: '메모에 "당특" 포함 시 빨간 배지 자동 표시' },
            ]} />

            <HelpSection title="6. 대시보드" items={[
              { label: '요약 카드', desc: '대실건수/금액, 숙박건수/금액, 총매출, 공실 수 실시간 확인' },
              { label: '타입별 현황', desc: 'GS/GD/S/D/P/PT별 총실/예약/입실/퇴실/공실 테이블' },
              { label: '채널별 매출', desc: '채널별 건수, 대실매출, 숙박매출, 합계 (매출 순 정렬)' },
              { label: '날짜 선택', desc: '과거 날짜 데이터도 조회 가능' },
              { label: '자동 갱신', desc: '30초마다 자동 새로고침' },
            ]} />

            <HelpSection title="7. 일일 마감" items={[
              { label: '매출 자동 집계', desc: '대실/숙박 건수와 금액 자동 계산, 전일 날짜 기본 선택' },
              { label: '카드 정산', desc: '8개 카드사별: 당일매출+선결제+미수회수 = 시스템합계 vs 단말기금액 입력 > 차액 표시' },
              { label: '현금 정산', desc: '현금합계(당일+선결제+미수) + 전일시재 - 지출 = 잔액 vs 실제시재(직원 확인)' },
              { label: '계좌 정산', desc: '계좌합계(당일+선결제+미수) vs 실제입금액(통장 확인)' },
              { label: 'OTA 참고', desc: '야놀자/여기어때 매출 x 수수료율 = 예상정산금 (참고용)' },
              { label: '현금지출 입력', desc: '지출 항목+금액 추가/삭제, 합계 자동 계산' },
              { label: '미수 현황', desc: '당일 발생 미수, 누적 미수 잔액 표시' },
              { label: '정산 요약', desc: '카드/현금/계좌 시스템 vs 실제 대비표, 모두 OK이면 초록 마감' },
              { label: '마감 확인', desc: '차액 있어도 마감 가능 (메모에 사유 기재)' },
            ]} />

            <HelpSection title="8. 객실 현황" items={[
              { label: '층별 표시', desc: '9층~2층 객실 카드, 타입별 테두리 색상 구분' },
              { label: '회색 = 공실', desc: '비어있는 객실' },
              { label: '파랑 = 대실', desc: '대실 사용중 (성명 표시)' },
              { label: '초록 = 숙박', desc: '숙박중 (연박은 "숙박 3/17박" + 퇴실예정일 표시)' },
              { label: '보라 = 대실+숙박', desc: '같은 방에 대실 후 숙박 배정 (양쪽 정보 표시)' },
              { label: '카드 클릭', desc: '상세 정보 팝업 + 각 건별 퇴실 처리 버튼' },
              { label: '예약 도착 알림', desc: '오늘 도착 예약 건수 + 미배정 예약 경고 표시' },
              { label: '컴플레인 경고', desc: '미처리 컴플레인 있는 객실에 빨간 ! 표시' },
            ]} />

            <HelpSection title="9. 예약 현황" items={[
              { label: '미래 예약 목록', desc: '예약금/완불로 입력한 미래 숙박 건 조회' },
              { label: '요약 카드', desc: '오늘도착, 내일도착, 이번주, 잔금대기 건수/금액' },
              { label: '결제상태 배지', desc: '완불(초록), 잔금대기(주황), 결제완료(초록)' },
              { label: '잔금 수금', desc: '"잔금수금" 버튼 > 결제수단 선택 > 수금 완료' },
              { label: '예약 취소', desc: '"취소" 버튼 > 취소 사유 입력 (환불 여부 메모)' },
              { label: '자동 전환', desc: '숙박일이 되면 판매 현황판에 자동 표시 (별도 작업 불필요)' },
            ]} />

            <HelpSection title="10. 미수 관리" items={[
              { label: '미수 발생', desc: '결제수단 "미수" 선택 시 자동 등록' },
              { label: '미수 목록', desc: '날짜/성명/금액/경과일/상태/연락처 테이블' },
              { label: '상태 구분', desc: '미수(7일내) > 주의(7~30일/주황) > 장기미수(30일+/빨강)' },
              { label: '수금 처리', desc: '"수금" 버튼 > 결제수단 선택 > 메모 입력 > 완료' },
              { label: '수금완료 이력', desc: '하단 접이식 섹션에서 수금완료 건 확인' },
              { label: '현황판 배지', desc: '판매 현황판에 빨간 "미수" / 초록 "수금" 배지 표시' },
            ]} />

            <HelpSection title="11. 컴플레인 관리" items={[
              { label: '접수', desc: '"+ 접수" 버튼 > 호실/카테고리/내용/우선순위/담당 입력' },
              { label: '카테고리', desc: '시설(에어컨/수압/TV/PC 등), 청결(냄새/벌레 등), 서비스(소음/주차 등), 기타' },
              { label: '우선순위', desc: '긴급(빨강) > 높음(주황) > 보통(회색) > 낮음' },
              { label: '시간순 보기', desc: '전체 컴플레인 시간순 목록, 상태 필터 가능' },
              { label: '호실별 보기', desc: '같은 호실 반복 이슈 감지 (3건 이상 → "반복 이슈" 빨간 배지)' },
              { label: '고객별 보기', desc: '고객별 컴플레인 이력 그룹핑' },
              { label: '상태 변경', desc: '미처리→접수(담당자+계획)→완료(처리내용)→종결' },
              { label: '연동 경고', desc: '판매현황판/객실현황에 미처리 컴플레인 호실 빨간 ! 표시' },
            ]} />

            <HelpSection title="12. 변경 이력 (감사 로그)" items={[
              { label: '자동 기록', desc: '판매/예약/고객/마감/지출 등 모든 변경이 자동 기록' },
              { label: '필터', desc: '테이블별(판매/예약/고객 등), 액션별(등록/수정/삭제), 날짜별 필터' },
              { label: '수정 상세', desc: '변경 전/후 필드별 비교 (빨강=이전, 초록=이후)' },
              { label: '삭제 복원', desc: '삭제된 데이터 확인 + "복원" 버튼으로 복구 가능' },
              { label: '건별 이력', desc: '판매 수정 모달 하단 "변경이력 보기" 링크' },
            ]} />

            <HelpSection title="배지/아이콘 가이드" items={[
              { label: '연박 (골드)', desc: '연박 예약으로 생성된 일별 레코드' },
              { label: '당특 (빨강)', desc: '메모에 "당특" 포함된 당일특가 건' },
              { label: '미수 (빨강)', desc: '미결제 건 (미수관리에서 추적)' },
              { label: '수금 (초록)', desc: '미수 수금 완료된 건' },
              { label: '예약금 (파랑)', desc: '예약금 결제, 잔금 대기 중' },
              { label: '완불 (초록)', desc: '전액 선결제 완료' },
              { label: '결제완료 (초록)', desc: '예약금 잔금까지 수금 완료' },
              { label: '☑퇴실 (주황)', desc: '퇴실 처리 완료 (행 연회색)' },
              { label: '! (빨강)', desc: '해당 호실에 미처리 컴플레인 있음' },
            ]} />

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">문의: 관리자에게 연락 | 우측 상단 메뉴: 컴플레인, 변경이력, 챗봇관리</p>
              <button onClick={() => setHelpPopup(false)}
                className="mt-3 px-6 py-2 bg-[#C9A84C] text-black font-bold rounded-lg text-sm hover:bg-[#E8C96A]">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6파트 그리드 ─── */}
      {/* 대실 행 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <SalesPartPanel
          title="야놀자" saleType="대실" sales={groups.yanolja_daesil} isEtc={false}
          collapsed={collapsed['yd']} onToggle={() => toggleCollapse('yd')}
          onClickRow={openEditSale} onAdd={() => openNewSale('야놀자', '대실')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
        <SalesPartPanel
          title="여기어때" saleType="대실" sales={groups.yeogi_daesil} isEtc={false}
          collapsed={collapsed['ed']} onToggle={() => toggleCollapse('ed')}
          onClickRow={openEditSale} onAdd={() => openNewSale('여기어때', '대실')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
        <SalesPartPanel
          title="기타" saleType="대실" sales={groups.etc_daesil} isEtc={true}
          collapsed={collapsed['od']} onToggle={() => toggleCollapse('od')}
          onClickRow={openEditSale} onAdd={() => openNewSale('워킹', '대실')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
      </div>

      {/* 숙박 행 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <SalesPartPanel
          title="야놀자" saleType="숙박" sales={groups.yanolja_sukbak} isEtc={false}
          collapsed={collapsed['ys']} onToggle={() => toggleCollapse('ys')}
          onClickRow={openEditSale} onAdd={() => openNewSale('야놀자', '숙박')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
        <SalesPartPanel
          title="여기어때" saleType="숙박" sales={groups.yeogi_sukbak} isEtc={false}
          collapsed={collapsed['es']} onToggle={() => toggleCollapse('es')}
          onClickRow={openEditSale} onAdd={() => openNewSale('여기어때', '숙박')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
        <SalesPartPanel
          title="기타" saleType="숙박" sales={groups.etc_sukbak} isEtc={true}
          collapsed={collapsed['os']} onToggle={() => toggleCollapse('os')}
          onClickRow={openEditSale} onAdd={() => openNewSale('워킹', '숙박')} onToggleCheckout={handleToggleCheckout} complaintRooms={complaintRooms}
        />
      </div>

      {/* 전체 요약 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-6 text-sm justify-center">
          <span>대실 <b className="text-blue-400">{allDaesil.length}</b>건 <b className="text-blue-400">{fmt(sumAmount(allDaesil))}</b>원</span>
          <span>숙박 <b className="text-green-400">{allSukbak.length}</b>건 <b className="text-green-400">{fmt(sumAmount(allSukbak))}</b>원</span>
          <span>합계 <b className="text-[#C9A84C]">{sales.length}</b>건 <b className="text-[#C9A84C]">{fmt(sumAmount(sales))}</b>원</span>
        </div>
      </div>

      {/* 입력/수정 모달 */}
      {modalOpen && (
        <SaleModal
          saleDate={saleDate}
          rooms={rooms}
          editSale={editSale}
          defaults={modalDefaultRef.current}
          onClose={() => { setModalOpen(false); setEditSale(null); }}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// 파트 패널 (하나의 채널×유형 영역)
// ═══════════════════════════════════════
function SalesPartPanel({ title, saleType, sales, isEtc, collapsed, onToggle, onClickRow, onAdd, onToggleCheckout, complaintRooms }: {
  title: string;
  saleType: SaleType;
  sales: Sale[];
  isEtc: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onClickRow: (sale: Sale) => void;
  onAdd: () => void;
  onToggleCheckout: (sale: Sale) => void;
  complaintRooms: Set<string>;
}) {
  const headerBg = saleType === '대실' ? 'bg-emerald-100' : 'bg-blue-100';
  const total = sumAmount(sales);
  const extraTotal = sumExtraAmount(sales);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
      {/* 헤더 */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between`}>
        <button onClick={onToggle} className="flex items-center gap-2 flex-1 text-left">
          <span className="font-bold text-sm">{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${saleType === '대실' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {saleType}
          </span>
          <span className="text-xs text-gray-600">({sales.length}건)</span>
          <span className="xl:hidden text-gray-500 text-xs ml-auto">{collapsed ? '▼' : '▲'}</span>
        </button>
        <button onClick={onAdd} className="text-xs text-[#C9A84C] hover:text-[#E8C96A] ml-2 shrink-0">+추가</button>
      </div>

      {/* 테이블 */}
      {!collapsed && (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-gray-100 text-gray-500">
                <th className="px-2 py-1.5 text-left w-6">#</th>
                {isEtc && <th className="px-2 py-1.5 text-left">구분</th>}
                <th className="px-2 py-1.5 text-left">성명</th>
                <th className="px-2 py-1.5 text-center">타입</th>
                <th className="px-2 py-1.5 text-center">입실</th>
                <th className="px-2 py-1.5 text-center">퇴실</th>
                {isEtc && <th className="px-2 py-1.5 text-center">결제</th>}
                <th className="px-2 py-1.5 text-right">금액</th>
                <th className="px-2 py-1.5 text-center">호실</th>
                <th className="px-2 py-1.5 text-center">퇴실</th>
                <th className="px-2 py-1.5 text-center">추결</th>
                <th className="px-2 py-1.5 text-right">추금액</th>
                <th className="px-2 py-1.5 text-left">메모</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={isEtc ? 13 : 11} className="px-2 py-4 text-center text-gray-400">-</td></tr>
              )}
              {sales.map((sale, i) => {
                const isOut = sale.status === 'checked_out';
                const hasExtra = !!(sale.extra_amount && sale.extra_amount > 0);
                return (
                  <tr
                    key={sale.id}
                    onClick={() => onClickRow(sale)}
                    className={`cursor-pointer border-t border-gray-200 transition-colors hover:bg-[#C9A84C]/10 ${isOut ? 'text-gray-400' : 'text-gray-800'}`}
                  >
                    <td className="px-2 py-1.5 text-gray-500">{i + 1}</td>
                    {isEtc && <td className="px-2 py-1.5 text-gray-600">{sale.channel}</td>}
                    <td className="px-2 py-1.5 truncate max-w-[100px]">
                      {sale.guest_name || '-'}
                      {sale.booking_id && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30">연박</span>
                      )}
                      {sale.memo?.includes('당특') && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-red-100 text-red-700">당특</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">{sale.room_type}</td>
                    <td className="px-2 py-1.5 text-center">{fmtTime(sale.check_in_time)}</td>
                    <td className="px-2 py-1.5 text-center">{fmtTime(sale.check_out_time)}</td>
                    {isEtc && <td className="px-2 py-1.5 text-center text-gray-600">{sale.payment_method || ''}</td>}
                    <td className="px-2 py-1.5 text-right font-medium">
                      {fmt(sale.amount)}
                      {sale.is_receivable && !sale.resolved_at && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-red-100 text-red-700">미수</span>
                      )}
                      {sale.is_receivable && sale.resolved_at && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-green-100 text-green-700">수금</span>
                      )}
                      {sale.payment_timing === '예약금' && !sale.balance_paid && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700">예약금{sale.prepaid_amount ? ` ${fmt(sale.prepaid_amount)}` : ''}</span>
                      )}
                      {sale.payment_timing === '예약금' && sale.balance_paid && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-green-100 text-green-700">결제완료</span>
                      )}
                      {sale.payment_timing === '완불' && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[10px] bg-green-100 text-green-700">완불</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-600">
                      {sale.room_number || ''}
                      {sale.room_number && complaintRooms.has(sale.room_number) && (
                        <span className="ml-0.5 text-red-400" title="미처리 컴플레인 있음">!</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); onToggleCheckout(sale); }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                          isOut
                            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200/60'
                            : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                        }`}
                      >
                        {isOut ? '☑ 퇴실' : '☐'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-center text-gray-600">{sale.extra_payment_method || ''}</td>
                    <td className={`px-2 py-1.5 text-right ${hasExtra ? 'text-yellow-400 font-medium' : 'text-gray-400'}`}>
                      {hasExtra ? `+${fmt(sale.extra_amount)}` : ''}
                    </td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-[60px] truncate" title={sale.memo || ''}>
                      {sale.memo || ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* 소계 */}
          {sales.length > 0 && (
            <div className="px-3 py-1.5 bg-gray-100 text-xs text-gray-600 flex justify-between border-t border-gray-200">
              <span>소계: {sales.length}건</span>
              <span className="font-medium text-[#C9A84C]">
                {fmt(total)}원
                {extraTotal > 0 && <span className="text-yellow-400 ml-1">(+{fmt(extraTotal)})</span>}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// 입력/수정 모달 (1박 + 연박 통합)
// ═══════════════════════════════════════
export function SaleModal({ saleDate, rooms, editSale, defaults, onClose, onSaved, onDeleted }: {
  saleDate: string;
  rooms: Room[];
  editSale: Sale | null;
  defaults: { channel: string; sale_type: SaleType } | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isEdit = !!editSale;
  const [mode, setMode] = useState<'single' | 'multi'>('single');

  // 결제 시점
  const [payTiming, setPayTiming] = useState<'현장' | '예약금' | '완불'>(editSale?.payment_timing || '현장');
  const [stayDate, setStayDate] = useState(editSale?.sale_date || '');
  const [prepaidDate, setPrepaidDate] = useState(editSale?.prepaid_date || saleDate);
  const [prepaidAmount, setPrepaidAmount] = useState(editSale?.prepaid_amount || 0);
  const [prepaidMethod, setPrepaidMethod] = useState(editSale?.prepaid_method || '');

  const [form, setForm] = useState<SaleInput>(() => {
    if (editSale) {
      return {
        sale_date: editSale.sale_date, sale_type: editSale.sale_type,
        channel: editSale.channel, payment_method: editSale.payment_method || '',
        guest_name: editSale.guest_name, room_type: editSale.room_type,
        check_in_time: editSale.check_in_time ?? undefined,
        check_out_time: editSale.check_out_time ?? undefined,
        amount: editSale.amount, room_id: editSale.room_id ?? undefined,
        room_number: editSale.room_number || '', car_number: editSale.car_number,
        memo: editSale.memo, extra_payment_method: editSale.extra_payment_method || '',
        extra_amount: editSale.extra_amount || 0,
      };
    }
    return { ...INITIAL_FORM, sale_date: saleDate, sale_type: defaults?.sale_type || '대실', channel: defaults?.channel || '' };
  });

  const [channelGroup, setChannelGroup] = useState<'ota' | 'other' | ''>(() => {
    const ch = editSale?.channel || defaults?.channel || '';
    if (['야놀자', '여기어때'].includes(ch)) return 'ota';
    if (ch) return 'other';
    return '';
  });

  const [loading, setLoading] = useState(false);

  // 연박 전용
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [rates, setRates] = useState<RoomRate[]>([]);
  const [dailyPreview, setDailyPreview] = useState<{ date: string; day: string; amount: number }[]>([]);

  // 고객 정보
  const [customerOpen, setCustomerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<CustomerInfo | null>(null);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredRooms = rooms.filter(r => r.room_type === form.room_type);

  const setField = <K extends keyof SaleInput>(key: K, value: SaleInput[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const selectChannel = (ch: string, group: 'ota' | 'other') => {
    setChannelGroup(group);
    setField('channel', ch);
    if (group === 'ota') setField('payment_method', ch === '야놀자' ? '야놀자' : '여기어때');
  };

  const handlePhoneChange = (raw: string) => {
    const formatted = formatPhoneInput(raw);
    setPhone(formatted);
    setFoundCustomer(null);
    setIsNewCustomer(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length >= 10) {
      setCustomerSearching(true);
      searchTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/admin/hotel/customers/search?phone=${digits}`);
        if (res.ok) {
          const data = await res.json();
          if (data.found) {
            setFoundCustomer(data.customer); setIsNewCustomer(false); setCustomerOpen(true);
            if (data.customer.name && !form.guest_name) setField('guest_name', data.customer.name);
            if (data.customer.email) setEmail(data.customer.email);
            setMarketingConsent(data.customer.marketing_consent || false);
          } else { setIsNewCustomer(true); }
        }
        setCustomerSearching(false);
      }, 400);
    }
  };

  // 연박: 박수 계산
  const nights = checkInDate && checkOutDate
    ? Math.max(0, Math.round((new Date(checkOutDate + 'T00:00:00').getTime() - new Date(checkInDate + 'T00:00:00').getTime()) / 86400000))
    : 0;

  // 연박: 요일별 요금 조회
  useEffect(() => {
    if (mode !== 'multi') return;
    fetch(`/api/admin/hotel/rates?room_type=${form.room_type}`)
      .then(r => r.ok ? r.json() : [])
      .then(setRates);
  }, [mode, form.room_type]);

  // 연박: 일별 미리보기 계산
  useEffect(() => {
    if (mode !== 'multi' || nights < 2 || !totalAmount) { setDailyPreview([]); return; }
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dates: { date: string; day: string }[] = [];
    const d = new Date(checkInDate + 'T00:00:00');
    for (let i = 0; i < nights; i++) {
      dates.push({ date: d.toISOString().split('T')[0], day: dayNames[d.getDay()] });
      d.setDate(d.getDate() + 1);
    }

    if (splitMethod === 'equal') {
      const base = Math.floor(totalAmount / nights);
      const rem = totalAmount - base * nights;
      setDailyPreview(dates.map((dt, i) => ({ ...dt, amount: base + (i < rem ? 1 : 0) })));
    } else if (splitMethod === 'by_day') {
      const rateMap = new Map(rates.map(r => [r.day_type, r.rate]));
      const getDayType = (day: string) => {
        if (day === '금') return '금';
        if (day === '토') return '토';
        if (day === '일') return '일';
        return '평일';
      };
      const rawAmounts = dates.map(dt => rateMap.get(getDayType(dt.day)) || 0);
      const rawTotal = rawAmounts.reduce((s, a) => s + a, 0);
      if (rawTotal === 0) {
        const base = Math.floor(totalAmount / nights);
        const rem = totalAmount - base * nights;
        setDailyPreview(dates.map((dt, i) => ({ ...dt, amount: base + (i < rem ? 1 : 0) })));
      } else {
        const adjusted = rawAmounts.map((a, i) => {
          if (i === rawAmounts.length - 1) {
            return totalAmount - rawAmounts.slice(0, -1).reduce((s, x) => s + Math.round(totalAmount * x / rawTotal), 0);
          }
          return Math.round(totalAmount * a / rawTotal);
        });
        setDailyPreview(dates.map((dt, i) => ({ ...dt, amount: adjusted[i] })));
      }
    } else {
      setDailyPreview(dates.map(dt => ({ ...dt, amount: 0 })));
    }
  }, [mode, nights, totalAmount, splitMethod, checkInDate, rates]);

  // 1박 저장
  const handleSubmitSingle = async () => {
    if (!form.channel || !form.amount) return;
    setLoading(true);
    const payload: Record<string, unknown> = { ...form };
    if (!payload.check_in_time) delete payload.check_in_time;
    if (!payload.check_out_time) delete payload.check_out_time;
    if (!payload.room_id) delete payload.room_id;
    // 미수 자동 처리
    if (form.payment_method === '미수') {
      payload.is_receivable = true;
      payload.receivable_amount = form.amount;
    }
    // 결제 시점 처리
    payload.payment_timing = payTiming;
    if (payTiming === '예약금') {
      if (stayDate) payload.sale_date = stayDate;
      payload.prepaid_date = today();
      payload.prepaid_amount = prepaidAmount;
      payload.prepaid_method = prepaidMethod;
      payload.balance_amount = (form.amount || 0) - prepaidAmount;
      payload.balance_paid = false;
    } else if (payTiming === '완불') {
      if (stayDate) payload.sale_date = stayDate;
      payload.prepaid_date = today();
      payload.prepaid_amount = form.amount;
      payload.prepaid_method = form.payment_method;
      payload.balance_amount = 0;
      payload.balance_paid = true;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      payload.phone = phoneDigits; payload.email = email || undefined; payload.marketing_consent = marketingConsent;
    }
    const method = isEdit ? 'PUT' : 'POST';
    const body = isEdit ? { id: editSale!.id, ...payload } : payload;
    await fetch('/api/admin/hotel/sales', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    onSaved();
  };

  // 연박 저장
  const handleSubmitMulti = async () => {
    if (!form.channel || !totalAmount || nights < 2) return;
    setLoading(true);
    const room = rooms.find(r => r.id === form.room_id);
    const phoneDigits = phone.replace(/\D/g, '');
    const body: Record<string, unknown> = {
      guest_name: form.guest_name, room_type: form.room_type,
      room_id: form.room_id || undefined, room_number: room?.room_number || form.room_number || undefined,
      channel: form.channel, payment_method: form.payment_method || undefined,
      check_in_date: checkInDate, check_out_date: checkOutDate,
      total_amount: totalAmount, split_method: splitMethod,
      memo: form.memo || '',
      payment_timing: payTiming,
      prepaid_date: payTiming !== '현장' ? prepaidDate : undefined,
      prepaid_amount: payTiming === '예약금' ? prepaidAmount : undefined,
      prepaid_method: payTiming !== '현장' ? (prepaidMethod || form.payment_method) : undefined,
    };
    if (splitMethod === 'manual') {
      body.daily_amounts = dailyPreview.map(d => d.amount);
    }
    if (phoneDigits.length >= 10) {
      body.phone = phoneDigits; body.email = email || undefined; body.marketing_consent = marketingConsent;
    }
    await fetch('/api/admin/hotel/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setLoading(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!editSale || !confirm('삭제하시겠습니까?')) return;
    if (editSale.booking_id) {
      if (!confirm('연박 전체를 삭제합니다. 계속하시겠습니까?')) return;
      await fetch(`/api/admin/hotel/bookings?id=${editSale.booking_id}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/admin/hotel/sales?id=${editSale.id}`, { method: 'DELETE' });
    }
    onDeleted();
  };

  const handleCheckout = async () => {
    if (!editSale) return;
    await fetch('/api/admin/hotel/sales', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editSale.id, status: 'checked_out' }),
    });
    onSaved();
  };

  // ─── 공통 UI 빌더 ───
  const channelUI = (
    <div>
      <div className="flex gap-2 mb-2">
        {OTA_CHANNELS.map(ch => (
          <button key={ch} onClick={() => selectChannel(ch, 'ota')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              form.channel === ch ? ch === '야놀자' ? 'bg-pink-600 text-white' : 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>{ch}</button>
        ))}
        <button onClick={() => { setChannelGroup('other'); if (!OTHER_CHANNELS.includes(form.channel as typeof OTHER_CHANNELS[number])) setField('channel', '워킹'); }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${channelGroup === 'other' ? 'bg-[#C9A84C] text-black' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
          기타
        </button>
      </div>
      {channelGroup === 'other' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {OTHER_CHANNELS.map(ch => (
              <button key={ch} onClick={() => setField('channel', ch)}
                className={`flex-1 py-1.5 rounded-lg text-xs ${form.channel === ch ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{ch}</button>
            ))}
          </div>
          <select value={form.payment_method || ''} onChange={e => setField('payment_method', e.target.value)}
            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">결제수단 선택</option>
            {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
          </select>
        </div>
      )}
    </div>
  );

  const roomTypeUI = (
    <div className="grid grid-cols-6 gap-2">
      {ROOM_TYPES.map(rt => (
        <button key={rt} onClick={() => { setField('room_type', rt); setField('room_id', undefined); setField('room_number', ''); }}
          className={`py-2 rounded-lg text-sm font-medium transition-colors ${form.room_type === rt ? 'bg-[#C9A84C] text-black' : 'bg-gray-100 text-gray-700'}`}>{rt}</button>
      ))}
    </div>
  );

  const customerUI = (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setCustomerOpen(!customerOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 hover:bg-gray-100 transition-colors">
        <span className="text-xs text-gray-600 flex items-center gap-2">
          고객 정보
          {foundCustomer && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40">재방문 {foundCustomer.visit_count}회</span>}
          {isNewCustomer && phone.replace(/\D/g, '').length >= 10 && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-700 border border-blue-300">신규</span>}
        </span>
        <span className="text-gray-500 text-xs">{customerOpen ? '▲' : '▼'}</span>
      </button>
      {customerOpen && (
        <div className="p-3 space-y-3 bg-white">
          <div className="relative">
            <input type="tel" value={phone} onChange={e => handlePhoneChange(e.target.value)}
              className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm pr-16" placeholder="010-0000-0000" inputMode="numeric" />
            {customerSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">검색중...</span>}
          </div>
          {foundCustomer && (
            <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg p-2.5 space-y-1">
              <div className="text-[#C9A84C] font-bold text-xs">재방문 고객! ({foundCustomer.visit_count}회째)</div>
              <div className="text-[10px] text-gray-700 space-y-0.5">
                {foundCustomer.preferred_room_type && <p>선호: {foundCustomer.preferred_room_type}타입 | 누적: {fmt(foundCustomer.total_spent)}원</p>}
                {foundCustomer.last_visit_date && <p>최근: {foundCustomer.last_visit_date}</p>}
                {foundCustomer.memo && <p className="text-yellow-400/80">메모: {foundCustomer.memo}</p>}
              </div>
            </div>
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="이메일 (선택)" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#C9A84C]" />
            <span className="text-xs text-gray-600">마케팅 수신동의</span>
          </label>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8">
      <div className="bg-white rounded-xl border border-gray-200 w-full max-w-lg mx-4 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#C9A84C]">{isEdit ? '판매 수정' : '판매 추가'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-xl">&times;</button>
        </div>

        {/* 1박/연박 토글 (신규 입력 시에만) */}
        {!isEdit && (
          <div className="flex gap-2">
            <button onClick={() => setMode('single')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'single' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'}`}>1박</button>
            <button onClick={() => setMode('multi')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'multi' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-500'}`}>연박</button>
          </div>
        )}

        {/* ──── 1박 모드 ──── */}
        {(mode === 'single' || isEdit) && (
          <>
            <div className="flex gap-2">
              {(['대실', '숙박'] as SaleType[]).map(type => (
                <button key={type} onClick={() => setField('sale_type', type)}
                  className={`flex-1 py-2.5 rounded-lg font-bold transition-colors ${form.sale_type === type ? type === '대실' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{type}</button>
              ))}
            </div>
            {channelUI}
            {roomTypeUI}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">성명</label>
                <input type="text" value={form.guest_name || ''} onChange={e => setField('guest_name', e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="성명" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">금액</label>
                <input type="number" value={form.amount || ''} onChange={e => setField('amount', Number(e.target.value))}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="0" step={1000} />
              </div>
            </div>
            {/* 결제 시점 */}
            <div>
              <label className="block text-xs text-gray-600 mb-2">결제 시점</label>
              <div className="flex gap-2">
                {([['현장', '현장결제'], ['예약금', '예약금'], ['완불', '완불']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPayTiming(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${payTiming === v ? v === '완불' ? 'bg-green-700 text-white' : v === '예약금' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'}`}>{label}</button>
                ))}
              </div>
              {payTiming === '예약금' && (
                <div className="mt-3 space-y-2 bg-gray-100 rounded-lg p-3 border border-blue-200">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5 font-bold">숙박 예정일</label>
                    <input type="date" value={stayDate} onChange={e => setStayDate(e.target.value)}
                      className="w-full bg-gray-100 border border-blue-700 rounded px-2 py-1.5 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">예약금 결제수단</label>
                      <select value={prepaidMethod} onChange={e => setPrepaidMethod(e.target.value)}
                        className="w-full bg-gray-100 border border-gray-300 rounded px-2 py-1.5 text-xs">
                        <option value="">선택</option>
                        {PAYMENT_METHODS.filter(p => p !== '미수').map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">예약금 금액</label>
                      <input type="number" value={prepaidAmount || ''} onChange={e => setPrepaidAmount(Number(e.target.value))}
                        className="w-full bg-gray-100 border border-gray-300 rounded px-2 py-1.5 text-xs" step={1000} />
                    </div>
                  </div>
                  {form.amount > 0 && prepaidAmount > 0 && (
                    <p className="text-xs text-blue-400">잔금 {fmt(form.amount - prepaidAmount)}원 현장결제 예정</p>
                  )}
                </div>
              )}
              {payTiming === '완불' && (
                <div className="mt-3 space-y-2 bg-gray-100 rounded-lg p-3 border border-green-200">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5 font-bold">숙박 예정일</label>
                    <input type="date" value={stayDate} onChange={e => setStayDate(e.target.value)}
                      className="w-full bg-gray-100 border border-green-700 rounded px-2 py-1.5 text-xs" />
                  </div>
                  <p className="text-xs text-green-400">전액 선결제 완료</p>
                </div>
              )}
            </div>
            {customerUI}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">입실시간</label>
                <input type="number" value={form.check_in_time ?? ''} onChange={e => setField('check_in_time', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="14" step={0.5} min={0} max={24} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">퇴실시간</label>
                <input type="number" value={form.check_out_time ?? ''} onChange={e => setField('check_out_time', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="12" step={0.5} min={0} max={24} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">호실</label>
                <select value={form.room_id ?? ''} onChange={e => { const room = rooms.find(r => r.id === Number(e.target.value)); setField('room_id', room?.id); setField('room_number', room?.room_number || ''); }}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">선택 안함</option>
                  {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.room_number}호</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">차번호</label>
                <input type="text" value={form.car_number || ''} onChange={e => setField('car_number', e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="차번호" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">추가결제수단</label>
                <select value={form.extra_payment_method || ''} onChange={e => setField('extra_payment_method', e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">없음</option>
                  {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">추가금액</label>
                <input type="number" value={form.extra_amount || ''} onChange={e => setField('extra_amount', Number(e.target.value))}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="0" step={1000} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">메모</label>
              <input type="text" value={form.memo || ''} onChange={e => setField('memo', e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="시간연장, 추가인원, 차량추가 등" />
            </div>
            <div className="space-y-2 pt-2">
              <button onClick={handleSubmitSingle} disabled={loading || !form.channel || !form.amount}
                className="w-full py-3 rounded-lg font-bold text-base bg-[#C9A84C] text-black hover:bg-[#E8C96A] transition-colors disabled:opacity-40">
                {loading ? '저장 중...' : isEdit ? '수정 저장' : '저장'}
              </button>
              {isEdit && editSale!.payment_timing === '예약금' && !editSale!.balance_paid && (
                <button onClick={async () => {
                  const method = prompt('잔금 결제수단을 입력하세요 (국민/신한/현금/계좌 등)');
                  if (!method) return;
                  setLoading(true);
                  await fetch('/api/admin/hotel/sales', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editSale!.id, balance_method: method, balance_paid: true }),
                  });
                  setLoading(false); onSaved();
                }} className="w-full py-2.5 rounded-lg font-bold text-sm bg-blue-600 text-white hover:bg-blue-500 transition-colors">
                  잔금 {fmt(editSale!.balance_amount)}원 결제 처리
                </button>
              )}
              {isEdit && editSale!.status === 'active' && (
                <button onClick={handleCheckout} className="w-full py-2.5 rounded-lg font-bold text-sm bg-orange-600 text-white hover:bg-orange-500 transition-colors">퇴실 처리</button>
              )}
              {isEdit && (
                <button onClick={handleDelete} className="w-full py-2 rounded-lg text-sm text-red-400 hover:text-red-700 border border-red-900 hover:border-red-700 transition-colors">
                  {editSale!.booking_id ? '연박 전체 삭제' : '삭제'}
                </button>
              )}
              {isEdit && (
                <a href={`/admin/hotel/audit?record_id=${editSale!.id}`} target="_blank"
                  className="block w-full py-2 text-center rounded-lg text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  변경이력 보기
                </a>
              )}
            </div>
          </>
        )}

        {/* ──── 연박 모드 ──── */}
        {mode === 'multi' && !isEdit && (
          <>
            {channelUI}
            {roomTypeUI}
            <div>
              <label className="block text-xs text-gray-600 mb-1">성명</label>
              <input type="text" value={form.guest_name || ''} onChange={e => setField('guest_name', e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="성명" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">호실</label>
              <select value={form.room_id ?? ''} onChange={e => { const room = rooms.find(r => r.id === Number(e.target.value)); setField('room_id', room?.id); setField('room_number', room?.room_number || ''); }}
                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2">
                <option value="">선택 안함</option>
                {filteredRooms.map(r => <option key={r.id} value={r.id}>{r.room_number}호</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">입실일</label>
                <input type="date" value={checkInDate} onChange={e => setCheckInDate(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">퇴실일</label>
                <input type="date" value={checkOutDate} onChange={e => setCheckOutDate(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" />
              </div>
            </div>
            {nights >= 2 && (
              <div className="text-center text-sm font-bold text-purple-400">{nights}박</div>
            )}
            <div>
              <label className="block text-xs text-gray-600 mb-1">총액</label>
              <input type="number" value={totalAmount || ''} onChange={e => setTotalAmount(Number(e.target.value))}
                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="0" step={1000} />
              {nights >= 2 && totalAmount > 0 && splitMethod === 'equal' && (
                <p className="text-xs text-gray-500 mt-1">1박 평균 {fmt(Math.round(totalAmount / nights))}원</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-2">분배 방식</label>
              <div className="flex gap-2">
                {([['equal', '균등'], ['by_day', '요일별'], ['manual', '수동']] as [SplitMethod, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => setSplitMethod(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${splitMethod === m ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
                ))}
              </div>
            </div>
            {/* 일별 미리보기 */}
            {dailyPreview.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-100 text-gray-500"><th className="px-2 py-1 text-left">날짜</th><th className="px-2 py-1 text-center">요일</th><th className="px-2 py-1 text-right">금액</th></tr></thead>
                  <tbody>
                    {dailyPreview.map((d, i) => (
                      <tr key={d.date} className="border-t border-gray-200">
                        <td className="px-2 py-1 text-gray-700">{d.date.slice(5)}</td>
                        <td className="px-2 py-1 text-center text-gray-600">{d.day}</td>
                        <td className="px-2 py-1 text-right">
                          {splitMethod === 'manual' ? (
                            <input type="number" value={d.amount || ''} onChange={e => {
                              const updated = [...dailyPreview];
                              updated[i] = { ...d, amount: Number(e.target.value) };
                              setDailyPreview(updated);
                            }} className="w-20 bg-gray-100 border border-gray-300 rounded px-2 py-0.5 text-right text-xs" step={1000} />
                          ) : (
                            <span className="text-gray-800">{fmt(d.amount)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-300 bg-gray-100">
                      <td colSpan={2} className="px-2 py-1 font-bold text-gray-700">합계</td>
                      <td className="px-2 py-1 text-right font-bold text-[#C9A84C]">{fmt(dailyPreview.reduce((s, d) => s + d.amount, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {/* 연박 결제 시점 */}
            <div>
              <label className="block text-xs text-gray-600 mb-2">결제 시점</label>
              <div className="flex gap-2">
                {([['현장', '현장결제'], ['예약금', '예약금'], ['완불', '완불']] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setPayTiming(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${payTiming === v ? v === '완불' ? 'bg-green-700 text-white' : v === '예약금' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'}`}>{label}</button>
                ))}
              </div>
              {payTiming === '예약금' && (
                <div className="mt-2 space-y-2 bg-gray-100 rounded-lg p-3 border border-blue-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">예약금 결제수단</label>
                      <select value={prepaidMethod} onChange={e => setPrepaidMethod(e.target.value)}
                        className="w-full bg-gray-100 border border-gray-300 rounded px-2 py-1.5 text-xs">
                        <option value="">선택</option>
                        {PAYMENT_METHODS.filter(p => p !== '미수').map(pm => <option key={pm} value={pm}>{pm}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">예약금 금액</label>
                      <input type="number" value={prepaidAmount || ''} onChange={e => setPrepaidAmount(Number(e.target.value))}
                        className="w-full bg-gray-100 border border-gray-300 rounded px-2 py-1.5 text-xs" step={1000} />
                    </div>
                  </div>
                  {totalAmount > 0 && prepaidAmount > 0 && (
                    <p className="text-xs text-blue-400">잔금 {fmt(totalAmount - prepaidAmount)}원 현장결제 예정</p>
                  )}
                </div>
              )}
              {payTiming === '완불' && (
                <p className="mt-2 text-xs text-green-400 bg-gray-100 rounded-lg p-3 border border-green-200">전액 선결제 완료 (결제일: 오늘)</p>
              )}
            </div>
            {customerUI}
            <div>
              <label className="block text-xs text-gray-600 mb-1">메모</label>
              <input type="text" value={form.memo || ''} onChange={e => setField('memo', e.target.value)}
                className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2" placeholder="메모" />
            </div>
            <button onClick={handleSubmitMulti} disabled={loading || !form.channel || !totalAmount || nights < 2}
              className="w-full py-3 rounded-lg font-bold text-base bg-purple-700 text-white hover:bg-purple-600 transition-colors disabled:opacity-40">
              {loading ? '저장 중...' : `연박 저장 (${nights}박)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 사용설명서 섹션 컴포넌트
function HelpSection({ title, items }: { title: string; items: { label: string; desc: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#C9A84C] mb-2">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-gray-900 font-medium shrink-0 w-28">{item.label}</span>
            <span className="text-gray-600">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
