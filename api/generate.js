export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { work, emotion } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 Vercel에 설정되지 않았습니다.' });
  }

  const prompt = `당신은 인턴사원 주간 보고서 전문 작성가입니다.
아래 기록을 바탕으로 두 가지 보고서를 자연스럽고 길게 작성하세요.

[한 일 기록]
${work || '업무 내용을 입력하지 않았습니다.'}

[느낀 점 기록]
${emotion || '느낀 점을 입력하지 않았습니다.'}

다음 JSON 형식으로만 응답하세요. 마크다운이나 다른 텍스트는 절대 쓰지 마세요:
{"corp":"기업용보고서 1000자 내용","school":"학교용보고서 1000자 내용"}`;

  try {
    // 1. 구글 주방에 "오늘 주문 가능한 메뉴(AI 모델) 목록 좀 주세요!" 요청하기
    const menuResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const menuData = await menuResponse.json();

    if (!menuData.models) {
      return res.status(500).json({ error: '구글 AI 모델 목록을 불러오지 못했습니다.' });
    }

    // 2. 글쓰기(generateContent)가 가능한 가장 최신의 'gemini' 모델 알아서 찾기
    const availableModel = menuData.models.find(m => 
      m.supportedGenerationMethods.includes('generateContent') && 
      m.name.includes('gemini')
    );

    if (!availableModel) {
      return res.status(500).json({ error: '사용 가능한 구글 AI 모델이 없습니다.' });
    }

    // 찾은 모델 이름 (예: "models/gemini-1.5-flash" 또는 "models/gemini-2.0-flash")
    const modelName = availableModel.name; 

    // 3. 찾은 최신 모델 이름으로 진짜 보고서 작성 주문하기!
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    // 에러 발생 시 방어
    if (data.error) {
      console.error("API 에러:", data.error);
      return res.status(500).json({ error: `API 에러: ${data.error.message}` });
    }

    // 빈 접시 방어
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      return res.status(500).json({ error: 'AI가 답변 작성을 거부했습니다. (입력한 단어가 구글 필터링에 걸렸을 수 있습니다.)' });
    }

    const text = parts[0].text;
    
    // JSON 변환 및 전달
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      res.status(200).json(parsed);
    } catch (parseError) {
      console.error("형식 오류:", text);
      res.status(500).json({ error: 'AI가 지정된 형식을 어기고 엉뚱한 답변을 보냈습니다. 다시 시도해주세요.' });
    }

  } catch (error) {
    console.error('서버 통신 오류:', error);
    res.status(500).json({ error: '서버 내부 통신 에러가 발생했습니다.' });
  }
}
