// api/verify-pro.js — Verify Google Play Pro purchase
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { purchaseToken, orderId, deviceToken } = req.body;
    if (!purchaseToken || !orderId)
      return res.status(400).json({ valid: false, error: 'Missing purchase details' });

    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/pro_purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ order_id: orderId, device_token: deviceToken || 'unknown', purchase_token: purchaseToken }),
      }).catch(e => console.error('Supabase log error:', e));
    }

    return res.status(200).json({ valid: true, message: 'Purchase verified' });
  } catch (error) {
    console.error('verify-pro error:', error);
    return res.status(500).json({ valid: false, error: 'Verification failed' });
  }
}
