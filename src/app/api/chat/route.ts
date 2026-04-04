import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HOTEL_CONTEXT = `
## 일로와 호텔 (ILLOWA HOTEL) 정보

### 위치 & 연락처
- 주소: 경기도 안양시 만안구 안양로268번길 41 (안양동 622-19)
- 교통: 수도권 1호선 안양역 1번 출구 도보 500m (약 5분)
- 전화: 0503-5051-6355
- 이메일: chon9129@naver.com
- 프론트: 24시간 연중무휴 (한국어·중국어 응대)

### 체크인/체크아웃
- 체크인: 15:00 / 체크아웃: 13:00
- 금·토요일 체크아웃: 12:00
- 당일특가: 체크인 18:00 (토 21:00) / 체크아웃 12:00 (토 11:00)

### 객실 종류 및 요금 (원/박)

| 객실 | 평일 | 금 | 토 | 일 | 특징 |
|------|------|-----|-----|-----|------|
| 스탠다드 | 50,000 | 70,000 | 85,000 | 50,000 | 퀸침대, OTT, PC |
| 게이밍 스탠다드 | 50,000 | 75,000 | 85,000 | 50,000 | RTX 3060, 2PC 듀얼모니터, 노하드, 퀸침대, OTT |
| 디럭스 | 60,000 | 85,000 | 90,000 | 60,000 | 퀸침대, OTT, PC, 욕조, 레인샤워 |
| 게이밍 디럭스 | 60,000 | 85,000 | 90,000 | 60,000 | RTX 3060, 2PC 듀얼모니터, 노하드, 퀸침대, OTT, 욕조 |
| 프리미어 | 70,000 | 90,000 | 95,000 | 70,000 | 퀸침대, OTT, PC, 욕조, 안마의자, 레인샤워 |
| 프리미어 트윈 | 75,000 | 95,000 | 99,000 | 75,000 | 트윈베드, OTT, PC, 욕조, 안마의자 |
| 당일특가(도보전용) | 45,000 | 70,000 | 80,000 | 45,000 | 당일현장예약, 랜덤배정 |
| 연박 스탠다드 | 연박할인 적용 | - | - | - | 2박 이상 |
| 연박 디럭스 | 연박할인 적용 | - | - | - | 2박 이상 |
| 연박 프리미어 트윈 | 연박할인 적용 | - | - | - | 2박 이상 |

### 주요 어메니티
- 전 객실 OTT 무료 (넷플릭스·웨이브·티빙)
- B1 스낵바: 라면 100종 이상, 24시간 자유 이용
- 로비: 치즈케이크·머핀·원두커피 무료 (웰컴 서비스)
- 고사양 게이밍: RTX 3060, 12세대 i5, 2PC, 듀얼모니터 (13개 객실)
- 디럭스 이상: 욕조 + 레인샤워헤드
- 프리미어: 안마의자
- 고급 침구 매일 교체 (세스코 위생관리)
- 결제: 현금·카드·법인카드·세금계산서 발급 가능
`;

const SYSTEM_PROMPT = (locale: string) => `You are a friendly and helpful hotel concierge chatbot for ILLOWA HOTEL (일로와 호텔), a premium boutique hotel in Anyang, South Korea.

${HOTEL_CONTEXT}

IMPORTANT LANGUAGE RULES:
- The user's current language is: "${locale}"
- ALWAYS respond in the same language as the user's message
- If the user writes in Korean (ko), respond in Korean
- If the user writes in English (en), respond in English
- If the user writes in Japanese (ja), respond in Japanese
- If the user writes in Chinese (zh), respond in Chinese (Simplified)
- If the user writes in Russian (ru), respond in Russian
- If the user writes in Spanish (es), respond in Spanish
- If the user writes in French (fr), respond in French
- If the user writes in Portuguese (pt), respond in Portuguese
- If the user writes in Indonesian (id), respond in Indonesian
- If the user writes in Hindi (hi), respond in Hindi
- Default locale hint: "${locale}" — use this if you cannot detect the user's language

BEHAVIOR GUIDELINES:
- Be warm, concise, and helpful
- For booking questions, direct them to call 0503-5051-6355 or use OTA platforms (Booking.com, Agoda, etc.)
- Only answer questions about ILLOWA HOTEL — politely decline unrelated questions
- Keep responses short (2-4 sentences) unless detailed info is needed
- Use friendly tone appropriate for a hotel concierge`;

export async function POST(req: NextRequest) {
  const { messages, locale } = await req.json();

  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(locale ?? 'ko') },
      ...messages,
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
