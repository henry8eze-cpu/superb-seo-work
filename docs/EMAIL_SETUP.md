# Email Notifications Setup Guide

This guide explains how to set up email notifications for your Superb Sprachschule application.

## Overview

The application includes email templates and a service structure for sending automated emails. Currently, emails are logged to the console (mock service), but you can integrate with real email providers.

## Email Templates

The following email templates are available in `lib/email.ts`:

### 1. Registration Confirmation
- Sent to students after they submit the registration form
- Confirms their interest in learning German
- Includes their preferred course level

### 2. Trial Lesson Confirmation
- Sent to students after booking a trial lesson
- Confirms their booking request
- Includes their preferred date and time

### 3. Trial Lesson Scheduled
- Sent to students when admin confirms the trial lesson
- Includes instructor name and meeting link
- Reminds them to join early

### 4. Certificate Awarded
- Sent to students after completing a course
- Congratulates them on their achievement
- Provides certificate number and download link

### 5. Admin Notifications
- Sent to admin email when new registrations or trial lessons are submitted
- Allows quick review and follow-up

## Setup Instructions

### Option 1: Resend (Recommended)

Resend is the easiest option for email sending in Next.js.

1. **Install Resend:**
   ```bash
   npm install resend
   ```

2. **Add environment variable:**
   Create a `.env.local` file and add:
   ```
   RESEND_API_KEY=your_resend_api_key
   ADMIN_EMAIL=admin@yourdomain.com
   ```

3. **Update email service in `lib/email.ts`:**
   ```typescript
   import { Resend } from 'resend';

   const resend = new Resend(process.env.RESEND_API_KEY);

   export class ResendEmailService implements EmailService {
     async send(to: string, subject: string, html: string): Promise<void> {
       await resend.emails.send({
         from: 'noreply@superb-sprachschule.de',
         to,
         subject,
         html,
       });
     }
   }

   export function getEmailService(): EmailService {
     if (process.env.RESEND_API_KEY) {
       return new ResendEmailService();
     }
     return new MockEmailService();
   }
   ```

### Option 2: SendGrid

1. **Install SendGrid:**
   ```bash
   npm install @sendgrid/mail
   ```

2. **Add environment variable:**
   ```
   SENDGRID_API_KEY=your_sendgrid_api_key
   ADMIN_EMAIL=admin@yourdomain.com
   ```

3. **Update email service in `lib/email.ts`:**
   ```typescript
   import sgMail from '@sendgrid/mail';

   export class SendGridEmailService implements EmailService {
     async send(to: string, subject: string, html: string): Promise<void> {
       sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
       await sgMail.send({
         to,
         from: 'noreply@superb-sprachschule.de',
         subject,
         html,
       });
     }
   }
   ```

### Option 3: Nodemailer (Gmail/Custom SMTP)

1. **Install Nodemailer:**
   ```bash
   npm install nodemailer
   ```

2. **Add environment variables:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ADMIN_EMAIL=admin@yourdomain.com
   ```

3. **Update email service in `lib/email.ts`:**
   ```typescript
   import nodemailer from 'nodemailer';

   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: parseInt(process.env.SMTP_PORT || '587'),
     secure: process.env.SMTP_PORT === '465',
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASS,
     },
   });

   export class NodemailerEmailService implements EmailService {
     async send(to: string, subject: string, html: string): Promise<void> {
       await transporter.sendMail({
         from: 'noreply@superb-sprachschule.de',
         to,
         subject,
         html,
       });
     }
   }
   ```

## Customizing Email Templates

To customize email templates, edit the `emailTemplates` object in `lib/email.ts`. Each template is a function that returns an object with `subject` and `html` properties.

Example:
```typescript
registrationConfirmation: (name: string, preferredCourse?: string) => ({
  subject: 'Welcome to Superb Sprachschule - Registration Confirmed',
  html: `Your custom HTML here...`,
}),
```

## Testing Emails

While using the mock service, emails are logged to the console. Check the server logs to see what would be sent.

Once you integrate a real email service:

1. Submit a registration form and check if the student receives a confirmation email
2. Submit a trial lesson booking and verify the email
3. Check admin receives notifications

## Environment Variables

Add these to your `.env.local` file:

```
# Email Service
ADMIN_EMAIL=admin@superb-sprachschule.de

# For Resend
RESEND_API_KEY=your_api_key

# For SendGrid
SENDGRID_API_KEY=your_api_key

# For SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
```

## Troubleshooting

### Emails not being sent?
1. Check server logs for errors
2. Verify API keys are correctly set in environment variables
3. Check email provider account settings and limits
4. Verify sender email address is valid in your email service

### Emails going to spam?
1. Add SPF and DKIM records to your domain
2. Use a reply-to address
3. Avoid spam trigger words in subject lines
4. Test with major email providers (Gmail, Outlook, etc.)

## Next Steps

- Customize email templates with your branding
- Add email templates for other events (course enrollment, payment, etc.)
- Set up email logs/analytics
- Consider adding email scheduling for digest emails
