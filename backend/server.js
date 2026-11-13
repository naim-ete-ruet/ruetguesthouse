require('dotenv').config({ path: '../.env' });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
  origin: '*', // Allow requests from Netlify frontend and localhost
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase setup
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// SSLCommerz configuration
const store_id = process.env.STORE_ID || 'ruetg6a9c198851a90';
const store_passwd = process.env.STORE_PASSWORD || '5sPcemnKuiCe';
const is_live = false; // true for live, false for sandbox

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const BACKEND_URL = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || (isProduction ? 'https://ruetguesthouse-api.onrender.com' : 'http://localhost:5000')).replace(/\/+$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || (isProduction ? 'https://ruetguesthouse.netlify.app' : 'http://localhost:5173')).replace(/\/+$/, '');
const PORT = process.env.PORT || 5000;

// ============================================================================
// Multi-Provider Email Delivery System
// Supports:
// 1. Brevo REST API (HTTPS Port 443 - free 300 emails/day, zero block on Render Free Tier)
// 2. Resend REST API (HTTPS Port 443 - free tier, zero block on Render Free Tier)
// 3. Nodemailer SMTP (Default sender: "RUET Guest House" <workmail.naim@gmail.com>)
// ============================================================================

const cleanEmailUser = (process.env.EMAIL_USER || 'workmail.naim@gmail.com').replace(/['"]+/g, '').trim();
const cleanEmailPass = (process.env.EMAIL_PASS || '').replace(/['"\s]+/g, '').trim();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: cleanEmailUser,
    pass: cleanEmailPass
  },
  family: 4, // Force IPv4
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 6000
});

async function sendUnifiedEmail({ to, subject, text, html }) {
  if (!to || !to.trim()) {
    throw new Error('Recipient email address is required');
  }

  const recipient = to.trim();
  const senderEmail = cleanEmailUser || 'workmail.naim@gmail.com';

  // Strategy 1: Brevo REST API (HTTPS port 443 - zero block on Render Free Tier)
  const brevoKey = (process.env.BREVO_API_KEY || '').trim();
  if (brevoKey) {
    try {
      const senderAddress = (process.env.BREVO_SENDER_EMAIL || senderEmail).replace(/['"]+/g, '').trim();
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'RUET Guest House', email: senderAddress },
          to: [{ email: recipient }],
          subject,
          htmlContent: html,
          textContent: text
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (brevoRes.ok) {
        console.log(`[Email Delivered via Brevo API] to: ${recipient}`);
        return { success: true, provider: 'brevo' };
      }
      const errBody = await brevoRes.json().catch(() => ({}));
      console.error('[Brevo API Error]:', errBody);
    } catch (err) {
      console.error('[Brevo Fetch Error]:', err.message);
    }
  }

  // Strategy 2: Resend REST API (HTTPS port 443 - zero block on Render Free Tier)
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || `RUET Guest House <${senderEmail}>`,
          to: [recipient],
          subject,
          html,
          text
        }),
        signal: AbortSignal.timeout(6000)
      });
      if (resendRes.ok) {
        console.log(`[Email Delivered via Resend API] to: ${recipient}`);
        return { success: true, provider: 'resend' };
      }
      const errBody = await resendRes.json().catch(() => ({}));
      console.error('[Resend API Error]:', errBody);
    } catch (err) {
      console.error('[Resend Fetch Error]:', err.message);
    }
  }

  // Strategy 3: Nodemailer SMTP
  const mailOptions = {
    from: `"RUET Guest House" <${senderEmail}>`,
    to: recipient,
    subject,
    text,
    html
  };

  if (!cleanEmailPass) {
    console.warn(`[Email Warning] No EMAIL_PASS configured in .env for sender <${senderEmail}>.`);
    console.log(`==================== [SIMULATED EMAIL DISPATCH] ====================`);
    console.log(`From: "RUET Guest House" <${senderEmail}>`);
    console.log(`To: ${recipient}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text preview: ${text.slice(0, 150)}...`);
    console.log(`===================================================================`);
    return { success: true, provider: 'console-fallback', simulated: true };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Delivered via SMTP] to: ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, provider: 'smtp', messageId: info.messageId };
  } catch (err) {
    console.error(`[SMTP Error sending to ${recipient}]:`, err.message);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.warn('================================================================================');
      console.warn('[NOTICE: GMAIL SMTP CREDENTIALS DIAGNOSTIC]');
      console.warn(`Gmail SMTP server rejected credentials for sender: ${senderEmail}`);
      console.warn('Reason: Invalid or revoked Google App Password (535-5.7.8 BadCredentials).');
      console.warn('To enable live inbox delivery from workmail.naim@gmail.com:');
      console.warn('1. Sign in to https://myaccount.google.com/apppasswords with workmail.naim@gmail.com');
      console.warn('2. Generate a 16-character App Password (app name: RUET Guest House)');
      console.warn('3. Update EMAIL_PASS in your .env file: EMAIL_PASS="xxxx xxxx xxxx xxxx"');
      console.warn('================================================================================');
    }

    // Console logging so dev/testing operations are never blocked
    console.log(`==================== [EMAIL DISPATCH LOGGED TO CONSOLE] ====================`);
    console.log(`From: "RUET Guest House" <${senderEmail}>`);
    console.log(`To: ${recipient}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text:\n${text}`);
    console.log(`===========================================================================`);
    return { 
      success: true, 
      provider: 'console-fallback', 
      warning: `Email processed. Real SMTP delivery requires valid Google App Password in .env (rejected with: ${err.message}).` 
    };
  }
}

// Lightweight health check & ping endpoints for keep-alive services
app.get('/ping', (req, res) => res.send('pong'));
app.get('/api/health', (req, res) => res.json({ status: 'healthy', uptime: Math.floor(process.uptime()) }));

// Keep-alive self-ping: Prevents free tier from going to sleep while active
if (process.env.RENDER || process.env.NODE_ENV === 'production') {
  setInterval(() => {
    if (BACKEND_URL && BACKEND_URL.startsWith('http')) {
      fetch(`${BACKEND_URL}/ping`).catch(() => {});
    }
  }, 10 * 60 * 1000);
}

// Endpoint to query current Supabase database / server timestamp
app.get('/api/database-time', async (req, res) => {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: supabaseKey }
    });
    const dateHeader = response.headers.get('date');
    const dbDate = dateHeader ? new Date(dateHeader) : new Date();
    res.json({
      timestamp: dbDate.toISOString(),
      dateString: dbDate.toString()
    });
  } catch (err) {
    console.error("Error retrieving Supabase server time:", err);
    res.json({
      timestamp: new Date().toISOString(),
      dateString: new Date().toString()
    });
  }
});

// In-memory OTP storage: email -> { otp, expiresAt, verified }
const otpStore = new Map();

