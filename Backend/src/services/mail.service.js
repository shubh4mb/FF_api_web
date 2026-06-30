import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for port 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendMail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"FlashFits" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
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
