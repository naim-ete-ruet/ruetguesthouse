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

// Forgot Password API Endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // In a real app, you would verify if the user exists in Supabase here
  // and generate a unique secure reset token.
  // For this demo, we'll send a direct placeholder link.
  
  const resetLink = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(email)}`;

  const mailOptions = {
    from: `"RUET Guest House" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    text: `Hello,\n\nWe received a request to reset your password for the RUET Guest House portal.\n\nPlease copy and paste the following link into your browser to reset your password:\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1f2937;">Password Reset Request</h2>
        <p style="color: #4b5563;">Hello,</p>
        <p style="color: #4b5563;">We received a request to reset your password for the RUET Guest House portal.</p>
        <p style="color: #4b5563;">Click the button below to reset your password:</p>
        <div style="margin: 30px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #4b5563; font-size: 14px;">If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${resetLink}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error("Nodemailer error:", error);
    res.status(500).json({ error: 'Failed to send email. Check your SMTP configuration in .env' });
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
      await supabase
        .from('bookings')
        .update({ payment_status: 'COMPLETED', booking_status: 'CONFIRMED', approval_status: 'PENDING_APPROVAL' })
        .eq('id', ref);
    } else if (type === 'meal') {
      await supabase
        .from('meals')
        .update({ payment_status: 'COMPLETED', status: 'CONFIRMED' })
        .eq('id', ref);
    }
  } catch (error) {
    console.error("Supabase update error:", error);
  }

  res.redirect(`${FRONTEND_URL}/${role}/booking-success?ref=${ref}`);
});

app.all('/api/payment/fail', (req, res) => {
  const role = req.query.role || req.body.role || 'student';
  res.redirect(`${FRONTEND_URL}/${role}/payment?payment=fail`);
});

app.all('/api/payment/cancel', (req, res) => {
  const role = req.query.role || req.body.role || 'student';
  res.redirect(`${FRONTEND_URL}/${role}/payment?payment=cancel`);
});

// Refund Endpoint - Initiates refund with SSLCommerz and updates Supabase
app.post('/api/payment/refund', async (req, res) => {
  try {
    const { bookingId, invoiceNumber, amount, reason, bankTranId } = req.body;
    if (!bookingId && !invoiceNumber && !bankTranId) {
      return res.status(400).json({ error: 'bookingId or invoiceNumber is required' });
    }

    console.log(`[Refund Requested] bookingId: ${bookingId}, invoiceNumber: ${invoiceNumber}, amount: ${amount}, reason: ${reason}`);

    // 1. Fetch booking details from Supabase if bookingId is provided
    let booking = null;
    if (bookingId) {
      const { data, error: bError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();
      if (!bError && data) booking = data;
    }

    const refundAmount = Number(amount || booking?.total_amount || 0);
    const transactions = loadTransactions();
    const tx = (bookingId && transactions[bookingId]) || {};

    let resolvedBankTranId = bankTranId || invoiceNumber || tx.bankTranId || tx.invoiceNumber;

    // If bankTranId is missing, attempt querying SSLCommerz by tranId or bookingId
    if (!resolvedBankTranId && (tx.tranId || bookingId)) {
      try {
        const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
        const searchId = tx.tranId || bookingId;
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
          refund_remarks: reason || 'Booking cancellation refund',
          bank_tran_id: resolvedBankTranId,
          refe_id: `REF_${bookingId}_${Date.now()}`
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
      console.warn(`[Refund] Bank transaction ID not found for ${bookingId}. Marking cancelled in RUET Guest House system.`);
    }

    // 3. Update Supabase: paymentStatus -> REFUNDED, bookingStatus -> CANCELLED
    if (bookingId) {
      await supabase
        .from('bookings')
        .update({
          booking_status: 'CANCELLED',
          approval_status: 'CANCELLED',
          payment_status: 'REFUNDED'
        })
        .eq('id', bookingId);

      // 4. Free up room if assigned
      if (booking?.assigned_room) {
        await supabase
          .from('rooms')
          .update({ status: 'available' })
          .eq('room_number', booking.assigned_room);
      }
    }

    return res.json({
      success: true,
      refundedInSSLCommerz: sslRefundSuccess,
      message: sslRefundSuccess
        ? `Refund of ৳${refundAmount} has been successfully processed with SSLCommerz.`
        : `Booking cancelled and marked as refunded (SSLCommerz note: ${sslRefundResult?.errorReason || (resolvedBankTranId ? 'Processed' : 'Bank transaction ID pending')}).`,
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

// Transaction query endpoint
app.get('/api/payment/transactions', (req, res) => {
  res.json(loadTransactions());
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`SSLCommerz Backend running on http://localhost:${PORT}`);
});