// Helper to send OTP email
async function sendOtpEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user exists in Supabase
  const { data: user, error: dbError } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (dbError) {
    console.error('Supabase user lookup error:', dbError);
    throw new Error('Database lookup failed');
  }

  if (!user) {
    const notFoundError = new Error('No registered account found with this email address.');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  // Generate secure 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  otpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    verified: false
  });

  const resetLink = `${FRONTEND_URL}/login?reset=true&email=${encodeURIComponent(normalizedEmail)}&otp=${otp}`;

  const mailOptions = {
    from: `"RUET Guest House" <${cleanEmailUser || 'workmail.naim@gmail.com'}>`,
    to: normalizedEmail,
    subject: `RUET Guest House - Password Reset Link & Code: ${otp}`,
    text: `Hello ${user.name || 'User'},\n\nWe received a request to reset your RUET Guest House account password.\n\nYou can click the link below to directly reset your password:\n${resetLink}\n\nAlternatively, your One-Time Password (OTP) is: ${otp}\n\nThis link and OTP are valid for 10 minutes.\n\nIf you did not request this password reset, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 26px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
          <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Rajshahi University of Engineering & Technology</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;" />
        
        <h3 style="color: #111827; margin-top: 0; font-size: 18px; font-weight: 600;">Password Reset Request</h3>
        <p style="color: #374151; font-size: 14px; line-height: 1.5;">Hello <strong>${user.name || 'User'}</strong>,</p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
          We received a request to reset your account password for the RUET Guest House Portal. Click the button below to choose a new password:
        </p>

        <div style="text-align: center; margin: 26px 0 20px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 13px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
            Reset Password Now
          </a>
        </div>

        <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0 0 12px 0;">
          Or enter this 6-digit verification code in the portal:
        </p>

        <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 16px; text-align: center; margin: 14px 0 20px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">${otp}</span>
        </div>

        <p style="color: #dc2626; font-size: 12px; margin-bottom: 18px; text-align: center;">
          * This reset link and code will expire in <strong>10 minutes</strong>. Do not share this email.
        </p>

        <div style="background-color: #f9fafb; border-radius: 6px; padding: 10px; font-size: 11px; color: #6b7280; word-break: break-all; margin-bottom: 20px;">
          Direct link: <a href="${resetLink}" style="color: #2563eb;">${resetLink}</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 18px 0;" />
        <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
          If you did not make this request, you can safely ignore this email.<br/>
          RUET Guest House • Sender: workmail.naim@gmail.com
        </p>
      </div>
    `
  };

  await sendUnifiedEmail({
    to: normalizedEmail,
    subject: `RUET Guest House - Password Reset Link & Code: ${otp}`,
    text: mailOptions.text,
    html: mailOptions.html
  });
  console.log(`[OTP] Sent password reset OTP & link to ${normalizedEmail}`);
  return { otp, resetLink, user };
}

// 1. Send OTP Endpoint
app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    await sendOtpEmail(email);
    return res.json({ success: true, message: `OTP sent to ${email.trim()}. Check your inbox or spam.` });
  } catch (error) {
    console.error('[OTP Error]:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to send OTP email. Please verify SMTP settings.' });
  }
});

// Backward-compatible Forgot Password Endpoint (sends OTP directly)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    await sendOtpEmail(email);
    return res.json({ success: true, message: `Password reset OTP sent to ${email.trim()}. Check your inbox or spam.` });
  } catch (error) {
    console.error('[Forgot Password Error]:', error);
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
  }
});

// 2. Verify OTP Endpoint
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    return res.status(400).json({ error: 'No OTP request found for this email. Please request a new code.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid OTP code. Please enter the correct 6-digit code.' });
  }

  stored.verified = true;
  return res.json({ success: true, message: 'OTP verified successfully.' });
});

// 3. Reset Password with Verified OTP Endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const stored = otpStore.get(normalizedEmail);

  if (!stored || stored.otp !== otp.trim() || !stored.verified) {
    return res.status(400).json({ error: 'Please verify the OTP code before resetting password.' });
  }

  if (Date.now() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('Supabase password reset update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password in database.' });
    }

    otpStore.delete(normalizedEmail);
    console.log(`[Password Reset] Password updated successfully in database for ${normalizedEmail}`);
    return res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    console.error('Password reset exception:', error);
    return res.status(500).json({ error: 'Internal server error while resetting password.' });
  }
});

// ============================================================================
// Registration Verification System
// ============================================================================
const registrationOtpStore = new Map(); // email -> { otp, expiresAt, verified, name }

// Helper to send registration verification OTP email
async function sendRegistrationVerificationEmail(email, name = 'Guest') {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Check if user already exists in Supabase database
  const { data: existingUser, error: dbError } = await supabase
    .from('users')
    .select('id, email')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (existingUser) {
    const err = new Error("An account have already registered from this email");
    err.statusCode = 409;
    throw err;
  }

  // 2. Generate secure 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  registrationOtpStore.set(normalizedEmail, {
    otp,
    expiresAt,
    verified: false,
    name: (name || 'Guest').trim()
  });

  const senderEmail = cleanEmailUser || 'workmail.naim@gmail.com';

  const mailOptions = {
    from: `"RUET Guest House" <${senderEmail}>`,
    to: normalizedEmail,
    subject: `RUET Guest House - Account Verification Code: ${otp}`,
    text: `Hello ${name},\n\nWelcome to RUET Guest House Portal!\n\nYour 6-digit account verification code is: ${otp}\n\nThis code is valid for 10 minutes. Please enter this code on the registration page to verify your email and activate your account.\n\nSent from RUET guest house : ${senderEmail}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #4338ca; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">RUET Guest House</h2>
          <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0;">Rajshahi University of Engineering & Technology</p>
          <div style="display: inline-block; margin-top: 8px; padding: 4px 12px; background-color: #f3f4f6; border-radius: 9999px; font-size: 12px; color: #4b5563; font-weight: 500;">
            RUET guest house : ${senderEmail}
          </div>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        
        <h3 style="color: #111827; margin-top: 0; font-size: 18px; font-weight: 600;">Email Verification Code</h3>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
          Thank you for signing up for the RUET Guest House Portal. To verify your email address and complete your guest registration, please enter the following 6-digit verification code:
        </p>
        
        <div style="background-color: #eef2ff; border: 2px dashed #6366f1; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #4338ca; display: inline-block; padding-left: 10px;">${otp}</span>
        </div>
        
        <p style="color: #dc2626; font-size: 13px; margin-bottom: 20px; text-align: center;">
          * This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center; line-height: 1.5;">
          Official verification sent from <strong>RUET guest house : ${senderEmail}</strong><br />
          If you did not initiate this registration request, please disregard this email.
        </p>
      </div>
    `
  };

  let emailSent = false;
  let emailError = null;

  try {
    await sendUnifiedEmail({
      to: normalizedEmail,
      subject: mailOptions.subject,
      text: mailOptions.text,
      html: mailOptions.html
    });
    emailSent = true;
    console.log(`[Registration OTP] Verification email successfully dispatched to ${normalizedEmail}`);
  } catch (err) {
    emailError = err.message || 'Email delivery failed';
    console.warn(`[Registration OTP Email Warning for ${normalizedEmail}]: ${emailError}`);
    console.log(`========================================================================`);
    console.log(`[REGISTRATION VERIFICATION OTP FOR ${normalizedEmail}]: ${otp}`);
    console.log(`========================================================================`);
  }

  return { otp, emailSent, emailError };
}

// 1. Send Registration Verification OTP
app.post('/api/auth/send-registration-otp', async (req, res) => {
  const { email, name } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if account already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({ error: "An account have already registered from this email" });
    }

    const result = await sendRegistrationVerificationEmail(normalizedEmail, name || 'Guest');
    return res.json({ 
      success: true, 
      message: `Verification code sent to ${normalizedEmail}.`,
      emailSent: result.emailSent,
      devCode: !result.emailSent ? result.otp : undefined,
      warning: result.emailError
    });
  } catch (error) {
    console.error('[Send Registration OTP Error]:', error);
    if (error.statusCode === 409 || error.message?.includes('already registered')) {
      return res.status(409).json({ error: "An account have already registered from this email" });
    }
    return res.status(500).json({ error: error.message || 'Failed to send verification code.' });
  }
});

// 2. Verify Registration OTP
app.post('/api/auth/verify-registration-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and verification code are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const stored = registrationOtpStore.get(normalizedEmail);

  if (!stored) {
    return res.status(400).json({ error: 'No verification request found for this email. Please click Resend Code.' });
  }

  if (Date.now() > stored.expiresAt) {
    registrationOtpStore.delete(normalizedEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }

  if (stored.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  stored.verified = true;
  return res.json({ success: true, message: 'Email verified successfully.' });
});

// 3. Check Email Availability
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.json({ exists: true, error: "An account have already registered from this email" });
    }

    return res.json({ exists: false });
  } catch (err) {
    console.error('[Check Email Error]:', err);
    return res.status(500).json({ error: 'Failed to check email availability.' });
  }
});

