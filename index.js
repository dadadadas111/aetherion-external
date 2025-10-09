const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

// Load environment variables from .env if present
dotenv.config();

const app = express();
app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ message: 'Hello World', status: 'ok', timestamp: new Date().toISOString() });
});

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
app.post('/sendemail', (req, res) => {
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

  // Generate a simple job ID for tracking
  const jobId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  // Send immediate response
  res.json({ 
    message: 'Email queued for sending', 
    jobId: jobId,
    status: 'queued'
  });

  // Process email sending in background (no await)
  sendEmailInBackground(mailOptions, jobId);
});

// Background email sending function
async function sendEmailInBackground(mailOptions, jobId) {
  try {
    console.log(`[${jobId}] Starting email send to ${mailOptions.to}`);
    
    const transporter = createTransporter();
    
    // Verify connection configuration first
    await transporter.verify();
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[${jobId}] Email sent successfully. MessageId: ${info.messageId}`);
    console.log(`[${jobId}] Accepted: ${JSON.stringify(info.accepted)}, Rejected: ${JSON.stringify(info.rejected)}`);
  } catch (err) {
    console.error(`[${jobId}] Error sending email:`, err && err.stack ? err.stack : err);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`sendemail-api listening on port ${port}`);
});

module.exports = { app, createTransporter };
