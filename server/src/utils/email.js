const axios = require('axios');

const brevoApiKey = process.env.BREVO_API_KEY;
const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'fxsol76@gmail.com';
const brevoSenderName = process.env.BREVO_SENDER_NAME || 'VivaWork';

const brevoClient = axios.create({
  baseURL: 'https://api.brevo.com/v3',
  headers: {
    'api-key': brevoApiKey,
    'Content-Type': 'application/json',
  },
});

const sendEmail = async ({ to, subject, htmlContent, textContent }) => {
  try {
    const response = await brevoClient.post('/smtp/email', {
      sender: { email: brevoSenderEmail, name: brevoSenderName },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    });
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    console.error('Email send failed:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
};

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getVerificationExpiry = () => {
  return new Date(Date.now() + 5 * 60 * 1000);
};

const baseEmailStyles = `
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #d1fae5; }
  .header { background: #ffffff; padding: 40px 30px; text-align: center; border-bottom: 2px solid #10b981; }
  .header h1 { color: #065f46; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
  .header p { color: #10b981; margin: 8px 0 0 0; font-size: 16px; font-weight: 500; }
  .content { padding: 40px 30px; background: #ffffff; }
  .greeting { font-size: 18px; color: #064e3b; margin-bottom: 20px; font-weight: 600; }
  .message { font-size: 15px; color: #374151; line-height: 1.7; margin-bottom: 30px; }
  .code-box { background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0; }
  .code-box .code { font-size: 42px; font-weight: 800; color: #065f46; letter-spacing: 12px; font-family: 'Courier New', monospace; }
  .code-box .label { color: #10b981; font-size: 13px; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  .expiry { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 8px; margin: 24px 0; }
  .expiry p { margin: 0; color: #92400e; font-size: 14px; }
  .footer { background: #f0fdf4; padding: 24px 30px; text-align: center; border-top: 1px solid #d1fae5; }
  .footer p { color: #6b7280; font-size: 13px; margin: 4px 0; }
  .footer a { color: #10b981; text-decoration: none; font-weight: 500; }
  .social-links { margin-top: 16px; }
  .social-links a { display: inline-block; margin: 0 8px; color: #10b981; font-size: 14px; text-decoration: none; font-weight: 500; }
  .btn { display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; transition: background 0.2s; }
  .btn:hover { background: #059669; }
  .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 8px; margin: 24px 0; }
  .warning p { margin: 0; color: #92400e; font-size: 14px; }
  .security { background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 8px; margin: 24px 0; }
  .security p { margin: 0; color: #065f46; font-size: 14px; }
  .amount-box { background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
  .amount-box .amount { font-size: 32px; font-weight: 800; color: #065f46; }
  .amount-box .label { color: #6b7280; font-size: 13px; margin-top: 4px; }
`;

const emailWrapper = (content, headerTitle, headerSubtitle) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle} - VivaWork</title>
  <style>${baseEmailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VivaWork</h1>
      <p>${headerSubtitle}</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Need help? Contact us at <a href="mailto:fxsol76@gmail.com">fxsol76@gmail.com</a></p>
      <p>VivaWork Inc. All rights reserved.</p>
      <div class="social-links">
        <a href="#">LinkedIn</a>
        <a href="#">Twitter</a>
        <a href="#">Instagram</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

const sendVerificationEmail = async (email, code, firstName) => {
  const name = firstName || 'there';
  
  const htmlContent = emailWrapper(`
    <p class="greeting">Hi ${name},</p>
    <p class="message">Welcome to VivaWork! To get started and unlock the full power of our platform, please verify your email address using the code below.</p>
    <div class="code-box">
      <div class="code">${code}</div>
      <div class="label">Verification Code</div>
    </div>
    <div class="expiry">
      <p>This code will expire in <strong>5 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
    </div>
    <p class="message">Once verified, you'll be able to create your professional profile, connect with other professionals, post or apply for jobs, and start earning.</p>
  `, 'Verify Your Email', 'Where Talent Meets Opportunity');

  const textContent = `
VivaWork - Verify Your Email

Hi ${name},

Welcome to VivaWork! Your verification code is: ${code}

This code will expire in 5 minutes.

If you didn't request this, please ignore this email.

VivaWork Inc.
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - VivaWork',
    htmlContent,
    textContent,
  });
};

const sendWithdrawalOtpEmail = async (email, code, amount, firstName) => {
  const name = firstName || 'there';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Withdrawal Verification - VivaWork</title>
  <style>${baseEmailStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Security Alert</h1>
      <p>Withdrawal Verification Required</p>
    </div>
    <div class="content">
      <p class="greeting">Hi ${name},</p>
      <p class="message">We received a request to withdraw funds from your VivaWork wallet. For your security, please verify this withdrawal using the code below.</p>
      <div class="amount-box">
        <div class="amount">₦${amount.toLocaleString()}</div>
        <div class="label">Requested Withdrawal Amount</div>
      </div>
      <div class="code-box">
        <div class="code">${code}</div>
        <div class="label">Verification Code</div>
      </div>
      <div class="warning">
        <p>This code will expire in <strong>5 minutes</strong>. Never share this code with anyone.</p>
      </div>
      <div class="security">
        <p>If you did not initiate this withdrawal, <strong>change your password immediately</strong> and contact support.</p>
      </div>
    </div>
    <div class="footer">
      <p>VivaWork Security Team</p>
      <p>This is an automated security message. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
VivaWork - Withdrawal Verification

Hi ${name},

A withdrawal of ₦${amount.toLocaleString()} was requested from your wallet.

Your verification code is: ${code}

This code will expire in 5 minutes. Never share this code.

If you did not request this, change your password immediately and contact support.

VivaWork Security Team
  `;

  return sendEmail({
    to: email,
    subject: 'Withdrawal Verification Code - VivaWork',
    htmlContent,
    textContent,
  });
};

const sendPasswordResetEmail = async (email, resetLink, firstName) => {
  const name = firstName || 'there';

  const htmlContent = emailWrapper(`
    <p class="greeting">Hi ${name},</p>
    <p class="message">We received a request to reset your password. Click the button below to create a new password.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p class="expiry" style="text-align: center; margin-top: 20px;">This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
  `, 'Reset Your Password', 'Secure Your Account');

  const textContent = `
VivaWork - Reset Your Password

Hi ${name},

We received a request to reset your password.

Click this link to reset: ${resetLink}

This link expires in 10 minutes. If you didn't request this, ignore this email.

VivaWork Inc.
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - VivaWork',
    htmlContent,
    textContent,
  });
};

const sendDisputeFiledEmail = async ({ to, firstName, contractTitle, filedByName, isFiledByBuyer, disputeId, isAdmin = false }) => {
  const name = firstName || 'there';
  const roleText = isFiledByBuyer ? 'the buyer' : 'the freelancer';
  const subject = isAdmin ? `New Dispute Filed - ${contractTitle}` : `Dispute Filed on Your Contract - ${contractTitle}`;

  const htmlContent = emailWrapper(`
    <p class="greeting">Hi ${name},</p>
    ${isAdmin ? `
    <p class="message">A new dispute has been filed on the platform and requires your admin review.</p>
    ` : `
    <p class="message">${filedByName} (${roleText}) has filed a dispute for the contract <strong>"${contractTitle}"</strong>.</p>
    <p class="message">An admin will review the case and both parties will be notified of the resolution.</p>
    `}
    <div class="code-box" style="background: #fef3c7; border-color: #f59e0b;">
      <div class="label" style="color: #92400e;">Contract</div>
      <div style="font-size: 18px; font-weight: 700; color: #92400e; margin-top: 8px;">${contractTitle}</div>
    </div>
    <div class="security">
      <p>You can view the dispute details and submit evidence through your dashboard.</p>
    </div>
  `, isAdmin ? 'New Dispute Requires Review' : 'Dispute Filed', 'Action Required');

  const textContent = `
VivaWork - ${isAdmin ? 'New Dispute' : 'Dispute Filed'}

Hi ${name},

${isAdmin ? 'A new dispute has been filed and requires your review.' : `${filedByName} has filed a dispute for "${contractTitle}".`}

Contract: ${contractTitle}
Filed by: ${filedByName}

An admin will review and notify both parties.

VivaWork Inc.
  `;

  return sendEmail({ to, subject, htmlContent, textContent });
};

const sendDisputeUpdateEmail = async ({ to, firstName, contractTitle, status, message, isAdmin = false }) => {
  const name = firstName || 'there';
  const statusLabels = {
    open: 'Open',
    under_review: 'Under Review',
    resolved: 'Resolved',
  };
  const statusColor = status === 'resolved' ? '#10b981' : status === 'under_review' ? '#f59e0b' : '#6b7280';

  const htmlContent = emailWrapper(`
    <p class="greeting">Hi ${name},</p>
    <p class="message">There has been an update on the dispute for <strong>"${contractTitle}"</strong>.</p>
    <div class="code-box" style="background: ${statusColor}15; border-color: ${statusColor};">
      <div class="label" style="color: ${statusColor};">Status Update</div>
      <div style="font-size: 24px; font-weight: 800; color: ${statusColor}; margin-top: 8px;">${statusLabels[status] || status}</div>
    </div>
    ${message ? `<p class="message">${message}</p>` : ''}
    <div class="security">
      <p>Log in to your dashboard to view full details and submit any additional evidence.</p>
    </div>
  `, 'Dispute Update', 'Status Changed');

  const textContent = `
VivaWork - Dispute Update

Hi ${name},

The dispute for "${contractTitle}" has been updated.

Status: ${statusLabels[status] || status}
${message ? `Message: ${message}` : ''}

Log in to view details.

VivaWork Inc.
  `;

  return sendEmail({ to, subject: `Dispute Update - ${contractTitle}`, htmlContent, textContent });
};

module.exports = {
  sendEmail,
  generateVerificationCode,
  getVerificationExpiry,
  sendVerificationEmail,
  sendWithdrawalOtpEmail,
  sendPasswordResetEmail,
  sendDisputeFiledEmail,
  sendDisputeUpdateEmail,
};