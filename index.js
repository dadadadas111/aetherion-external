const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

const app = express();
app.use(express.json());

const SMTP_EMAIL = process.env.SMTP_EMAIL;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;

if (!SMTP_EMAIL || !SMTP_PASSWORD || !SMTP_HOST || !SMTP_PORT) {
  console.warn('Warning: SMTP_* environment variables are not fully set. /sendemail will fail until they are configured.');
}

// Create transporter factory function so it can be re-used/tested
function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

// Simple POST /sendemail
// Expected JSON body: { to, subject, text, html? }
app.post('/sendemail', async (req, res) => {
  const { to, subject, text, html, from } = req.body || {};

  // Basic validation
  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Missing required fields. Provide "to", "subject" and either "text" or "html".' });
  }

  const mailOptions = {
    from: from || SMTP_EMAIL,
    to,
    subject,
    text,
    html,
  };

  try {
    const transporter = createTransporter();

    // Verify connection configuration first (fast failure)
    await transporter.verify();

    const info = await transporter.sendMail(mailOptions);
    return res.json({ message: 'Email sent', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (err) {
    console.error('Error sending email:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Failed to send email', details: err && err.message ? err.message : String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`sendemail-api listening on port ${port}`);
});

module.exports = { app, createTransporter };
