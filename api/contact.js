// Vercel serverless-funktion: tar emot Städmanis kontaktformulär och mejlar in förfrågan via Resend.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot mot spam-bottar
  if (body.botcheck) return res.status(200).json({ success: true });

  const name    = (body.name || '').toString().trim();
  const phone   = (body.phone || '').toString().trim();
  const email   = (body.email || '').toString().trim();
  const address = (body.address || '').toString().trim();
  const message = (body.message || '').toString().trim();

  if (!name || (!phone && !email)) {
    return res.status(400).json({ success: false, message: 'Namn och telefon eller e-post krävs.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, message: 'E-posttjänst ej konfigurerad.' });

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;color:#1a1a1a">
      <h2 style="margin:0 0 14px">Ny förfrågan via Städmanis hemsida</h2>
      <p style="margin:4px 0"><strong>Namn:</strong> ${esc(name)}</p>
      <p style="margin:4px 0"><strong>Telefon:</strong> ${esc(phone) || '–'}</p>
      <p style="margin:4px 0"><strong>E-post:</strong> ${esc(email) || '–'}</p>
      <p style="margin:4px 0"><strong>Adress:</strong> ${esc(address) || '–'}</p>
      <p style="margin:14px 0 4px"><strong>Meddelande:</strong></p>
      <p style="margin:0;white-space:pre-wrap;background:#f5f5f5;padding:14px;border-radius:8px">${esc(message) || '–'}</p>
    </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Städmani <forms@stadmani.com>',
        to: ['info@stadmani.com'],
        reply_to: email || undefined,
        subject: `Ny förfrågan från webben — ${name}`,
        html,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ success: false, message: 'Kunde inte skicka.', detail: detail.slice(0, 200) });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Något gick fel. Försök igen eller ring oss.' });
  }
}
