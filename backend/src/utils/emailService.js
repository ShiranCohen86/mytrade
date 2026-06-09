const logger = require('./logger');

async function sendAlertEmail(user, ticker, alert, currentPrice) {
  if (!process.env.SMTP_HOST) {
    logger.info(`[DEV] Price alert: ${ticker} ${alert.direction} $${alert.targetPrice} — now $${currentPrice.toFixed(2)} — ${user.email}`);
    return;
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const directionStr = alert.direction === 'above' ? 'rose above' : 'fell below';
  const arrow = alert.direction === 'above' ? '▲' : '▼';
  const color = alert.direction === 'above' ? '#22c55e' : '#ef4444';

  await transporter.sendMail({
    from: `"MyTrade" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `MyTrade Alert: ${ticker} ${directionStr} $${alert.targetPrice}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#3D7EFF;padding:20px 24px;">
          <span style="font-size:18px;font-weight:700;color:#fff;">MyTrade Price Alert</span>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px;margin:0 0 16px;">
            <strong style="color:#fff;">${ticker}</strong> has
            <span style="color:${color};font-weight:600;">${arrow} ${directionStr}</span>
            your target of <strong style="color:#fff;">$${alert.targetPrice}</strong>.
          </p>
          <div style="background:#1a1f2e;border-radius:8px;padding:16px;margin-bottom:16px;">
            <span style="color:#94a3b8;font-size:13px;">Current price</span><br/>
            <span style="color:#fff;font-size:22px;font-weight:700;">$${currentPrice.toFixed(2)}</span>
          </div>
          <p style="color:#64748b;font-size:12px;margin:0;">
            You can update or remove this alert in your
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" style="color:#3D7EFF;">MyTrade dashboard</a>.
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendAlertEmail };
