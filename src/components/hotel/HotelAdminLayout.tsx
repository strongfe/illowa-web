'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin/hotel/sales', label: '판매 입력', icon: '📝' },
  { href: '/admin/hotel/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/hotel/closing', label: '일일 마감', icon: '📋' },
  { href: '/admin/hotel/rooms', label: '객실 현황', icon: '🏨' },
  { href: '/admin/hotel/reservations', label: '예약 현황', icon: '📅' },
  { href: '/admin/hotel/receivables', label: '미수 관리', icon: '💰' },
];

export default function HotelAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  };

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
          <Link href="/admin/hotel/dashboard" className="text-[#C9A84C] font-bold text-lg">
            일로와 호텔
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
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
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/admin/hotel/complaints" className="text-xs text-gray-500 hover:text-gray-700">
            컴플레인
          </Link>
          <Link href="/admin/hotel/audit" className="text-xs text-gray-500 hover:text-gray-700">
            변경이력
          </Link>
          <Link href="/admin/dashboard" className="text-xs text-gray-500 hover:text-gray-700">
            챗봇 관리
          </Link>
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
          {NAV_ITEMS.map((item) => (
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
