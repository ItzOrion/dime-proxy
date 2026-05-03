// api/check-scans.js — Rate limit receipt scans per device
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { deviceToken, isPro } = req.body;
    const today       = new Date().toISOString().split('T')[0];
    const dailyLimit  = isPro ? 10 : 3;
    const monthLimit  = isPro ? 50 : 3;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
      return res.status(200).json({ allowed: true, remaining: dailyLimit });

    const headers = {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    const getRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/scan_limits?device_token=eq.${encodeURIComponent(deviceToken)}&select=*`,
      { headers }
    );
    const records = await getRes.json();
    const record  = records[0];

    if (!record) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/scan_limits`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ device_token: deviceToken, daily_count: 1, monthly_count: 1, last_reset: today }),
      });
      return res.status(200).json({ allowed: true, remaining: dailyLimit - 1 });
    }

    const daily   = record.last_reset === today ? record.daily_count   : 0;
    const monthly = record.monthly_count;

    if (daily >= dailyLimit || monthly >= monthLimit)
      return res.status(200).json({ allowed: false, remaining: 0,
        reason: daily >= dailyLimit ? 'daily_limit' : 'monthly_limit' });

    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/scan_limits?device_token=eq.${encodeURIComponent(deviceToken)}`,
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ daily_count: daily + 1, monthly_count: monthly + 1, last_reset: today }) }
    );

    return res.status(200).json({ allowed: true, remaining: dailyLimit - (daily + 1) });
  } catch (err) {
    console.error('check-scans error:', err);
    return res.status(200).json({ allowed: true, remaining: 1 });
  }
}
