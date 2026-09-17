import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const resendApiKey = process.env.RESEND_API || process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Initialize Nodemailer fallback
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

if (!resend && !transporter) {
  console.warn("⚠️ [mail.service] Neither Resend nor Nodemailer (EMAIL_USER/EMAIL_PASS) is configured. Outgoing emails will fail.");
}

const fromEmail = process.env.EMAIL_FROM || 'noreply@mail.theflashfits.com';
const gmailUser = process.env.EMAIL_USER || fromEmail;

export const sendMail = async (to, subject, text, html, attachments = []) => {
  let resendError = null;

  // 1. Try Resend if configured
  if (resend) {
    try {
      const payload = {
        from: `FlashFits <${fromEmail}>`,
        to,
        subject,
      };

      if (text) payload.text = text;
      if (html) payload.html = html;
      if (attachments && attachments.length > 0) payload.attachments = attachments;

      const { data, error } = await resend.emails.send(payload);
      if (error) {
        throw error;
      }

      console.log("[mail.service] Email sent successfully via Resend: %s", data?.id);
      return { service: 'resend', id: data?.id };
    } catch (err) {
      console.warn("[mail.service] Resend failed, attempting fallback to Nodemailer:", err.message || err);
      resendError = err;
    }
  }

  // 2. Fallback to Nodemailer
  if (transporter) {
    try {
      const mailOptions = {
        from: `FlashFits <${gmailUser}>`,
        to,
        subject,
        text,
        html,
        attachments,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("[mail.service] Email sent successfully via Nodemailer: %s", info.messageId);
      return { service: 'nodemailer', id: info.messageId };
    } catch (nmErr) {
      console.error("[mail.service] Nodemailer also failed:", nmErr.message || nmErr);
      throw nmErr;
    }
  }

  if (resendError) {
    throw resendError;
  }

  throw new Error("No available email transport configured (Resend or Nodemailer).");
};

export const sendOtpEmail = async (email, otp, purpose = 'email_register') => {
  const isReset = purpose === 'password_reset';
  const title = isReset ? 'Reset Your Password' : 'Verify Your Email';
  const subject = isReset ? `FlashFits: ${otp} is your password reset code` : `FlashFits: ${otp} is your verification code`;
  const message = isReset
    ? 'Use the verification code below to reset your FlashFits account password. This code is valid for 10 minutes.'
    : 'Welcome to FlashFits! Use the verification code below to verify your email address and complete your registration. This code is valid for 10 minutes.';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                <!-- Header -->
                <tr>
                  <td style="background-color: #0f172a; padding: 32px 24px; text-align: center;">
                    <span style="color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: 3px; display: inline-block;">FLASHFITS</span>
                    <div style="color: #94a3b8; font-size: 11px; letter-spacing: 1.5px; margin-top: 4px; text-transform: uppercase;">Style Delivered Fast</div>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 36px 28px; text-align: center;">
                    <h2 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 12px 0;">${title}</h2>
                    <p style="font-size: 15px; line-height: 24px; color: #475569; margin: 0 0 28px 0;">
                      ${message}
                    </p>
                    
                    <!-- OTP Box -->
                    <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; padding: 18px 24px; display: inline-block; margin-bottom: 28px;">
                      <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #0f172a; font-family: 'SF Mono', Consolas, Monaco, monospace; display: block; margin-left: 10px;">
                        ${otp}
                      </span>
                    </div>

                    <p style="font-size: 13px; color: #64748b; margin: 0 0 8px 0;">
                      This code will expire in <strong style="color: #0f172a;">10 minutes</strong>.
                    </p>
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                      If you didn't request this code, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #f1f5f9; padding: 20px 24px; text-align: center;">
                    <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                      &copy; ${new Date().getFullYear()} FlashFits. All rights reserved.
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

  return sendMail(
    email,
    subject,
    `Your FlashFits verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
    html
  );
};

export const sendVerificationEmail = async (merchantEmail, shopName) => {
  const subject = "Shop Verified - Welcome to FlashFits!";
  const text = `Congratulations ${shopName}! Your shop has been verified and is now live on the FlashFits app.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
      <h2 style="color: #000;">Congratulations, ${shopName}!</h2>
      <p>We are excited to inform you that your shop has been <strong>successfully verified</strong> by our admin team.</p>
      <p>Your products are now visible to customers on the FlashFits app. You can now start receiving orders and managing your shop inventory.</p>
      <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
        <p style="margin: 0; font-size: 14px;"><strong>Next steps:</strong></p>
        <ul style="font-size: 14px; margin-top: 5px;">
          <li>Log in to your merchant dashboard</li>
          <li>Ensure your stock levels are accurate</li>
          <li>Start processing your orders</li>
        </ul>
      </div>
      <p style="margin-top: 30px;">Best regards,<br/><strong>The FlashFits Team</strong></p>
    </div>
  `;
  return sendMail(merchantEmail, subject, text, html);
};

export const sendMerchantPaymentReceiptEmail = async (merchantEmail, shopName, pdfBuffer) => {
  const subject = "Payment Receipt - Flashfits";
  const text = `Hi ${shopName},\n\nThank you for your payment. Please find your receipt attached as a PDF.\n\nBest regards,\nThe Flashfits Team`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; line-height: 1.6;">
      <h2 style="color: #000;">Payment Receipt</h2>
      <p>Hi ${shopName},</p>
      <p>Thank you for your payment. Please find your receipt attached as a PDF document.</p>
      <p style="margin-top: 30px;">Best regards,<br/><strong>The Flashfits Team</strong></p>
    </div>
  `;

  const attachments = [
    {
      filename: 'Flashfits_Receipt.pdf',
      content: pdfBuffer,
    }
  ];

  return sendMail(merchantEmail, subject, text, html, attachments);
};
