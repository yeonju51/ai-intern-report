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
${work || '(없음)'}

[느낀 점 기록]
${emotion || '(없음)'}

다음 JSON 형식으로만 응답하세요. 마크다운이나 다른 텍스트는 절대 쓰지 마세요:
{"corp":"기업용보고서 1000자 내용","school":"학교용보고서 1000자 내용"}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    
    // 🔥 제미나이가 요리를 안 주고 에러를 줬을 때, 로그에 이유를 적어두는 코드 추가!
    if (!data.candidates) {
      console.error("🚨 제미나이 API 에러 발생 상세내용:", JSON.stringify(data));
      return res.status(500).json({ error: '제미나이 API가 거절했습니다.', details: data });
    }

    const text = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
}
