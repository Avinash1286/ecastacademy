/**
 * Email template for password reset
 */
export function getPasswordResetEmailHTML(
  resetUrl: string,
  userName?: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">ECAST Academy</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
              
              ${userName ? `<p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">Hi ${userName},</p>` : ''}
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">
                We received a request to reset your password for your ECAST Academy account. Click the button below to create a new password:
              </p>
              
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${resetUrl}" style="display: inline-block; padding: 14px 36px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; color: #666666; font-size: 14px; line-height: 20px;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="margin: 0 0 20px 0; padding: 12px; background-color: #f8f8f8; border-radius: 4px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #667eea; text-decoration: none; font-size: 14px;">${resetUrl}</a>
              </p>
              
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 20px;">
                This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ECAST Academy. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Email template for welcome email
 */
export function getWelcomeEmailHTML(userName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ECAST Academy</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">ECAST Academy</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Welcome to ECAST Academy! 🎉</h2>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">Hi ${userName},</p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">
                Thank you for joining ECAST Academy! We're excited to have you on board and can't wait to help you on your learning journey.
              </p>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 24px;">
                With ECAST Academy, you'll have access to:
              </p>
              
              <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #666666; font-size: 16px; line-height: 28px;">
                <li>AI-powered interactive learning</li>
                <li>Personalized course recommendations</li>
                <li>Progress tracking and analytics</li>
                <li>Community support and resources</li>
              </ul>
              
              <table role="presentation" style="margin: 30px 0;">
                <tr>
                  <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${process.env.NEXTAUTH_URL}/dashboard" style="display: inline-block; padding: 14px 36px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">Get Started</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 20px;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ECAST Academy. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

