export default async function handler(req, res) {
  // 웹사이트에서 보낸 요청만 받기
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 사용자가 입력한 데이터
  const { work, emotion } = req.body;
  
  // Vercel 금고에 숨겨둔 API 키 꺼내기
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
  }

  // 제미나이에게 내릴 명령 (Prompt)
  const prompt = `당신은 인턴사원 주간 보고서 전문 작성가입니다.
아래 기록을 바탕으로 두 가지 보고서를 자연스럽고 길게 작성하세요.

[한 일 기록]
${work || '(없음)'}

[느낀 점 기록]
${emotion || '(없음)'}

다음 JSON 형식으로만 응답하세요. 마크다운이나 다른 텍스트는 절대 쓰지 마세요:
{"corp":"기업용보고서 1000자 내용","school":"학교용보고서 1000자 내용"}`;

  try {
    // 구글 제미나이 주방에 요청 보내기
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    // JSON 예쁘게 포장해서 프론트엔드로 보내기
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.status(200).json(parsed);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
}
