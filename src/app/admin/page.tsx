'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    } else {
      const data = await res.json();
      setError(data.error ?? '오류가 발생했습니다.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: '#111', border: '1px solid #222' }}>
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold tracking-widest uppercase" style={{ color: '#b8964a' }}>
            ILLOWA
          </h1>
          <p className="text-xs mt-1" style={{ color: '#555' }}>관리자 대시보드</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5 tracking-wide" style={{ color: '#888' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호 입력"
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: '#1a1a1a', color: '#e5e5e5', border: '1px solid #333' }}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide transition-opacity disabled:opacity-40"
            style={{ background: '#b8964a', color: '#fff' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
