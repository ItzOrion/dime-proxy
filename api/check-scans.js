export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { deviceToken, isPro } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Daily limits: Free = 3/day, Pro = 10/day
    const dailyLimit = isPro ? 10 : 3;
    const monthlyLimit = isPro ? 50 : 3;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      // No database configured — allow scans
      return res.status(200).json({ allowed: true, remaining: dailyLimit });
    }

    // Get current scan record
    const getRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/scan_limits?device_token=eq.${encodeURIComponent(deviceToken)}&select=*`,
      {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      }
    );
    const records = await getRes.json();
    const record = records[0];

    if (!record) {
      // First scan — create record
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/scan_limits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          device_token: deviceToken,
          daily_count: 1,
          monthly_count: 1,
          last_reset: today
        })
      });
      return res.status(200).json({ allowed: true, remaining: dailyLimit - 1 });
    }

    // Reset daily count if new day
    const dailyCount = record.last_reset === today ? record.daily_count : 0;
    const monthlyCount = record.monthly_count;

    if (dailyCount >= dailyLimit || monthlyCount >= monthlyLimit) {
      return res.status(200).json({
        allowed: false,
        remaining: 0,
        reason: dailyCount >= dailyLimit ? 'daily_limit' : 'monthly_limit'
      });
    }

    // Increment count
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/scan_limits?device_token=eq.${encodeURIComponent(deviceToken)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          daily_count: dailyCount + 1,
          monthly_count: monthlyCount + 1,
          last_reset: today
        })
      }
    );

    return res.status(200).json({
      allowed: true,
      remaining: dailyLimit - (dailyCount + 1)
    });

  } catch (error) {
    console.error('Check scans error:', error);
    // On error — allow the scan (don't block user)
    return res.status(200).json({ allowed: true, remaining: 1 });
  }
}
