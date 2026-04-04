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
  ko: '안녕하세요! 일로와 호텔 안내 챗봇입니다. 아래 버튼을 누르거나 직접 질문해주세요 😊',
  en: "Hello! I'm ILLOWA HOTEL's concierge bot. Tap a button below or ask anything 😊",
  ja: 'こんにちは！ILLOWAホテルのコンシェルジュです。下のボタンか直接ご質問どうぞ 😊',
  zh: '您好！我是ILLOWA HOTEL礼宾助手。请点击下方按钮或直接提问 😊',
  ru: 'Здравствуйте! Я консьерж ILLOWA HOTEL. Нажмите кнопку или задайте вопрос 😊',
  es: '¡Hola! Soy el concierge de ILLOWA HOTEL. Pulsa un botón o pregunta lo que quieras 😊',
  fr: "Bonjour! Je suis le concierge d'ILLOWA HOTEL. Appuyez sur un bouton ou posez une question 😊",
  pt: 'Olá! Sou o concierge do ILLOWA HOTEL. Toque num botão ou faça uma pergunta 😊',
  id: 'Halo! Saya concierge ILLOWA HOTEL. Tekan tombol di bawah atau tanyakan apa saja 😊',
  hi: 'नमस्ते! मैं ILLOWA HOTEL का कंसीयर्ज हूं। नीचे बटन दबाएं या कोई भी सवाल पूछें 😊',
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

// __GUIDE__ = special action to open tourist guide modal
const QUICK_REPLIES: Record<string, { label: string; text: string }[]> = {
  ko: [
    { label: '💰 객실 요금', text: '객실별 요금을 알려주세요' },
    { label: '🕐 체크인/아웃', text: '체크인, 체크아웃 시간이 언제예요?' },
    { label: '🎮 게이밍룸', text: '게이밍룸 시설이 어떻게 되나요?' },
    { label: '🍜 스낵바', text: '스낵바 이용 방법을 알려주세요' },
    { label: '🗺️ 관광 가이드', text: '__GUIDE__' },
    { label: '📞 예약 방법', text: '예약은 어떻게 하나요?' },
  ],
  en: [
    { label: '💰 Room Rates', text: 'What are the room rates?' },
    { label: '🕐 Check-in/out', text: 'What are the check-in and check-out times?' },
    { label: '🎮 Gaming Rooms', text: 'Tell me about the gaming room facilities' },
    { label: '🍜 Snack Bar', text: 'How do I use the snack bar?' },
    { label: '🗺️ Travel Guide', text: '__GUIDE__' },
    { label: '📞 How to Book', text: 'How can I make a reservation?' },
  ],
  ja: [
    { label: '💰 客室料金', text: '客室の料金を教えてください' },
    { label: '🕐 チェックイン', text: 'チェックイン・チェックアウトの時間は？' },
    { label: '🎮 ゲーミングルーム', text: 'ゲーミングルームの設備を教えてください' },
    { label: '🍜 スナックバー', text: 'スナックバーの使い方を教えてください' },
    { label: '🗺️ 観光ガイド', text: '__GUIDE__' },
    { label: '📞 予約方法', text: '予約はどのようにしますか？' },
  ],
  zh: [
    { label: '💰 客房价格', text: '请告诉我客房价格' },
    { label: '🕐 入住时间', text: '入住和退房时间是什么时候？' },
    { label: '🎮 游戏房间', text: '请介绍游戏房间的设施' },
    { label: '🍜 小吃吧', text: '怎么使用小吃吧？' },
    { label: '🗺️ 旅游指南', text: '__GUIDE__' },
    { label: '📞 预订方式', text: '怎么预订房间？' },
  ],
  ru: [
    { label: '💰 Цены', text: 'Какова стоимость номеров?' },
    { label: '🕐 Заезд/выезд', text: 'Каково время заезда и выезда?' },
    { label: '🎮 Игровые номера', text: 'Расскажите об игровых номерах' },
    { label: '🍜 Снек-бар', text: 'Как пользоваться снек-баром?' },
    { label: '🗺️ Путеводитель', text: '__GUIDE__' },
    { label: '📞 Бронирование', text: 'Как забронировать номер?' },
  ],
  es: [
    { label: '💰 Tarifas', text: '¿Cuáles son las tarifas de las habitaciones?' },
    { label: '🕐 Check-in/out', text: '¿A qué hora es el check-in y check-out?' },
    { label: '🎮 Sala Gaming', text: 'Cuéntame sobre las salas gaming' },
    { label: '🍜 Snack Bar', text: '¿Cómo uso el snack bar?' },
    { label: '🗺️ Guía Turística', text: '__GUIDE__' },
    { label: '📞 Reservas', text: '¿Cómo puedo hacer una reserva?' },
  ],
  fr: [
    { label: '💰 Tarifs', text: 'Quels sont les tarifs des chambres?' },
    { label: '🕐 Check-in/out', text: "Quels sont les horaires d'arrivée et de départ?" },
    { label: '🎮 Salle Gaming', text: 'Parlez-moi des salles gaming' },
    { label: '🍜 Snack Bar', text: 'Comment utiliser le snack bar?' },
    { label: '🗺️ Guide Touristique', text: '__GUIDE__' },
    { label: '📞 Réservation', text: 'Comment faire une réservation?' },
  ],
  pt: [
    { label: '💰 Tarifas', text: 'Quais são as tarifas dos quartos?' },
    { label: '🕐 Check-in/out', text: 'Quais são os horários de check-in e check-out?' },
    { label: '🎮 Sala Gaming', text: 'Fale-me sobre as salas gaming' },
    { label: '🍜 Snack Bar', text: 'Como usar o snack bar?' },
    { label: '🗺️ Guia Turístico', text: '__GUIDE__' },
    { label: '📞 Reservas', text: 'Como fazer uma reserva?' },
  ],
  id: [
    { label: '💰 Tarif Kamar', text: 'Berapa tarif kamarnya?' },
    { label: '🕐 Check-in/out', text: 'Jam berapa check-in dan check-out?' },
    { label: '🎮 Kamar Gaming', text: 'Ceritakan tentang fasilitas kamar gaming' },
    { label: '🍜 Snack Bar', text: 'Bagaimana cara menggunakan snack bar?' },
    { label: '🗺️ Panduan Wisata', text: '__GUIDE__' },
    { label: '📞 Cara Booking', text: 'Bagaimana cara memesan kamar?' },
  ],
  hi: [
    { label: '💰 कमरे की दरें', text: 'कमरों की दरें क्या हैं?' },
    { label: '🕐 चेक-इन/आउट', text: 'चेक-इन और चेक-आउट का समय क्या है?' },
    { label: '🎮 गेमिंग रूम', text: 'गेमिंग रूम की सुविधाओं के बारे में बताएं' },
    { label: '🍜 स्नैक बार', text: 'स्नैक बार का उपयोग कैसे करें?' },
    { label: '🗺️ पर्यटन गाइड', text: '__GUIDE__' },
    { label: '📞 बुकिंग', text: 'कमरा कैसे बुक करें?' },
  ],
};

