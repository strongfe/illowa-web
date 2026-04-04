'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Log {
  id: string;
  session_id: string;
  locale: string;
  user_message: string;
  assistant_response: string;
  created_at: string;
}

interface Evaluation {
  question_ko: string;
  answer_ko: string;
  category: string;
  rating: '정확' | '부정확' | '개선필요';
  rating_reason: string;
}

const LOCALE_FLAG: Record<string, string> = {
  ko: '🇰🇷', en: '🇺🇸', ja: '🇯🇵', zh: '🇨🇳',
  ru: '🇷🇺', es: '🇪🇸', fr: '🇫🇷', pt: '🇵🇹',
  id: '🇮🇩', hi: '🇮🇳',
};

const RATING_STYLE: Record<string, { bg: string; color: string }> = {
  '정확':    { bg: '#0f2a1a', color: '#4ade80' },
  '부정확':  { bg: '#2a0f0f', color: '#f87171' },
  '개선필요':{ bg: '#2a1f00', color: '#fbbf24' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [localeFilter, setLocaleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [evaluating, setEvaluating] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/logs?locale=${localeFilter}&page=${page}`);
    if (res.status === 401) { router.push('/admin'); return; }
    const json = await res.json();
    setLogs(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }, [localeFilter, page, router]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function evaluate(log: Log) {
    if (evaluations[log.id] || evaluating) return;
    setEvaluating(log.id);
    const res = await fetch('/api/admin/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_message: log.user_message,
        assistant_response: log.assistant_response,
        locale: log.locale,
      }),
    });
    const data = await res.json();
    setEvaluations((prev) => ({ ...prev, [log.id]: data }));
    setEvaluating(null);
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin');
  }

  // 언어별 통계
  const localeCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.locale] = (acc[l.locale] ?? 0) + 1;
    return acc;
  }, {});

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', color: '#e5e5e5' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10"
        style={{ background: '#111' }}>
        <div>
          <h1 className="text-base font-semibold tracking-widest uppercase" style={{ color: '#b8964a' }}>
            ILLOWA 관리자
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#555' }}>챗봇 대화 로그 분석</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" target="_blank"
            className="text-xs px-3 py-1.5 rounded-lg border"
            style={{ borderColor: '#333', color: '#888' }}>
            🌐 사이트 보기
          </a>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>
            로그아웃
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
            <p className="text-xs" style={{ color: '#666' }}>전체 대화</p>
            <p className="text-2xl font-bold mt-1" style={{ color: '#b8964a' }}>{total}</p>
          </div>
          {Object.entries(localeCounts).slice(0, 3).map(([loc, cnt]) => (
            <div key={loc} className="rounded-xl p-4" style={{ background: '#111', border: '1px solid #222' }}>
              <p className="text-xs" style={{ color: '#666' }}>{LOCALE_FLAG[loc]} {loc.toUpperCase()}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#e5e5e5' }}>{cnt}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: '#666' }}>언어 필터:</span>
          {['all', 'ko', 'en', 'ja', 'zh', 'ru', 'es', 'fr', 'pt', 'id', 'hi'].map((loc) => (
            <button key={loc} onClick={() => { setLocaleFilter(loc); setPage(1); }}
              className="text-xs px-3 py-1 rounded-full transition-all"
              style={{
                background: localeFilter === loc ? '#b8964a' : '#1a1a1a',
                color: localeFilter === loc ? '#fff' : '#888',
                border: '1px solid ' + (localeFilter === loc ? '#b8964a' : '#333'),
              }}>
              {loc === 'all' ? '전체' : `${LOCALE_FLAG[loc]} ${loc.toUpperCase()}`}
            </button>
          ))}
        </div>

        {/* Logs */}
        {loading ? (
          <div className="text-center py-20" style={{ color: '#555' }}>불러오는 중...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#555' }}>대화 기록이 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => {
              const ev = evaluations[log.id];
              const isExpanded = expanded === log.id;
              return (
                <div key={log.id} className="rounded-xl overflow-hidden"
                  style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  {/* Row header */}
                  <button className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : log.id)}>
                    <span className="text-lg flex-shrink-0 mt-0.5">{LOCALE_FLAG[log.locale] ?? '🌐'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1a1a1a', color: '#666' }}>
                          {log.locale.toUpperCase()}
                        </span>
                        {ev && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={RATING_STYLE[ev.rating]}>
                            {ev.rating}
                          </span>
                        )}
                        {ev && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1a1a1a', color: '#888' }}>
                            {ev.category}
                          </span>
                        )}
                        <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: '#444' }}>
                          {timeAgo(log.created_at)}
                        </span>
                      </div>
                      <p className="text-sm truncate" style={{ color: '#e5e5e5' }}>
                        <span style={{ color: '#b8964a' }}>Q. </span>
                        {ev ? ev.question_ko : log.user_message}
                      </p>
                      {ev && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#666' }}>
                          A. {ev.answer_ko}
                        </p>
                      )}
                    </div>
                    <span className="text-xs flex-shrink-0" style={{ color: '#444' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                      {/* Original messages */}
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-lg p-3" style={{ background: '#1a1a1a' }}>
                          <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#b8964a' }}>손님 질문 (원문)</p>
                          <p className="text-sm leading-relaxed" style={{ color: '#e5e5e5' }}>{log.user_message}</p>
                        </div>
                        <div className="rounded-lg p-3" style={{ background: '#1a1a1a' }}>
                          <p className="text-[10px] font-semibold mb-1.5" style={{ color: '#888' }}>AI 답변 (원문)</p>
                          <p className="text-sm leading-relaxed" style={{ color: '#ccc' }}>{log.assistant_response}</p>
                        </div>
                      </div>

                      {/* AI Evaluation */}
                      {ev ? (
                        <div className="rounded-lg p-3 space-y-2" style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
                          <p className="text-[10px] font-semibold" style={{ color: '#666' }}>🤖 AI 품질 평가</p>
                          <div className="grid md:grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px]" style={{ color: '#555' }}>한국어 질문</p>
                              <p className="text-sm mt-0.5" style={{ color: '#e5e5e5' }}>{ev.question_ko}</p>
                            </div>
                            <div>
                              <p className="text-[10px]" style={{ color: '#555' }}>한국어 답변 요약</p>
                              <p className="text-sm mt-0.5" style={{ color: '#ccc' }}>{ev.answer_ko}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded-full font-semibold"
                              style={RATING_STYLE[ev.rating]}>
                              {ev.rating}
                            </span>
                            <span className="text-xs" style={{ color: '#888' }}>— {ev.rating_reason}</span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => evaluate(log)}
                          disabled={evaluating === log.id}
                          className="w-full py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50"
                          style={{ background: '#1a1200', color: '#b8964a', border: '1px solid #b8964a30' }}>
                          {evaluating === log.id ? '🤖 AI 분석 중...' : '🤖 AI 품질 평가 실행'}
                        </button>
                      )}

                      <p className="text-[10px]" style={{ color: '#333' }}>
                        {new Date(log.created_at).toLocaleString('ko-KR')} · session: {log.session_id?.slice(0, 8)}...
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30"
              style={{ background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>
              이전
            </button>
            <span className="text-xs" style={{ color: '#555' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs disabled:opacity-30"
              style={{ background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
