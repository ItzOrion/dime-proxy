// api/receipt-scan.js
// Dime proxy — Gemini receipt scanning
// Deploy to: https://dime-proxy-qf74bvo65-itzorions-projects.vercel.app

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64)
      return res.status(400).json({ error: 'No image provided' });

    if (!process.env.GEMINI_API_KEY)
      return res.status(500).json({ error: 'API key not configured' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are a receipt scanner. Extract details from this receipt and reply ONLY with valid JSON, no markdown.
Format: {"merchant":"name","total":0.00,"date":"YYYY-MM-DD","category":"Food/Transport/Shopping/Health/Entertainment/Education/Bills/Other","confidence":0.9}
Use empty string or 0 if unreadable. Date must be YYYY-MM-DD.`
              },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/gi, '').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { parsed = { merchant:'', total:0, date:'', category:'Other', confidence:0 }; }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Receipt scan error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
