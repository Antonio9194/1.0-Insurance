import nodemailer from 'nodemailer';  // ES module import

// Function to send email
export const sendEmail = async (toEmail, subject, text) => {
  let transporter = nodemailer.createTransport({
    service: 'hotmail',  // You can change this to another service like SendGrid if needed
    auth: {
      user: process.env.EMAIL_USER,  // Get email from .env file
      pass: process.env.EMAIL_PASS,  // Get password from .env file
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,  // Sender's email address
    to: toEmail,                  // Recipient's email address
    subject: subject,             // Email subject
    text: text,                   // Email body content
  };

  try {
    await transporter.sendMail(mailOptions);  // Send the email
    console.log('Email sent successfully!');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};