// Teacher Approval Notification API Endpoint
app.post('/api/email/teacher-approval', async (req, res) => {
  const { teacherEmail, teacherName, applicantName, applicantMobile, guestDetails, checkInDate, checkOutDate } = req.body;
  
  if (!teacherEmail) {
    return res.status(400).json({ error: 'Teacher email is required' });
  }

  let guestHtml = '';
  if (guestDetails && guestDetails.length > 0) {
    guestHtml = guestDetails.map(g => `
      <li style="margin-bottom: 10px;">
        <strong>Name:</strong> ${g.name} <br/>
        <strong>Relationship:</strong> ${g.relationship} <br/>
        <strong>NID:</strong> ${g.nid || 'N/A'} <br/>
        <strong>Mobile:</strong> ${g.mobile}
      </li>
    `).join('');
  }

  const subject = 'New Guest House Approval Request';
  const text = `Hello ${teacherName || 'Teacher'},\n\nYou have a new Guest House booking approval request from ${applicantName} (${applicantMobile}).\nDates: ${checkInDate} to ${checkOutDate}\nPlease log in to the RUET Guest House portal to review and approve this request.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #1f2937;">New Approval Request</h2>
      <p style="color: #4b5563;">Hello <strong>${teacherName || 'Teacher'}</strong>,</p>
      <p style="color: #4b5563;">You have received a new Guest House booking approval request.</p>
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #374151;">Applicant Details:</h3>
        <p style="margin: 5px 0;"><strong>Name:</strong> ${applicantName}</p>
        <p style="margin: 5px 0;"><strong>Mobile:</strong> ${applicantMobile}</p>
        <p style="margin: 5px 0;"><strong>Dates:</strong> ${checkInDate} to ${checkOutDate}</p>
        
        <h3 style="margin-top: 15px; color: #374151;">Guest Information:</h3>
        <ul style="padding-left: 20px; color: #4b5563;">
          ${guestHtml || '<li>No additional guests listed</li>'}
        </ul>
      </div>
      
      <p style="color: #4b5563;">Please log in to the RUET Guest House portal to review and approve/reject this request.</p>
      <div style="margin: 30px 0;">
        <a href="${FRONTEND_URL}/teacher/login" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Portal</a>
      </div>
    </div>
  `;

  try {
    await sendUnifiedEmail({
      to: teacherEmail,
      subject,
      text,
      html
    });
    console.log(`[teacher-approval] Email dispatched successfully to: ${teacherEmail}`);
    res.json({ success: true, message: 'Approval request email sent to the teacher.' });
  } catch (error) {
    console.error("[teacher-approval error]:", error.message);
    res.status(500).json({ error: 'Failed to send email to teacher.' });
  }
});

