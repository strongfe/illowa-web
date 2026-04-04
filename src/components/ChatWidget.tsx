'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PLACEHOLDER: Record<string, string> = {
  ko: '궁금한 점을 물어보세요...',
  en: 'Ask me anything...',
  ja: 'ご質問をどうぞ...',
  zh: '请输入您的问题...',
  ru: 'Задайте вопрос...',
  es: 'Haz tu pregunta...',
  fr: 'Posez votre question...',
  pt: 'Faça sua pergunta...',
  id: 'Tanyakan sesuatu...',
  hi: 'अपना सवाल पूछें...',
};

const GREETING: Record<string, string> = {
  ko: '안녕하세요! 일로와 호텔 안내 챗봇입니다. 객실, 요금, 편의시설 등 무엇이든 물어보세요 😊',
  en: 'Hello! I\'m the ILLOWA HOTEL concierge bot. Ask me about rooms, rates, amenities, and more 😊',
  ja: 'こんにちは！ILLOWAホテルのコンシェルジュです。お部屋・料金・施設など、お気軽にどうぞ 😊',
  zh: '您好！我是ILLOWA HOTEL的礼宾助手。欢迎询问客房、价格、设施等问题 😊',
  ru: 'Здравствуйте! Я консьерж отеля ILLOWA. Спрашивайте о номерах, ценах и удобствах 😊',
  es: '¡Hola! Soy el asistente del ILLOWA HOTEL. Pregúntame sobre habitaciones, tarifas y más 😊',
  fr: 'Bonjour! Je suis le concierge de l\'ILLOWA HOTEL. Posez vos questions sur les chambres, tarifs, etc 😊',
  pt: 'Olá! Sou o concierge do ILLOWA HOTEL. Pergunte sobre quartos, tarifas e amenidades 😊',
  id: 'Halo! Saya asisten ILLOWA HOTEL. Tanya tentang kamar, tarif, fasilitas, dan lainnya 😊',
  hi: 'नमस्ते! मैं ILLOWA HOTEL का कंसीयर्ज हूं। कमरे, दरें, सुविधाओं के बारे में पूछें 😊',
};

const TITLE: Record<string, string> = {
  ko: '일로와 호텔 안내',
  en: 'ILLOWA Concierge',
  ja: 'ILLOWAコンシェルジュ',
  zh: 'ILLOWA礼宾服务',
  ru: 'Консьерж ILLOWA',
  es: 'Conserje ILLOWA',
  fr: 'Conciergerie ILLOWA',
  pt: 'Concierge ILLOWA',
  id: 'Concierge ILLOWA',
  hi: 'ILLOWA कंसीयर्ज',
};

export default function ChatWidget() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef<string>(crypto.randomUUID());

  const greeting = GREETING[locale] ?? GREETING.en;
  const placeholder = PLACEHOLDER[locale] ?? PLACEHOLDER.en;
  const title = TITLE[locale] ?? TITLE.en;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: greeting }]);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, locale, session_id: sessionId.current }),
      });

      if (!res.ok || !res.body) throw new Error('Network error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      setLoading(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantText };
          return updated;
        });
      }
    } catch {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      ]);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-white/10"
          style={{ background: '#1a1a1a', height: '480px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: '#b8964a' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-white font-semibold text-sm tracking-wide">{title}</span>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#444 transparent' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={msg.role === 'user'
                    ? { background: '#b8964a', color: '#fff', borderBottomRightRadius: '4px' }
                    : { background: '#2a2a2a', color: '#e5e5e5', borderBottomLeftRadius: '4px' }
                  }>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl text-sm" style={{ background: '#2a2a2a', borderBottomLeftRadius: '4px' }}>
                  <span className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 border-t border-white/10 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={placeholder}
              disabled={loading}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-50"
              style={{ background: '#2a2a2a', color: '#e5e5e5', border: '1px solid #333' }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="rounded-xl px-3 py-2 text-sm font-semibold transition-opacity disabled:opacity-40"
              style={{ background: '#b8964a', color: '#fff' }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ background: '#b8964a' }}
        aria-label="Chat">
        {open ? (
          <span className="text-white text-xl">✕</span>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
