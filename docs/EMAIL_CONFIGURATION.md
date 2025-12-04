# Email Configuration Guide

## Overview
The application uses SMTP to send emails for various notifications including:
- Account registration OTP codes
- Booking request notifications
- Payment reminders
- Cancellation notifications

## Configuration

To enable email sending, you need to configure SMTP settings in your `.env` file:

### Gmail Configuration (Recommended)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=true
SMTP_FROM="Weddding <no-reply@weddding.com>"
```

**Important Notes:**
- `SMTP_PORT=465` with `SMTP_SECURE=true` is required for Gmail (SSL/TLS)
- `SMTP_PASS` must be an **App Password**, not your regular Gmail password
- `SMTP_FROM` can be different from `SMTP_USER` - it's the display name/email shown to recipients
- The email domain in `SMTP_FROM` doesn't need to match `SMTP_USER`, but it's recommended for better deliverability

### Gmail Setup Steps
1. Enable 2-Step Verification on your Google account
2. Generate an App Password:
   - Go to Google Account settings → Security
   - Under "2-Step Verification", click "App passwords"
   - Select "Mail" and your device
   - Generate and copy the 16-character password
3. Use the generated password as `SMTP_PASS` (not your regular password)
4. Use your Gmail address as `SMTP_USER`

### Other Email Providers
- **Outlook/Hotmail**: `smtp-mail.outlook.com`, port `587`
- **Yahoo**: `smtp.mail.yahoo.com`, port `587`
- **Custom SMTP**: Use your provider's SMTP settings

## Development Mode

If SMTP is not configured (missing environment variables), the application will:
- Log email content to the console instead of sending
- Format: `[EMAIL:DEV] to=email@example.com subject=Subject body=Body content`
- This allows testing without actual email delivery

## Verification

To check if emails are being sent:

1. **Check Console Logs**: Look for `[EMAIL:DEV]` messages in the terminal
2. **Check SMTP Logs**: If configured, look for success/error messages
3. **Check Email Inbox**: Verify emails are received (check spam folder)
4. **Check Backend Logs**: Look for `✅` or `❌` messages from notification service

## Troubleshooting

### Emails not sending
- Verify all SMTP environment variables are set
- Check that `SMTP_PASS` is an app password (not your regular password)
- Verify firewall/network allows SMTP connections
- Check backend console for error messages

### OTP showing in terminal but not in email
- This means SMTP is not configured
- The app is in development mode (logging to console)
- Configure SMTP settings to enable actual email delivery

### Common Errors
- **Authentication failed**: Check `SMTP_USER` and `SMTP_PASS`
- **Connection timeout**: Check `SMTP_HOST` and `SMTP_PORT`
- **TLS/SSL errors**: Try setting `SMTP_SECURE=false` for port 587