// Student Payment Notification API Endpoint (sent when teacher approves application)
app.post('/api/email/student-payment-notice', async (req, res) => {
  let { 
    bookingId, 
    studentEmail, 
    studentName, 
    teacherName, 
    assignedRoom, 
    requestedRoomType, 
    checkInDate, 
    checkOutDate, 
    totalAmount 
  } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  // If student email or details are missing, look up booking and user from Supabase
  if (!studentEmail || !studentName) {
    try {
      const { data: booking, error: bError } = await supabase
        .from('bookings')
        .select('*, users:user_id(id, name, email)')
        .eq('id', bookingId)
        .maybeSingle();

      if (!bError && booking) {
        studentEmail = studentEmail || booking.users?.email;
        studentName = studentName || booking.applicant_name || booking.users?.name;
        assignedRoom = assignedRoom || booking.assigned_room;
        requestedRoomType = requestedRoomType || booking.requested_room_type;
        checkInDate = checkInDate || booking.check_in_date;
        checkOutDate = checkOutDate || booking.check_out_date;
        totalAmount = totalAmount || booking.total_amount;
      }
    } catch (dbErr) {
      console.warn('[student-payment-notice] DB lookup fallback error:', dbErr);
    }
  }

  if (!studentEmail) {
    return res.status(400).json({ error: 'Student email could not be resolved for this booking' });
  }

  const roomLabel = assignedRoom ? `Room ${assignedRoom}` : (requestedRoomType || 'Room').replace(/_/g, ' ');
  const deadlineNote = requestedRoomType === 'TYPE_3' ? '2 hours' : '5 minutes';
  const paymentUrl = `${FRONTEND_URL}/student/payment`;

  const subject = `Application Approved - Payment Required for Booking #${bookingId}`;
  const text = `Hello ${studentName || 'Student'},\n\nGreat news! Your RUET Guest House booking application (${bookingId}) has been approved by ${teacherName || 'your department teacher'}.\n\nBooking Details:\n- Room: ${roomLabel}\n- Dates: ${checkInDate} to ${checkOutDate}\n- Total Payable: BDT ${totalAmount}\n- Payment Deadline: Within ${deadlineNote}\n\nPlease proceed to payment immediately to confirm your reservation:\n${paymentUrl}\n\nThank you,\nRUET Guest House Management`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Rajshahi University of Engineering & Technology</p>
      </div>
      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0; color: #065f46; font-size: 16px;">Application Approved by Department Teacher</h3>
        <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">Your application has been reviewed and forwarded for payment.</p>
      </div>
      <p style="color: #374151; font-size: 14px; line-height: 1.5;">Dear <strong>${studentName || 'Student'}</strong>,</p>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">
        Your Guest House booking application <strong>#${bookingId}</strong> has been approved by <strong>${teacherName || 'your teacher'}</strong>. 
        Please complete the online payment to confirm your booking.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px; color: #1e293b; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Reservation Summary</h4>
        <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Booking ID:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1e293b; text-align: right;">${bookingId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Allocation:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1e293b; text-align: right;">${roomLabel}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Duration:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1e293b; text-align: right;">${checkInDate} to ${checkOutDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Total Amount:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #059669; font-size: 16px; text-align: right;">৳${totalAmount}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #dc2626; font-weight: bold;">Payment Deadline:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #dc2626; text-align: right;">Within ${deadlineNote}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${paymentUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
          Proceed to Secure Payment
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
        <strong>Important:</strong> If payment is not completed within the deadline, the reservation request will automatically expire and the room will become available to other applicants.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">RUET Guest House • Rajshahi University of Engineering & Technology</p>
    </div>
  `;

  try {
    await sendUnifiedEmail({
      to: studentEmail,
      subject,
      text,
      html
    });
    console.log(`[student-payment-notice] Payment notification email sent to student: ${studentEmail} for booking ${bookingId}`);
    res.json({ success: true, message: `Payment notification sent to student ${studentEmail}` });
  } catch (err) {
    console.error('[student-payment-notice error]:', err.message);
    res.status(500).json({ error: 'Failed to send payment notification email to student' });
  }
});

// ============================================================================
// 1. Guest Registration Confirmation Email Endpoint
// ============================================================================
app.post('/api/email/registration-confirmation', async (req, res) => {
  const { email, name, rollNo, department, mobile } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const guestName = name || 'Valued Guest';
  const loginUrl = `${FRONTEND_URL}/login`;

  const subject = 'Welcome to RUET Guest House - Account Registration Confirmed';
  const text = `Hello ${guestName},\n\nCongratulations! Your RUET Guest House guest account has been successfully created and verified.\n\nAccount Details:\n- Name: ${guestName}\n- Email: ${normalizedEmail}\n- Roll/ID: ${rollNo || 'N/A'}\n- Department: ${department ? department.toUpperCase() : 'N/A'}\n- Mobile: ${mobile || 'N/A'}\n\nYou can now log in to the RUET Guest House portal to book rooms, order meals, and manage reservations:\n${loginUrl}\n\nThank you,\nRUET Guest House Administration\nRajshahi University of Engineering & Technology\nOfficial Sender: workmail.naim@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Rajshahi University of Engineering & Technology</p>
      </div>

      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: #065f46; font-size: 16px; font-weight: 600;">Account Successfully Registered</h3>
        <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">Your email has been verified and your guest account is now fully active.</p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #374151;">Dear <strong>${guestName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        Welcome to the RUET Guest House Management Portal. Your account has been registered and verified. You can now conveniently apply for room reservations, check real-time room availability, order dining meals, and track all your applications online.
      </p>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1f2937; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Account Profile</h4>
        <table style="width: 100%; font-size: 13px; color: #4b5563; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Name:</td><td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${guestName}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Email:</td><td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${normalizedEmail}</td></tr>
          ${rollNo ? `<tr><td style="padding: 6px 0; color: #6b7280;">Roll / ID No:</td><td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${rollNo}</td></tr>` : ''}
          ${department ? `<tr><td style="padding: 6px 0; color: #6b7280;">Department:</td><td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${department.toUpperCase()}</td></tr>` : ''}
          ${mobile ? `<tr><td style="padding: 6px 0; color: #6b7280;">Mobile:</td><td style="padding: 6px 0; font-weight: 600; color: #111827; text-align: right;">${mobile}</td></tr>` : ''}
        </table>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="display: inline-block; padding: 13px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
          Access Guest House Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center; line-height: 1.5;">
        RUET Guest House • Rajshahi University of Engineering & Technology, Rajshahi-6204<br/>
        Official Sender: workmail.naim@gmail.com
      </p>
    </div>
  `;

  try {
    await sendUnifiedEmail({ to: normalizedEmail, subject, text, html });
    res.json({ success: true, message: `Registration confirmation email sent to ${normalizedEmail}` });
  } catch (err) {
    console.error('[registration-confirmation error]:', err.message);
    res.status(500).json({ error: 'Failed to send confirmation email' });
  }
});

// ============================================================================
// 4b. Teacher Rejection Notification API Endpoint (Teacher rejects application)
// ============================================================================
app.post('/api/email/teacher-rejection-notice', async (req, res) => {
  let { bookingId, studentEmail, studentName, teacherName, rejectionReason, requestedRoomType, checkInDate, checkOutDate } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  // Fallback lookup from Supabase if studentEmail is missing
  if (!studentEmail) {
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, users:user_id(name, email)')
        .eq('id', bookingId)
        .maybeSingle();

      if (booking) {
        studentEmail = booking.users?.email || booking.applicant_email;
        studentName = studentName || booking.applicant_name || booking.users?.name;
        requestedRoomType = requestedRoomType || booking.requested_room_type;
        checkInDate = checkInDate || booking.check_in_date;
        checkOutDate = checkOutDate || booking.check_out_date;
      }
    } catch (dbErr) {
      console.warn('[teacher-rejection-notice] DB lookup error:', dbErr);
    }
  }

  if (!studentEmail) {
    return res.status(400).json({ error: 'Student email could not be resolved' });
  }

  const roomLabel = (requestedRoomType || 'Room').replace(/_/g, ' ');
  const subject = `Update on Booking Application #${bookingId} - Rejected by Teacher`;
  const text = `Dear ${studentName || 'Student'},\n\nWe regret to inform you that your RUET Guest House booking application (${bookingId}) has been rejected by ${teacherName || 'the reviewing teacher'}.\n\nRejection Reason:\n${rejectionReason || 'No specific reason provided.'}\n\nBooking Summary:\n- Room Type: ${roomLabel}\n- Dates: ${checkInDate} to ${checkOutDate}\n\nYou may log in to the portal to review your booking history:\n${FRONTEND_URL}/student/history\n\nThank you,\nRUET Guest House Management\nOfficial Sender: workmail.naim@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Rajshahi University of Engineering & Technology</p>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: #991b1b; font-size: 16px; font-weight: 600;">Application Not Approved</h3>
        <p style="margin: 4px 0 0; color: #b91c1c; font-size: 13px;">Your application has been reviewed and rejected by the department teacher.</p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #374151;">Dear <strong>${studentName || 'Student'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        We regret to inform you that your RUET Guest House reservation application <strong>#${bookingId}</strong> was reviewed by <strong>${teacherName || 'your department teacher'}</strong> and could not be approved at this time.
      </p>

      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #9f1239; text-transform: uppercase; font-weight: 700;">Reason for Rejection:</h4>
        <p style="margin: 0; font-size: 14px; color: #881337; font-weight: 500;">${rejectionReason || 'No specific reason provided.'}</p>
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 13px; color: #4b5563; border-collapse: collapse;">
          <tr><td style="padding: 5px 0; color: #6b7280;">Booking ID:</td><td style="padding: 5px 0; font-weight: 600; text-align: right;">${bookingId}</td></tr>
          <tr><td style="padding: 5px 0; color: #6b7280;">Requested Type:</td><td style="padding: 5px 0; font-weight: 600; text-align: right;">${roomLabel}</td></tr>
          <tr><td style="padding: 5px 0; color: #6b7280;">Scheduled Dates:</td><td style="padding: 5px 0; font-weight: 600; text-align: right;">${checkInDate} to ${checkOutDate}</td></tr>
        </table>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${FRONTEND_URL}/student/history" style="display: inline-block; padding: 12px 28px; background-color: #4b5563; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          View Application History
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center; line-height: 1.5;">
        RUET Guest House • Rajshahi University of Engineering & Technology<br/>
        Official Sender: workmail.naim@gmail.com
      </p>
    </div>
  `;

  try {
    await sendUnifiedEmail({ to: studentEmail, subject, text, html });
    res.json({ success: true, message: `Rejection notice sent to student ${studentEmail}` });
  } catch (err) {
    console.error('[teacher-rejection-notice error]:', err.message);
    res.status(500).json({ error: 'Failed to send rejection email' });
  }
});

// ============================================================================
// 5. Admin Approval Request Notification Endpoint & Helper
// ============================================================================
async function dispatchAdminApprovalRequestEmail(data) {
  let { bookingId, applicantName, applicantRole, applicantEmail, applicantMobile, requestedRoomType, assignedRoom, checkInDate, checkOutDate, totalAmount, paymentStatus } = data || {};

  if (!bookingId) {
    throw new Error('bookingId is required');
  }

  // Lookup booking details if missing
  if (!applicantName || !applicantEmail) {
    try {
      const { data: b } = await supabase
        .from('bookings')
        .select('*, users:user_id(name, email, role, mobile)')
        .eq('id', bookingId)
        .maybeSingle();

      if (b) {
        applicantName = applicantName || b.applicant_name || b.users?.name;
        applicantRole = applicantRole || b.users?.role || 'Guest';
        applicantEmail = applicantEmail || b.users?.email;
        applicantMobile = applicantMobile || b.mobile_number || b.users?.mobile;
        requestedRoomType = requestedRoomType || b.requested_room_type;
        assignedRoom = assignedRoom || b.assigned_room;
        checkInDate = checkInDate || b.check_in_date;
        checkOutDate = checkOutDate || b.check_out_date;
        totalAmount = totalAmount || b.total_amount;
        paymentStatus = paymentStatus || b.payment_status;
      }
    } catch (e) {}
  }

  // Target Admin Emails: workmail.naim@gmail.com + any active admin in database
  const adminRecipients = new Set(['workmail.naim@gmail.com']);
  try {
    const { data: admins } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'admin');
    if (admins && admins.length > 0) {
      admins.forEach(a => { if (a.email) adminRecipients.add(a.email.trim().toLowerCase()); });
    }
  } catch (e) {}

  const roomLabel = assignedRoom ? `Room ${assignedRoom}` : (requestedRoomType || 'Standard').replace(/_/g, ' ');
  const adminUrl = `${FRONTEND_URL}/admin/bookings`;

  const subject = `Action Required: New Booking Pending Admin Approval - #${bookingId}`;
  const text = `Hello Administrator,\n\nA new Guest House booking application (#${bookingId}) is pending your administrative review and room allocation.\n\nApplicant Details:\n- Name: ${applicantName} (${applicantRole || 'Guest'})\n- Email: ${applicantEmail}\n- Mobile: ${applicantMobile}\n\nStay Details:\n- Room Allocation: ${roomLabel}\n- Schedule: ${checkInDate} to ${checkOutDate}\n- Total Amount: ৳${totalAmount}\n- Payment Status: ${paymentStatus || 'PENDING'}\n\nPlease log in to the Admin Portal to review and approve this reservation:\n${adminUrl}\n\nRUET Guest House Management\nOfficial Sender: workmail.naim@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 26px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 22px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Administration Portal Notification</p>
      </div>

      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin-bottom: 22px;">
        <h3 style="margin: 0; color: #92400e; font-size: 16px; font-weight: 600;">New Booking Pending Admin Action</h3>
        <p style="margin: 4px 0 0; color: #b45309; font-size: 13px;">Booking #${bookingId} requires your administrative review and room allocation.</p>
      </div>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin: 18px 0;">
        <h4 style="margin: 0 0 10px 0; font-size: 13px; color: #1f2937; text-transform: uppercase;">Applicant Profile</h4>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Name:</strong> ${applicantName} <span style="color: #6b7280;">(${applicantRole || 'Guest'})</span></p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Email:</strong> ${applicantEmail}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Mobile:</strong> ${applicantMobile}</p>

        <h4 style="margin: 16px 0 10px 0; font-size: 13px; color: #1f2937; text-transform: uppercase; border-top: 1px solid #e5e7eb; padding-top: 12px;">Stay & Payment</h4>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Room:</strong> ${roomLabel}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Dates:</strong> ${checkInDate} to ${checkOutDate}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Total Amount:</strong> ৳${totalAmount}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Payment:</strong> <span style="font-weight: 600; color: ${paymentStatus === 'PAID' || paymentStatus === 'COMPLETED' ? '#059669' : '#d97706'}">${paymentStatus || 'PENDING'}</span></p>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${adminUrl}" style="display: inline-block; padding: 13px 30px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3);">
          Manage Bookings in Admin Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
        RUET Guest House • Rajshahi University of Engineering & Technology<br/>
        Official Sender: workmail.naim@gmail.com
      </p>
    </div>
  `;

  for (const recipient of adminRecipients) {
    await sendUnifiedEmail({ to: recipient, subject, text, html });
  }
  return { success: true, recipients: [...adminRecipients] };
}

