import nodemailer from 'nodemailer';  // ES module import

// Email sending function
export const sendEmail = async (toEmail, subject, text) => {
  // Create the transporter
  let transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: {
      user: process.env.EMAIL_USER,  // Securely stored in .env file
      pass: process.env.EMAIL_PASS   // Password generated for the app
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject: subject,
    text: text
  };

  try {
    await transporter.sendMail(mailOptions);  // Send the email
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};



