import dotenv from "dotenv";
dotenv.config();
import { Resend } from "resend";
import { EmailOutboxModel as EmailOutbox } from "../../models/index.js";
import appendEmailButtonFallbacks from "./emailButtonFallbacks.js";

let resend;
const getResendClient = () => {
  if (!process.env.RESEND_EMAIL_KEY) {
    throw new Error("RESEND_EMAIL_KEY is not configured.");
  }
  if (!resend) resend = new Resend(process.env.RESEND_EMAIL_KEY);
  return resend;
};

const emailTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>

<style>
  /* RESET */
  body, table, td, p {
    margin: 0;
    padding: 0;
  }
  body {
    background-color: #f4f4f7;
    font-family: Arial, sans-serif;
    color: #333;
    -webkit-text-size-adjust: 100%;
  }

  /* CONTAINER */
  .email-container {
    width: 100%;
    background-color: #f4f4f7;
    padding: 40px 0;
  }

  .email-wrapper {
    width: 100%;
    max-width: 600px;
    background: #ffffff;
    margin: 0 auto;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  /* HEADER */
  .email-header {
    background-color: #7B0323;
    color: white;
    text-align: center;
    padding: 25px 20px;
    font-size: 24px;
    font-weight: bold;
  }

  /* BODY */
  .email-body {
    padding: 30px;
    font-size: 16px;
    line-height: 1.7;
  }

  .email-body p {
    margin: 0 0 18px 0;
  }

  /* BUTTON */
  .button-wrapper {
    text-align: center;
    margin: 30px 0;
  }

  .button {
    display: inline-block;
    background-color: #7B0323;
    color: #ffffff !important;
    padding: 12px 28px;
    font-size: 16px;
    font-weight: bold;
    border-radius: 6px;
    text-decoration: none;
  }

  /* FOOTER */
  .email-footer {
    background-color: #f0f0f0;
    padding: 20px 30px;
    font-size: 13px;
    color: #555;
    text-align: center;
  }

  .email-footer a {
    color: #7B0323;
    text-decoration: none;
    font-weight: bold;
  }

  /* 📱 MOBILE STYLES */
  @media (max-width: 480px) {

    .email-wrapper {
      border-radius: 0 !important;
      box-shadow: none !important;
    }

    .email-header {
      font-size: 20px !important;
      padding: 20px !important;
    }

    .email-body {
      padding: 20px !important;
      font-size: 15px !important;
    }

    .button {
      width: 100% !important;
      padding: 14px 0 !important;
      font-size: 17px !important;
      border-radius: 6px !important;
      display: block !important;
    }

    .email-footer {
      padding: 20px !important;
      font-size: 12px !important;
    }
  }
</style>

</head>

<body>
  <div class="email-container">
    <div class="email-wrapper">

      <div class="email-header">${title}</div>

      <div class="email-body">
        ${content}
      </div>

      <div class="email-footer">
        <p style="color:#777; font-size: 12px; margin-top: 30px;">
          This is an automated message. Replies are not monitored.<br/>
          For help, contact <a href="mailto:support@tipsyverse.com">support@tipsyverse.com</a>.
        </p>
        <p>© ${new Date().getFullYear()} Tipsyverse</p>
      </div>

    </div>
  </div>
</body>
</html>
`;


const sendEmail = async ({
  to,
  cc,
  bcc,
  subject,
  title,
  html,
  attachments,
  queueOnFailure = true,
}) => {
  try {
    const msg = {
      to: to,
      ...(cc ? { cc } : {}),
      ...(bcc ? { bcc } : {}),
      ...(attachments?.length ? { attachments } : {}),
      from: process.env.FROM_EMAIL,
      subject: subject,
      html: emailTemplate(title, appendEmailButtonFallbacks(html)),
    };

    await getResendClient().emails.send(msg);
    console.log(`✅ Email sent to ${to}`);
    return { success: true, message: "Email sent successfully." };
  } catch (error) {
    console.error(
      "❌ Email sending error:",
      error.response?.body || error.message
    );
    if (queueOnFailure) {
      await EmailOutbox.create({
        payload: { to, cc, bcc, subject, title, html, attachments },
        lastError: error.message || "Email provider error",
        nextAttemptAt: new Date(Date.now() + 60_000),
      }).catch((queueError) =>
        console.error("❌ Failed to queue email retry:", queueError.message)
      );
    }
    return { success: false, queued: queueOnFailure, message: "Email failed to send." };
  }
};

export default sendEmail;