app.post('/api/email/admin-approval-request', async (req, res) => {
  try {
    const result = await dispatchAdminApprovalRequestEmail(req.body);
    res.json({ success: true, message: `Admin approval request dispatched to ${result.recipients.join(', ')}` });
  } catch (err) {
    console.error('[admin-approval-request error]:', err.message);
    res.status(500).json({ error: err.message || 'Failed to send admin approval request' });
  }
});

// ============================================================================
// 6a. Admin Approval Notice Endpoint (Admin approves booking -> Guest)
// ============================================================================
app.post('/api/email/admin-approval-notice', async (req, res) => {
  let { bookingId, guestEmail, guestName, assignedRoom, requestedRoomType, checkInDate, checkOutDate, totalAmount } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  if (!guestEmail) {
    try {
      const { data: b } = await supabase
        .from('bookings')
        .select('*, users:user_id(name, email)')
        .eq('id', bookingId)
        .maybeSingle();
      if (b) {
        guestEmail = b.users?.email || b.applicant_email;
        guestName = guestName || b.applicant_name || b.users?.name;
        assignedRoom = assignedRoom || b.assigned_room;
        requestedRoomType = requestedRoomType || b.requested_room_type;
        checkInDate = checkInDate || b.check_in_date;
        checkOutDate = checkOutDate || b.check_out_date;
        totalAmount = totalAmount || b.total_amount;
      }
    } catch (e) {}
  }

  if (!guestEmail) {
    return res.status(400).json({ error: 'Guest email could not be resolved' });
  }

  const roomLabel = assignedRoom ? (String(assignedRoom).toLowerCase().startsWith('room') ? assignedRoom : `Room ${assignedRoom}`) : (requestedRoomType || 'Room').replace(/_/g, ' ');
  const subject = `Reservation Confirmed: RUET Guest House Booking #${bookingId} Approved`;
  const text = `Dear ${guestName || 'Guest'},\n\nCongratulations! Your reservation at RUET Guest House (Booking #${bookingId}) has been officially APPROVED by the Guest House Administration.\n\nReservation Details:\n- Allocated Room: ${roomLabel}\n- Check-in: ${checkInDate}\n- Check-out: ${checkOutDate}\n- Total Amount: ৳${totalAmount}\n\nPlease present your University ID card or NID upon check-in at the guest house reception.\n\nView your booking online:\n${FRONTEND_URL}/login\n\nThank you,\nRUET Guest House Administration\nOfficial Sender: workmail.naim@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Rajshahi University of Engineering & Technology</p>
      </div>

      <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: #065f46; font-size: 16px; font-weight: 600;">Booking Confirmed & Room Allocated</h3>
        <p style="margin: 4px 0 0; color: #047857; font-size: 13px;">Your reservation has been officially approved by the Guest House Authority.</p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #374151;">Dear <strong>${guestName || 'Guest'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        We are pleased to inform you that your reservation request <strong>#${bookingId}</strong> has been officially confirmed and approved.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 22px 0;">
        <h4 style="margin: 0 0 14px 0; font-size: 14px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Reservation Summary</h4>
        <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
          <tr><td style="padding: 7px 0; color: #64748b;">Booking ID:</td><td style="padding: 7px 0; font-weight: 700; color: #1e293b; text-align: right;">${bookingId}</td></tr>
          <tr><td style="padding: 7px 0; color: #64748b;">Allocated Room:</td><td style="padding: 7px 0; font-weight: 700; color: #4f46e5; font-size: 15px; text-align: right;">${roomLabel}</td></tr>
          <tr><td style="padding: 7px 0; color: #64748b;">Check-in:</td><td style="padding: 7px 0; font-weight: 600; text-align: right;">${checkInDate}</td></tr>
          <tr><td style="padding: 7px 0; color: #64748b;">Check-out:</td><td style="padding: 7px 0; font-weight: 600; text-align: right;">${checkOutDate}</td></tr>
          <tr><td style="padding: 7px 0; color: #64748b;">Total Paid:</td><td style="padding: 7px 0; font-weight: 700; color: #059669; font-size: 15px; text-align: right;">৳${totalAmount}</td></tr>
        </table>
      </div>

      <div style="background-color: #f3f4f6; border-radius: 8px; padding: 14px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 12px; color: #4b5563; line-height: 1.5;">
          <strong>Guest Check-in Instructions:</strong> Please present your valid Institutional ID Card or National ID (NID) upon arrival at the Guest House reception. Check-in time is 12:00 PM.
        </p>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${FRONTEND_URL}/login" style="display: inline-block; padding: 12px 30px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);">
          View Reservation in Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
        RUET Guest House • Rajshahi University of Engineering & Technology<br/>
        Official Sender: workmail.naim@gmail.com
      </p>
    </div>
  `;

  try {
    await sendUnifiedEmail({ to: guestEmail, subject, text, html });
    res.json({ success: true, message: `Admin approval notice sent to guest ${guestEmail}` });
  } catch (err) {
    console.error('[admin-approval-notice error]:', err.message);
    res.status(500).json({ error: 'Failed to send approval email' });
  }
});