export default function ChatWidget() {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useRef<string>(crypto.randomUUID());

  const greeting = GREETING[locale] ?? GREETING.en;
  const placeholder = PLACEHOLDER[locale] ?? PLACEHOLDER.en;
  const title = TITLE[locale] ?? TITLE.en;
  const quickReplies = QUICK_REPLIES[locale] ?? QUICK_REPLIES.en;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: greeting }]);
      setShowQuickReplies(true);
    }
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function handleQuickReply(text: string) {
    if (text === '__GUIDE__') {
      window.dispatchEvent(new CustomEvent('open-tourist-guide'));
      return;
    }
    setShowQuickReplies(false);
    sendText(text);
  }

  async function sendText(text: string) {
    if (!text || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setShowQuickReplies(false);

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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    await sendText(text);
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
        <div
          className="fixed bottom-24 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-white/10"
          style={{ background: '#1a1a1a', height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: '#b8964a' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-white font-semibold text-sm tracking-wide">{title}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#444 transparent' }}
          >
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'user'
                      ? { background: '#b8964a', color: '#fff', borderBottomRightRadius: '4px' }
                      : { background: '#2a2a2a', color: '#e5e5e5', borderBottomLeftRadius: '4px' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Quick reply buttons */}
            {showQuickReplies && !loading && messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(qr.text)}
                    className="text-xs px-2.5 py-1.5 rounded-full border transition-all hover:scale-105 active:scale-95"
                    style={{ borderColor: '#b8964a40', color: '#b8964a', background: '#1a1200' }}
                  >
                    {qr.label}
                  </button>
                ))}
              </div>
            )}

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
              style={{ background: '#b8964a', color: '#fff' }}
            >
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
        aria-label="Chat"
      >
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
