/**
 * Test script for Resend email functionality
 * Run with: node test-email.js
 */

require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function testEmail() {
  console.log('\n🧪 Testing Resend Email Configuration\n');
  
  // Check environment variables
  console.log('1. Checking environment variables...');
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY is not set in .env.local');
    return;
  }
  console.log('✅ RESEND_API_KEY:', apiKey.substring(0, 10) + '...');
  console.log('✅ EMAIL_FROM:', emailFrom || 'no-reply@contact.fmc-rgipt.in');
  
  // Initialize Resend
  console.log('\n2. Initializing Resend client...');
  const resend = new Resend(apiKey);
  console.log('✅ Resend client initialized');
  
  // Test email
  console.log('\n3. Sending test email...');
  const testEmail = 'delivered@resend.dev'; // Resend's test email
  
  try {
    const { data, error } = await resend.emails.send({
      from: `FMC Gallery <${emailFrom || 'no-reply@contact.fmc-rgipt.in'}>`,
      to: [testEmail],
      subject: 'FMC Gallery - Email Configuration Test',
      html: `
        <h1>Email Test Successful! ✅</h1>
        <p>Your Resend email configuration is working correctly.</p>
        <p><strong>Verified Domain:</strong> contact.fmc-rgipt.in</p>
        <p><strong>Sender:</strong> no-reply@contact.fmc-rgipt.in</p>
      `,
    });
    
    if (error) {
      console.error('❌ Failed to send email:', error);
      return;
    }
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Email ID:', data.id);
    console.log('📬 Sent to:', testEmail);
    console.log('\n✨ Your invitation emails are ready to work!\n');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testEmail();
