// api/subscribe.js — Vercel Serverless Function
// Proxies waitlist signups to Loops API (keeps API key server-side)

export default async function handler(req, res) {
  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!process.env.LOOPS_API_KEY) {
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

    if (!response.ok) {
      // Loops returns 409 if contact already exists — treat as success
      if (response.status === 409) {
        return res.status(200).json({ ok: true, message: 'Already on the list' });
      }
      console.error('Loops API error:', data);
      return res.status(500).json({ error: 'Failed to subscribe' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