// ============================================================================
// 6b. Admin Rejection Notice Endpoint (Admin rejects booking -> Guest)
// ============================================================================
app.post('/api/email/admin-rejection-notice', async (req, res) => {
  let { bookingId, guestEmail, guestName, rejectionReason, refundStatus, totalAmount } = req.body;

  if (!bookingId) {
    return res.status(400).json({ error: 'bookingId is required' });
  }

  if (!guestEmail) {
    try {
      const { data: b } = await supabase
        .from('bookings')
        .select('*, users:user_id(name, email)')
        .eq('id', bookingId)
        .maybeSingle();
      if (b) {
        guestEmail = b.users?.email || b.applicant_email;
        guestName = guestName || b.applicant_name || b.users?.name;
        totalAmount = totalAmount || b.total_amount;
      }
    } catch (e) {}
  }

  if (!guestEmail) {
    return res.status(400).json({ error: 'Guest email could not be resolved' });
  }

  const subject = `Notice Regarding RUET Guest House Booking #${bookingId}`;
  const text = `Dear ${guestName || 'Guest'},\n\nWe regret to inform you that your booking reservation (#${bookingId}) at RUET Guest House could not be approved by the administration.\n\nReason:\n${rejectionReason || 'Room capacity fully booked or reserved for official university event.'}\n\n${refundStatus === 'REFUNDED' || refundStatus === 'SUCCESS' ? `Refund Status: A refund of ৳${totalAmount} has been processed via SSLCommerz.\n\n` : ''}If you have questions, please contact the Guest House Authority.\n\nRUET Guest House Administration\nOfficial Sender: workmail.naim@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #1e3a8a; margin: 0; font-size: 24px; font-weight: 700;">RUET Guest House</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">Rajshahi University of Engineering & Technology</p>
      </div>

      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <h3 style="margin: 0; color: #991b1b; font-size: 16px; font-weight: 600;">Booking Request Cancelled</h3>
        <p style="margin: 4px 0 0; color: #b91c1c; font-size: 13px;">Your reservation could not be accommodated by the Guest House Administration.</p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #374151;">Dear <strong>${guestName || 'Guest'}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
        We regret to inform you that your booking request <strong>#${bookingId}</strong> could not be accommodated at RUET Guest House.
      </p>

      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 16px; margin: 18px 0;">
        <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #9f1239; text-transform: uppercase;">Administrative Note:</h4>
        <p style="margin: 0; font-size: 14px; color: #881337;">${rejectionReason || 'Room unavailable due to administrative priority or capacity.'}</p>
      </div>

      ${refundStatus === 'REFUNDED' || refundStatus === 'SUCCESS' ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 18px 0;">
          <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #065f46; text-transform: uppercase;">Refund Initiated</h4>
          <p style="margin: 0; font-size: 14px; color: #047857;">A full refund of <strong>৳${totalAmount}</strong> has been processed via SSLCommerz to your original payment method.</p>
        </div>
      ` : ''}

      <div style="text-align: center; margin: 26px 0;">
        <a href="${FRONTEND_URL}/login" style="display: inline-block; padding: 12px 28px; background-color: #4b5563; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Return to Portal
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 11px; margin: 0; text-align: center;">
        RUET Guest House • Rajshahi University of Engineering & Technology<br/>
        Official Sender: workmail.naim@gmail.com
      </p>
    </div>
  `;

  try {
    await sendUnifiedEmail({ to: guestEmail, subject, text, html });
    res.json({ success: true, message: `Admin rejection notice sent to guest ${guestEmail}` });
  } catch (err) {
    console.error('[admin-rejection-notice error]:', err.message);
    res.status(500).json({ error: 'Failed to send rejection email' });
  }
});

const fs = require('fs');
const path = require('path');

const TRANSACTIONS_FILE = path.join(__dirname, 'transactions.json');

const loadTransactions = () => {
  try {
    if (fs.existsSync(TRANSACTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading transactions.json:", err);
  }
  return {};
};

const saveTransactions = (data) => {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving transactions.json:", err);
  }
};

app.post('/api/payment/init', async (req, res) => {
  const { amount, applicant_name, user_id, role, email, mobile, item_type, reference_id } = req.body;
  const tran_id = `${reference_id}_${Date.now()}`;

  const transactions = loadTransactions();
  transactions[reference_id] = {
    bookingId: reference_id,
    tranId: tran_id,
    amount: Number(amount),
    itemType: item_type,
    userId: user_id,
    role: role,
    status: 'INITIATED',
    initiatedAt: new Date().toISOString()
  };
  saveTransactions(transactions);

  const data = {
    total_amount: amount,
    currency: 'BDT',
    tran_id: tran_id, // unique tran_id tied to reference
    success_url: `${BACKEND_URL}/api/payment/success?tran_id=${tran_id}&ref=${reference_id}&type=${item_type}&role=${role || 'student'}`,
    fail_url: `${BACKEND_URL}/api/payment/fail?tran_id=${tran_id}&ref=${reference_id}&role=${role || 'student'}`,
    cancel_url: `${BACKEND_URL}/api/payment/cancel?tran_id=${tran_id}&ref=${reference_id}&role=${role || 'student'}`,
    ipn_url: `${BACKEND_URL}/api/payment/ipn`,
    shipping_method: 'No',
    product_name: item_type === 'booking' ? 'Room Booking' : 'Dining Meal',
    product_category: 'Service',
    product_profile: 'general',
    cus_name: applicant_name || 'Guest User',
    cus_email: email || 'test@test.com',
    cus_add1: 'RUET, Rajshahi',
    cus_add2: 'Rajshahi',
    cus_city: 'Rajshahi',
    cus_state: 'Rajshahi',
    cus_postcode: '6204',
    cus_country: 'Bangladesh',
    cus_phone: mobile || '01700000000',
    cus_fax: '01700000000',
    ship_name: applicant_name || 'Guest User',
    ship_add1: 'RUET, Rajshahi',
    ship_add2: 'Rajshahi',
    ship_city: 'Rajshahi',
    ship_state: 'Rajshahi',
    ship_postcode: 6204,
    ship_country: 'Bangladesh',
  };

  if (amount <= 0) {
    // If amount is 0 (e.g. VIP rooms or free bookings), bypass SSLCommerz
    return res.json({ url: `${BACKEND_URL}/api/payment/success?tran_id=${tran_id}&ref=${reference_id}&type=${item_type}&role=${role || 'student'}` });
  }

  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  sslcz.init(data).then(apiResponse => {
    // Redirect the user to payment gateway
    if (apiResponse?.GatewayPageURL) {
      res.json({ url: apiResponse.GatewayPageURL });
    } else {
      res.status(400).json({ error: 'Failed to initialize payment gateway' });
    }
  }).catch(err => {
    console.error("SSLCommerz Init Error:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  });
});

app.all('/api/payment/success', async (req, res) => {
  const tran_id = req.query.tran_id || req.body.tran_id;
  const ref = req.query.ref || req.body.ref;
  const type = req.query.type || req.body.type || 'booking';
  const role = req.query.role || req.body.role || 'student';

  const bank_tran_id = req.body.bank_tran_id || req.query.bank_tran_id;
  const invoice_number = bank_tran_id || req.body.invoice_no;
  const val_id = req.body.val_id || req.query.val_id;
  const amount = req.body.amount || req.query.amount;

  console.log(`[Payment Success] ref=${ref}, tran_id=${tran_id}, invoice_number/bank_tran_id=${invoice_number}, val_id=${val_id}, amount=${amount}`);

  // Save full transaction record including SSLCommerz invoice number / bank_tran_id for refund support
  const transactions = loadTransactions();
  transactions[ref] = {
    ...(transactions[ref] || {}),
    bookingId: ref,
    tranId: tran_id || req.body.tran_id || transactions[ref]?.tranId,
    bankTranId: invoice_number,
    invoiceNumber: invoice_number,
    valId: val_id,
    amount: Number(amount || transactions[ref]?.amount || 0),
    cardType: req.body.card_type || null,
    status: 'COMPLETED',
    paidAt: new Date().toISOString()
  };
  saveTransactions(transactions);

  try {
    if (type === 'booking') {
      const { data: bData } = await supabase
        .from('bookings')
        .update({ payment_status: 'COMPLETED', booking_status: 'CONFIRMED', approval_status: 'PENDING_APPROVAL' })
        .eq('id', ref)
        .select('*')
        .maybeSingle();

      const studentId = bData?.user_id;
      if (studentId) {
        await supabase.from('notifications').insert({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: studentId,
          type: 'success',
          title: 'Payment Received',
          message: `Your payment of ৳${amount || transactions[ref]?.amount || ''} for booking ${ref} was successful.`,
          link: `/${role}/history`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }

      // Notify admin
      await supabase.from('notifications').insert({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: 'admin_1',
        type: 'success',
        title: 'Online Payment Confirmed',
        message: `Online payment of ৳${amount || transactions[ref]?.amount || ''} received for booking ${ref} (${bData?.applicant_name || 'Guest'}).`,
        link: '/admin/payments',
        is_read: false,
        created_at: new Date().toISOString()
      });

      // Dispatch admin approval request email from workmail.naim@gmail.com
      try {
        const { data: bUser } = await supabase.from('users').select('name, email, role, mobile').eq('id', studentId).maybeSingle();
        dispatchAdminApprovalRequestEmail({
          bookingId: ref,
          applicantName: bData?.applicant_name || bUser?.name,
          applicantRole: bUser?.role || role,
          applicantEmail: bUser?.email,
          applicantMobile: bData?.mobile_number || bUser?.mobile,
          requestedRoomType: bData?.requested_room_type,
          assignedRoom: bData?.assigned_room,
          checkInDate: bData?.check_in_date,
          checkOutDate: bData?.check_out_date,
          totalAmount: amount || bData?.total_amount,
          paymentStatus: 'PAID'
        }).catch(e => console.warn('Payment success admin approval email dispatch notice:', e));
      } catch (e) {}
    } else if (type === 'meal') {
      const { data: mData } = await supabase
        .from('meals')
        .update({ payment_status: 'COMPLETED', status: 'PAID' })
        .eq('id', ref)
        .select('*')
        .maybeSingle();

      const studentId = mData?.user_id;
      if (studentId) {
        await supabase.from('notifications').insert({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: studentId,
          type: 'success',
          title: 'Meal Payment Received',
          message: `Your payment for meal request #${ref} was successful.`,
          link: `/${role}/meals`,
          is_read: false,
          created_at: new Date().toISOString()
        });
      }

      // Notify admin
      await supabase.from('notifications').insert({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: 'admin_1',
        type: 'success',
        title: 'Meal Payment Confirmed',
        message: `Online payment received for meal #${ref} (${mData?.applicant_name || 'Guest'}).`,
        link: '/admin/meals',
        is_read: false,
        created_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Supabase update error:", error);
  }

  res.redirect(`${FRONTEND_URL}/${role}/booking-success?ref=${ref}&type=${type}`);
});

