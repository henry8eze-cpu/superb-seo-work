// Email Templates for Superb Sprachschule
// This service provides email templates and a structure for sending emails
// You'll need to integrate with an email service like Resend, SendGrid, or Nodemailer

export const emailTemplates = {
  registrationConfirmation: (name: string, preferredCourse?: string) => ({
    subject: 'Welcome to Superb Sprachschule - Registration Confirmed',
    html: `
      <h1>Welcome to Superb Sprachschule!</h1>
      <p>Dear ${name},</p>
      <p>Thank you for registering with us. We're excited to help you master the German language!</p>
      ${preferredCourse ? `<p><strong>Your Preferred Course:</strong> ${preferredCourse}</p>` : ''}
      <p>Our team will contact you within 24 hours to discuss your learning goals and recommend the perfect course for you.</p>
      <p>In the meantime, feel free to browse our <a href="https://superb-sprachschule.de">website</a> to learn more about our courses.</p>
      <p>Best regards,<br/>The Superb Sprachschule Team</p>
    `,
  }),

  certificateAwarded: (name: string, courseName: string, certificateNumber: string) => ({
    subject: 'Congratulations! Your Certificate is Ready - Superb Sprachschule',
    html: `
      <h1>Congratulations!</h1>
      <p>Dear ${name},</p>
      <p>We're thrilled to inform you that you have successfully completed the <strong>${courseName}</strong> course!</p>
      <p>Your certificate has been issued and is now available in your student dashboard.</p>
      <p><strong>Certificate Details:</strong></p>
      <ul>
        <li><strong>Course:</strong> ${courseName}</li>
        <li><strong>Certificate Number:</strong> ${certificateNumber}</li>
        <li><strong>Issue Date:</strong> ${new Date().toLocaleDateString('en-US')}</li>
      </ul>
      <p><a href="https://superb-sprachschule.de/dashboard/certificates">Download Your Certificate</a></p>
      <p>We're proud of your achievement! Feel free to share your certificate on LinkedIn and other professional networks.</p>
      <p>Best regards,<br/>The Superb Sprachschule Team</p>
    `,
  }),

  registrationStatusUpdate: (name: string, status: string) => {
    const statusMessages: Record<string, string> = {
      CONTACTED: 'Our team has reviewed your application and will be in touch shortly.',
      ACCEPTED: 'Congratulations! Your application has been approved.',
      ON_HOLD: 'Your application is currently on hold. We will follow up with more information soon.',
      ENROLLED: 'You have been enrolled! Welcome to Superb Sprachschule.',
      REJECTED: 'Unfortunately, we are unable to proceed with your application at this time.',
    }
    return {
      subject: `Your Application Status Has Been Updated - Superb Sprachschule`,
      html: `
      <h1>Application Update</h1>
      <p>Dear ${name},</p>
      <p>${statusMessages[status] || `Your application status has been updated to: ${status}`}</p>
      <p>Best regards,<br/>The Superb Sprachschule Team</p>
    `,
    }
  },

  adminRegistrationNotification: (fullName: string, email: string, phone: string, germanLevel?: string) => ({
    subject: `New Registration - ${fullName} - Superb Sprachschule Admin`,
    html: `
      <h1>New Student Registration</h1>
      <p>A new student has registered:</p>
      <p><strong>Student Details:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${fullName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Phone:</strong> ${phone}</li>
        <li><strong>German Level:</strong> ${germanLevel || 'Not specified'}</li>
      </ul>
      <p><a href="https://superb-sprachschule.de/admin/registrations">View in Admin Dashboard</a></p>
      <p>Please reach out to the student to discuss their learning goals.</p>
    `,
  }),
}

// Email service interface
export interface EmailService {
  send(to: string, subject: string, html: string): Promise<void>
}

export type SentEmail = { to: string; subject: string; html: string; sentAt: Date }

// Mock email service for development and tests. Keeps an in-memory outbox.
export class MockEmailService implements EmailService {
  static outbox: SentEmail[] = []

  async send(to: string, subject: string, html: string): Promise<void> {
    MockEmailService.outbox.push({ to, subject, html, sentAt: new Date() })
    if (process.env.NODE_ENV !== 'test') {
      console.log('[Email Service] Email sent (mock)')
      console.log(`To: ${to}`)
      console.log(`Subject: ${subject}`)
      // Print links so invitation and claim emails can be followed without a mail provider.
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) console.log(`Link: ${href.replace(/&amp;/g, '&')}`)
    }
  }
}

// Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
export class ResendEmailService implements EmailService {
  constructor(
    private apiKey: string,
    private from: string
  ) {}

  async send(to: string, subject: string, html: string): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject, html }),
    })
    if (!response.ok) {
      throw new Error(`Resend rejected email to ${to}: ${response.status} ${await response.text()}`)
    }
  }
}

let emailService: EmailService | null = null

// EMAIL_PROVIDER=mock forces the mock (dev/test). Otherwise Resend is used when RESEND_API_KEY is set.
export function getEmailService(): EmailService {
  if (emailService) return emailService
  const provider = process.env.EMAIL_PROVIDER
  const apiKey = process.env.RESEND_API_KEY
  if (provider !== 'mock' && apiKey) {
    emailService = new ResendEmailService(apiKey, process.env.EMAIL_FROM || 'Superb <noreply@superb-sprachschule.de>')
  } else {
    if (process.env.NODE_ENV === 'production' && provider !== 'mock') {
      console.warn('[Email Service] RESEND_API_KEY is not set; emails are only logged.')
    }
    emailService = new MockEmailService()
  }
  return emailService
}

/**
 * Sends without letting a mail outage fail the surrounding operation
 * (e.g. a confirmed booking stays confirmed even if the email bounces).
 */
export async function sendEmailSafely(to: string, subject: string, html: string) {
  try {
    await getEmailService().send(to, subject, html)
    return true
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error)
    return false
  }
}

// Utility functions for common email operations
export async function sendRegistrationConfirmation(email: string, name: string, preferredCourse?: string) {
  const emailService = getEmailService()
  const template = emailTemplates.registrationConfirmation(name, preferredCourse)
  await emailService.send(email, template.subject, template.html)
}

export async function sendCertificateAwarded(email: string, name: string, courseName: string, certificateNumber: string) {
  const emailService = getEmailService()
  const template = emailTemplates.certificateAwarded(name, courseName, certificateNumber)
  await emailService.send(email, template.subject, template.html)
}

export async function sendAdminRegistrationNotification(adminEmail: string, fullName: string, studentEmail: string, phone: string, germanLevel?: string) {
  const emailService = getEmailService()
  const template = emailTemplates.adminRegistrationNotification(fullName, studentEmail, phone, germanLevel)
  await emailService.send(adminEmail, template.subject, template.html)
}

export async function sendRegistrationStatusUpdate(email: string, name: string, status: string) {
  const emailService = getEmailService()
  const template = emailTemplates.registrationStatusUpdate(name, status)
  await emailService.send(email, template.subject, template.html)
}

