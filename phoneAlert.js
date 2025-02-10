import twilio from 'twilio';

export const sendPhoneReminder = async (phoneNumber, message) => {
  if (!phoneNumber) {
    console.error("No phone number provided!");
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    // Check if WhatsApp is available for the number
    const isWhatsApp = phoneNumber.startsWith('whatsapp:'); // This depends on your WhatsApp format for Twilio
    
    if (isWhatsApp) {
      await client.messages.create({
        body: message,
        from: 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER, // Your Twilio WhatsApp number
        to: phoneNumber,
      });
      console.log("WhatsApp message sent successfully!");
    } else {
      await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER, // Use the insurance company’s verified phone number here
        to: phoneNumber,
      });
      console.log("SMS sent successfully!");
    }
  } catch (error) {
    console.error("Error sending phone reminder:", error.message);
    if (error.code === 21408) {
      console.error('Permission to send an SMS has not been enabled for the region indicated by the \'To\' number.');
    } else if (error.code === 21606) {
      console.error('The "From" phone number is not a valid, SMS-capable Twilio number.');
    } else if (error.code === 21612) {
      console.error('The "From" phone number is not a valid, MMS-capable Twilio number.');
    } else if (error.code === 21614) {
      console.error('The "To" phone number is not a valid mobile number.');
    } else if (error.code === 21610) {
      console.error('The "To" phone number has opted out of receiving messages.');
    } else {
      console.error('An unknown error occurred:', error);
    }
  }
};