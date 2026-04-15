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
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    // 1. 구글 API 자체에서 에러를 보냈을 때 (키 오류 등)
    if (data.error) {
      console.error("API 에러:", data.error);
      return res.status(500).json({ error: `API 에러: ${data.error.message}` });
    }

    // 2. AI가 필터링 정책 등에 걸려서 빈 접시를 줬을 때 방어! (방금 발생한 오류의 원인)
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      console.error("빈 접시 도착. 전체 데이터:", JSON.stringify(data));
      return res.status(500).json({ error: 'AI가 답변 작성을 거부했습니다. (입력한 단어가 구글 정책 필터링에 걸렸을 수 있습니다.)' });
    }

    // 3. 정상적으로 텍스트 가져오기
    const text = parts[0].text;
    
    try {
      // 제미나이가 JSON 양식을 안 지키고 쓸데없는 말을 덧붙였을 때 방어
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
