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
  const { rfq, suppliers } = data;

  const { data: rfqRecord, error } = await supabase
    .from('rfqs')
    .insert([{ ...rfq, status: 'pending', created_at: new Date() }])
    .select()
    .single();

  if (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error }) };
  }

  for (const supplier of suppliers) {
    const quoteToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    await supabase.from('suppliers').insert([{
      rfq_id: rfqRecord.id,
      name: supplier.name,
      email: supplier.email,
      token: quoteToken,
      status: 'pending'
    }]);

    const quoteUrl = `https://fluffy-donut-112541.netlify.app/quote.html?token=${quoteToken}`;

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: supplier.email,
      subject: 'Air Freight RFQ – Import from China / 询价：中国进口空运报价',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2>Freight Quote Request / 询价通知</h2>
          <p>Dear ${supplier.name},</p>
          <p>You have received a new freight quote request:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Contents / 内容</td><td style="padding:8px;border-bottom:1px solid #eee"><b>${rfq.description}</b></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Cartons / 箱数</td><td style="padding:8px;border-bottom:1px solid #eee"><b>${rfq.qty} ctns × ${rfq.weight_per_carton} kg</b></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Origin / 起运</td><td style="padding:8px;border-bottom:1px solid #eee"><b>${rfq.origin}</b></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Delivery / 送货</td><td style="padding:8px;border-bottom:1px solid #eee"><b>${rfq.destination}</b></td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666">Terms / 条款</td><td style="padding:8px;border-bottom:1px solid #eee"><b>${rfq.terms}</b></td></tr>
            <tr><td style="padding:8px;color:#666">Deadline / 截止</td><td style="padding:8px"><b>$
