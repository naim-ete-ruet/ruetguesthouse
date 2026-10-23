require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const SSLCommerzPayment = require('sslcommerz-lts');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
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

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this or use SMTP host/port for custom domains
  auth: {
    user: process.env.EMAIL_USER, // e.g., your-email@gmail.com
    pass: process.env.EMAIL_PASS  // e.g., your 16-character App Password
  }
});

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

  const mailOptions = {
    from: `"RUET Guest House" <${process.env.EMAIL_USER}>`,
    to: normalizedEmail,
    subject: `RUET Guest House - Your Password Reset OTP: ${otp}`,
    text: `Hello ${user.name || 'User'},\n\nYour One-Time Password (OTP) to reset your RUET Guest House account password is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0; font-size: 22px;">RUET Guest House</h2>
          <p style="color: #6b7280; font-size: 13px; margin-top: 4px;">Rajshahi University of Engineering & Technology</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <h3 style="color: #1f2937; margin-top: 0; font-size: 18px;">Password Reset Verification Code</h3>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">Hello <strong>${user.name || 'User'}</strong>,</p>
        <p style="color: #4b5563; font-size: 14px; line-height: 1.5;">We received a request to reset your account password. Please use the following 6-digit One-Time Password (OTP) to continue:</p>
        <div style="background-color: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a;">${otp}</span>
        </div>
        <p style="color: #dc2626; font-size: 13px; margin-bottom: 20px;">* This code will expire in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">If you did not make this request, you can safely ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log(`[OTP] Sent password reset OTP to ${normalizedEmail}`);
  return { otp, user };
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

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
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

  const mailOptions = {
    from: `"RUET Guest House" <${process.env.EMAIL_USER}>`,
    to: teacherEmail,
    subject: 'New Guest House Approval Request',
    text: `Hello ${teacherName},\n\nYou have a new Guest House booking approval request from ${applicantName} (${applicantMobile}).\nDates: ${checkInDate} to ${checkOutDate}\nPlease log in to the RUET Guest House portal to review and approve this request.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
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
            ${guestHtml}
          </ul>
        </div>
        
        <p style="color: #4b5563;">Please log in to the RUET Guest House portal to review and approve/reject this request.</p>
        <div style="margin: 30px 0;">
          <a href="${FRONTEND_URL}/teacher/login" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Portal</a>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Teacher approval email sent successfully to: ${teacherEmail}`);
    res.json({ message: 'Approval request email sent to the teacher.' });
  } catch (error) {
    console.error("Nodemailer error:", error);
    res.status(500).json({ error: 'Failed to send email to teacher.' });
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
    success_url: `http://localhost:5000/api/payment/success?tran_id=${tran_id}&ref=${reference_id}&type=${item_type}&role=${role || 'student'}`,
    fail_url: `http://localhost:5000/api/payment/fail?tran_id=${tran_id}&ref=${reference_id}&role=${role || 'student'}`,
    cancel_url: `http://localhost:5000/api/payment/cancel?tran_id=${tran_id}&ref=${reference_id}&role=${role || 'student'}`,
    ipn_url: 'http://localhost:5000/api/payment/ipn',
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
    return res.json({ url: `http://localhost:5000/api/payment/success?tran_id=${tran_id}&ref=${reference_id}&type=${item_type}&role=${role || 'student'}` });
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
          read: false,
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
        read: false,
        created_at: new Date().toISOString()
      });
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
          read: false,
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
        read: false,
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
          read: false,
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
            read: false,
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
          read: false,
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
            read: false,
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
          read: false,
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
        read: false,
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

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`SSLCommerz Backend running on http://localhost:${PORT}`);
  // Initial sync on launch & recurring every 30 seconds
  syncRoomAvailability();
  setInterval(syncRoomAvailability, 30000);
});
