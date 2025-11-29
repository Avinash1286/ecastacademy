import nodemailer from "nodemailer";

// Create reusable transporter
const createTransporter = () => {
  // For development, you can use ethereal.email or your SMTP service
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_SERVER_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { to, subject, html, from } = options;

  // Check if email is configured
  if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
    // In production, email must be configured - throw error to alert operators
    if (process.env.NODE_ENV === "production") {
      console.error("CRITICAL: Email service not configured in production!");
      throw new Error("Email service is not configured. Please contact support.");
    }
    // In development, log warning and skip
    console.warn("Email not configured. Skipping email send.");
    console.log("Would send email to:", to);
    console.log("Subject:", subject);
    return;
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: from || process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
}

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD) {
    return false;
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error("Email configuration error:", error);
    return false;
  }
}

