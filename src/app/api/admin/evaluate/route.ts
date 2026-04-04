import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isAuthed(req: NextRequest) {
  return req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { user_message, assistant_response, locale } = await req.json();

  const prompt = `당신은 호텔 챗봇 품질 평가자입니다. 아래 대화를 분석하세요.

[손님 언어: ${locale}]
[손님 질문]: ${user_message}
[챗봇 답변]: ${assistant_response}

다음 JSON 형식으로만 응답하세요:
{
  "question_ko": "손님 질문을 한국어로 번역 (이미 한국어면 그대로)",
  "answer_ko": "챗봇 답변을 한국어로 요약 (2줄 이내)",
  "category": "요금문의 | 체크인아웃 | 시설문의 | 예약문의 | 관광정보 | 기타",
  "rating": "정확 | 부정확 | 개선필요",
  "rating_reason": "평가 이유 한 줄"
}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const result = JSON.parse(completion.choices[0].message.content ?? '{}');
  return NextResponse.json(result);
}
