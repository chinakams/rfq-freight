const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);
  const { token, price, transit_days, courier, service_level, insurance, customs, remarks } = data;

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('*, rfqs(*)')
    .eq('token', token)
    .single();

  if (error || !supplier) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Token not found' }) };
  }

  await supabase
    .from('suppliers')
    .update({ price, transit_days, courier, service_level, insurance, customs, remarks, status: 'submitted', submitted_at: new Date() })
    .eq('token', token);

  const { data: allSuppliers } = await supabase
    .from('suppliers')
    .select('*')
    .eq('rfq_id', supplier.rfq_id);

  const allSubmitted = allSuppliers.every(s => s.status === 'submitted');

  if (allSubmitted) {
    const sorted = [...allSuppliers].sort((a, b) => a.price - b.price);
    const best = sorted[0];

    const rows = sorted.map((s, i) => `
      <tr style="background:${i === 0 ? '#f0fdf4' : 'white'}">
        <td style="padding:8px;border-bottom:1px solid #eee">${i === 0 ? '★ ' : ''}Forwarder ${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee"><b>$${s.price}</b></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${s.transit_days} days</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${s.courier || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${s.insurance}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${s.customs}</td>
        <td style="padding:8px;font-size:12px;color:#666">${s.remarks || '—'}</td>
      </tr>`).join('');

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: process.env.YOUR_EMAIL,
      subject: `All quotes received – RFQ #${supplier.rfq_id}`,
      html: `
        <div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px">
          <h2>All quotes received</h2>
          <p>Best price: <b>$${best.price}</b> — ${best.transit_days} days</p>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f8f8f8">
              <th style="padding:8px;text-align:left">Forwarder</th>
              <th style="padding:8px;text-align:left">Price</th>
              <th style="padding:8px;text-align:left">Days</th>
              <th style="padding:8px;text-align:left">Courier</th>
              <th style="padding:8px;text-align:left">Insurance</th>
              <th style="padding:8px;text-align:left">Customs</th>
              <th style="padding:8px;text-align:left">Remarks</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#999;font-size:12px;margin-top:16px">Forwarder names are hidden.</p>
        </div>`
    });
  }

  return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
};
