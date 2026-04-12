import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const HOTEL_CONTEXT = `
## 일로와 호텔 (ILLOWA HOTEL) 정보

### 위치 & 연락처
- 주소: 경기도 안양시 만안구 안양로268번길 41 (안양동 622-19)
- 교통: 수도권 1호선 안양역 1번 출구 도보 500m (약 5분)
- 전화: 031-464-9661
- 이메일: ch8773@naver.com
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

### 호텔 주변 관광 & 맛집 (도보권)

**시장 & 먹거리 (도보 5~10분)**
- 안양중앙시장: 673개 점포, 누룽지/호떡/어묵/떡볶이/순대국, 영업 9시~19시
- 안양남부시장: 식재료+일용잡화, 공원 인접
- 추천 음식: 누룽지(3,000~5,000원), 호떡(1,200원), 어묵(1,000~3,000원), 순대국(7,000~9,000원), 떡볶이(3,000~5,000원)
- 팁: 일부 노점 현금만 가능, 영어 소통 제한적 (파파고 앱 추천)

**K-뷰티 & 쇼핑**
- 올리브영 안양사거리점: 도보 10분, Tax Free 즉시환급 (15,000원 이상, 여권 필요)
- 안양지하상가 일번가몰: 약 500개 점포, 백화점 대비 30~50% 저렴
- 엔터식스 안양역점: 안양역 직결, SPAO·Nike·Adidas
- 2001아울렛: 30~70% 상시 할인

**예술 & 자연**
- 안양예술공원(APAP): 입장 무료, 세계 건축가 60여명 작품, 삼성산 트레킹 연계
- 안양천 산책로: 봄 벚꽃(약 10km), 여름 수변산책, 가을 단풍
- 따릉이: 안양천 서울구간(구로/영등포) 이용 가능, 1시간 1,000원

**추천 1일 코스**
10:00 안양예술공원 → 13:00 안양중앙시장 점심 → 15:00 올리브영 → 16:00 일번가몰/엔터식스 → 17:30 안양천 산책 → 19:00 호텔 귀환 (B1 라면+넷플릭스)
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
- For booking questions, direct them to call 031-464-9661 or use OTA platforms (Booking.com, Agoda, etc.)
- Only answer questions about ILLOWA HOTEL — politely decline unrelated questions
- Keep responses short (2-4 sentences) unless detailed info is needed
- Use friendly tone appropriate for a hotel concierge`;

export async function POST(req: NextRequest) {
  const { messages, locale, session_id } = await req.json();

  const userMessage = messages[messages.length - 1]?.content ?? '';

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
  let assistantResponse = '';

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? '';
        if (text) {
          assistantResponse += text;
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();

      // 스트리밍 완료 후 Supabase에 로그 저장
      await supabase.from('chat_logs').insert({
        session_id: session_id ?? null,
        locale: locale ?? 'ko',
        user_message: userMessage,
        assistant_response: assistantResponse,
      });
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
