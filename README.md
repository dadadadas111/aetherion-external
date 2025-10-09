# sendemail-api

Simple Node.js API to send email via SMTP using Nodemailer.

Prerequisites
- Node.js 16+ or compatible

Setup
1. Copy `.env.example` to `.env` and fill in your SMTP settings (the example already includes the values provided).
2. Install dependencies:

   npm install

3. Start the server:

   npm start

API: POST /sendemail

Request JSON body:

{
  "to": "recipient@example.com",
  "subject": "Hello",
  "text": "Plain text body",
  "html": "<p>Optional HTML body</p>",
  "from": "optional-from@example.com"
}

Example using PowerShell (Windows):

```powershell
$body = @{
  to = 'recipient@example.com'
  subject = 'Test from sendemail-api'
  text = 'This is a test email.'
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/sendemail -Method Post -Body $body -ContentType 'application/json'
```

Example using curl:

```bash
curl -X POST http://localhost:3000/sendemail \
  -H "Content-Type: application/json" \
  -d '{"to":"recipient@example.com","subject":"Hi","text":"Hello"}'
```

Notes
- For Gmail SMTP you may need an App Password (if using 2FA) or allow less secure apps — the `.env.example` includes an app password value for illustration.
- The server verifies SMTP config before sending to fail fast if misconfigured.
