'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

// Main nav — always visible
const MAIN_NAV = [
  { href: '/admin/hotel/sales', label: '판매 입력', icon: '📝' },
  { href: '/admin/hotel/bookings', label: '연박 현황', icon: '🛏️' },
  { href: '/admin/hotel/receivables', label: '미수 관리', icon: '💰' },
  { href: '/admin/hotel/reservations', label: '예약 현황', icon: '📅' },
];

// Admin submenu — shown when "관리자" is clicked
const ADMIN_NAV = [
  { href: '/admin/hotel/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/hotel/closing', label: '일일 마감', icon: '📋' },
  { href: '/admin/hotel/rooms', label: '객실 현황', icon: '🏨' },
  { href: '/admin/hotel/invoices', label: '인보이스', icon: '🧾' },
  { href: '/admin/hotel/complaints', label: '컴플레인', icon: '⚠️' },
  { href: '/admin/hotel/audit', label: '변경이력', icon: '📜' },
  { href: '/admin/dashboard', label: '챗봇 관리', icon: '💬' },
];

export default function HotelAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  };

  // Check if current page is in admin submenu
  const isAdminPage = ADMIN_NAV.some((item) => pathname === item.href);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-xl p-1 text-gray-700"
          >
            ☰
          </button>
          <Link href="/admin/hotel/sales" className="text-[#C9A84C] font-bold text-lg">
            일로와 호텔
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-[#C9A84C] text-black'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          {/* Admin dropdown */}
          <div className="relative">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isAdminPage
                  ? 'bg-[#C9A84C] text-black'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              ⚙️ 관리자 {adminOpen ? '▲' : '▼'}
            </button>
            {adminOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAdminOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                  {ADMIN_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAdminOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition-colors ${
                        pathname === item.href
                          ? 'bg-[#C9A84C]/10 text-[#C9A84C] font-bold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-3 rounded-lg text-sm ${
                pathname === item.href
                  ? 'bg-[#C9A84C] text-black font-medium'
                  : 'text-gray-700'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2">
            <div className="px-4 py-1 text-xs text-gray-400 font-medium">관리자</div>
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-sm ${
                  pathname === item.href
                    ? 'bg-[#C9A84C] text-black font-medium'
                    : 'text-gray-500'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className={`mx-auto py-6 ${
        pathname === '/admin/hotel/sales' ? 'max-w-[1920px] px-4 xl:px-8' : pathname === '/admin/hotel/reservations' ? 'max-w-6xl px-4' : 'max-w-7xl px-4'
      }`}>
        {children}
      </main>
    </div>
  );
}
