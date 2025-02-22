import nodemailer from 'nodemailer';

export const sendEmail = async (toEmail, subject, text) => {
  if (!toEmail) {
    console.error("No recipient email provided!");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'vinciguerraebarbagallomail@gmail.com', // Your email
      pass: 'xxxx jmnm goth ypgq', // Your app password here
    },
  });

  const mailOptions = {
    from: 'vinciguerraebarbagallomail@gmail.com', // Same email as above
    to: toEmail,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
