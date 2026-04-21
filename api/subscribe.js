// api/subscribe.js — Vercel Serverless Function (CommonJS)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!process.env.LOOPS_API_KEY) {
    console.error('LOOPS_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        source: 'quarvo.io waitlist',
        userGroup: 'waitlist',
      }),
    });

    const data = await response.json();

    if (response.status === 409) {
      return res.status(200).json({ ok: true, message: 'Already on the list' });
    }

    if (!response.ok) {
      console.error('Loops API error:', data);
      return res.status(500).json({ error: 'Failed to subscribe' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
};
