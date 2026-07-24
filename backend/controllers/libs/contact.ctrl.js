import { sendEmail, validateEmail, validatePhone } from "../../utils/index.js";

const contactCtrl = {
    sendContactUsEmail:  async (req, res) => {
      try {
         const { name, phone, email, message } = req.body;

          if (!name || !phone || !email || !message) {
        return res.status(400).json({
          success: false,
          message: "Name, phone, email, and message are required.",
        });
      }

       if (!validateEmail(email)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid email." });
      }

      if (!validatePhone(phone)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid phone number." });
      }
      
      const emailContent = 
      ` <h3>New Contact Request</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong> ${message}</p>`;
      await sendEmail({
        to: process.env.SUPPORT_EMAIL,
        title: "New Contact Message from Tipsyverse",
        subject: "New Contact Message from Tipsyverse",
        html: emailContent,
      });

       return res.status(200).json({
        success: true,
        message: `Thank you for your message! We'll get back to you shortly.`,
      });
      } catch (error) {
        return res.status(500).json({ success: false, message: err.message });
      }
    }
}

export default contactCtrl;