app.all('/api/payment/fail', (req, res) => {
  const role = req.query.role || req.body.role || 'student';
  res.redirect(`${FRONTEND_URL}/${role}/payment?payment=fail`);
});

app.all('/api/payment/cancel', (req, res) => {
  const role = req.query.role || req.body.role || 'student';
  res.redirect(`${FRONTEND_URL}/${role}/payment?payment=cancel`);
});

// Refund Endpoint - Initiates refund with SSLCommerz and updates Supabase for Bookings & Meals
app.post('/api/payment/refund', async (req, res) => {
  try {
    const { bookingId, mealId, invoiceNumber, amount, reason, bankTranId } = req.body;
    const targetMealId = mealId || (bookingId && bookingId.startsWith('MEAL-') ? bookingId : null);
    const targetBookingId = (!targetMealId && bookingId && !bookingId.startsWith('MEAL-')) ? bookingId : null;

    if (!targetBookingId && !targetMealId && !invoiceNumber && !bankTranId) {
      return res.status(400).json({ error: 'bookingId, mealId, or invoiceNumber is required' });
    }

    console.log(`[Refund Requested] bookingId: ${bookingId}, mealId: ${mealId}, targetMealId: ${targetMealId}, targetBookingId: ${targetBookingId}, amount: ${amount}, reason: ${reason}`);

    let booking = null;
    let meal = null;

    if (targetBookingId) {
      const { data, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', targetBookingId)
        .maybeSingle();
      if (!bError && data) booking = data;
    } else if (targetMealId) {
      const { data, error: mError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', targetMealId)
        .maybeSingle();
      if (!mError && data) meal = data;

      if (meal && (meal.status === 'APPROVED' || meal.status === 'SERVED')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Approved meals cannot be refunded.' 
        });
      }
    }

    const targetRef = targetMealId || targetBookingId;
    const refundAmount = Number(amount || meal?.total_amount || booking?.total_amount || 0);
    const transactions = loadTransactions();
    const tx = (targetRef && transactions[targetRef]) || {};

    let resolvedBankTranId = bankTranId || invoiceNumber || tx.bankTranId || tx.invoiceNumber;

    // If bankTranId is missing, attempt querying SSLCommerz by tranId or reference
    if (!resolvedBankTranId && (tx.tranId || targetRef)) {
      try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const searchId = tx.tranId || targetRef;
        const qRes = await sslcz.transactionQueryByTransactionId({ tran_id: searchId });
        if (qRes?.element && qRes.element[0]?.bank_tran_id && qRes.element[0]?.status !== 'INVALID') {
          resolvedBankTranId = qRes.element[0].bank_tran_id;
          tx.bankTranId = resolvedBankTranId;
          saveTransactions(transactions);
        }
      } catch (qErr) {
        console.error("Query transaction error during refund:", qErr);
      }
    }

    let sslRefundResult = null;
    let sslRefundSuccess = false;

    // 2. If bank_tran_id is available, call SSLCommerz initiateRefund API
    if (resolvedBankTranId && refundAmount > 0) {
      try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const refundPayload = {
          refund_amount: refundAmount,
          refund_remarks: reason || (targetMealId ? 'Meal cancellation refund' : 'Booking cancellation refund'),
          bank_tran_id: resolvedBankTranId,
          refe_id: `REF_${targetRef}_${Date.now()}`
        };

        console.log(`[SSLCommerz initiateRefund Sending]`, refundPayload);
        sslRefundResult = await sslcz.initiateRefund(refundPayload);
        console.log(`[SSLCommerz initiateRefund Response]`, sslRefundResult);

        if (sslRefundResult?.status === 'success') {
          sslRefundSuccess = true;
          tx.refundStatus = 'SUCCESS';
          tx.refundRefId = sslRefundResult.refund_ref_id;
          tx.refundedAmount = refundAmount;
          tx.refundedAt = new Date().toISOString();
          saveTransactions(transactions);
        } else {
          console.warn("[SSLCommerz Refund Note]", sslRefundResult?.errorReason || sslRefundResult);
        }
      } catch (refundErr) {
        console.error("SSLCommerz refund exception:", refundErr);
      }
    } else {
      console.warn(`[Refund] Bank transaction ID not found for ${targetRef}. Marking refunded in RUET Guest House system.`);
    }

    // 3. Update Supabase and send notifications
    if (targetMealId) {
      // Meal Refund in Supabase
      await supabase
        .from('meals')
        .update({
          status: 'REFUNDED',
          payment_status: 'REFUNDED'
        })
        .eq('id', targetMealId);

      try {
        await supabase.from('notifications').insert({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: 'admin_1',
          type: 'warning',
          title: 'Meal Order Refunded',
          message: `Meal #${targetMealId} (${meal?.applicant_name || 'Guest'}) has been cancelled and refunded ৳${refundAmount}.`,
          link: '/admin/meals',
          is_read: false,
          created_at: new Date().toISOString()
        });

        if (meal?.user_id) {
          const userRole = meal.user_role === 'teacher' ? 'teacher' : 'student';
          await supabase.from('notifications').insert({
            id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            user_id: meal.user_id,
            type: 'warning',
            title: 'Meal Cancelled & Refunded',
            message: `Your meal request #${targetMealId} (${meal.meal_type}) has been cancelled and refund of ৳${refundAmount} has been processed.`,
            link: `/${userRole}/meals`,
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      } catch (notifErr) {
        console.warn("Meal refund notification error:", notifErr);
      }
    } else if (targetBookingId) {
      // Booking Refund in Supabase
      await supabase
        .from('bookings')
        .update({
          booking_status: 'CANCELLED',
          approval_status: 'CANCELLED',
          payment_status: 'REFUNDED'
        })
        .eq('id', targetBookingId);

      // Free up room if assigned
      if (booking?.assigned_room) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', booking.assigned_room);
      }

      // Create notifications for admin and user
      try {
        await supabase.from('notifications').insert({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: 'admin_1',
          type: 'warning',
          title: 'Booking Refunded & Cancelled',
          message: `Booking ${targetBookingId} (${booking?.applicant_name || 'Guest'}) has been cancelled and refunded ৳${refundAmount}.`,
          link: '/admin/bookings',
          is_read: false,
          created_at: new Date().toISOString()
        });

        if (booking?.user_id) {
          await supabase.from('notifications').insert({
            id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            user_id: booking.user_id,
            type: 'warning',
            title: 'Booking Cancelled & Refunded',
            message: `Your booking ${targetBookingId} has been cancelled and refund of ৳${refundAmount} has been processed.`,
            link: '/student/history',
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      } catch (notifErr) {
        console.warn("Refund notification error:", notifErr);
      }
    }

    return res.json({
      success: true,
      refundedInSSLCommerz: sslRefundSuccess,
      message: sslRefundSuccess
        ? `Refund of ৳${refundAmount} has been successfully processed with SSLCommerz.`
        : `${targetMealId ? 'Meal' : 'Booking'} marked as refunded (SSLCommerz note: ${sslRefundResult?.errorReason || (resolvedBankTranId ? 'Processed' : 'Bank transaction ID pending')}).`,
      refundResult: sslRefundResult
    });
  } catch (err) {
    console.error("Refund handler error:", err);
    res.status(500).json({ error: 'Failed to process refund', details: err.message });
  }
});

// Cash Verification Endpoint - Marks booking as paid and confirmed across system
app.post('/api/payment/verify-cash', async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required' });
    }

    console.log(`[Verify Cash] bookingId: ${bookingId}`);

    // 1. Update Supabase booking: payment_status: 'PAID', booking_status: 'CONFIRMED', approval_status: 'APPROVED'
    const { data: booking, error: bError } = await supabase
      .from('bookings')
      .update({
        payment_status: 'PAID',
        booking_status: 'CONFIRMED',
        approval_status: 'APPROVED'
      })
      .eq('id', bookingId)
      .select('*, guests(*)')
      .single();

    if (bError) {
      console.error("Supabase error during cash verify:", bError);
      throw bError;
    }

    // 2. If room assigned, mark room as occupied
    if (booking?.assigned_room) {
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('room_number', booking.assigned_room);
    }

    // 3. Record in backend transactions.json
    const transactions = loadTransactions();
    transactions[bookingId] = {
      ...(transactions[bookingId] || {}),
      bookingId: bookingId,
      tranId: `CASH_${bookingId}_${Date.now()}`,
      bankTranId: 'CASH_VERIFIED',
      invoiceNumber: `CASH_${bookingId}`,
      amount: Number(booking?.total_amount || 0),
      paymentMethod: 'CASH',
      status: 'COMPLETED',
      paidAt: new Date().toISOString()
    };
    saveTransactions(transactions);

    // 4. Create notifications for student and admin
    try {
      if (booking?.user_id) {
        await supabase.from('notifications').insert({
          id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          user_id: booking.user_id,
          type: 'success',
          title: 'Cash Payment Verified',
          message: `Your cash payment for booking ${bookingId} has been verified and confirmed.`,
          link: '/student/history',
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
      await supabase.from('notifications').insert({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        user_id: 'admin_1',
        type: 'success',
        title: 'Cash Payment Verified',
        message: `Cash payment for booking ${bookingId} (${booking?.applicant_name || 'Guest'}) has been verified.`,
        link: '/admin/payments',
        is_read: false,
        created_at: new Date().toISOString()
      });
    } catch (notifErr) {
      console.warn("Cash verify notification error:", notifErr);
    }

    return res.json({
      success: true,
      message: `Booking ${bookingId} marked as verified and paid via Cash.`,
      booking
    });
  } catch (err) {
    console.error("Error verifying cash payment:", err);
    return res.status(500).json({ error: 'Failed to verify cash payment', details: err.message });
  }
});

// Helper to parse date string + time string into a valid Date object
function parseDateTime(dateStr, timeStr, defaultTime = '12:00') {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim().split('T')[0];
  let hours = 12;
  let minutes = 0;
  
  if (timeStr && typeof timeStr === 'string') {
    const rawTime = timeStr.trim().toLowerCase();
    const isPM = rawTime.includes('pm');
    const isAM = rawTime.includes('am');
    const cleanTime = rawTime.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    if (parts.length >= 1) {
      hours = parseInt(parts[0], 10) || 0;
      if (parts.length >= 2) {
        minutes = parseInt(parts[1], 10) || 0;
      }
      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;
    }
  } else if (defaultTime) {
    const parts = defaultTime.split(':');
    hours = parseInt(parts[0], 10) || 12;
    minutes = parseInt(parts[1], 10) || 0;
  }
  
  const d = new Date(cleanDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Room synchronization engine: checks active stays vs checkout times
async function syncRoomAvailability() {
  try {
    const { data: bookings, error: bErr } = await supabase.from('bookings').select('*');
    const { data: rooms, error: rErr } = await supabase.from('rooms').select('*');

    if (bErr || rErr || !rooms || !bookings) return;

    const now = new Date();
    const activeOccupiedRooms = new Set();
    const expiredBookingIds = [];

    bookings.forEach(b => {
      // Exclude cancelled or rejected bookings
      if (
        b.booking_status === 'CANCELLED' ||
        b.approval_status === 'CANCELLED' ||
        b.approval_status === 'REJECTED' ||
        b.approval_status === 'REJECTED_BY_TEACHER'
      ) {
        return;
      }

      if (!b.assigned_room) return;
      const isConfirmed = (b.booking_status === 'CONFIRMED' || b.approval_status === 'APPROVED');
      if (!isConfirmed) return;

      const checkIn = parseDateTime(b.check_in_date, b.check_in_time, '12:00');
      const checkOut = parseDateTime(b.check_out_date || b.check_in_date, b.check_out_time, '12:00');

      if (checkOut) {
        if (now < checkOut) {
          // Booking is NOT expired! The room is occupied/reserved by this booking.
          activeOccupiedRooms.add(String(b.assigned_room).trim());
        } else {
          // Checkout time has elapsed (now >= checkOut): Booking IS expired.
          if (b.booking_status === 'CONFIRMED') {
            expiredBookingIds.push(b.id);
          }
        }
      }
    });

    const roomsToMakeAvailable = [];
    const roomsToMakeOccupied = [];

    rooms.forEach(room => {
      const roomNum = String(room.room_number).trim();
      // Preserve manual maintenance status
      if (room.status === 'maintenance') return;

      const shouldBeOccupied = activeOccupiedRooms.has(roomNum);

      if (!shouldBeOccupied && room.status === 'occupied') {
        roomsToMakeAvailable.push(roomNum);
      } else if (shouldBeOccupied && room.status !== 'occupied') {
        roomsToMakeOccupied.push(roomNum);
      }
    });

    if (roomsToMakeAvailable.length > 0) {
      console.log(`[Auto-Sync] Check-out elapsed. Making rooms available:`, roomsToMakeAvailable);
      await supabase
        .from('rooms')
        .update({ status: 'available' })
        .in('room_number', roomsToMakeAvailable);
    }

    if (roomsToMakeOccupied.length > 0) {
      console.log(`[Auto-Sync] Active check-in reached. Making rooms occupied:`, roomsToMakeOccupied);
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .in('room_number', roomsToMakeOccupied);
    }

    if (expiredBookingIds.length > 0) {
      await supabase
        .from('bookings')
        .update({ booking_status: 'COMPLETED' })
        .in('id', expiredBookingIds);
    }

    return {
      syncedAt: now.toISOString(),
      roomsMadeAvailable: roomsToMakeAvailable,
      roomsMadeOccupied: roomsToMakeOccupied,
      expiredBookings: expiredBookingIds
    };
  } catch (err) {
    console.error("[Auto-Sync Error]", err);
  }
}

// Room synchronization endpoint
app.all('/api/rooms/sync-availability', async (req, res) => {
  const result = await syncRoomAvailability();
  res.json({ success: true, result });
});

// Transaction query endpoint
app.get('/api/payment/transactions', (req, res) => {
  res.json(loadTransactions());
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  // Initial sync on launch & recurring every 30 seconds
  syncRoomAvailability();
  setInterval(syncRoomAvailability, 30000);
});
